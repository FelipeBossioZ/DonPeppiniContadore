# ============================================================================
# 🎩 Don Peppini Contadore - NUEVAS VISTAS
# Flujo de Efectivo v2 + Preview Impuestos + Importar Contabilidad Preview
# ============================================================================

from rest_framework import views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from decimal import Decimal
from datetime import date, datetime
import pandas as pd

from .models import (
    Cuenta, AsientoContable, MovimientoContable,
    CierreContable
)

try:
    from empresas.models import Empresa
except ImportError:
    Empresa = None

try:
    from terceros.models import Tercero
except ImportError:
    Tercero = None


# ============================================================================
# 1. FLUJO DE EFECTIVO V2 — Modelo Bota & Brota (Variaciones + Clasificación)
# ============================================================================

def clasificar_cuenta(codigo):
    """
    Clasifica una cuenta PUC para el Estado de Flujos de Efectivo.
    
    Categorías:
    - VERIF:  Efectivo (lo que estamos explicando)
    - CTNO-A: Capital de Trabajo Neto Operativo - Activos corrientes operativos
    - CTNO-P: Capital de Trabajo Neto Operativo - Pasivos corrientes operativos
    - NO-EF:  Partidas que no afectan efectivo (depreciación acumulada, provisiones)
    - EAI:    Efectivo en Actividades de Inversión
    - EAF:    Efectivo en Actividades de Financiación
    """
    c = str(codigo).strip()

    # ---- CLASE 1: ACTIVOS ----
    if c.startswith('11'):
        return 'VERIF'

    # Depreciación acumulada → NO-EF (no afecta efectivo, reversar en EGO)
    if c.startswith('1592') or c.startswith('1598') or c.startswith('1699'):
        return 'NO-EF'

    # Provisiones de activos → CTNO-A (neta con el activo)
    # 1499 prov inventarios se maneja como parte del CTNO
    if c.startswith('1499'):
        return 'CTNO-A'

    # PPE bruto (sin depreciación) → EAI
    if c.startswith('15'):
        return 'EAI'

    # Intangibles → EAI
    if c.startswith('16'):
        return 'EAI'

    # Inversiones → EAI
    if c.startswith('12'):
        return 'EAI'

    # Diferidos: 17xx
    # Gastos pagados por anticipado (corto plazo) → CTNO-A
    # Pero si es inversión grande (software >12m), el profesor lo pone como EAI
    # Para el sistema automático, lo dejamos como CTNO-A por defecto
    # (el usuario puede reclasificar si quiere)
    if c.startswith('17'):
        return 'CTNO-A'

    # Otros activos largo plazo → EAI
    if c.startswith('18') or c.startswith('19'):
        return 'EAI'

    # Deudores (13xx), Inventarios (14xx) → CTNO-A
    if c.startswith('1'):
        return 'CTNO-A'

    # ---- CLASE 2: PASIVOS ----
    # Obligaciones financieras → EAF
    if c.startswith('21'):
        return 'EAF'

    # Proveedores, CxP, Retenciones, Impuestos, Obl. Laborales → CTNO-P
    if c.startswith('22') or c.startswith('23') or c.startswith('24') or c.startswith('25') or c.startswith('26'):
        return 'CTNO-P'

    # Otros pasivos largo plazo → EAF
    if c.startswith('2'):
        return 'EAF'

    # ---- CLASE 3: PATRIMONIO ----
    # Todo patrimonio → EAF (excepto resultado del ejercicio actual, que se excluye aparte)
    if c.startswith('3'):
        return 'EAF'

    return 'OTRO'


def agrupar_nombre_ctno(codigo):
    """Agrupa las cuentas CTNO por nombre legible para el flujo."""
    c = str(codigo).strip()
    if c.startswith('1305'):
        return 'Deudores comerciales'
    if c.startswith('1355'):
        return 'Anticipos de impuestos (Rtefuente, ReteIVA)'
    if c.startswith('140') or c.startswith('1499'):
        return 'Inventarios'
    if c.startswith('2408') and c[4:6] == '10':
        return 'IVA descontable'
    if c.startswith('17'):
        return 'Gastos pagados por anticipado'
    if c.startswith('13'):
        return 'Otros deudores'
    if c.startswith('2205'):
        return 'Proveedores'
    if c.startswith('2365') or c.startswith('2367'):
        return 'Retenciones por pagar'
    if c.startswith('237'):
        return 'Aportes seguridad social'
    if c.startswith('2408'):
        return 'IVA por pagar'
    if c.startswith('24'):
        return 'Otros impuestos'
    if c.startswith('2505'):
        return 'Salarios por pagar'
    if c.startswith('251') or c.startswith('252'):
        return 'Obligaciones laborales (prestaciones)'
    if c.startswith('25'):
        return 'Otras obligaciones laborales'
    if c.startswith('23'):
        return 'Cuentas por pagar'
    if c.startswith('26'):
        return 'Pasivos estimados y provisiones'
    return f'Otros ({c[:2]}xx)'


class EstadoFlujosEfectivoV2View(views.APIView):
    """
    🎩 Estado de Flujos de Efectivo - Método Indirecto v2
    Modelo basado en análisis de variaciones (estilo universidad/Oscar León García)
    
    Retorna:
    - variaciones: detalle cuenta por cuenta con clasificación
    - flujo: EAO (EGO + Var CTNO) + EAI + EAF + verificación
    
    GET /api/contabilidad/niif/flujos-efectivo-v2/?empresa=X&fecha_inicio=Y&fecha_fin=Z
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')

        if not all([empresa_id, fecha_inicio, fecha_fin]):
            return Response({'error': 'empresa, fecha_inicio y fecha_fin son requeridos'}, status=400)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)

        # ====================================================================
        # PASO 1: Calcular saldos por cuenta (iniciales y finales)
        # ====================================================================
        # Solo cuentas de balance (clases 1, 2, 3) que sean auxiliares (nivel más bajo)
        cuentas_balance = Cuenta.objects.filter(
            empresa=empresa,
            activa=True,
        ).filter(
            Q(codigo__startswith='1') | Q(codigo__startswith='2') | Q(codigo__startswith='3')
        ).order_by('codigo')

        variaciones = []

        for cuenta in cuentas_balance:
            # Saldo Inicial: todo lo anterior a fecha_inicio
            si = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__lt=fecha_inicio,
                asiento__estado='vigente',
                cuenta=cuenta
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )

            # Saldo Final: todo hasta fecha_fin (inclusive)
            sf = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta=cuenta
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )

            # Saldo neto (débitos - créditos): positivo=saldo deudor, negativo=saldo acreedor
            saldo_ini = si['d'] - si['c']
            saldo_fin = sf['d'] - sf['c']
            variacion = saldo_fin - saldo_ini

            # Excluir cuentas sin movimiento
            if saldo_ini == 0 and saldo_fin == 0:
                continue

            clasif = clasificar_cuenta(cuenta.codigo)

            # Efecto sobre el efectivo
            if clasif == 'VERIF':
                efecto = Decimal('0')  # La variación de caja es lo que estamos probando
            else:
                efecto = Decimal('0')  # Se maneja en las secciones del flujo

            variaciones.append({
                'codigo': cuenta.codigo,
                'nombre': cuenta.nombre,
                'saldo_inicial': float(saldo_ini),
                'saldo_final': float(saldo_fin),
                'variacion': float(variacion),
                'clasificacion': clasif,
            })

        # ====================================================================
        # PASO 2: Calcular Resultado Neto del Período (desde P&L)
        # ====================================================================
        def saldo_pl(clase_inicio):
            """Saldo neto de una clase de P&L en el período"""
            movs = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=clase_inicio
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            return movs

        ing = saldo_pl('4')
        gas = saldo_pl('5')
        cos = saldo_pl('6')

        ingresos = ing['c'] - ing['d']
        gastos = gas['d'] - gas['c']
        costos = cos['d'] - cos['c']
        resultado_neto = ingresos - gastos - costos

        # ====================================================================
        # PASO 3: Partidas que NO afectan efectivo (NO-EF)
        # Depreciation, amortization, provisions → add back to EGO
        # ====================================================================
        # Método 1: Desde las cuentas de P&L (más preciso)
        def gasto_no_efectivo(prefijo):
            """Suma gastos de P&L que no son salida de efectivo"""
            movs = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=prefijo
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            return movs['d'] - movs['c']  # Gasto = saldo débito

        # Depreciaciones (51450x, 52045x etc.)
        dep_admin = gasto_no_efectivo('5145')
        dep_ventas = gasto_no_efectivo('5245')
        depreciacion_total = dep_admin + dep_ventas

        # Amortizaciones (5150xx, 5250xx)
        amort_admin = gasto_no_efectivo('5150')
        amort_ventas = gasto_no_efectivo('5250')
        amortizacion_total = amort_admin + amort_ventas

        # Provisiones (5155xx, 5255xx, 5299xx)
        prov_admin = gasto_no_efectivo('5155')
        prov_ventas = gasto_no_efectivo('5255')
        prov_otros = gasto_no_efectivo('5299')
        provisiones_total = prov_admin + prov_ventas + prov_otros

        # Si no encontramos nada en P&L, intentar desde las contrapartidas de balance
        if depreciacion_total == 0 and amortizacion_total == 0 and provisiones_total == 0:
            # Fallback: usar variaciones de cuentas NO-EF del balance
            for v in variaciones:
                if v['clasificacion'] == 'NO-EF':
                    # Variación de depreciación acumulada (crédito → negativa en nuestro sistema)
                    # Reversar para que sea positiva (add-back)
                    val = Decimal(str(v['variacion'])) * -1
                    if v['codigo'].startswith('1592'):
                        depreciacion_total += val
                    elif v['codigo'].startswith('1499'):
                        provisiones_total += val
                    else:
                        amortizacion_total += val

        partidas_no_efectivo = []
        if depreciacion_total != 0:
            partidas_no_efectivo.append({
                'concepto': 'Depreciaciones',
                'valor': float(depreciacion_total)
            })
        if amortizacion_total != 0:
            partidas_no_efectivo.append({
                'concepto': 'Amortizaciones',
                'valor': float(amortizacion_total)
            })
        if provisiones_total != 0:
            partidas_no_efectivo.append({
                'concepto': 'Provisiones',
                'valor': float(provisiones_total)
            })

        total_no_efectivo = depreciacion_total + amortizacion_total + provisiones_total
        ego = resultado_neto + total_no_efectivo  # Efectivo Generado por la Operación

        # ====================================================================
        # PASO 4: Variación del CTNO (Capital de Trabajo Neto Operativo)
        # ====================================================================
        from collections import OrderedDict
        ctno_grupos = OrderedDict()

        for v in variaciones:
            if v['clasificacion'] not in ('CTNO-A', 'CTNO-P'):
                continue
            grupo = agrupar_nombre_ctno(v['codigo'])
            if grupo not in ctno_grupos:
                ctno_grupos[grupo] = Decimal('0')
            # Efecto = -variación
            # Activo sube → cash sale (negativo)
            # Pasivo sube → cash entra (positivo, pero variación es negativa, -(-x) = +x)
            ctno_grupos[grupo] += Decimal(str(v['variacion'])) * -1

        variacion_ctno_detalle = []
        variacion_ctno_total = Decimal('0')
        for nombre, efecto in ctno_grupos.items():
            variacion_ctno_detalle.append({
                'concepto': nombre,
                'valor': float(efecto)
            })
            variacion_ctno_total += efecto

        total_eao = ego + variacion_ctno_total

        # ====================================================================
        # PASO 5: Actividades de Inversión (EAI)
        # ====================================================================
        eai_detalle = []
        total_eai = Decimal('0')

        # Agrupar por cuenta principal
        eai_items = {}
        for v in variaciones:
            if v['clasificacion'] != 'EAI':
                continue
            # Para EAI usamos -variación como efecto en efectivo
            efecto = Decimal(str(v['variacion'])) * -1
            nombre = v['nombre']
            # Agrupar PPE
            if v['codigo'].startswith('15'):
                grupo = 'Propiedad, Planta y Equipo'
            elif v['codigo'].startswith('12'):
                grupo = 'Inversiones'
            elif v['codigo'].startswith('16'):
                grupo = 'Intangibles'
            elif v['codigo'].startswith('17'):
                grupo = 'Diferidos (inversión)'
            elif v['codigo'].startswith('18') or v['codigo'].startswith('19'):
                grupo = 'Otros activos largo plazo'
            else:
                grupo = nombre

            if grupo not in eai_items:
                eai_items[grupo] = Decimal('0')
            eai_items[grupo] += efecto

        for nombre, efecto in eai_items.items():
            if efecto != 0:
                eai_detalle.append({
                    'concepto': nombre,
                    'valor': float(efecto)
                })
                total_eai += efecto

        # ====================================================================
        # PASO 6: Actividades de Financiación (EAF)
        # ====================================================================
        eaf_detalle = []
        total_eaf = Decimal('0')

        eaf_items = {}
        for v in variaciones:
            if v['clasificacion'] != 'EAF':
                continue
            efecto = Decimal(str(v['variacion'])) * -1
            if v['codigo'].startswith('21'):
                grupo = 'Obligaciones financieras'
            elif v['codigo'].startswith('31'):
                grupo = 'Aportes de capital'
            elif v['codigo'].startswith('36') or v['codigo'].startswith('37'):
                grupo = 'Resultados de ejercicios anteriores'
            elif v['codigo'].startswith('35'):
                grupo = 'Dividendos y participaciones'
            elif v['codigo'].startswith('32'):
                grupo = 'Superávit de capital'
            elif v['codigo'].startswith('33'):
                grupo = 'Reservas'
            else:
                grupo = 'Otros patrimonio/pasivos LP'

            if grupo not in eaf_items:
                eaf_items[grupo] = Decimal('0')
            eaf_items[grupo] += efecto

        for nombre, efecto in eaf_items.items():
            if efecto != 0:
                eaf_detalle.append({
                    'concepto': nombre,
                    'valor': float(efecto)
                })
                total_eaf += efecto

        # ====================================================================
        # PASO 7: Verificación
        # ====================================================================
        variacion_efectivo_calculada = total_eao + total_eai + total_eaf

        # Efectivo real
        efectivo_items = [v for v in variaciones if v['clasificacion'] == 'VERIF']
        efectivo_inicial = sum(Decimal(str(v['saldo_inicial'])) for v in efectivo_items)
        efectivo_final = sum(Decimal(str(v['saldo_final'])) for v in efectivo_items)
        variacion_efectivo_real = efectivo_final - efectivo_inicial

        cuadra = abs(variacion_efectivo_calculada - variacion_efectivo_real) < Decimal('1')

        # ====================================================================
        # RESPUESTA
        # ====================================================================
        return Response({
            'empresa': {
                'nit': empresa.nit,
                'razon_social': empresa.razon_social,
            },
            'periodo': {
                'inicio': fecha_inicio,
                'fin': fecha_fin,
            },
            'titulo': 'Estado de Flujos de Efectivo',
            'subtitulo': 'Método Indirecto',
            'norma': 'NIIF para Pymes - Sección 7',

            # === VARIACIONES (hoja auxiliar) ===
            'variaciones': variaciones,

            # === FLUJO ===
            'eao': {
                'resultado_neto': float(resultado_neto),
                'detalle_resultado': {
                    'ingresos': float(ingresos),
                    'costos': float(costos),
                    'gastos': float(gastos),
                },
                'partidas_no_efectivo': partidas_no_efectivo,
                'total_no_efectivo': float(total_no_efectivo),
                'ego': float(ego),
                'variacion_ctno': variacion_ctno_detalle,
                'total_variacion_ctno': float(variacion_ctno_total),
                'total_eao': float(total_eao),
            },

            'eai': {
                'detalle': eai_detalle,
                'total_eai': float(total_eai),
            },

            'eaf': {
                'detalle': eaf_detalle,
                'total_eaf': float(total_eaf),
            },

            'resumen': {
                'variacion_neta': float(variacion_efectivo_calculada),
                'efectivo_inicial': float(efectivo_inicial),
                'efectivo_final_calculado': float(efectivo_inicial + variacion_efectivo_calculada),
                'efectivo_final_real': float(efectivo_final),
                'cuadra': cuadra,
            },
        })


# ============================================================================
# 2. PREVIEW DE IMPUESTOS EN CIERRE CONTABLE
# ============================================================================

class PreviewImpuestosView(views.APIView):
    """
    🎩 Preview de Impuesto de Renta estimado.
    
    Calcula:
    - Utilidad gravable del período
    - Impuesto bruto (35% tarifa general personas jurídicas 2024-2026)
    - Retenciones y autorretenciones a favor (anticipos)
    - Impuesto neto estimado a reservar
    
    POST /api/contabilidad/cierres/preview-impuestos/
    Body: { empresa, año }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        empresa_id = request.data.get('empresa')
        año = int(request.data.get('año', datetime.now().year))
        tarifa = Decimal(str(request.data.get('tarifa', '0.35')))

        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)

        fecha_inicio = date(año, 1, 1)
        fecha_fin = date(año, 12, 31)

        # ====================================================================
        # 1. UTILIDAD DEL EJERCICIO
        # ====================================================================
        def saldo_clase(clase):
            movs = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=clase
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            if clase == '4':
                return movs['c'] - movs['d']
            return movs['d'] - movs['c']

        ingresos = saldo_clase('4')
        costos = saldo_clase('6')
        gastos = saldo_clase('5')
        utilidad_antes_impuestos = ingresos - costos - gastos

        # ====================================================================
        # 2. IMPUESTO BRUTO
        # ====================================================================
        if utilidad_antes_impuestos <= 0:
            impuesto_bruto = Decimal('0')
        else:
            impuesto_bruto = (utilidad_antes_impuestos * tarifa).quantize(Decimal('1'))

        # ====================================================================
        # 3. RETENCIONES Y AUTORRETENCIONES A FAVOR (Anticipos de impuestos)
        # Cuentas clase 1355xx - Anticipo de impuestos y contribuciones
        # ====================================================================
        def saldo_cuenta_acumulado(prefijo):
            """Saldo acumulado de una cuenta al cierre del año"""
            movs = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=prefijo
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            return movs['d'] - movs['c']

        # Retención en la fuente a favor (135515 y similares)
        retenciones_detalle = []

        # Buscar TODAS las cuentas 1355xx con saldo en el período
        cuentas_retencion = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='1355'
        ).values(
            'cuenta__codigo', 'cuenta__nombre'
        ).annotate(
            debitos=Coalesce(Sum('debito'), Decimal('0')),
            creditos=Coalesce(Sum('credito'), Decimal('0'))
        ).order_by('cuenta__codigo')

        total_retenciones = Decimal('0')
        for cr in cuentas_retencion:
            saldo = cr['debitos'] - cr['creditos']
            if saldo > 0:  # Solo si hay anticipo a favor
                retenciones_detalle.append({
                    'codigo': cr['cuenta__codigo'],
                    'nombre': cr['cuenta__nombre'],
                    'saldo': float(saldo),
                })
                total_retenciones += saldo

        # También buscar autorretenciones (1355xx con "autorretencion" en nombre)
        # y retención de IVA (135517), ICA (135518), etc.

        # ====================================================================
        # 4. IMPUESTO NETO ESTIMADO
        # ====================================================================
        impuesto_neto = max(impuesto_bruto - total_retenciones, Decimal('0'))

        # ====================================================================
        # 5. DETALLE ADICIONAL: Retenciones causadas como pasivo (2365xx, 2367xx)
        # Esto es lo que la empresa ha RETENIDO a terceros (es un pasivo)
        # NO se descuenta del impuesto propio, pero es info útil
        # ====================================================================
        retenciones_pasivo = []
        ctas_ret_pasivo = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
        ).filter(
            Q(cuenta__codigo__startswith='2365') |
            Q(cuenta__codigo__startswith='2367') |
            Q(cuenta__codigo__startswith='2368')
        ).values(
            'cuenta__codigo', 'cuenta__nombre'
        ).annotate(
            debitos=Coalesce(Sum('debito'), Decimal('0')),
            creditos=Coalesce(Sum('credito'), Decimal('0'))
        ).order_by('cuenta__codigo')

        total_ret_pasivo = Decimal('0')
        for cr in ctas_ret_pasivo:
            saldo = cr['creditos'] - cr['debitos']  # Pasivo = saldo crédito
            if saldo > 0:
                retenciones_pasivo.append({
                    'codigo': cr['cuenta__codigo'],
                    'nombre': cr['cuenta__nombre'],
                    'saldo': float(saldo),
                })
                total_ret_pasivo += saldo

        # ====================================================================
        # RESPUESTA
        # ====================================================================
        return Response({
            'empresa': empresa.razon_social,
            'año': año,
            'tarifa_aplicada': float(tarifa * 100),

            'estado_resultados': {
                'ingresos': float(ingresos),
                'costos': float(costos),
                'gastos': float(gastos),
                'utilidad_antes_impuestos': float(utilidad_antes_impuestos),
                'tipo_resultado': 'Utilidad' if utilidad_antes_impuestos >= 0 else 'Pérdida',
            },

            'impuesto': {
                'base_gravable': float(max(utilidad_antes_impuestos, Decimal('0'))),
                'tarifa': f"{float(tarifa * 100):.0f}%",
                'impuesto_bruto': float(impuesto_bruto),
            },

            'anticipos_a_favor': {
                'detalle': retenciones_detalle,
                'total': float(total_retenciones),
            },

            'impuesto_neto': {
                'valor': float(impuesto_neto),
                'mensaje': (
                    f"Reservar ${impuesto_neto:,.0f} para impuesto de renta {año}"
                    if impuesto_neto > 0
                    else f"No hay impuesto a pagar (pérdida fiscal o retenciones cubren)"
                ),
            },

            'info_retenciones_causadas': {
                'nota': 'Retenciones practicadas a terceros (pasivo a declarar y pagar)',
                'detalle': retenciones_pasivo,
                'total': float(total_ret_pasivo),
            },
        })


# ============================================================================
# 3. IMPORTAR CONTABILIDAD CON PREVIEW EDITABLE
# ============================================================================

class ImportarContabilidadPreviewView(views.APIView):
    """
    🎩 Importa asientos contables desde Excel con preview detallado.
    
    Formato esperado: columnas Fecha, Código, Cuenta, Tercero (NIT), 
    Descripción, Débito, Crédito.
    
    Retorna cada asiento parseado para revisión en el frontend antes de ejecutar.
    
    POST /api/contabilidad/importar-contabilidad/preview/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        archivo = request.FILES.get('archivo')
        empresa_id = request.data.get('empresa')

        if not archivo:
            return Response({'error': 'Archivo requerido'}, status=400)
        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)

        # Leer Excel
        try:
            df = pd.read_excel(archivo, sheet_name=0, header=None)
        except Exception as e:
            return Response({'error': f'Error leyendo Excel: {str(e)}'}, status=400)

        # ====================================================================
        # 1. Detectar encabezados
        # ====================================================================
        header_row = None
        keywords = ['fecha', 'cuenta', 'código', 'codigo', 'débito', 'debito', 'crédito', 'credito']
        for i, row in df.iterrows():
            row_str = ' '.join(str(v).lower() for v in row.values if pd.notna(v))
            if sum(1 for kw in keywords if kw in row_str) >= 3:
                header_row = i
                break

        if header_row is None:
            return Response({
                'error': 'No se encontró fila de encabezados. Asegúrate de tener columnas: Fecha, Código, Débito, Crédito',
                'primeras_filas': [[str(v) for v in row] for _, row in df.head(5).iterrows()]
            }, status=400)

        df.columns = df.iloc[header_row]
        df = df.iloc[header_row + 1:]
        df.columns = [str(c).strip().lower() if pd.notna(c) else f'col_{i}' for i, c in enumerate(df.columns)]

        # ====================================================================
        # 2. Mapear columnas
        # ====================================================================
        col_map = {}
        for col in df.columns:
            cl = str(col).lower()
            if 'n°' in cl or 'num' in cl or cl == 'n':
                col_map['numero'] = col
            elif 'fecha' in cl:
                col_map['fecha'] = col
            elif 'codigo' in cl or 'código' in cl:
                if 'cuenta' not in col_map:
                    col_map['cuenta'] = col
            elif cl == 'cuenta' and 'cuenta' not in col_map:
                col_map['cuenta'] = col
            elif 'tercero' in cl or 'nit' in cl:
                col_map['tercero'] = col
            elif 'centro' in cl:
                col_map['centro'] = col
            elif 'concepto' in cl or 'descripcion' in cl or 'descripción' in cl or 'detalle' in cl:
                col_map['concepto'] = col
            elif 'debito' in cl or 'débito' in cl or 'debe' in cl:
                col_map['debito'] = col
            elif 'credito' in cl or 'crédito' in cl or 'haber' in cl:
                col_map['credito'] = col

        if 'cuenta' not in col_map:
            return Response({
                'error': 'No se encontró columna de Código/Cuenta',
                'columnas_detectadas': list(df.columns),
                'mapeo': col_map,
            }, status=400)

        # ====================================================================
        # 3. Parsear asientos
        # ====================================================================
        asientos = []
        current_num = None
        current_fecha = None
        current_movs = []
        errores_globales = []

        # Cache de cuentas y terceros
        cuentas_cache = {c.codigo: c for c in Cuenta.objects.filter(empresa=empresa)}
        terceros_cache = {}
        if Tercero:
            terceros_cache = {t.numero_documento: t for t in Tercero.objects.all()}

        def parse_num(val):
            if pd.isna(val) or val is None or str(val).strip() == '':
                return 0.0
            try:
                s = str(val).replace(',', '').replace('$', '').replace(' ', '').strip()
                return abs(float(s))
            except:
                return 0.0

        def parse_fecha(val):
            if pd.isna(val) or val is None:
                return None
            try:
                if isinstance(val, (datetime, pd.Timestamp)):
                    return val.date() if hasattr(val, 'date') else val
                return pd.to_datetime(val).date()
            except:
                return None

        def guardar_asiento_actual():
            if current_fecha and current_movs:
                total_d = sum(m['debito'] for m in current_movs)
                total_c = sum(m['credito'] for m in current_movs)
                cuadra = abs(total_d - total_c) < 1
                errores = []
                for m in current_movs:
                    if not m['cuenta_valida']:
                        errores.append(f"Cuenta {m['cuenta_codigo']} no encontrada")

                asientos.append({
                    'idx': len(asientos),
                    'incluir': True,
                    'numero_excel': current_num,
                    'fecha': current_fecha.isoformat() if current_fecha else None,
                    'concepto': current_movs[0].get('concepto', '') if current_movs else '',
                    'movimientos': current_movs,
                    'total_debito': total_d,
                    'total_credito': total_c,
                    'cuadra': cuadra,
                    'errores': errores,
                    'tipo_comprobante': 'OT',  # Default, editable en frontend
                })

        for _, row in df.iterrows():
            # Detectar nueva agrupación
            num_val = row.get(col_map.get('numero')) if 'numero' in col_map else None
            fecha_val = row.get(col_map.get('fecha')) if 'fecha' in col_map else None
            cuenta_val = row.get(col_map.get('cuenta'))

            # Detectar si esta fila inicia nuevo asiento
            nueva_fecha = parse_fecha(fecha_val)
            nuevo_num = None
            if pd.notna(num_val):
                try:
                    nuevo_num = int(float(str(num_val)))
                except:
                    nuevo_num = None

            es_nuevo = False
            if nuevo_num is not None and nuevo_num != current_num:
                es_nuevo = True
            elif nueva_fecha is not None and nueva_fecha != current_fecha and nuevo_num is None:
                es_nuevo = True

            if es_nuevo:
                guardar_asiento_actual()
                current_num = nuevo_num
                current_fecha = nueva_fecha or current_fecha
                current_movs = []
            elif nueva_fecha:
                current_fecha = nueva_fecha

            # Procesar movimiento
            if pd.isna(cuenta_val) or str(cuenta_val).strip() == '':
                continue

            cuenta_codigo = str(cuenta_val).strip().replace('.0', '')
            # Limpiar código: quitar espacios y puntos decorativos
            cuenta_codigo = cuenta_codigo.replace(' ', '')

            cuenta_obj = cuentas_cache.get(cuenta_codigo)

            debito = parse_num(row.get(col_map.get('debito', ''), 0))
            credito = parse_num(row.get(col_map.get('credito', ''), 0))

            if debito == 0 and credito == 0:
                continue

            # Tercero
            tercero_nit = ''
            tercero_nombre = ''
            tercero_id = None
            if 'tercero' in col_map:
                t_val = row.get(col_map['tercero'])
                if pd.notna(t_val):
                    tercero_nit = str(t_val).strip().replace('.0', '')
                    t_obj = terceros_cache.get(tercero_nit)
                    if t_obj:
                        tercero_nombre = t_obj.nombre_razon_social
                        tercero_id = t_obj.id

            concepto = ''
            if 'concepto' in col_map:
                c_val = row.get(col_map['concepto'])
                if pd.notna(c_val):
                    concepto = str(c_val).strip()

            current_movs.append({
                'cuenta_codigo': cuenta_codigo,
                'cuenta_nombre': cuenta_obj.nombre if cuenta_obj else '❌ NO ENCONTRADA',
                'cuenta_id': cuenta_obj.id if cuenta_obj else None,
                'cuenta_valida': cuenta_obj is not None,
                'debito': debito,
                'credito': credito,
                'tercero_nit': tercero_nit,
                'tercero_nombre': tercero_nombre,
                'tercero_id': tercero_id,
                'concepto': concepto,
            })

        # Último asiento
        guardar_asiento_actual()

        # Estadísticas
        total_asientos = len(asientos)
        asientos_ok = sum(1 for a in asientos if a['cuadra'] and not a['errores'])
        asientos_error = total_asientos - asientos_ok

        # Cuentas disponibles para dropdowns
        cuentas_lista = list(Cuenta.objects.filter(
            empresa=empresa, activa=True
        ).values('id', 'codigo', 'nombre', 'naturaleza').order_by('codigo')[:1000])

        return Response({
            'empresa': empresa.razon_social,
            'empresa_id': empresa.id,
            'columnas_detectadas': col_map,
            'estadisticas': {
                'total_asientos': total_asientos,
                'asientos_ok': asientos_ok,
                'asientos_con_errores': asientos_error,
            },
            'asientos': asientos,
            'cuentas': cuentas_lista,
        })


class ImportarContabilidadEjecutarView(views.APIView):
    """
    🎩 Ejecuta la importación de asientos confirmada desde el preview.
    
    POST /api/contabilidad/importar-contabilidad/ejecutar/
    Body: { empresa, asientos: [...] }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        empresa_id = request.data.get('empresa')
        asientos_data = request.data.get('asientos', [])

        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)

        if not asientos_data:
            return Response({'error': 'No hay asientos para importar'}, status=400)

        # Buscar o crear tercero genérico para asientos sin tercero
        tercero_generico = None
        if Tercero:
            tercero_generico, _ = Tercero.objects.get_or_create(
                numero_documento='0',
                defaults={
                    'tipo_documento': 'NIT',
                    'nombre_razon_social': 'TERCERO GENÉRICO (Importación)',
                    'tipo_persona': 'J',
                }
            )

        creados = 0
        errores = []

        from django.db import transaction

        for asiento_data in asientos_data:
            if not asiento_data.get('incluir', True):
                continue

            try:
                with transaction.atomic():
                    fecha_str = asiento_data['fecha']
                    fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()

                    # Determinar tercero
                    tercero = tercero_generico
                    movimientos = asiento_data.get('movimientos', [])
                    if movimientos:
                        primer_tercero_id = None
                        for m in movimientos:
                            if m.get('tercero_id'):
                                primer_tercero_id = m['tercero_id']
                                break
                        if primer_tercero_id and Tercero:
                            try:
                                tercero = Tercero.objects.get(id=primer_tercero_id)
                            except Tercero.DoesNotExist:
                                pass

                    tipo_comprobante = asiento_data.get('tipo_comprobante', 'OT')

                    asiento = AsientoContable(
                        empresa=empresa,
                        fecha=fecha,
                        concepto=asiento_data.get('concepto', f'Importación {fecha}'),
                        tercero=tercero,
                        tipo_comprobante=tipo_comprobante,
                    )
                    asiento.save()

                    for mov in movimientos:
                        cuenta_id = mov.get('cuenta_id')
                        if not cuenta_id:
                            continue

                        tercero_mov = None
                        if mov.get('tercero_id') and Tercero:
                            try:
                                tercero_mov = Tercero.objects.get(id=mov['tercero_id'])
                            except:
                                pass

                        MovimientoContable.objects.create(
                            asiento=asiento,
                            cuenta_id=cuenta_id,
                            debito=Decimal(str(mov.get('debito', 0))),
                            credito=Decimal(str(mov.get('credito', 0))),
                            tercero=tercero_mov,
                            descripcion=mov.get('concepto', ''),
                        )

                    creados += 1

            except Exception as e:
                errores.append({
                    'asiento': asiento_data.get('idx', '?'),
                    'fecha': asiento_data.get('fecha', '?'),
                    'error': str(e),
                })

        return Response({
            'mensaje': f'Se importaron {creados} asientos exitosamente',
            'creados': creados,
            'errores': errores,
            'total_errores': len(errores),
        })
