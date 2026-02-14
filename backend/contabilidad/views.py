#contabilidad/views.py

from rest_framework import viewsets, filters, views
from rest_framework.response import Response
#from rest_framework.permissions import AllowAny   # 👈 añade esto
#from .models import Cuenta, AsientoContable, MovimientoContable, 
from .models import (
    Cuenta, CuentaBase, AsientoContable, MovimientoContable, 
    PeriodoContable, NotaEstadoFinanciero, CierreContable, ConceptoRetencion,
    BitacoraAuditoria
)
from .serializers import CuentaSerializer, AsientoContableSerializer, MovimientoContableSerializer
from django.utils import timezone
from datetime import date
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from openpyxl.styles import Alignment, Font


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    return xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR')


def _log_auditoria(request, empresa, accion, detalle="", asiento=None, asiento_relacionado=None):
    try:
        BitacoraAuditoria.objects.create(
            empresa=empresa,
            usuario=request.user if request.user.is_authenticated else None,
            accion=accion,
            detalle=detalle,
            asiento=asiento,
            asiento_relacionado=asiento_relacionado,
            ip_address=_get_client_ip(request),
        )
    except Exception:
        pass  # Nunca bloquear operación contable por fallo de log
from django.http import HttpResponse
from django.db.models import Sum, Q, Count, Avg, StdDev, F
from decimal import Decimal
from datetime import datetime
from rest_framework.decorators import api_view, permission_classes
from django.db.models.functions import Coalesce
from datetime import timedelta


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def periodo_view(request):
    anio = int(request.query_params.get('anio'))
    empresa_id = request.query_params.get('empresa')
    if not empresa_id:
        return Response({"error": "Empresa requerida"}, status=400)
    from empresas.models import Empresa
    try:
        empresa = Empresa.objects.get(id=empresa_id)
    except Empresa.DoesNotExist:
        return Response({"error": "Empresa no encontrada"}, status=404)
    p = PeriodoContable.ensure(empresa, anio)
    return Response({
        "anio": p.anio,
        "estado": p.estado,
        "ajustes": {
            "inicio": p.ajustes_inicio.isoformat(),
            "fin":    p.ajustes_fin.isoformat(),
            "requiere_pins": p.requiere_pins_en_ajustes,
        },
        "mes13": {
            "habilitado": p.habilitar_mes13,
            "etiqueta": "Mes 13 (Ajustes de cierre)"
        }
    })

def _parse_date(val):
    if not val:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):  # ISO y día/mes/año
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None



class CuentaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión del Plan de Cuentas.
    Permite listar, crear, editar y desactivar cuentas.
    """
    permission_classes = [IsAuthenticated]
    queryset = Cuenta.objects.select_related("padre", "empresa").all().order_by("codigo")
    serializer_class = CuentaSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["codigo", "nombre"]
    pagination_class = None

class AsientoContableViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de Asientos Contables.

    Permite crear, listar y ver el detalle de los asientos.
    La actualización y eliminación se deshabilitan por seguridad contable,
    ya que los asientos no deben modificarse (se deben crear asientos de ajuste).
    """
    permission_classes = [IsAuthenticated]
    queryset = AsientoContable.objects.select_related("tercero").prefetch_related("movimientos", "movimientos__tercero", "movimientos__cuenta").all()
    serializer_class = AsientoContableSerializer
    http_method_names = ['get', 'post', 'head', 'options']  # Deshabilitar PUT, PATCH, DELETE

    def get_queryset(self):
        """
        Filtra asientos por empresa y opcionalmente por rango de fechas.
        """
        qs = super().get_queryset()
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        fi = _parse_date(self.request.query_params.get('fecha_inicio'))
        ff = _parse_date(self.request.query_params.get('fecha_fin'))
        if fi:
            qs = qs.filter(fecha__gte=fi)
        if ff:
            qs = qs.filter(fecha__lte=ff)
        tipo = self.request.query_params.get('tipo_comprobante')
        if tipo:
            qs = qs.filter(tipo_comprobante=tipo)
        return qs

    def create(self, request, *args, **kwargs):
        fecha = request.data.get('fecha')
        empresa_id = request.data.get('empresa')
        
        # Verificar si el período está cerrado
        if fecha and empresa_id:
            from datetime import datetime
            try:
                fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
                
                cierre_anual = CierreContable.objects.filter(
                    empresa_id=empresa_id,
                    tipo='anual',
                    año=fecha_obj.year,
                    estado='cerrado'
                ).exists()
                
                if cierre_anual:
                    return Response({
                        'error': f'El año {fecha_obj.year} está cerrado. No se pueden crear asientos.'
                    }, status=400)
                
                cierre_mensual = CierreContable.objects.filter(
                    empresa_id=empresa_id,
                    tipo='mensual',
                    año=fecha_obj.year,
                    mes=fecha_obj.month,
                    estado='cerrado'
                ).exists()
                
                if cierre_mensual:
                    return Response({
                        'error': f'El mes {fecha_obj.month}/{fecha_obj.year} está cerrado.'
                    }, status=400)
            except:
                pass
        
        response = super().create(request, *args, **kwargs)
        if response.status_code == 201:
            try:
                asiento_id = response.data.get('id')
                asiento = AsientoContable.objects.get(id=asiento_id)
                _log_auditoria(request, asiento.empresa, 'crear_asiento',
                    f"{asiento.tipo_comprobante}-{asiento.numero:04d} - {asiento.concepto}", asiento=asiento)
            except Exception:
                pass
        return response

    @action(detail=True, methods=["post"], url_path="anular")
    def anular(self, request, pk=None):
        asiento = self.get_object()
        if asiento.estado == "anulado":
            return Response({"detail": "El asiento ya está anulado."}, status=400)

        hoy = timezone.localdate()
        # Tomamos el año fiscal del asiento si existe, si no, el de la fecha
        anio_fiscal = asiento.fiscal_year or asiento.fecha.year
        periodo = PeriodoContable.ensure(asiento.empresa, anio_fiscal)

        # Estado del periodo
        if periodo.estado == "cerrado":
            return Response(
                {"detail": f"El periodo {periodo.anio} está CERRADO. Anulación prohibida."},
                status=403
            )

        # Regla de ventanas:
        #  - Hasta 31/12 del año fiscal: anula sin PIN
        #  - Durante la ventana de ajustes (enero–marzo del año siguiente): requiere PIN si está configurado
        #  - Fuera de eso: prohibido
        limite_libre = date(anio_fiscal, 12, 31)
        requiere_pins = False

        if hoy <= limite_libre:
            requiere_pins = False
        elif periodo.in_ajustes(hoy) and hoy.year == anio_fiscal + 1:
            requiere_pins = bool(periodo.requiere_pins_en_ajustes)
        else:
            return Response({"detail": "Fuera de la ventana permitida para anulación."}, status=403)

        if requiere_pins:
            from django.conf import settings
            contador_pin = request.data.get("contador_pin")
            gerente_pin  = request.data.get("gerente_pin")
            ok_cont = bool(contador_pin) and (contador_pin == getattr(settings, "CONTADOR_PIN", None))
            ok_ger  = bool(gerente_pin)  and (gerente_pin  == getattr(settings, "GERENTE_PIN", None))
            if not (ok_cont and ok_ger):
                return Response({"detail": "Se requieren PINs válidos de Contador y Gerente."}, status=403)

        motivo = request.data.get("motivo", "")

        # Crear asiento de ajuste (inverso) y marcar anulado
        ajuste = AsientoContable.objects.create(
            empresa=asiento.empresa,
            fecha=hoy,
            tipo_comprobante='AJ',
            fiscal_year=asiento.fiscal_year,
            fiscal_period=asiento.fiscal_period,
            concepto=f"AJUSTE POR ANULACIÓN del {asiento.tipo_comprobante}-{asiento.numero:04d}",
            tercero=asiento.tercero,
            descripcion_adicional=f"Motivo: {motivo}",
        )
        for m in asiento.movimientos.all():
            MovimientoContable.objects.create(
                asiento=ajuste,
                cuenta=m.cuenta,
                tercero=m.tercero,
                debito=m.credito,
                credito=m.debito,
            )

        asiento.estado = "anulado"
        asiento.anulado_por = request.user
        asiento.anulado_en = timezone.now()
        asiento.anulacion_motivo = motivo
        asiento.ajusta_a = ajuste
        asiento.save()

        # Determinar si es corrección rápida o anulación simple
        es_correccion = "Corrección rápida" in motivo
        accion = 'corregir_asiento' if es_correccion else 'anular_asiento'
        _log_auditoria(request, asiento.empresa, accion,
            f"{asiento.tipo_comprobante}-{asiento.numero:04d} anulado. Motivo: {motivo}. Ajuste: {ajuste.tipo_comprobante}-{ajuste.numero:04d}",
            asiento=asiento, asiento_relacionado=ajuste)

        return Response({"detail": "Asiento anulado y ajuste generado", "ajuste_id": ajuste.id}, status=200)

class LibroDiarioView(views.APIView):
    """
    Vista para generar el reporte de Libro Diario.
    Devuelve todos los movimientos contables ordenados por fecha.
    """
    def get(self, request):
        fi = _parse_date(request.query_params.get('fecha_inicio'))
        ff = _parse_date(request.query_params.get('fecha_fin'))
        empresa_id = request.query_params.get('empresa')

        movimientos = (
            MovimientoContable.objects
            .select_related('asiento', 'cuenta')
            .filter(asiento__estado='vigente')
            .order_by('asiento__fecha', 'asiento__id')
        )
        if empresa_id:
            movimientos = movimientos.filter(asiento__empresa_id=empresa_id)
        if fi:
            movimientos = movimientos.filter(asiento__fecha__gte=fi)
        if ff:
            movimientos = movimientos.filter(asiento__fecha__lte=ff)

        data = []
        for m in movimientos:
            data.append({
                'fecha': m.asiento.fecha,
                'asiento_id': f"{m.asiento.tipo_comprobante or 'OT'}-{m.asiento.numero:04d}",
                'tercero': getattr(m.asiento.tercero, 'nombre_razon_social', None),
                'codigo_cuenta': m.cuenta.codigo,
                'nombre_cuenta': m.cuenta.nombre,
                'concepto': m.asiento.concepto,
                'descripcion_adicional': m.asiento.descripcion_adicional or '',
                'debito': m.debito,
                'credito': m.credito,
            })

        formato = request.query_params.get('formato', 'json')
        if formato == 'xlsx':
            from empresas.models import Empresa
            wb = Workbook()
            ws = wb.active
            ws.title = "Libro Diario"

            empresa_nombre = "EMPRESA"
            empresa_nit = ""
            if empresa_id:
                try:
                    emp = Empresa.objects.get(id=empresa_id)
                    empresa_nombre = emp.razon_social
                    empresa_nit = emp.nit
                except Empresa.DoesNotExist:
                    pass

            ws.append([f"{empresa_nombre}   NIT: {empresa_nit}"])
            ws.cell(1, 1).font = Font(bold=True, size=12)
            ws.append([f"Libro Diario   {fi or ''} a {ff or ''}"])
            ws.cell(2, 1).font = Font(bold=True)
            ws.append([])

            headers = ['Fecha', 'Comprobante', 'Tercero', 'Cuenta', 'Nombre Cuenta', 'Concepto', 'Notas', 'Débito', 'Crédito']
            ws.append(headers)
            for h in range(1, len(headers)+1):
                ws.cell(4, h).font = Font(bold=True)
            for d in data:
                ws.append([
                    str(d['fecha']), d['asiento_id'], d['tercero'],
                    d['codigo_cuenta'], d['nombre_cuenta'], d['concepto'],
                    d['descripcion_adicional'],
                    float(d['debito']), float(d['credito']),
                ])
            for col in range(1, len(headers)+1):
                ws.column_dimensions[get_column_letter(col)].width = 16
            resp = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            resp["Content-Disposition"] = 'attachment; filename="libro_diario.xlsx"'
            wb.save(resp)
            return resp

        return Response(data, status=200)


class BalancePruebasView(views.APIView):
    def get(self, request):
        fi = _parse_date(request.query_params.get('fecha_inicio'))
        ff = _parse_date(request.query_params.get('fecha_fin'))
        empresa_id = request.query_params.get('empresa')

        cuentas = Cuenta.objects.all().order_by('codigo')
        if empresa_id:
            cuentas = cuentas.filter(empresa_id=empresa_id)

        # Movimientos del período
        movs = MovimientoContable.objects.filter(asiento__estado='vigente')
        if empresa_id:
            movs = movs.filter(asiento__empresa_id=empresa_id)
        if fi:
            movs = movs.filter(asiento__fecha__gte=fi)
        if ff:
            movs = movs.filter(asiento__fecha__lte=ff)

        periodo = movs.values('cuenta__codigo','cuenta__nombre') \
                      .annotate(total_debito=Sum('debito'), total_credito=Sum('credito')) \
                      .order_by('cuenta__codigo')
        periodo_dict = {
            x['cuenta__codigo']: {
                'nombre': x['cuenta__nombre'],
                'deb': x['total_debito'] or Decimal('0'),
                'cre': x['total_credito'] or Decimal('0'),
            } for x in periodo
        }

        # Saldos anteriores (saldo inicial)
        prev_dict = {}
        if fi:
            movs_prev = MovimientoContable.objects.filter(asiento__fecha__lt=fi, asiento__estado='vigente')
            if empresa_id:
                movs_prev = movs_prev.filter(asiento__empresa_id=empresa_id)
            prev = movs_prev.values('cuenta__codigo').annotate(deb=Sum('debito'), cre=Sum('credito'))
            prev_dict = {
                x['cuenta__codigo']: (x['deb'] or Decimal('0')) - (x['cre'] or Decimal('0'))
                for x in prev
            }

        reporte = []
        total_ini = total_debitos = total_creditos = total_fin = Decimal('0')

        for cta in cuentas:
            ini = prev_dict.get(cta.codigo, Decimal('0'))
            deb = periodo_dict.get(cta.codigo, {}).get('deb', Decimal('0'))
            cre = periodo_dict.get(cta.codigo, {}).get('cre', Decimal('0'))
            if ini == 0 and deb == 0 and cre == 0:
                continue
            fin = ini + deb - cre
            reporte.append({
                'codigo_cuenta': cta.codigo,
                'nombre_cuenta': cta.nombre,
                'saldo_inicial': ini,
                'total_debito': deb,
                'total_credito': cre,
                'saldo_final': fin,
            })
            total_ini       += ini
            total_debitos   += deb
            total_creditos  += cre
            total_fin       += fin

        formato = request.query_params.get("formato")
        if formato == "xlsx":
            from empresas.models import Empresa
            wb = Workbook()
            ws = wb.active
            ws.title = "Balance de Prueba"

            empresa_nombre = "EMPRESA"
            empresa_nit = ""
            if empresa_id:
                try:
                    emp = Empresa.objects.get(id=empresa_id)
                    empresa_nombre = emp.razon_social
                    empresa_nit = emp.nit
                except Empresa.DoesNotExist:
                    pass

            ws["A1"] = f"{empresa_nombre}   NIT: {empresa_nit}"
            ws["A2"] = f"Balance de Prueba   {fi or ''} a {ff or ''}"
            ws["A1"].font = Font(bold=True, size=12)
            ws["A2"].font = Font(bold=True)

            headers = ["Cuenta","Nombre Cuenta contable","Saldo inicial","Débitos","Créditos","Saldo final"]
            ws.append(headers)
            for cell in ws[3]:
                cell.font = Font(bold=True)

            for row in reporte:
                ws.append([
                    row["codigo_cuenta"],
                    row["nombre_cuenta"],
                    float(row["saldo_inicial"]),
                    float(row["total_debito"]),
                    float(row["total_credito"]),
                    float(row["saldo_final"]),
                ])

            ws.append(["","TOTAL", float(total_ini), float(total_debitos), float(total_creditos), float(total_fin)])
            widths = [12, 40, 16, 14, 14, 16]
            for i,w in enumerate(widths, start=1):
                ws.column_dimensions[get_column_letter(i)].width = w
                for cell in ws[get_column_letter(i)]:
                    cell.alignment = Alignment(horizontal="left", vertical="center")

            resp = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            resp["Content-Disposition"] = 'attachment; filename="balance_prueba.xlsx"'
            wb.save(resp)
            return resp

        return Response({
            'detalle': reporte,
            'sumas_iguales': {
                'total_inicial': total_ini,
                'total_debitos': total_debitos,
                'total_creditos': total_creditos,
                'total_final': total_fin,
            }
        }, status=200)


class BalancePorTercerosView(views.APIView):
    """
    🎩 Balance por Terceros
    Muestra saldos agrupados por tercero, opcionalmente filtrados por cuenta.
    Útil para: cuentas por cobrar, por pagar, retenciones, aportes, etc.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, F, Value, CharField
        from django.db.models.functions import Coalesce

        empresa_id = request.query_params.get('empresa')
        fi = _parse_date(request.query_params.get('fecha_inicio'))
        ff = _parse_date(request.query_params.get('fecha_fin'))
        cuenta_prefijo = request.query_params.get('cuenta', '')  # ej: "23", "13", "2505"

        if not empresa_id:
            return Response({'error': 'Empresa es requerida'}, status=400)

        # Base queryset
        movs = MovimientoContable.objects.filter(
            asiento__empresa_id=empresa_id,
            asiento__estado='vigente',
        ).select_related('cuenta', 'asiento__tercero')

        if cuenta_prefijo:
            movs = movs.filter(cuenta__codigo__startswith=cuenta_prefijo)

        # --- Saldos anteriores (antes de fecha_inicio) ---
        prev_dict = {}
        if fi:
            prev_qs = movs.filter(asiento__fecha__lt=fi)
            prev = prev_qs.annotate(
                terc_id=Coalesce(F('tercero_id'), F('asiento__tercero_id')),
            ).values(
                'terc_id',
                cuenta_codigo=F('cuenta__codigo'),
                cuenta_nombre=F('cuenta__nombre'),
            ).annotate(
                deb=Coalesce(Sum('debito'), Decimal('0')),
                cre=Coalesce(Sum('credito'), Decimal('0')),
            )
            for row in prev:
                key = (row['terc_id'], row['cuenta_codigo'])
                prev_dict[key] = row['deb'] - row['cre']

        # --- Movimientos del período ---
        periodo_qs = movs
        if fi:
            periodo_qs = periodo_qs.filter(asiento__fecha__gte=fi)
        if ff:
            periodo_qs = periodo_qs.filter(asiento__fecha__lte=ff)

        periodo = periodo_qs.annotate(
            terc_id=Coalesce(F('tercero_id'), F('asiento__tercero_id')),
        ).values(
            'terc_id',
            cuenta_codigo=F('cuenta__codigo'),
            cuenta_nombre=F('cuenta__nombre'),
        ).annotate(
            total_debito=Coalesce(Sum('debito'), Decimal('0')),
            total_credito=Coalesce(Sum('credito'), Decimal('0')),
        ).order_by('cuenta_codigo', 'terc_id')

        # Materializar para iterar múltiples veces
        periodo = list(periodo)

        # --- Obtener nombres de terceros ---
        tercero_ids = set()
        for row in periodo:
            if row['terc_id']:
                tercero_ids.add(row['terc_id'])
        for key in prev_dict:
            if key[0]:
                tercero_ids.add(key[0])

        from terceros.models import Tercero
        terceros_map = {}
        if tercero_ids:
            for t in Tercero.objects.filter(id__in=tercero_ids).values('id', 'nombre_razon_social', 'numero_documento'):
                terceros_map[t['id']] = {
                    'nombre': t['nombre_razon_social'],
                    'documento': t['numero_documento'],
                }

        # --- Construir reporte ---
        reporte = []
        totales = {'saldo_inicial': Decimal('0'), 'debitos': Decimal('0'), 'creditos': Decimal('0'), 'saldo_final': Decimal('0')}

        # Agrupar por cuenta, luego por tercero
        from collections import defaultdict
        por_cuenta = defaultdict(list)

        # Recopilar todas las combinaciones (cuenta, tercero)
        all_keys = set()
        for row in periodo:
            all_keys.add((row['terc_id'], row['cuenta_codigo'], row['cuenta_nombre']))
        for (tid, ccode), saldo in prev_dict.items():
            # Buscar nombre de cuenta
            all_keys.add((tid, ccode, ''))

        for row in periodo:
            key = (row['terc_id'], row['cuenta_codigo'])
            ini = prev_dict.get(key, Decimal('0'))
            deb = row['total_debito']
            cre = row['total_credito']
            fin = ini + deb - cre

            if ini == 0 and deb == 0 and cre == 0:
                continue

            tercero_info = terceros_map.get(row['terc_id'], {'nombre': 'Sin tercero', 'documento': ''})

            por_cuenta[row['cuenta_codigo']].append({
                'tercero_id': row['terc_id'],
                'tercero_nombre': tercero_info['nombre'],
                'tercero_documento': tercero_info['documento'],
                'saldo_inicial': float(ini),
                'debitos': float(deb),
                'creditos': float(cre),
                'saldo_final': float(fin),
            })

            totales['saldo_inicial'] += ini
            totales['debitos'] += deb
            totales['creditos'] += cre
            totales['saldo_final'] += fin

        # Construir estructura por cuenta
        for codigo in sorted(por_cuenta.keys()):
            filas = por_cuenta[codigo]
            nombre_cuenta = ''
            for row in periodo:
                if row['cuenta_codigo'] == codigo:
                    nombre_cuenta = row['cuenta_nombre']
                    break

            subtotal = {
                'saldo_inicial': sum(f['saldo_inicial'] for f in filas),
                'debitos': sum(f['debitos'] for f in filas),
                'creditos': sum(f['creditos'] for f in filas),
                'saldo_final': sum(f['saldo_final'] for f in filas),
            }

            reporte.append({
                'cuenta_codigo': codigo,
                'cuenta_nombre': nombre_cuenta,
                'terceros': sorted(filas, key=lambda x: x['tercero_nombre']),
                'subtotal': subtotal,
            })

        # --- Formato Excel ---
        formato = request.query_params.get('formato')
        if formato == 'xlsx':
            from empresas.models import Empresa
            wb = Workbook()
            ws = wb.active
            ws.title = "Balance por Terceros"

            empresa_nombre = "EMPRESA"
            empresa_nit = ""
            if empresa_id:
                try:
                    emp = Empresa.objects.get(id=empresa_id)
                    empresa_nombre = emp.razon_social
                    empresa_nit = emp.nit
                except Empresa.DoesNotExist:
                    pass

            ws['A1'] = f"{empresa_nombre}   NIT: {empresa_nit}"
            ws['A1'].font = Font(bold=True, size=12)
            ws['A2'] = "Balance por Terceros"
            ws['A2'].font = Font(bold=True, size=14)
            ws['A3'] = f"Período: {fi or 'Inicio'} a {ff or 'Fin'}"
            if cuenta_prefijo:
                ws['A4'] = f"Filtro cuenta: {cuenta_prefijo}*"

            headers = ['Cuenta', 'Nombre Cuenta', 'Documento', 'Tercero', 'Saldo Inicial', 'Débitos', 'Créditos', 'Saldo Final']
            ws.append([])
            ws.append(headers)
            for cell in ws[ws.max_row]:
                cell.font = Font(bold=True)

            for grupo in reporte:
                for t in grupo['terceros']:
                    ws.append([
                        grupo['cuenta_codigo'], grupo['cuenta_nombre'],
                        t['tercero_documento'], t['tercero_nombre'],
                        t['saldo_inicial'], t['debitos'], t['creditos'], t['saldo_final'],
                    ])
                # Subtotal
                ws.append([
                    '', f"Subtotal {grupo['cuenta_codigo']}", '', '',
                    grupo['subtotal']['saldo_inicial'], grupo['subtotal']['debitos'],
                    grupo['subtotal']['creditos'], grupo['subtotal']['saldo_final'],
                ])
                ws[ws.max_row][1].font = Font(bold=True)

            ws.append([
                '', 'TOTAL GENERAL', '', '',
                float(totales['saldo_inicial']), float(totales['debitos']),
                float(totales['creditos']), float(totales['saldo_final']),
            ])
            for cell in ws[ws.max_row]:
                cell.font = Font(bold=True)

            widths = [12, 35, 15, 35, 16, 16, 16, 16]
            for i, w in enumerate(widths, start=1):
                ws.column_dimensions[get_column_letter(i)].width = w

            resp = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            resp["Content-Disposition"] = 'attachment; filename="balance_terceros.xlsx"'
            wb.save(resp)
            return resp

        return Response({
            'filtro_cuenta': cuenta_prefijo or 'Todas',
            'fecha_inicio': str(fi) if fi else None,
            'fecha_fin': str(ff) if ff else None,
            'detalle': reporte,
            'totales': {
                'saldo_inicial': float(totales['saldo_inicial']),
                'total_debitos': float(totales['debitos']),
                'total_creditos': float(totales['creditos']),
                'saldo_final': float(totales['saldo_final']),
            }
        })


class LibroMayorView(views.APIView):
    """
    Reporte de Libro Mayor para una cuenta (por código).
    GET /api/contabilidad/libro-mayor/<codigo_cuenta>/?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
    """
    def get(self, request, codigo_cuenta):
        try:
            cuenta = Cuenta.objects.get(pk=codigo_cuenta)   # tu PK de cuenta es 'codigo'
        except Cuenta.DoesNotExist:
            return Response({"error": "La cuenta especificada no existe."}, status=404)

        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin    = request.query_params.get('fecha_fin')

        # Saldo inicial
        mov_prev = MovimientoContable.objects.filter(cuenta=cuenta)
        if fecha_inicio:
            mov_prev = mov_prev.filter(asiento__fecha__lt=fecha_inicio)
        agg_prev = mov_prev.aggregate(total_debito=Sum('debito'), total_credito=Sum('credito'))
        deb_prev = agg_prev['total_debito']  or Decimal('0')
        cre_prev = agg_prev['total_credito'] or Decimal('0')
        saldo_inicial = deb_prev - cre_prev

        # Movimientos del período
        qs = MovimientoContable.objects.filter(cuenta=cuenta)
        if fecha_inicio:
            qs = qs.filter(asiento__fecha__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(asiento__fecha__lte=fecha_fin)
        qs = qs.select_related('asiento', 'asiento__tercero').order_by('asiento__fecha','asiento__id')

        detalle = []
        saldo = saldo_inicial
        for m in qs:
            saldo += m.debito - m.credito
            detalle.append({
                'fecha': m.asiento.fecha,
                'asiento_id': f"{m.asiento.tipo_comprobante or 'OT'}-{m.asiento.numero:04d}",
                'tercero': getattr(m.asiento.tercero, 'nombre_razon_social', None),
                'concepto': m.asiento.concepto,
                'debito': m.debito,
                'credito': m.credito,
                'saldo': saldo,
            })

        formato = request.query_params.get('formato', 'json')
        if formato == 'xlsx':
            from empresas.models import Empresa
            wb = Workbook()
            ws = wb.active
            ws.title = f"Libro Mayor {cuenta.codigo}"

            empresa_nombre = "EMPRESA"
            empresa_nit = ""
            if hasattr(cuenta, 'empresa_id') and cuenta.empresa_id:
                try:
                    emp = Empresa.objects.get(id=cuenta.empresa_id)
                    empresa_nombre = emp.razon_social
                    empresa_nit = emp.nit
                except Empresa.DoesNotExist:
                    pass

            ws.append([f"{empresa_nombre}   NIT: {empresa_nit}"])
            ws.cell(1, 1).font = Font(bold=True, size=12)
            ws.append([f"Libro Mayor"])
            ws.cell(2, 1).font = Font(bold=True)
            ws.append([f"Cuenta: {cuenta.codigo} - {cuenta.nombre}"])
            ws.append([f"Periodo: {fecha_inicio or 'Inicio'} a {fecha_fin or 'Fin'}"])
            ws.append([f"Saldo Inicial: {float(saldo_inicial)}"])
            ws.append([])
            headers = ['Fecha', 'Comprobante', 'Tercero', 'Concepto', 'Débito', 'Crédito', 'Saldo']
            ws.append(headers)
            for h in range(1, len(headers)+1):
                ws.cell(7, h).font = Font(bold=True)
            for d in detalle:
                ws.append([
                    str(d['fecha']), d['asiento_id'], d['tercero'], d['concepto'],
                    float(d['debito']), float(d['credito']), float(d['saldo']),
                ])
            ws.append([])
            ws.append(['', '', '', 'Saldo Final:', '', '', float(saldo)])
            for col in range(1, len(headers)+1):
                ws.column_dimensions[get_column_letter(col)].width = 16
            resp = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            resp["Content-Disposition"] = f'attachment; filename="libro_mayor_{cuenta.codigo}.xlsx"'
            wb.save(resp)
            return resp

        return Response({
            'cuenta': {'codigo': cuenta.codigo, 'nombre': cuenta.nombre},
            'fecha_inicio_reporte': fecha_inicio,
            'fecha_fin_reporte': fecha_fin,
            'saldo_inicial': saldo_inicial,
            'movimientos': detalle,
            'saldo_final': saldo,
        }, status=200)


class EstadoResultadosView(views.APIView):
    """
    Vista para generar el Estado de Resultados a una fecha de corte.
    """
    

    def get(self, request):
        from django.db.models import Sum
        from decimal import Decimal

        fecha_fin = request.query_params.get('fecha_fin')
        empresa_id = request.query_params.get('empresa')
        if not fecha_fin:
            return Response({"error": "Debe proporcionar una 'fecha_fin' en los parámetros."}, status=400)

        base_qs = MovimientoContable.objects.filter(
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
        )
        if empresa_id:
            base_qs = base_qs.filter(asiento__empresa_id=empresa_id)

        # 1. Ingresos (Clase 4)
        ingresos_agg = base_qs.filter(
            cuenta__codigo__startswith='4'
        ).aggregate(total_credito=Sum('credito'), total_debito=Sum('debito'))
        total_ingresos = (ingresos_agg['total_credito'] or 0) - (ingresos_agg['total_debito'] or 0)

        # 2. Costos de Ventas (Clase 6)
        costos_agg = base_qs.filter(
            cuenta__codigo__startswith='6'
        ).aggregate(total_debito=Sum('debito'), total_credito=Sum('credito'))
        total_costos = (costos_agg['total_debito'] or 0) - (costos_agg['total_credito'] or 0)

        utilidad_bruta = total_ingresos - total_costos

        # 3. Gastos Operacionales (Clase 5)
        gastos_agg = base_qs.filter(
            cuenta__codigo__startswith='5'
        ).aggregate(total_debito=Sum('debito'), total_credito=Sum('credito'))
        total_gastos = (gastos_agg['total_debito'] or 0) - (gastos_agg['total_credito'] or 0)

        utilidad_operacional = utilidad_bruta - total_gastos
        utilidad_neta_antes_impuestos = utilidad_operacional

        return Response({
            'fecha_corte': fecha_fin,
            'ingresos_operacionales': total_ingresos,
            'costo_de_ventas': total_costos,
            'utilidad_bruta': utilidad_bruta,
            'gastos_operacionales': total_gastos,
            'utilidad_operacional': utilidad_operacional,
            'utilidad_neta_antes_de_impuestos': utilidad_neta_antes_impuestos
        })

class BalanceGeneralView(views.APIView):
    """
    Vista para generar el Balance General (Estado de Situación Financiera).
    """
    

    def get(self, request):
        from django.db.models import Sum
        from decimal import Decimal

        fecha_fin = request.query_params.get('fecha_fin')
        empresa_id = request.query_params.get('empresa')
        if not fecha_fin:
            return Response({"error": "Debe proporcionar una 'fecha_fin' en los parámetros."}, status=400)

        # Función auxiliar para calcular el saldo de una clase de cuenta
        def calcular_saldo_clase(clase):
            qs = MovimientoContable.objects.filter(
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=str(clase)
            )
            if empresa_id:
                qs = qs.filter(asiento__empresa_id=empresa_id)
            saldo = qs.aggregate(
                total_debito=Sum('debito', default=Decimal(0)),
                total_credito=Sum('credito', default=Decimal(0))
            )
            return saldo['total_debito'] - saldo['total_credito']

        # Calcular saldos para Activo (1), Pasivo (2), y Patrimonio (3)
        total_activos = calcular_saldo_clase(1)
        total_pasivos = calcular_saldo_clase(2) * -1 # Se multiplica por -1 porque los pasivos son de naturaleza crédito
        total_patrimonio_inicial = calcular_saldo_clase(3) * -1

        # Calcular la utilidad del ejercicio (Ingresos - Gastos - Costos)
        utilidad_ingresos = calcular_saldo_clase(4) * -1
        utilidad_gastos = calcular_saldo_clase(5)
        utilidad_costos = calcular_saldo_clase(6)
        utilidad_del_ejercicio = utilidad_ingresos - utilidad_gastos - utilidad_costos

        total_patrimonio = total_patrimonio_inicial + utilidad_del_ejercicio

        # Verificación de la ecuación contable
        ecuacion_ok = total_activos == (total_pasivos + total_patrimonio)

        return Response({
            'fecha_corte': fecha_fin,
            'activos': {
                'total': total_activos,
            },
            'pasivos_y_patrimonio': {
                'total_pasivos': total_pasivos,
                'total_patrimonio': total_patrimonio,
                'total_pasivo_y_patrimonio': total_pasivos + total_patrimonio,
            },
            'verificacion_ecuacion_contable': {
                'ecuacion': 'Activo = Pasivo + Patrimonio',
                'balance_correcto': ecuacion_ok
            }
        })

class MediosMagneticosView(views.APIView):
    """
    Vista para generar reportes de Medios Magnéticos (Exógena) para la DIAN.
    """
    

    def get(self, request, formato):
        year = request.query_params.get('year')
        if not year:
            return Response({"error": "Debe proporcionar el parámetro 'year'."}, status=400)

        if formato == '1001':
            return self.formato_1001(year)

        # Aquí se añadirían las llamadas a otros formatos (1003, 1005, etc.)

        return Response({"error": f"El formato '{formato}' no es soportado aún."}, status=404)

    def formato_1001(self, year):
        """
        Genera los datos para el Formato 1001 v10: Pagos o abonos en cuenta.
        Conceptos de ejemplo: 5002 (Salarios), 5016 (Honorarios).
        """
        from django.db.models import Sum, Value, CharField
        from django.db.models.functions import Coalesce

        # Filtra movimientos de cuentas de Gasto (clase 5) para el año especificado.
        pagos = MovimientoContable.objects.filter(
            asiento__fecha__year=year,
            cuenta__codigo__startswith='5'
        ).values(
            'asiento__tercero__tipo_documento',
            'asiento__tercero__numero_documento',
            'asiento__tercero__nombre_razon_social'
        ).annotate(
            # Agregamos el concepto basado en la cuenta. Lógica de ejemplo.
            concepto_pago=Value('5016', output_field=CharField()), # Asumimos honorarios por defecto
            valor_pago=Sum('debito')
        ).filter(valor_pago__gt=0) # Solo pagos, no notas crédito

        # Aquí iría una lógica más compleja para mapear cuentas a conceptos DIAN.
        # Por ahora, es una implementación de ejemplo.

        data = list(pagos)

        return Response({
            'formato': '1001',
            'version': '10',
            'año': year,
            'registros': data
        })

# ============================================================================
# 🎩 AGREGAR ESTO AL FINAL DE contabilidad/views.py
# ============================================================================

import pandas as pd
from rest_framework.parsers import MultiPartParser
from empresas.models import Empresa
from terceros.models import Tercero


class ImportarAsientosView(views.APIView):
    """
    🎩 Endpoint para importar asientos desde Excel
    
    POST /api/contabilidad/importar-asientos/
    - empresa: ID de la empresa
    - archivo: Archivo Excel
    - preview: Si es 'true', solo muestra preview sin guardar
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        empresa_id = request.data.get('empresa')
        archivo = request.FILES.get('archivo')
        preview = request.data.get('preview', 'false').lower() == 'true'
        
        if not empresa_id:
            return Response({'error': 'Empresa es requerida'}, status=400)
        if not archivo:
            return Response({'error': 'Archivo es requerido'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        # Leer Excel
        try:
            df = pd.read_excel(archivo, sheet_name=0, header=None)
        except Exception as e:
            return Response({'error': f'Error leyendo Excel: {str(e)}'}, status=400)
        
        # Procesar
        result = self._procesar_excel(df, empresa, preview)
        return Response(result)

    def _procesar_excel(self, df, empresa, preview=False):
        # Buscar encabezados
        header_row = None
        keywords = ['fecha', 'cuenta', 'código', 'codigo', 'débito', 'debito', 'crédito', 'credito', 'n°']
        for i, row in df.iterrows():
            row_str = ' '.join(str(v).lower() for v in row.values if pd.notna(v))
            if any(kw in row_str for kw in keywords):
                header_row = i
                break
        
        if header_row is None:
            return {'error': 'No se encontró fila de encabezados'}
        
        df.columns = df.iloc[header_row]
        df = df.iloc[header_row + 1:]
        df.columns = [str(c).strip().lower() if pd.notna(c) else f'col_{i}' for i, c in enumerate(df.columns)]
        
        # Mapear columnas
        col_map = {}
        for col in df.columns:
            cl = str(col).lower().strip()
            if cl in ('n°', 'no', 'num', 'numero', 'número', '#', 'n'):
                col_map['numero'] = col
            elif 'fecha' in cl:
                col_map['fecha'] = col
            elif 'codigo' in cl or 'código' in cl or (cl == 'cuenta' and 'cuenta' not in col_map):
                col_map['cuenta'] = col
            elif 'nombre' in cl or (cl == 'cuenta' and 'cuenta' in col_map):
                col_map['nombre_cuenta'] = col
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
            return {'error': 'No se encontró columna de cuenta/código', 'columnas': list(df.columns)}
        
        # Determinar modo de agrupación: por N° o por fecha
        use_numero = 'numero' in col_map
        
        # Procesar filas
        asientos = []
        current_asiento = None
        current_movs = []
        current_key = None  # N° del asiento o fecha
        
        for idx, row in df.iterrows():
            # Determinar si es un nuevo asiento
            new_asiento = False
            fecha = None
            numero = None
            
            if use_numero:
                num_val = row.get(col_map.get('numero'))
                if pd.notna(num_val):
                    num_str = str(num_val).replace('.0', '').strip()
                    if num_str and num_str != current_key:
                        new_asiento = True
                        current_key = num_str
                        numero = num_str
            
            fecha_val = row.get(col_map.get('fecha'))
            if pd.notna(fecha_val):
                try:
                    if isinstance(fecha_val, (datetime, pd.Timestamp)):
                        fecha = fecha_val.date() if hasattr(fecha_val, 'date') else fecha_val
                    else:
                        fecha = pd.to_datetime(fecha_val).date()
                    if not use_numero:
                        new_asiento = True
                except:
                    pass
            
            if new_asiento:
                # Guardar asiento anterior
                if current_asiento and current_movs:
                    current_asiento['movimientos'] = current_movs
                    current_asiento['total_debito'] = sum(m['debito'] for m in current_movs)
                    current_asiento['total_credito'] = sum(m['credito'] for m in current_movs)
                    current_asiento['cuadra'] = abs(current_asiento['total_debito'] - current_asiento['total_credito']) < 1
                    asientos.append(current_asiento)
                
                concepto = str(row.get(col_map.get('concepto', ''), '')).strip()
                if concepto == 'nan':
                    concepto = ''
                current_asiento = {
                    'numero': numero or '',
                    'fecha': fecha.isoformat() if fecha else '',
                    'concepto': concepto or f'Asiento {numero or ""}',
                }
                current_movs = []
            
            # Update fecha if we have it (in N° mode, fecha might appear on first row)
            if fecha and current_asiento and not current_asiento.get('fecha'):
                current_asiento['fecha'] = fecha.isoformat()
            
            # Agregar movimiento
            cuenta_codigo = row.get(col_map.get('cuenta'))
            if pd.notna(cuenta_codigo) and current_asiento:
                cuenta_codigo = str(cuenta_codigo).strip().replace('.0', '')
                
                cuenta = Cuenta.objects.filter(empresa=empresa, codigo=cuenta_codigo).first()
                
                debito = self._parse_num(row.get(col_map.get('debito', ''), 0))
                credito = self._parse_num(row.get(col_map.get('credito', ''), 0))
                
                # Concepto del movimiento (descripción individual)
                mov_concepto = str(row.get(col_map.get('concepto', ''), '')).strip()
                if mov_concepto == 'nan':
                    mov_concepto = ''
                
                # Tercero
                tercero_val = str(row.get(col_map.get('tercero', ''), '')).strip()
                if tercero_val == 'nan':
                    tercero_val = ''
                
                if debito > 0 or credito > 0:
                    current_movs.append({
                        'cuenta_codigo': cuenta_codigo,
                        'cuenta_nombre': cuenta.nombre if cuenta else '❌ NO ENCONTRADA',
                        'cuenta_id': cuenta.id if cuenta else None,
                        'debito': debito,
                        'credito': credito,
                        'concepto': mov_concepto,
                        'tercero': tercero_val,
                        'valido': cuenta is not None,
                    })
        
        # Último asiento
        if current_asiento and current_movs:
            current_asiento['movimientos'] = current_movs
            current_asiento['total_debito'] = sum(m['debito'] for m in current_movs)
            current_asiento['total_credito'] = sum(m['credito'] for m in current_movs)
            current_asiento['cuadra'] = abs(current_asiento['total_debito'] - current_asiento['total_credito']) < 1
            asientos.append(current_asiento)
        
        if preview:
            return {
                'preview': True,
                'empresa': empresa.razon_social,
                'total_asientos': len(asientos),
                'total_movimientos': sum(len(a['movimientos']) for a in asientos),
                'asientos': asientos,
            }
        
        # Guardar
        return self._guardar_asientos(empresa, asientos)

    def _guardar_asientos(self, empresa, asientos_data):
        from django.db import transaction
        
        tercero = Tercero.objects.filter(empresa=empresa).first()
        if not tercero:
            tercero, _ = Tercero.objects.get_or_create(
                empresa=empresa,
                numero_documento='00000000',
                defaults={
                    'tipo_documento': 'NIT',
                    'nombre_razon_social': 'Tercero Importación',
                    'tipo_tercero': 'OTR',
                }
            )
        
        creados = 0
        movs_creados = 0
        errores = []
        
        with transaction.atomic():
            for a in asientos_data:
                movs_validos = [m for m in a['movimientos'] if m['cuenta_id']]
                if not movs_validos:
                    errores.append(f"{a['fecha']}: Sin cuentas válidas")
                    continue
                
                if not a.get('cuadra', False):
                    errores.append(f"{a['fecha']}: No cuadra")
                    continue
                
                fecha = datetime.fromisoformat(a['fecha']).date()
                asiento = AsientoContable.objects.create(
                    empresa=empresa,
                    fecha=fecha,
                    concepto=a['concepto'],
                    tercero=tercero,
                    fiscal_year=fecha.year,
                    fiscal_period=fecha.month,
                )
                creados += 1
                
                for m in movs_validos:
                    MovimientoContable.objects.create(
                        asiento=asiento,
                        cuenta_id=m['cuenta_id'],
                        debito=Decimal(str(m['debito'])),
                        credito=Decimal(str(m['credito'])),
                    )
                    movs_creados += 1
        
        return {
            'success': True,
            'asientos_creados': creados,
            'movimientos_creados': movs_creados,
            'errores': errores,
        }

    def _parse_num(self, value):
        if pd.isna(value) or value == '' or value is None:
            return 0.0
        try:
            clean = str(value).replace('$', '').replace(',', '').replace(' ', '').strip()
            return float(clean)
        except:
            return 0.0

# ============================================================================
# 🎩 ESTADOS FINANCIEROS NIIF - Don Peppini Contadore
# AGREGAR AL FINAL DE contabilidad/views.py
# ============================================================================

from django.db.models import Sum, Q, F
from django.db.models.functions import Coalesce


class EstadoSituacionFinancieraView(views.APIView):
    """
    🎩 Estado de Situación Financiera (Balance General) - NIIF Pymes
    
    Estructura según Sección 4 NIIF para Pymes:
    - Activos (corrientes y no corrientes)
    - Pasivos (corrientes y no corrientes)
    - Patrimonio
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        fecha_corte = request.query_params.get('fecha_corte')
        
        if not empresa_id:
            return Response({'error': 'Empresa es requerida'}, status=400)
        if not fecha_corte:
            return Response({'error': 'Fecha de corte es requerida'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        def saldo_cuenta(prefijo):
            """Calcula saldo de cuentas que empiezan con el prefijo"""
            result = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__lte=fecha_corte,
                asiento__estado='vigente',
                cuenta__codigo__startswith=prefijo
            ).aggregate(
                debitos=Coalesce(Sum('debito'), Decimal('0')),
                creditos=Coalesce(Sum('credito'), Decimal('0'))
            )
            return result['debitos'] - result['creditos']
        
        def detalle_clase(clase):
            """Obtiene detalle por grupos de una clase - derivado de movimientos reales"""
            # Obtener todos los movimientos de la clase agrupados por los primeros 2 dígitos
            from django.db.models.functions import Substr
            
            grupos = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__lte=fecha_corte,
                asiento__estado='vigente',
                cuenta__codigo__startswith=str(clase)
            ).annotate(
                grupo=Substr('cuenta__codigo', 1, 2)
            ).values('grupo').annotate(
                debitos=Coalesce(Sum('debito'), Decimal('0')),
                creditos=Coalesce(Sum('credito'), Decimal('0'))
            ).order_by('grupo')
            
            # Buscar nombres de los grupos
            detalle = []
            for g in grupos:
                saldo_raw = g['debitos'] - g['creditos']
                if saldo_raw == 0:
                    continue
                
                # Buscar nombre del grupo en PUC
                cuenta_grupo = Cuenta.objects.filter(
                    empresa=empresa,
                    codigo=g['grupo']
                ).first()
                
                # Si no existe el grupo, buscar la primera cuenta del grupo para inferir nombre
                if not cuenta_grupo:
                    primera = Cuenta.objects.filter(
                        empresa=empresa,
                        codigo__startswith=g['grupo']
                    ).first()
                    nombre_grupo = primera.nombre if primera else f"Grupo {g['grupo']}"
                    # Limpiar nombre para nivel grupo
                    NOMBRES_GRUPO = {
                        '11': 'Disponible', '12': 'Inversiones', '13': 'Deudores',
                        '14': 'Inventarios', '15': 'Propiedad, planta y equipo',
                        '16': 'Intangibles', '17': 'Diferidos', '18': 'Otros activos',
                        '19': 'Valorizaciones',
                        '21': 'Obligaciones financieras', '22': 'Proveedores',
                        '23': 'Cuentas por pagar', '24': 'Impuestos',
                        '25': 'Obligaciones laborales', '26': 'Pasivos estimados',
                        '27': 'Diferidos', '28': 'Otros pasivos', '29': 'Bonos',
                        '31': 'Capital social', '32': 'Superávit capital',
                        '33': 'Reservas', '34': 'Revalorización patrimonio',
                        '36': 'Resultados del ejercicio', '37': 'Resultados ej. anteriores',
                        '38': 'Superávit por valorizaciones',
                    }
                    nombre_grupo = NOMBRES_GRUPO.get(g['grupo'], nombre_grupo)
                else:
                    nombre_grupo = cuenta_grupo.nombre
                
                saldo = float(saldo_raw) if clase == 1 else float(saldo_raw) * -1
                detalle.append({
                    'codigo': g['grupo'],
                    'nombre': nombre_grupo,
                    'saldo': saldo
                })
            return detalle
        
        # ACTIVOS (Clase 1)
        activos_detalle = detalle_clase(1)
        total_activos = sum((Decimal(str(a['saldo'])) for a in activos_detalle), Decimal('0'))
        
        # Clasificación corriente/no corriente por defecto
        ACTIVOS_CORRIENTES = {'11', '12', '13', '14'}  # Disponible, Inversiones CP, Deudores, Inventarios
        PASIVOS_CORRIENTES = {'21', '22', '23', '24', '25'}  # Obl. financieras CP, Proveedores, CxP, Impuestos, Laborales
        
        # Permitir override desde query params: ?corrientes=15,17&no_corrientes=12
        override_corrientes = set(request.query_params.get('act_corrientes', '').split(',')) - {''}
        override_no_corrientes = set(request.query_params.get('act_no_corrientes', '').split(',')) - {''}
        
        activos_corrientes = []
        activos_no_corrientes = []
        for a in activos_detalle:
            cod = a['codigo']
            if cod in override_corrientes:
                is_corriente = True
            elif cod in override_no_corrientes:
                is_corriente = False
            else:
                is_corriente = cod in ACTIVOS_CORRIENTES
            a['corriente'] = is_corriente
            if is_corriente:
                activos_corrientes.append(a)
            else:
                activos_no_corrientes.append(a)
        
        # PASIVOS (Clase 2)
        pasivos_detalle = detalle_clase(2)
        total_pasivos = sum((Decimal(str(p['saldo'])) for p in pasivos_detalle), Decimal('0'))
        
        override_pas_corrientes = set(request.query_params.get('pas_corrientes', '').split(',')) - {''}
        override_pas_no_corrientes = set(request.query_params.get('pas_no_corrientes', '').split(',')) - {''}
        
        pasivos_corrientes = []
        pasivos_no_corrientes = []
        for p in pasivos_detalle:
            cod = p['codigo']
            if cod in override_pas_corrientes:
                is_corriente = True
            elif cod in override_pas_no_corrientes:
                is_corriente = False
            else:
                is_corriente = cod in PASIVOS_CORRIENTES
            p['corriente'] = is_corriente
            if is_corriente:
                pasivos_corrientes.append(p)
            else:
                pasivos_no_corrientes.append(p)
        
        # PATRIMONIO (Clase 3)
        patrimonio_detalle = detalle_clase(3)
        total_patrimonio_base = sum((Decimal(str(p['saldo'])) for p in patrimonio_detalle), Decimal('0'))
        
        # Resultado del ejercicio (Ingresos - Gastos - Costos)
        ingresos = saldo_cuenta('4') * -1  # Naturaleza crédito
        gastos = saldo_cuenta('5')  # Naturaleza débito
        costos = saldo_cuenta('6')  # Naturaleza débito
        resultado_ejercicio = ingresos - gastos - costos
        
        total_patrimonio = total_patrimonio_base + resultado_ejercicio
        
        # Verificación ecuación contable
        ecuacion_ok = abs(float(total_activos) - float(total_pasivos + total_patrimonio)) < 1
        
        return Response({
            'empresa': {
                'nit': empresa.nit,
                'razon_social': empresa.razon_social,
            },
            'fecha_corte': fecha_corte,
            'titulo': 'Estado de Situación Financiera',
            'norma': 'NIIF para Pymes - Sección 4',
            
            'activos': {
                'corrientes': {
                    'detalle': activos_corrientes,
                    'total': float(sum((a['saldo'] for a in activos_corrientes), 0)),
                },
                'no_corrientes': {
                    'detalle': activos_no_corrientes,
                    'total': float(sum((a['saldo'] for a in activos_no_corrientes), 0)),
                },
                'total': float(total_activos),
            },
            
            'pasivos': {
                'corrientes': {
                    'detalle': pasivos_corrientes,
                    'total': float(sum((p['saldo'] for p in pasivos_corrientes), 0)),
                },
                'no_corrientes': {
                    'detalle': pasivos_no_corrientes,
                    'total': float(sum((p['saldo'] for p in pasivos_no_corrientes), 0)),
                },
                'total': float(total_pasivos),
            },
            
            'patrimonio': {
                'detalle': patrimonio_detalle,
                'resultado_ejercicio': float(resultado_ejercicio),
                'total': float(total_patrimonio),
            },
            
            'verificacion': {
                'activos': float(total_activos),
                'pasivos_patrimonio': float(total_pasivos + total_patrimonio),
                'ecuacion_ok': ecuacion_ok,
            }
        })


class EstadoResultadosIntegralView(views.APIView):
    """
    🎩 Estado de Resultados Integral - NIIF Pymes
    
    Estructura según Sección 5 NIIF para Pymes
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')
        
        if not all([empresa_id, fecha_inicio, fecha_fin]):
            return Response({'error': 'Empresa, fecha_inicio y fecha_fin son requeridos'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        def saldo_periodo(prefijo):
            result = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=prefijo
            ).aggregate(
                debitos=Coalesce(Sum('debito'), Decimal('0')),
                creditos=Coalesce(Sum('credito'), Decimal('0'))
            )
            return result['debitos'] - result['creditos']
        
        def detalle_grupo(clase):
            """Obtiene detalle por grupos"""
            cuentas = Cuenta.objects.filter(
                empresa=empresa,
                codigo__startswith=str(clase),
                codigo__regex=r'^\d{2}$'
            ).order_by('codigo')
            
            detalle = []
            for cuenta in cuentas:
                movs = MovimientoContable.objects.filter(
                    asiento__empresa=empresa,
                    asiento__fecha__gte=fecha_inicio,
                    asiento__fecha__lte=fecha_fin,
                    asiento__estado='vigente',
                    cuenta__codigo__startswith=cuenta.codigo
                ).aggregate(
                    debitos=Coalesce(Sum('debito'), Decimal('0')),
                    creditos=Coalesce(Sum('credito'), Decimal('0'))
                )
                saldo = movs['creditos'] - movs['debitos'] if clase == 4 else movs['debitos'] - movs['creditos']
                if saldo != 0:
                    detalle.append({
                        'codigo': cuenta.codigo,
                        'nombre': cuenta.nombre,
                        'valor': float(saldo)
                    })
            return detalle
        
        # INGRESOS (Clase 4)
        ingresos_detalle = detalle_grupo(4)
        total_ingresos = sum(i['valor'] for i in ingresos_detalle)
        
        # COSTOS DE VENTAS (Clase 6)
        costos_detalle = detalle_grupo(6)
        total_costos = sum(c['valor'] for c in costos_detalle)
        
        utilidad_bruta = total_ingresos - total_costos
        
        # GASTOS (Clase 5)
        gastos_detalle = detalle_grupo(5)
        
        # Separar gastos operacionales y no operacionales
        gastos_admin = [g for g in gastos_detalle if g['codigo'] in ['51']]
        gastos_ventas = [g for g in gastos_detalle if g['codigo'] in ['52']]
        gastos_no_operacionales = [g for g in gastos_detalle if g['codigo'] in ['53', '54']]
        
        total_gastos_operacionales = sum(g['valor'] for g in gastos_admin) + sum(g['valor'] for g in gastos_ventas)
        utilidad_operacional = utilidad_bruta - total_gastos_operacionales
        
        # Ingresos/gastos no operacionales
        total_gastos_no_op = sum(g['valor'] for g in gastos_no_operacionales)
        
        utilidad_antes_impuestos = utilidad_operacional - total_gastos_no_op
        
        # Impuesto de renta (simplificado - 35% si hay utilidad)
        impuesto_renta = max(0, utilidad_antes_impuestos * Decimal('0.35')) if utilidad_antes_impuestos > 0 else 0
        
        utilidad_neta = utilidad_antes_impuestos - float(impuesto_renta)
        
        return Response({
            'empresa': {
                'nit': empresa.nit,
                'razon_social': empresa.razon_social,
            },
            'periodo': {
                'inicio': fecha_inicio,
                'fin': fecha_fin,
            },
            'titulo': 'Estado de Resultados Integral',
            'norma': 'NIIF para Pymes - Sección 5',
            
            'ingresos': {
                'operacionales': {
                    'detalle': ingresos_detalle,
                    'total': total_ingresos,
                },
                'total': total_ingresos,
            },
            
            'costos': {
                'detalle': costos_detalle,
                'total': total_costos,
            },
            
            'utilidad_bruta': utilidad_bruta,
            
            'gastos': {
                'administracion': {
                    'detalle': gastos_admin,
                    'total': sum(g['valor'] for g in gastos_admin),
                },
                'ventas': {
                    'detalle': gastos_ventas,
                    'total': sum(g['valor'] for g in gastos_ventas),
                },
                'total_operacionales': total_gastos_operacionales,
                'no_operacionales': {
                    'detalle': gastos_no_operacionales,
                    'total': total_gastos_no_op,
                },
            },
            
            'utilidad_operacional': utilidad_operacional,
            'utilidad_antes_impuestos': utilidad_antes_impuestos,
            'impuesto_renta': float(impuesto_renta),
            'utilidad_neta': utilidad_neta,
        })


class EstadoCambiosPatrimonioView(views.APIView):
    """
    🎩 Estado de Cambios en el Patrimonio - NIIF Pymes
    
    Estructura según Sección 6 NIIF para Pymes
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')
        
        if not all([empresa_id, fecha_inicio, fecha_fin]):
            return Response({'error': 'Empresa, fecha_inicio y fecha_fin son requeridos'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        # Cuentas de patrimonio principales
        componentes = [
            ('31', 'Capital Social'),
            ('32', 'Superávit de Capital'),
            ('33', 'Reservas'),
            ('34', 'Revalorización del Patrimonio'),
            ('36', 'Resultados del Ejercicio'),
            ('37', 'Resultados de Ejercicios Anteriores'),
        ]
        
        resultado = []
        total_inicial = Decimal('0')
        total_final = Decimal('0')
        
        for codigo, nombre in componentes:
            # Saldo inicial (antes de fecha_inicio)
            inicial = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__lt=fecha_inicio,
                asiento__estado='vigente',
                cuenta__codigo__startswith=codigo
            ).aggregate(
                debitos=Coalesce(Sum('debito'), Decimal('0')),
                creditos=Coalesce(Sum('credito'), Decimal('0'))
            )
            saldo_inicial = (inicial['creditos'] - inicial['debitos'])
            
            # Movimientos del periodo
            periodo = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=codigo
            ).aggregate(
                debitos=Coalesce(Sum('debito'), Decimal('0')),
                creditos=Coalesce(Sum('credito'), Decimal('0'))
            )
            aumentos = periodo['creditos']
            disminuciones = periodo['debitos']
            
            saldo_final = saldo_inicial + aumentos - disminuciones
            
            if saldo_inicial != 0 or aumentos != 0 or disminuciones != 0:
                resultado.append({
                    'codigo': codigo,
                    'concepto': nombre,
                    'saldo_inicial': float(saldo_inicial),
                    'aumentos': float(aumentos),
                    'disminuciones': float(disminuciones),
                    'saldo_final': float(saldo_final),
                })
                total_inicial += saldo_inicial
                total_final += saldo_final
        
        # Agregar resultado del ejercicio actual
        ingresos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='4'
        ).aggregate(
            debitos=Coalesce(Sum('debito'), Decimal('0')),
            creditos=Coalesce(Sum('credito'), Decimal('0'))
        )
        gastos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='5'
        ).aggregate(
            debitos=Coalesce(Sum('debito'), Decimal('0')),
            creditos=Coalesce(Sum('credito'), Decimal('0'))
        )
        costos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='6'
        ).aggregate(
            debitos=Coalesce(Sum('debito'), Decimal('0')),
            creditos=Coalesce(Sum('credito'), Decimal('0'))
        )
        
        utilidad_periodo = (ingresos['creditos'] - ingresos['debitos']) - (gastos['debitos'] - gastos['creditos']) - (costos['debitos'] - costos['creditos'])
        
        resultado.append({
            'codigo': 'RES',
            'concepto': 'Resultado del Periodo',
            'saldo_inicial': 0,
            'aumentos': float(utilidad_periodo) if utilidad_periodo > 0 else 0,
            'disminuciones': float(abs(utilidad_periodo)) if utilidad_periodo < 0 else 0,
            'saldo_final': float(utilidad_periodo),
        })
        
        total_final += utilidad_periodo
        
        return Response({
            'empresa': {
                'nit': empresa.nit,
                'razon_social': empresa.razon_social,
            },
            'periodo': {
                'inicio': fecha_inicio,
                'fin': fecha_fin,
            },
            'titulo': 'Estado de Cambios en el Patrimonio',
            'norma': 'NIIF para Pymes - Sección 6',
            'componentes': resultado,
            'totales': {
                'saldo_inicial': float(total_inicial),
                'saldo_final': float(total_final),
            }
        })


class EstadoFlujosEfectivoView(views.APIView):
    """
    🎩 Estado de Flujos de Efectivo - Método Indirecto con modelo CTNO
    
    GET /api/contabilidad/niif/flujos-efectivo/
    Params: empresa, fecha_inicio, fecha_fin
    
    Genera automáticamente:
    1. Tabla de variaciones con clasificación por cuenta
    2. EFE completo con EGO, Variación CTNO, EAI, EAF
    3. Verificación cruzada con balance
    """
    permission_classes = [IsAuthenticated]

    # ── Reglas de clasificación por prefijo PUC ──────────────────────────
    # Orden: de más específico a más general (el primero que haga match gana)
    CLASIFICACION_RULES = [
        # EFECTIVO (verificación)
        ('110', 'VERIF'),   # Caja
        ('111', 'VERIF'),   # Bancos
        ('112', 'VERIF'),   # Cuentas de ahorro
        ('11',  'VERIF'),   # Todo disponible

        # PARTIDAS QUE NO AFECTAN EFECTIVO
        ('1592', 'NO-EF'),  # Depreciación acumulada PPE
        ('1598', 'NO-EF'),  # Depreciación acumulada otros
        ('1699', 'NO-EF'),  # Amortización acumulada intangibles
        ('1499', 'NO-EF'),  # Provisiones inventarios

        # ACTIVOS OPERATIVOS CORRIENTES (CTNO-A)
        ('13',   'CTNO-A'), # Deudores / CxC
        ('14',   'CTNO-A'), # Inventarios
        ('1705', 'CTNO-A'), # Gastos pagados por anticipado (operacional)
        ('240810', 'CTNO-A'), # IVA descontable (es un activo)

        # INVERSIÓN (EAI)
        ('12',   'EAI'),    # Inversiones
        ('15',   'EAI'),    # Propiedad, Planta y Equipo
        ('16',   'EAI'),    # Intangibles
        ('17',   'EAI'),    # Diferidos (no operacionales → inversión)
        ('18',   'EAI'),    # Otros activos no corrientes
        ('19',   'EAI'),    # Valorizaciones

        # PASIVOS OPERATIVOS CORRIENTES (CTNO-P)
        ('22',   'CTNO-P'), # Proveedores
        ('23',   'CTNO-P'), # CxP, Retenciones, Aportes
        ('2408', 'CTNO-P'), # IVA (generado = pasivo)
        ('24',   'CTNO-P'), # Impuestos
        ('25',   'CTNO-P'), # Obligaciones laborales
        ('26',   'CTNO-P'), # Otros pasivos corrientes
        ('27',   'CTNO-P'), # Diferidos pasivos
        ('28',   'CTNO-P'), # Otros pasivos

        # FINANCIACIÓN (EAF)
        ('21',   'EAF'),    # Obligaciones financieras
        ('29',   'EAF'),    # Bonos y papeles comerciales
        ('3',    'EAF'),    # Patrimonio
    ]

    def _clasificar_cuenta(self, codigo):
        """Clasifica una cuenta según su código PUC"""
        for prefijo, clasificacion in self.CLASIFICACION_RULES:
            if codigo.startswith(prefijo):
                return clasificacion
        return 'CTNO-A'  # Default: operativo

    def _nombre_grupo(self, codigo):
        """Agrupa cuentas para presentación resumida en el EFE"""
        GRUPOS = {
            '1105': 'Caja',
            '1110': 'Bancos',
            '1112': 'Cuentas de ahorro',
            '13':   'Deudores comerciales',
            '1355': 'Anticipos de impuestos',
            '14':   'Inventarios',
            '1499': 'Provisión inventarios',
            '1592': 'Depreciación acumulada',
            '1598': 'Depreciación acum. otros',
            '1699': 'Amortización acumulada',
            '1705': 'Gastos anticipados',
            '15':   'Propiedad, planta y equipo',
            '16':   'Intangibles',
            '17':   'Diferidos / Intangibles',
            '12':   'Inversiones',
            '21':   'Obligaciones financieras',
            '22':   'Proveedores',
            '2335': 'Costos y gastos por pagar',
            '2365': 'Retención en la fuente',
            '2367': 'IVA retenido',
            '2370': 'Retenciones nómina',
            '2408': 'IVA',
            '240810': 'IVA descontable',
            '2505': 'Salarios por pagar',
            '2510': 'Cesantías',
            '2515': 'Int. cesantías',
            '2520': 'Prima de servicios',
            '2525': 'Vacaciones',
            '25':   'Obligaciones laborales',
            '31':   'Capital social',
            '33':   'Reservas',
            '34':   'Revalorización patrimonio',
            '36':   'Resultados ejercicio',
            '37':   'Resultados ej. anteriores',
            '38':   'Superávit',
        }
        for prefijo, nombre in sorted(GRUPOS.items(), key=lambda x: -len(x[0])):
            if codigo.startswith(prefijo):
                return nombre
        return 'Otro'

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')

        if not all([empresa_id, fecha_inicio, fecha_fin]):
            return Response({
                'error': 'Empresa, fecha_inicio y fecha_fin son requeridos'
            }, status=400)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)

        # ── 1. CALCULAR RESULTADO NETO ──────────────────────────────────
        def saldo_clase(clase_prefix):
            agg = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=clase_prefix
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            if clase_prefix == '4':
                return agg['c'] - agg['d']  # Ingresos: naturaleza crédito
            return agg['d'] - agg['c']  # Gastos/Costos: naturaleza débito

        ingresos = saldo_clase('4')
        gastos = saldo_clase('5')
        costos = saldo_clase('6')
        resultado_neto = ingresos - gastos - costos

        # ── 2. CALCULAR VARIACIONES POR CUENTA ──────────────────────────
        # Obtener todas las cuentas con movimientos en el periodo o antes
        cuentas_con_movimiento = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__regex=r'^[1-3]'  # Solo balance (1,2,3)
        ).values(
            'cuenta__codigo',
            'cuenta__nombre'
        ).distinct()

        variaciones = []
        for c in cuentas_con_movimiento:
            codigo = c['cuenta__codigo']
            nombre = c['cuenta__nombre']

            # Saldo inicial (antes del periodo)
            si = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__lt=fecha_inicio,
                asiento__estado='vigente',
                cuenta__codigo=codigo
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            saldo_ini = si['d'] - si['c']

            # Saldo final (hasta fin del periodo)
            sf = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo=codigo
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            saldo_fin = sf['d'] - sf['c']

            variacion = saldo_fin - saldo_ini
            clasificacion = self._clasificar_cuenta(codigo)

            # Para EAI con amortización directa (17xx, 16xx),
            # separar débitos (adquisiciones) y créditos (amortización)
            debitos_periodo = Decimal('0')
            creditos_periodo = Decimal('0')
            if clasificacion == 'EAI' and (codigo.startswith('17') or codigo.startswith('16')):
                period_movs = MovimientoContable.objects.filter(
                    asiento__empresa=empresa,
                    asiento__fecha__gte=fecha_inicio,
                    asiento__fecha__lte=fecha_fin,
                    asiento__estado='vigente',
                    cuenta__codigo=codigo
                ).aggregate(
                    d=Coalesce(Sum('debito'), Decimal('0')),
                    c=Coalesce(Sum('credito'), Decimal('0'))
                )
                debitos_periodo = period_movs['d']
                creditos_periodo = period_movs['c']

            if variacion != 0 or saldo_ini != 0 or saldo_fin != 0:
                variaciones.append({
                    'codigo': codigo,
                    'nombre': nombre,
                    'saldo_inicial': saldo_ini,
                    'saldo_final': saldo_fin,
                    'variacion': variacion,
                    'clasificacion': clasificacion,
                    'grupo': self._nombre_grupo(codigo),
                    'debitos_periodo': debitos_periodo,
                    'creditos_periodo': creditos_periodo,
                })

        # ── 3. CONSTRUIR EFE ────────────────────────────────────────────

        # --- Partidas que no afectan efectivo (add-back) ---
        partidas_no_ef = []
        total_no_ef = Decimal('0')
        for v in variaciones:
            if v['clasificacion'] == 'NO-EF':
                efecto = -v['variacion']  # Dep acumulada ↑ → efecto positivo
                partidas_no_ef.append({
                    'codigo': v['codigo'],
                    'nombre': v['nombre'],
                    'valor': float(efecto),
                })
                total_no_ef += efecto

        # Para EAI con amortización directa: add-back los créditos (amortización)
        for v in variaciones:
            if v['clasificacion'] == 'EAI' and v['creditos_periodo'] > 0:
                # El crédito en un diferido = amortización = no afecta efectivo
                partidas_no_ef.append({
                    'codigo': v['codigo'],
                    'nombre': f"Amort. {v['nombre']}",
                    'valor': float(v['creditos_periodo']),
                })
                total_no_ef += v['creditos_periodo']

        ego = resultado_neto + total_no_ef

        # --- Variación CTNO ---
        # Agrupar por grupo para presentación limpia
        ctno_items = {}
        total_ctno = Decimal('0')
        for v in variaciones:
            if v['clasificacion'] in ('CTNO-A', 'CTNO-P'):
                efecto = -v['variacion']  # Activo ↑ → efectivo ↓, Pasivo ↑ → efectivo ↑
                grupo = v['grupo']
                if grupo not in ctno_items:
                    ctno_items[grupo] = {
                        'nombre': grupo,
                        'valor': Decimal('0'),
                        'detalle': [],
                    }
                ctno_items[grupo]['valor'] += efecto
                ctno_items[grupo]['detalle'].append({
                    'codigo': v['codigo'],
                    'nombre': v['nombre'],
                    'variacion': float(v['variacion']),
                    'efecto': float(efecto),
                })
                total_ctno += efecto

        ctno_list = sorted(ctno_items.values(), key=lambda x: x['detalle'][0]['codigo'])
        for item in ctno_list:
            item['valor'] = float(item['valor'])

        total_eao = ego + total_ctno

        # --- Actividades de Inversión (EAI) ---
        eai_items = {}
        total_eai = Decimal('0')
        for v in variaciones:
            if v['clasificacion'] == 'EAI':
                # Para cuentas con amortización directa, usar débitos brutos
                if v['debitos_periodo'] > 0 or v['creditos_periodo'] > 0:
                    efecto = -v['debitos_periodo']  # Solo cash out por adquisiciones
                else:
                    efecto = -v['variacion']  # PPE (dep es en cuenta separada)

                if efecto != 0:
                    grupo = v['grupo']
                    if grupo not in eai_items:
                        eai_items[grupo] = {
                            'nombre': grupo,
                            'valor': Decimal('0'),
                            'detalle': [],
                        }
                    eai_items[grupo]['valor'] += efecto
                    eai_items[grupo]['detalle'].append({
                        'codigo': v['codigo'],
                        'nombre': v['nombre'],
                        'efecto': float(efecto),
                    })
                    total_eai += efecto

        eai_list = sorted(eai_items.values(), key=lambda x: x['detalle'][0]['codigo'])
        for item in eai_list:
            item['valor'] = float(item['valor'])

        # --- Actividades de Financiación (EAF) ---
        eaf_items = {}
        total_eaf = Decimal('0')
        for v in variaciones:
            if v['clasificacion'] == 'EAF':
                efecto = -v['variacion']
                # Patrimonio: aportes de capital ↑ → entrada de efectivo
                # Obligaciones financieras ↑ → entrada de efectivo
                if v['codigo'].startswith('2'):
                    efecto = -v['variacion']  # Pasivo ↑ (variación negativa en D-C) → efecto positivo
                elif v['codigo'].startswith('3'):
                    efecto = -v['variacion']  # Patrimonio ↑ (variación negativa en D-C) → efecto positivo

                if efecto != 0:
                    grupo = v['grupo']
                    if grupo not in eaf_items:
                        eaf_items[grupo] = {
                            'nombre': grupo,
                            'valor': Decimal('0'),
                            'detalle': [],
                        }
                    eaf_items[grupo]['valor'] += efecto
                    eaf_items[grupo]['detalle'].append({
                        'codigo': v['codigo'],
                        'nombre': v['nombre'],
                        'efecto': float(efecto),
                    })
                    total_eaf += efecto

        eaf_list = sorted(eaf_items.values(), key=lambda x: x['detalle'][0]['codigo'])
        for item in eaf_list:
            item['valor'] = float(item['valor'])

        # --- Resumen ---
        variacion_neta = total_eao + total_eai + total_eaf

        # Efectivo inicial y final (verificación)
        ef_ini = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__lt=fecha_inicio,
            asiento__estado='vigente',
            cuenta__codigo__startswith='11'
        ).aggregate(
            d=Coalesce(Sum('debito'), Decimal('0')),
            c=Coalesce(Sum('credito'), Decimal('0'))
        )
        efectivo_inicial = ef_ini['d'] - ef_ini['c']

        ef_fin = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='11'
        ).aggregate(
            d=Coalesce(Sum('debito'), Decimal('0')),
            c=Coalesce(Sum('credito'), Decimal('0'))
        )
        efectivo_final_balance = ef_fin['d'] - ef_fin['c']
        efectivo_final_calc = efectivo_inicial + variacion_neta

        cuadra = abs(efectivo_final_calc - efectivo_final_balance) < Decimal('1')

        # ── 4. TABLA DE VARIACIONES (para exportación) ──────────────────
        tabla_variaciones = [{
            'codigo': v['codigo'],
            'nombre': v['nombre'],
            'saldo_inicial': float(v['saldo_inicial']),
            'saldo_final': float(v['saldo_final']),
            'variacion': float(v['variacion']),
            'clasificacion': v['clasificacion'],
            'efecto_efe': float(-v['variacion']) if v['clasificacion'] not in ('VERIF', 'EAI', 'EAF') else 0,
        } for v in variaciones if v['variacion'] != 0]

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

            # EAO - Efectivo Actividades de Operación
            'operacion': {
                'resultado_neto': float(resultado_neto),
                'detalle_resultado': {
                    'ingresos': float(ingresos),
                    'costos': float(costos),
                    'gastos': float(gastos),
                },
                'partidas_no_efectivo': partidas_no_ef,
                'total_no_efectivo': float(total_no_ef),
                'ego': float(ego),
                'variacion_ctno': ctno_list,
                'total_ctno': float(total_ctno),
                'total': float(total_eao),
            },

            # EAI - Efectivo Actividades de Inversión
            'inversion': {
                'items': eai_list,
                'total': float(total_eai),
            },

            # EAF - Efectivo Actividades de Financiación
            'financiacion': {
                'items': eaf_list,
                'total': float(total_eaf),
            },

            # Resumen
            'resumen': {
                'variacion_neta': float(variacion_neta),
                'efectivo_inicial': float(efectivo_inicial),
                'efectivo_final_calculado': float(efectivo_final_calc),
                'efectivo_final_balance': float(efectivo_final_balance),
                'cuadra': cuadra,
            },

            # Tabla de variaciones completa
            'variaciones': tabla_variaciones,
        })

class MediosMagneticosView(views.APIView):
    """
    🎩 Generación de Medios Magnéticos DIAN
    GET /api/contabilidad/medios-magneticos/?empresa=1&year=2025
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        year = request.query_params.get('year')
        
        if not empresa_id or not year:
            return Response({'error': 'Empresa y año son requeridos'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
            year = int(year)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        except ValueError:
            return Response({'error': 'Año inválido'}, status=400)
        
        fecha_inicio = f'{year}-01-01'
        fecha_fin = f'{year}-12-31'
        
        wb = Workbook()
        wb.remove(wb.active)
        
        self._generar_1001(wb, empresa, fecha_inicio, fecha_fin, year)
        self._generar_1003(wb, empresa, fecha_inicio, fecha_fin, year)
        self._generar_1005(wb, empresa, fecha_inicio, fecha_fin, year)
        self._generar_1006(wb, empresa, fecha_inicio, fecha_fin, year)
        self._generar_1007(wb, empresa, fecha_inicio, fecha_fin, year)
        self._generar_1008(wb, empresa, fecha_fin, year)
        self._generar_1009(wb, empresa, fecha_fin, year)
        self._generar_1012(wb, empresa, fecha_fin, year)
        self._generar_2276(wb, empresa, fecha_inicio, fecha_fin, year)
        
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename=MediosMagneticos_{empresa.nit}_{year}.xlsx'
        
        return response

    def _estilo_encabezado(self):
        return {
            'font': Font(bold=True, color='FFFFFF', size=10),
            'fill': PatternFill(start_color='4F46E5', end_color='4F46E5', fill_type='solid'),
            'alignment': Alignment(horizontal='center', vertical='center', wrap_text=True),
            'border': Border(
                left=Side(style='thin'), right=Side(style='thin'),
                top=Side(style='thin'), bottom=Side(style='thin')
            )
        }

    def _aplicar_estilo_encabezado(self, ws, row, num_cols):
        estilo = self._estilo_encabezado()
        for col in range(1, num_cols + 1):
            cell = ws.cell(row=row, column=col)
            cell.font = estilo['font']
            cell.fill = estilo['fill']
            cell.alignment = estilo['alignment']
            cell.border = estilo['border']

    def _agregar_titulo(self, ws, empresa, titulo, year):
        ws.cell(row=1, column=1, value=empresa.razon_social)
        ws.cell(row=2, column=1, value=titulo)
        ws.cell(row=3, column=1, value=f'AG {year}')
        ws.cell(row=1, column=1).font = Font(bold=True, size=12)
        ws.cell(row=2, column=1).font = Font(bold=True, size=11, color='4F46E5')

    # =========================================================================
    # FORMATO 1001 - Pagos o abonos en cuenta y retenciones practicadas
    # =========================================================================
    def _generar_1001(self, wb, empresa, fecha_inicio, fecha_fin, year):
        ws = wb.create_sheet('1001')
        self._agregar_titulo(ws, empresa, '1001 - Pagos o abonos en cuenta y retenciones en la fuente practicadas', year)
        
        headers = [
            'Concepto', 'Tipo de documento', 'Número identificación',
            'Primer apellido del informado', 'Segundo apellido del informado',
            'Primer nombre del informado', 'Otros nombres del informado',
            'Razón social informado', 'Dirección', 'Código dpto', 'Código mcp',
            'País de Residencia o domicilio', 'Pago o abono en cuenta deducible',
            'Pago o abono en cuenta NO deducible', 'IVA mayor valor del costo o gasto deducible',
            'IVA mayor valor del costo o gasto NO deducible', 'Retención en la fuente practicada Renta',
            'Retención en la fuente asumida Renta', 'Retención en la fuente practicada IVA Régimen Común',
            'Retención en la fuente practicada IVA NO domiciliados'
        ]
        
        for col, header in enumerate(headers, 1):
            ws.cell(row=4, column=col, value=header)
        self._aplicar_estilo_encabezado(ws, 4, len(headers))
        
        # Datos: Gastos (clase 5 y 6) agrupados por tercero
        movimientos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__regex=r'^[56]'
        ).select_related('asiento__tercero', 'cuenta')
        
        datos_por_tercero = {}
        for mov in movimientos:
            tercero = mov.asiento.tercero
            if not tercero:
                continue
            
            key = tercero.id
            if key not in datos_por_tercero:
                datos_por_tercero[key] = {'tercero': tercero, 'pago_deducible': Decimal('0'), 'retencion_renta': Decimal('0')}
            
            datos_por_tercero[key]['pago_deducible'] += mov.debito
        
        # Retenciones practicadas (cuenta 2365xx)
        retenciones = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='2365'
        ).select_related('asiento__tercero')
        
        for ret in retenciones:
            tercero = ret.asiento.tercero
            if not tercero:
                continue
            key = tercero.id
            if key in datos_por_tercero:
                datos_por_tercero[key]['retencion_renta'] += ret.credito
        
        row = 5
        for data in datos_por_tercero.values():
            tercero = data['tercero']
            mm = get_tercero_mm_data(tercero)
            
            ws.cell(row=row, column=1, value='5016')
            ws.cell(row=row, column=2, value=mm['tipo_documento'])
            ws.cell(row=row, column=3, value=mm['numero_documento'])
            ws.cell(row=row, column=4, value=mm['primer_apellido'])
            ws.cell(row=row, column=5, value=mm['segundo_apellido'])
            ws.cell(row=row, column=6, value=mm['primer_nombre'])
            ws.cell(row=row, column=7, value=mm['otros_nombres'])
            ws.cell(row=row, column=8, value=mm['razon_social'])
            ws.cell(row=row, column=9, value=mm['direccion'])
            ws.cell(row=row, column=10, value=mm['codigo_dpto'])
            ws.cell(row=row, column=11, value=mm['codigo_mcp'])
            ws.cell(row=row, column=12, value=mm['codigo_pais'])
            ws.cell(row=row, column=13, value=float(data['pago_deducible']))
            ws.cell(row=row, column=14, value=0)
            ws.cell(row=row, column=15, value=0)
            ws.cell(row=row, column=16, value=0)
            ws.cell(row=row, column=17, value=float(data['retencion_renta']))
            ws.cell(row=row, column=18, value=0)
            ws.cell(row=row, column=19, value=0)
            ws.cell(row=row, column=20, value=0)
            row += 1
        
        if row == 5:
            ws.cell(row=5, column=1, value='SIN DATOS PARA ESTE FORMATO')

    # =========================================================================
    # FORMATO 1003 - Retenciones en la fuente que le practicaron
    # =========================================================================
    def _generar_1003(self, wb, empresa, fecha_inicio, fecha_fin, year):
        ws = wb.create_sheet('1003')
        self._agregar_titulo(ws, empresa, '1003 - Retenciones en la fuente que le practicaron', year)
        
        headers = [
            'Concepto', 'Tipo de documento', 'Número identificación del informado', 'DV',
            'Primer apellido del informado', 'Segundo apellido del informado',
            'Primer nombre del informado', 'Otros nombres del informado',
            'Razón social informado', 'Dirección', 'Código del Dpto', 'Código del Municipio',
            'Valor acumulado del pago o abono sujeto a Retención en la fuente',
            'Retención que le practicaron'
        ]
        
        for col, header in enumerate(headers, 1):
            ws.cell(row=4, column=col, value=header)
        self._aplicar_estilo_encabezado(ws, 4, len(headers))
        
        # Cuenta 1355 (Anticipo retención)
        movimientos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='1355'
        ).select_related('asiento__tercero')
        
        datos_por_tercero = {}
        for mov in movimientos:
            tercero = mov.asiento.tercero
            if not tercero:
                continue
            
            key = tercero.id
            if key not in datos_por_tercero:
                datos_por_tercero[key] = {'tercero': tercero, 'base': Decimal('0'), 'retencion': Decimal('0')}
            datos_por_tercero[key]['retencion'] += mov.debito
        
        row = 5
        for data in datos_por_tercero.values():
            tercero = data['tercero']
            mm = get_tercero_mm_data(tercero)
            
            ws.cell(row=row, column=1, value='5016')
            ws.cell(row=row, column=2, value=mm['tipo_documento'])
            ws.cell(row=row, column=3, value=mm['numero_documento'])
            ws.cell(row=row, column=4, value=mm['dv'])
            ws.cell(row=row, column=5, value=mm['primer_apellido'])
            ws.cell(row=row, column=6, value=mm['segundo_apellido'])
            ws.cell(row=row, column=7, value=mm['primer_nombre'])
            ws.cell(row=row, column=8, value=mm['otros_nombres'])
            ws.cell(row=row, column=9, value=mm['razon_social'])
            ws.cell(row=row, column=10, value=mm['direccion'])
            ws.cell(row=row, column=11, value=mm['codigo_dpto'])
            ws.cell(row=row, column=12, value=mm['codigo_mcp'])
            ws.cell(row=row, column=13, value=float(data['base']))
            ws.cell(row=row, column=14, value=float(data['retencion']))
            row += 1
        
        if row == 5:
            ws.cell(row=5, column=1, value='SIN DATOS PARA ESTE FORMATO')

    # =========================================================================
    # FORMATO 1005 - IVA Descontable
    # =========================================================================
    def _generar_1005(self, wb, empresa, fecha_inicio, fecha_fin, year):
        ws = wb.create_sheet('1005')
        self._agregar_titulo(ws, empresa, '1005 - Impuesto sobre las ventas - Descontable', year)
        
        headers = [
            'Tipo de documento', 'Número identificación', 'DV',
            'Primer apellido del informado', 'Segundo apellido del informado',
            'Primer nombre del informado', 'Otros nombres del informado',
            'Razón social informado', 'Impuesto Descontable',
            'IVA resultante por devoluciones en ventas anuladas, rescindidas o resueltas',
            'IVA tratado como mayor valor del costo o gasto (Art. 490 E. T.)'
        ]
        
        for col, header in enumerate(headers, 1):
            ws.cell(row=4, column=col, value=header)
        self._aplicar_estilo_encabezado(ws, 4, len(headers))
        
        # IVA en compras (débitos en 2408)
        movimientos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='2408',
            debito__gt=0
        ).select_related('asiento__tercero')
        
        datos_por_tercero = {}
        for mov in movimientos:
            tercero = mov.asiento.tercero
            if not tercero:
                continue
            
            key = tercero.id
            if key not in datos_por_tercero:
                datos_por_tercero[key] = {'tercero': tercero, 'iva_descontable': Decimal('0')}
            datos_por_tercero[key]['iva_descontable'] += mov.debito
        
        row = 5
        for data in datos_por_tercero.values():
            tercero = data['tercero']
            mm = get_tercero_mm_data(tercero)
            
            ws.cell(row=row, column=1, value=mm['tipo_documento'])
            ws.cell(row=row, column=2, value=mm['numero_documento'])
            ws.cell(row=row, column=3, value=mm['dv'])
            ws.cell(row=row, column=4, value=mm['primer_apellido'])
            ws.cell(row=row, column=5, value=mm['segundo_apellido'])
            ws.cell(row=row, column=6, value=mm['primer_nombre'])
            ws.cell(row=row, column=7, value=mm['otros_nombres'])
            ws.cell(row=row, column=8, value=mm['razon_social'])
            ws.cell(row=row, column=9, value=float(data['iva_descontable']))
            ws.cell(row=row, column=10, value=0)
            ws.cell(row=row, column=11, value=0)
            row += 1
        
        if row == 5:
            ws.cell(row=5, column=1, value='SIN DATOS PARA ESTE FORMATO')

    # =========================================================================
    # FORMATO 1006 - IVA Generado
    # =========================================================================
    def _generar_1006(self, wb, empresa, fecha_inicio, fecha_fin, year):
        ws = wb.create_sheet('1006')
        self._agregar_titulo(ws, empresa, '1006 - Impuesto sobre las ventas - Generado', year)
        
        headers = [
            'Tipo de documento', 'Número identificación', 'DV',
            'Primer apellido del informado', 'Segundo apellido del informado',
            'Primer nombre del informado', 'Otros nombres del informado',
            'Razón social informado', 'Impuesto generado',
            'IVA recuperado en devoluciones en compras anuladas, rescindidas o resueltas',
            'Impuesto al consumo'
        ]
        
        for col, header in enumerate(headers, 1):
            ws.cell(row=4, column=col, value=header)
        self._aplicar_estilo_encabezado(ws, 4, len(headers))
        
        # IVA en ventas (créditos en 2408)
        movimientos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='2408',
            credito__gt=0
        ).select_related('asiento__tercero')
        
        datos_por_tercero = {}
        for mov in movimientos:
            tercero = mov.asiento.tercero
            if not tercero:
                continue
            
            key = tercero.id
            if key not in datos_por_tercero:
                datos_por_tercero[key] = {'tercero': tercero, 'iva_generado': Decimal('0')}
            datos_por_tercero[key]['iva_generado'] += mov.credito
        
        row = 5
        for data in datos_por_tercero.values():
            tercero = data['tercero']
            mm = get_tercero_mm_data(tercero)
            
            ws.cell(row=row, column=1, value=mm['tipo_documento'])
            ws.cell(row=row, column=2, value=mm['numero_documento'])
            ws.cell(row=row, column=3, value=mm['dv'])
            ws.cell(row=row, column=4, value=mm['primer_apellido'])
            ws.cell(row=row, column=5, value=mm['segundo_apellido'])
            ws.cell(row=row, column=6, value=mm['primer_nombre'])
            ws.cell(row=row, column=7, value=mm['otros_nombres'])
            ws.cell(row=row, column=8, value=mm['razon_social'])
            ws.cell(row=row, column=9, value=float(data['iva_generado']))
            ws.cell(row=row, column=10, value=0)
            ws.cell(row=row, column=11, value=0)
            row += 1
        
        if row == 5:
            ws.cell(row=5, column=1, value='SIN DATOS PARA ESTE FORMATO')

    # =========================================================================
    # FORMATO 1007 - Ingresos Recibidos
    # =========================================================================
    def _generar_1007(self, wb, empresa, fecha_inicio, fecha_fin, year):
        ws = wb.create_sheet('1007')
        self._agregar_titulo(ws, empresa, '1007 - Ingresos Recibidos', year)
        
        headers = [
            'Concepto', 'Tipo de documento', 'Número identificación del informado',
            'Primer apellido del informado', 'Segundo apellido del informado',
            'Primer nombre del informado', 'Otros nombres del informado',
            'Razón social informado', 'País de Residencia o domicilio',
            'Ingresos brutos recibidos', 'Devoluciones, rebajas y descuentos'
        ]
        
        for col, header in enumerate(headers, 1):
            ws.cell(row=4, column=col, value=header)
        self._aplicar_estilo_encabezado(ws, 4, len(headers))
        
        # Ingresos (clase 4 créditos)
        movimientos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='4',
            credito__gt=0
        ).select_related('asiento__tercero')
        
        datos_por_tercero = {}
        for mov in movimientos:
            tercero = mov.asiento.tercero
            if not tercero:
                continue
            
            key = tercero.id
            if key not in datos_por_tercero:
                datos_por_tercero[key] = {'tercero': tercero, 'ingresos': Decimal('0'), 'devoluciones': Decimal('0')}
            datos_por_tercero[key]['ingresos'] += mov.credito
        
        row = 5
        for data in datos_por_tercero.values():
            tercero = data['tercero']
            mm = get_tercero_mm_data(tercero)
            
            ws.cell(row=row, column=1, value='4001')
            ws.cell(row=row, column=2, value=mm['tipo_documento'])
            ws.cell(row=row, column=3, value=mm['numero_documento'])
            ws.cell(row=row, column=4, value=mm['primer_apellido'])
            ws.cell(row=row, column=5, value=mm['segundo_apellido'])
            ws.cell(row=row, column=6, value=mm['primer_nombre'])
            ws.cell(row=row, column=7, value=mm['otros_nombres'])
            ws.cell(row=row, column=8, value=mm['razon_social'])
            ws.cell(row=row, column=9, value=mm['codigo_pais'])
            ws.cell(row=row, column=10, value=float(data['ingresos']))
            ws.cell(row=row, column=11, value=float(data['devoluciones']))
            row += 1
        
        if row == 5:
            ws.cell(row=5, column=1, value='SIN DATOS PARA ESTE FORMATO')

    # =========================================================================
    # FORMATO 1008 - Cuentas por Cobrar
    # =========================================================================
    def _generar_1008(self, wb, empresa, fecha_corte, year):
        ws = wb.create_sheet('1008')
        self._agregar_titulo(ws, empresa, '1008 - Saldo de cuentas por cobrar', year)
        
        headers = [
            'Concepto', 'Tipo de documento', 'Número identificación deudor', 'DV',
            'Primer apellido deudor', 'Segundo apellido deudor',
            'Primer nombre deudor', 'Otros nombres deudor',
            'Razón social deudor', 'Dirección', 'Código dpto', 'Código mcp',
            'País de Residencia o domicilio', 'Saldo cuentas por cobrar al 31-12'
        ]
        
        for col, header in enumerate(headers, 1):
            ws.cell(row=4, column=col, value=header)
        self._aplicar_estilo_encabezado(ws, 4, len(headers))
        
        # Saldo cuentas 13xx al cierre
        saldos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__lte=fecha_corte,
            asiento__estado='vigente',
            cuenta__codigo__startswith='13'
        ).values('asiento__tercero').annotate(
            total_debito=Coalesce(Sum('debito'), Decimal('0')),
            total_credito=Coalesce(Sum('credito'), Decimal('0'))
        )
        
        row = 5
        for saldo in saldos:
            tercero_id = saldo['asiento__tercero']
            if not tercero_id:
                continue
            
            saldo_neto = saldo['total_debito'] - saldo['total_credito']
            if saldo_neto <= 0:
                continue
            
            try:
                tercero = Tercero.objects.get(id=tercero_id)
            except Tercero.DoesNotExist:
                continue
            
            mm = get_tercero_mm_data(tercero)
            
            ws.cell(row=row, column=1, value='1315')
            ws.cell(row=row, column=2, value=mm['tipo_documento'])
            ws.cell(row=row, column=3, value=mm['numero_documento'])
            ws.cell(row=row, column=4, value=mm['dv'])
            ws.cell(row=row, column=5, value=mm['primer_apellido'])
            ws.cell(row=row, column=6, value=mm['segundo_apellido'])
            ws.cell(row=row, column=7, value=mm['primer_nombre'])
            ws.cell(row=row, column=8, value=mm['otros_nombres'])
            ws.cell(row=row, column=9, value=mm['razon_social'])
            ws.cell(row=row, column=10, value=mm['direccion'])
            ws.cell(row=row, column=11, value=mm['codigo_dpto'])
            ws.cell(row=row, column=12, value=mm['codigo_mcp'])
            ws.cell(row=row, column=13, value=mm['codigo_pais'])
            ws.cell(row=row, column=14, value=float(saldo_neto))
            row += 1
        
        if row == 5:
            ws.cell(row=5, column=1, value='SIN DATOS PARA ESTE FORMATO')

    # =========================================================================
    # FORMATO 1009 - Cuentas por Pagar
    # =========================================================================
    def _generar_1009(self, wb, empresa, fecha_corte, year):
        ws = wb.create_sheet('1009')
        self._agregar_titulo(ws, empresa, '1009 - Saldo de cuentas por Pagar', year)
        
        headers = [
            'Concepto', 'Tipo de documento', 'Número identificación acreedor', 'DV',
            'Primer apellido acreedor', 'Segundo apellido acreedor',
            'Primer nombre acreedor', 'Otros nombres acreedor',
            'Razón social acreedor', 'Dirección', 'Código dpto', 'Código mcp',
            'País de Residencia o domicilio', 'Saldo cuentas por pagar al 31-12'
        ]
        
        for col, header in enumerate(headers, 1):
            ws.cell(row=4, column=col, value=header)
        self._aplicar_estilo_encabezado(ws, 4, len(headers))
        
        # Saldo cuentas 22xx y 23xx al cierre
        saldos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__lte=fecha_corte,
            asiento__estado='vigente',
            cuenta__codigo__regex=r'^2[23]'
        ).values('asiento__tercero').annotate(
            total_debito=Coalesce(Sum('debito'), Decimal('0')),
            total_credito=Coalesce(Sum('credito'), Decimal('0'))
        )
        
        row = 5
        for saldo in saldos:
            tercero_id = saldo['asiento__tercero']
            if not tercero_id:
                continue
            
            saldo_neto = saldo['total_credito'] - saldo['total_debito']
            if saldo_neto <= 0:
                continue
            
            try:
                tercero = Tercero.objects.get(id=tercero_id)
            except Tercero.DoesNotExist:
                continue
            
            mm = get_tercero_mm_data(tercero)
            
            ws.cell(row=row, column=1, value='2205')
            ws.cell(row=row, column=2, value=mm['tipo_documento'])
            ws.cell(row=row, column=3, value=mm['numero_documento'])
            ws.cell(row=row, column=4, value=mm['dv'])
            ws.cell(row=row, column=5, value=mm['primer_apellido'])
            ws.cell(row=row, column=6, value=mm['segundo_apellido'])
            ws.cell(row=row, column=7, value=mm['primer_nombre'])
            ws.cell(row=row, column=8, value=mm['otros_nombres'])
            ws.cell(row=row, column=9, value=mm['razon_social'])
            ws.cell(row=row, column=10, value=mm['direccion'])
            ws.cell(row=row, column=11, value=mm['codigo_dpto'])
            ws.cell(row=row, column=12, value=mm['codigo_mcp'])
            ws.cell(row=row, column=13, value=mm['codigo_pais'])
            ws.cell(row=row, column=14, value=float(saldo_neto))
            row += 1
        
        if row == 5:
            ws.cell(row=5, column=1, value='SIN DATOS PARA ESTE FORMATO')

    # =========================================================================
    # FORMATO 1012 - Inversiones, cuentas bancarias
    # =========================================================================
    def _generar_1012(self, wb, empresa, fecha_corte, year):
        ws = wb.create_sheet('1012')
        self._agregar_titulo(ws, empresa, '1012 - Inversiones, acciones, títulos valores y cuentas', year)
        
        headers = [
            'Concepto', 'Tipo de documento', 'NIT informado', 'DV',
            'Primer apellido del informado', 'Segundo apellido del informado',
            'Primer nombre del informado', 'Otros nombres del informado',
            'Razón social informado', 'País de Residencia o domicilio', 'Valor al 31-12'
        ]
        
        for col, header in enumerate(headers, 1):
            ws.cell(row=4, column=col, value=header)
        self._aplicar_estilo_encabezado(ws, 4, len(headers))
        
        # Saldo cuentas 11xx y 12xx al cierre
        saldos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__lte=fecha_corte,
            asiento__estado='vigente',
            cuenta__codigo__regex=r'^1[12]'
        ).values('asiento__tercero', 'cuenta__codigo').annotate(
            total_debito=Coalesce(Sum('debito'), Decimal('0')),
            total_credito=Coalesce(Sum('credito'), Decimal('0'))
        )
        
        row = 5
        for saldo in saldos:
            tercero_id = saldo['asiento__tercero']
            if not tercero_id:
                continue
            
            saldo_neto = saldo['total_debito'] - saldo['total_credito']
            if saldo_neto <= 0:
                continue
            
            try:
                tercero = Tercero.objects.get(id=tercero_id)
            except Tercero.DoesNotExist:
                continue
            
            mm = get_tercero_mm_data(tercero)
            cuenta_codigo = saldo['cuenta__codigo']
            
            if cuenta_codigo.startswith('1110'):
                concepto = '1110'
            elif cuenta_codigo.startswith('1120'):
                concepto = '1120'
            else:
                concepto = '1200'
            
            ws.cell(row=row, column=1, value=concepto)
            ws.cell(row=row, column=2, value=mm['tipo_documento'])
            ws.cell(row=row, column=3, value=mm['numero_documento'])
            ws.cell(row=row, column=4, value=mm['dv'])
            ws.cell(row=row, column=5, value=mm['primer_apellido'])
            ws.cell(row=row, column=6, value=mm['segundo_apellido'])
            ws.cell(row=row, column=7, value=mm['primer_nombre'])
            ws.cell(row=row, column=8, value=mm['otros_nombres'])
            ws.cell(row=row, column=9, value=mm['razon_social'])
            ws.cell(row=row, column=10, value=mm['codigo_pais'])
            ws.cell(row=row, column=11, value=float(saldo_neto))
            row += 1
        
        if row == 5:
            ws.cell(row=5, column=1, value='SIN DATOS PARA ESTE FORMATO')

    # =========================================================================
    # FORMATO 2276 - Rentas de Trabajo y Pensiones
    # =========================================================================
    def _generar_2276(self, wb, empresa, fecha_inicio, fecha_fin, year):
        ws = wb.create_sheet('2276')
        self._agregar_titulo(ws, empresa, '2276 - Información de ingresos y retenciones por rentas de trabajo', year)
        
        headers = [
            'Entidad informante', 'Tipo de documento del beneficiario',
            'Número de identificación del beneficiario',
            'Primer apellido del beneficiario', 'Segundo apellido del beneficiario',
            'Primer nombre del beneficiario', 'Otros nombres del beneficiario',
            'Dirección del beneficiario', 'Departamento del beneficiario',
            'Municipio del beneficiario', 'País del beneficiario',
            'Pagos por Salarios', 'Pagos por Emolumentos eclesiásticos',
            'Pagos realizados con bonos', 'Exceso alimentación 41 UVT',
            'Pagos por Honorarios', 'Pagos por Servicios', 'Pagos por Comisiones',
            'Pagos por prestaciones sociales', 'Pagos por Viáticos',
            'Pagos por gastos de representación', 'Compensaciones cooperativo',
            'Apoyos económicos', 'Otros Pagos', 'Cesantías pagadas',
            'Cesantías consignadas', 'Cesantías tradicional', 'Pensiones',
            'Total ingresos brutos', 'Aportes Salud', 'Aportes Pensión',
            'Aportes voluntarios RAIS', 'Aportes voluntarios pensión',
            'Aportes AFC', 'Aportes AVC', 'Retención renta',
            'IVA mayor costo', 'Retención IVA', 'Alimentación 41 UVT',
            'Ingreso laboral promedio', 'Tipo doc dependiente', 'ID dependiente',
            'ID fideicomiso', 'Tipo doc participante', 'ID participante'
        ]
        
        for col, header in enumerate(headers, 1):
            ws.cell(row=4, column=col, value=header)
        self._aplicar_estilo_encabezado(ws, 4, len(headers))
        
        # Empleados
        empleados = Tercero.objects.filter(empresa=empresa, tipo_tercero='EMP', activo=True)
        
        row = 5
        for empleado in empleados:
            mm = get_tercero_mm_data(empleado)
            
            pagos = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                asiento__tercero=empleado,
                cuenta__codigo__startswith='51',
                debito__gt=0
            ).aggregate(total=Coalesce(Sum('debito'), Decimal('0')))
            
            total_pagos = pagos['total']
            if total_pagos <= 0:
                continue
            
            ws.cell(row=row, column=1, value=empresa.nit)
            ws.cell(row=row, column=2, value=mm['tipo_documento'])
            ws.cell(row=row, column=3, value=mm['numero_documento'])
            ws.cell(row=row, column=4, value=mm['primer_apellido'])
            ws.cell(row=row, column=5, value=mm['segundo_apellido'])
            ws.cell(row=row, column=6, value=mm['primer_nombre'])
            ws.cell(row=row, column=7, value=mm['otros_nombres'])
            ws.cell(row=row, column=8, value=mm['direccion'])
            ws.cell(row=row, column=9, value=mm['codigo_dpto'])
            ws.cell(row=row, column=10, value=mm['codigo_mcp'])
            ws.cell(row=row, column=11, value=mm['codigo_pais'])
            ws.cell(row=row, column=12, value=float(total_pagos))
            
            for col in range(13, len(headers) + 1):
                ws.cell(row=row, column=col, value=0)
            
            ws.cell(row=row, column=29, value=float(total_pagos))
            row += 1
        
        if row == 5:
            ws.cell(row=5, column=1, value='SIN DATOS PARA ESTE FORMATO')

# ============================================================================
# 🎩 CERTIFICADOS TRIBUTARIOS - Don Peppini Contadore
# AGREGAR AL FINAL DE contabilidad/views.py
# ============================================================================

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY
from io import BytesIO


class CertificadosTributariosView(views.APIView):
    """
    🎩 Generación de Certificados Tributarios en PDF
    
    GET /api/contabilidad/certificados/?empresa=1&year=2025&tercero=5&tipo=retencion_fuente
    
    Tipos disponibles:
    - retencion_fuente: Certificado de Retención en la Fuente
    - retencion_iva: Certificado de Retención de IVA
    - ingresos_retenciones: Certificado de Ingresos y Retenciones (empleados)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models.functions import Coalesce
        
        empresa_id = request.query_params.get('empresa')
        year = request.query_params.get('year')
        tercero_id = request.query_params.get('tercero')
        tipo = request.query_params.get('tipo', 'retencion_fuente')
        
        if not all([empresa_id, year, tercero_id]):
            return Response({'error': 'Empresa, año y tercero son requeridos'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
            tercero = Tercero.objects.get(id=tercero_id)
            year = int(year)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        except Tercero.DoesNotExist:
            return Response({'error': 'Tercero no encontrado'}, status=404)
        
        # Generar el certificado según el tipo
        if tipo == 'retencion_fuente':
            return self._certificado_retencion_fuente(empresa, tercero, year)
        elif tipo == 'retencion_iva':
            return self._certificado_retencion_iva(empresa, tercero, year)
        elif tipo == 'ingresos_retenciones':
            return self._certificado_ingresos_retenciones(empresa, tercero, year)
        else:
            return Response({'error': f'Tipo de certificado "{tipo}" no soportado'}, status=400)

    def _get_styles(self):
        """Estilos para el PDF"""
        styles = getSampleStyleSheet()
        
        styles.add(ParagraphStyle(
            name='TituloEmpresa',
            parent=styles['Heading1'],
            fontSize=14,
            alignment=TA_CENTER,
            spaceAfter=6,
            textColor=colors.HexColor('#1e3a5f')
        ))
        
        styles.add(ParagraphStyle(
            name='Subtitulo',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            spaceAfter=20,
            textColor=colors.HexColor('#666666')
        ))
        
        styles.add(ParagraphStyle(
            name='TituloCertificado',
            parent=styles['Heading2'],
            fontSize=12,
            alignment=TA_CENTER,
            spaceBefore=20,
            spaceAfter=20,
            textColor=colors.HexColor('#2c5282'),
            fontName='Helvetica-Bold'
        ))
        
        styles.add(ParagraphStyle(
            name='Cuerpo',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_JUSTIFY,
            spaceBefore=10,
            spaceAfter=10,
            leading=14
        ))
        
        styles.add(ParagraphStyle(
            name='Firma',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            spaceBefore=40,
            spaceAfter=6
        ))
        
        return styles

    def _formato_moneda(self, valor):
        """Formatea un valor como moneda colombiana"""
        return f"${valor:,.0f}".replace(',', '.')

    def _certificado_retencion_fuente(self, empresa, tercero, year):
        """Genera Certificado de Retención en la Fuente"""
        from django.db.models.functions import Coalesce
        
        fecha_inicio = f'{year}-01-01'
        fecha_fin = f'{year}-12-31'
        
        # Buscar retenciones practicadas al tercero (cuenta 2365xx)
        retenciones = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__tercero=tercero,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='2365',
            credito__gt=0
        ).values('cuenta__codigo', 'cuenta__nombre').annotate(
            total=Sum('credito')
        )
        
        # Calcular base (pagos al tercero - gastos clase 5 y 6)
        base_pagos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__tercero=tercero,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__regex=r'^[56]',
            debito__gt=0
        ).aggregate(total=Coalesce(Sum('debito'), Decimal('0')))['total']
        
        total_retencion = sum(r['total'] for r in retenciones)
        
        # Generar PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, 
                               rightMargin=72, leftMargin=72,
                               topMargin=72, bottomMargin=72)
        
        styles = self._get_styles()
        story = []
        
        # Encabezado empresa
        story.append(Paragraph(empresa.razon_social.upper(), styles['TituloEmpresa']))
        story.append(Paragraph(f"NIT: {empresa.nit}-{empresa.digito_verificacion or ''}", styles['Subtitulo']))
        story.append(Paragraph(f"{empresa.direccion or ''} • {empresa.telefono or ''}", styles['Subtitulo']))
        
        story.append(Spacer(1, 20))
        
        # Título del certificado
        story.append(Paragraph(
            f"CERTIFICADO DE RETENCIÓN EN LA FUENTE<br/>AÑO GRAVABLE {year}",
            styles['TituloCertificado']
        ))
        
        # Datos del beneficiario
        es_juridica = tercero.tipo_documento == 'NIT'
        nombre_tercero = tercero.nombre_razon_social if es_juridica else f"{tercero.primer_nombre or ''} {tercero.otros_nombres or ''} {tercero.primer_apellido or ''} {tercero.segundo_apellido or ''}".strip()
        
        story.append(Paragraph(
            f"<b>{empresa.razon_social}</b>, identificada con NIT <b>{empresa.nit}</b>, "
            f"certifica que durante el año gravable <b>{year}</b> practicó retenciones en la fuente a:",
            styles['Cuerpo']
        ))
        
        # Tabla datos del tercero
        datos_tercero = [
            ['NOMBRE O RAZÓN SOCIAL:', nombre_tercero],
            ['TIPO DOCUMENTO:', 'NIT' if es_juridica else 'CC'],
            ['NÚMERO DOCUMENTO:', tercero.numero_documento],
            ['DIRECCIÓN:', tercero.direccion or 'No registrada'],
        ]
        
        t = Table(datos_tercero, colWidths=[2.5*inch, 4*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f4f8')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        
        # Tabla de retenciones
        story.append(Paragraph("<b>DETALLE DE RETENCIONES PRACTICADAS:</b>", styles['Cuerpo']))
        
        datos_ret = [['CONCEPTO', 'BASE', 'RETENCIÓN']]
        
        if retenciones:
            for r in retenciones:
                # Calcular base aproximada (retención / tarifa estimada)
                base_estimada = float(r['total']) / 0.11 if r['total'] else 0  # Asume 11% promedio
                datos_ret.append([
                    r['cuenta__nombre'][:40],
                    self._formato_moneda(base_estimada),
                    self._formato_moneda(float(r['total']))
                ])
        
        # Totales
        datos_ret.append(['TOTAL', self._formato_moneda(float(base_pagos)), self._formato_moneda(float(total_retencion))])
        
        t = Table(datos_ret, colWidths=[3*inch, 1.5*inch, 1.5*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e2e8f0')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        
        # Texto legal
        story.append(Paragraph(
            f"El presente certificado se expide a solicitud del interesado para los fines pertinentes, "
            f"de conformidad con el artículo 381 del Estatuto Tributario.",
            styles['Cuerpo']
        ))
        
        from datetime import datetime
        fecha_actual = datetime.now().strftime('%d de %B de %Y').replace('January', 'enero').replace('February', 'febrero').replace('March', 'marzo').replace('April', 'abril').replace('May', 'mayo').replace('June', 'junio').replace('July', 'julio').replace('August', 'agosto').replace('September', 'septiembre').replace('October', 'octubre').replace('November', 'noviembre').replace('December', 'diciembre')
        
        story.append(Paragraph(f"Dado en {empresa.ciudad or 'Colombia'}, a los {fecha_actual}.", styles['Cuerpo']))
        
        story.append(Spacer(1, 50))
        
        # Firma
        story.append(Paragraph("_" * 40, styles['Firma']))
        story.append(Paragraph(f"<b>{empresa.representante_legal or 'Representante Legal'}</b>", styles['Firma']))
        story.append(Paragraph(f"Representante Legal", styles['Firma']))
        story.append(Paragraph(f"{empresa.razon_social}", styles['Firma']))
        
        # Pie de página
        story.append(Spacer(1, 30))
        story.append(Paragraph(
            f"<font size='8' color='#888888'>Certificado generado por Don Peppini Contadore 🎩</font>",
            styles['Firma']
        ))
        
        doc.build(story)
        
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename=Certificado_ReteFuente_{tercero.numero_documento}_{year}.pdf'
        return response

    def _certificado_retencion_iva(self, empresa, tercero, year):
        """Genera Certificado de Retención de IVA"""
        from django.db.models.functions import Coalesce
        
        fecha_inicio = f'{year}-01-01'
        fecha_fin = f'{year}-12-31'
        
        # Buscar retenciones de IVA practicadas (cuenta 2367xx o 2368xx)
        retenciones = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__tercero=tercero,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__regex=r'^236[78]',
            credito__gt=0
        ).aggregate(total=Coalesce(Sum('credito'), Decimal('0')))['total']
        
        # Calcular IVA base (compras con IVA)
        iva_base = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__tercero=tercero,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='2408',
            debito__gt=0
        ).aggregate(total=Coalesce(Sum('debito'), Decimal('0')))['total']
        
        # Generar PDF similar al de retención en la fuente
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                               rightMargin=72, leftMargin=72,
                               topMargin=72, bottomMargin=72)
        
        styles = self._get_styles()
        story = []
        
        # Encabezado
        story.append(Paragraph(empresa.razon_social.upper(), styles['TituloEmpresa']))
        story.append(Paragraph(f"NIT: {empresa.nit}-{empresa.digito_verificacion or ''}", styles['Subtitulo']))
        story.append(Paragraph(f"{empresa.direccion or ''}", styles['Subtitulo']))
        
        story.append(Spacer(1, 20))
        
        story.append(Paragraph(
            f"CERTIFICADO DE RETENCIÓN DE IVA<br/>AÑO GRAVABLE {year}",
            styles['TituloCertificado']
        ))
        
        # Datos del tercero
        es_juridica = tercero.tipo_documento == 'NIT'
        nombre_tercero = tercero.nombre_razon_social if es_juridica else f"{tercero.primer_nombre or ''} {tercero.primer_apellido or ''}".strip()
        
        story.append(Paragraph(
            f"<b>{empresa.razon_social}</b> certifica que durante el año gravable <b>{year}</b> "
            f"practicó retenciones de IVA a:",
            styles['Cuerpo']
        ))
        
        datos_tercero = [
            ['NOMBRE O RAZÓN SOCIAL:', nombre_tercero],
            ['NIT/CC:', tercero.numero_documento],
            ['DIRECCIÓN:', tercero.direccion or 'No registrada'],
        ]
        
        t = Table(datos_tercero, colWidths=[2.5*inch, 4*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f4f8')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        
        # Tabla de retención
        datos_ret = [
            ['CONCEPTO', 'VALOR'],
            ['IVA Facturado', self._formato_moneda(float(iva_base))],
            ['Retención de IVA Practicada (15%)', self._formato_moneda(float(retenciones))],
        ]
        
        t = Table(datos_ret, colWidths=[4*inch, 2*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        
        story.append(Paragraph(
            "Este certificado se expide de conformidad con el artículo 437-2 del Estatuto Tributario.",
            styles['Cuerpo']
        ))
        
        from datetime import datetime
        fecha_actual = datetime.now().strftime('%d de %B de %Y')
        story.append(Paragraph(f"Dado en {empresa.ciudad or 'Colombia'}, a los {fecha_actual}.", styles['Cuerpo']))
        
        story.append(Spacer(1, 50))
        story.append(Paragraph("_" * 40, styles['Firma']))
        story.append(Paragraph(f"<b>{empresa.representante_legal or 'Representante Legal'}</b>", styles['Firma']))
        story.append(Paragraph(f"Representante Legal", styles['Firma']))
        
        doc.build(story)
        
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename=Certificado_ReteIVA_{tercero.numero_documento}_{year}.pdf'
        return response

    def _certificado_ingresos_retenciones(self, empresa, tercero, year):
        """Genera Certificado de Ingresos y Retenciones (Formato 220 - Empleados)"""
        from django.db.models.functions import Coalesce
        
        fecha_inicio = f'{year}-01-01'
        fecha_fin = f'{year}-12-31'
        
        # Pagos de nómina al empleado (cuentas 51xx)
        pagos_nomina = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__tercero=tercero,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='51',
            debito__gt=0
        )
        
        # Agrupar por subcuenta
        salarios = pagos_nomina.filter(cuenta__codigo__startswith='5105').aggregate(
            total=Coalesce(Sum('debito'), Decimal('0')))['total']
        
        aux_transporte = pagos_nomina.filter(cuenta__codigo__startswith='5110').aggregate(
            total=Coalesce(Sum('debito'), Decimal('0')))['total']
        
        cesantias = pagos_nomina.filter(cuenta__codigo__startswith='5115').aggregate(
            total=Coalesce(Sum('debito'), Decimal('0')))['total']
        
        intereses_cesantias = pagos_nomina.filter(cuenta__codigo__startswith='5120').aggregate(
            total=Coalesce(Sum('debito'), Decimal('0')))['total']
        
        prima = pagos_nomina.filter(cuenta__codigo__startswith='5125').aggregate(
            total=Coalesce(Sum('debito'), Decimal('0')))['total']
        
        vacaciones = pagos_nomina.filter(cuenta__codigo__startswith='5130').aggregate(
            total=Coalesce(Sum('debito'), Decimal('0')))['total']
        
        total_ingresos = salarios + aux_transporte + cesantias + intereses_cesantias + prima + vacaciones
        
        # Aportes salud y pensión (estimados)
        aporte_salud = float(salarios) * 0.04  # 4% empleado
        aporte_pension = float(salarios) * 0.04  # 4% empleado
        
        # Retención en la fuente
        retencion = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__tercero=tercero,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='2365',
            credito__gt=0
        ).aggregate(total=Coalesce(Sum('credito'), Decimal('0')))['total']
        
        # Generar PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                               rightMargin=50, leftMargin=50,
                               topMargin=50, bottomMargin=50)
        
        styles = self._get_styles()
        story = []
        
        # Encabezado
        story.append(Paragraph(empresa.razon_social.upper(), styles['TituloEmpresa']))
        story.append(Paragraph(f"NIT: {empresa.nit}-{empresa.digito_verificacion or ''}", styles['Subtitulo']))
        
        story.append(Paragraph(
            f"CERTIFICADO DE INGRESOS Y RETENCIONES<br/>POR RENTAS DE TRABAJO Y PENSIONES<br/>AÑO GRAVABLE {year}",
            styles['TituloCertificado']
        ))
        
        # Datos del empleado
        nombre_empleado = f"{tercero.primer_nombre or ''} {tercero.otros_nombres or ''} {tercero.primer_apellido or ''} {tercero.segundo_apellido or ''}".strip()
        
        story.append(Paragraph("<b>DATOS DEL TRABAJADOR</b>", styles['Cuerpo']))
        
        datos_empleado = [
            ['Apellidos y Nombres:', nombre_empleado],
            ['Documento de Identidad:', f"CC {tercero.numero_documento}"],
            ['Dirección:', tercero.direccion or 'No registrada'],
            ['Ciudad:', tercero.ciudad or empresa.ciudad or 'Colombia'],
        ]
        
        t = Table(datos_empleado, colWidths=[2*inch, 4.5*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f4f8')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ]))
        story.append(t)
        story.append(Spacer(1, 15))
        
        # Tabla de ingresos
        story.append(Paragraph("<b>CONCEPTO DE LOS INGRESOS</b>", styles['Cuerpo']))
        
        ingresos_data = [
            ['CONCEPTO', 'VALOR RECIBIDO'],
            ['Salarios y demás pagos laborales', self._formato_moneda(float(salarios))],
            ['Auxilio de transporte', self._formato_moneda(float(aux_transporte))],
            ['Cesantías e intereses de cesantías', self._formato_moneda(float(cesantias + intereses_cesantias))],
            ['Prima de servicios', self._formato_moneda(float(prima))],
            ['Vacaciones', self._formato_moneda(float(vacaciones))],
            ['TOTAL INGRESOS BRUTOS', self._formato_moneda(float(total_ingresos))],
        ]
        
        t = Table(ingresos_data, colWidths=[4*inch, 2.5*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e2e8f0')),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ]))
        story.append(t)
        story.append(Spacer(1, 15))
        
        # Aportes y retenciones
        story.append(Paragraph("<b>APORTES Y RETENCIONES</b>", styles['Cuerpo']))
        
        aportes_data = [
            ['CONCEPTO', 'VALOR'],
            ['Aportes obligatorios a salud', self._formato_moneda(aporte_salud)],
            ['Aportes obligatorios a pensión', self._formato_moneda(aporte_pension)],
            ['Retención en la fuente por salarios', self._formato_moneda(float(retencion))],
            ['TOTAL DEDUCCIONES', self._formato_moneda(aporte_salud + aporte_pension + float(retencion))],
        ]
        
        t = Table(aportes_data, colWidths=[4*inch, 2.5*inch])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#c53030')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fed7d7')),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        
        # Texto legal
        story.append(Paragraph(
            "El presente certificado se expide en cumplimiento del Artículo 378 del Estatuto Tributario, "
            "para efectos de la declaración de renta del trabajador.",
            styles['Cuerpo']
        ))
        
        from datetime import datetime
        fecha_actual = datetime.now().strftime('%d de %B de %Y')
        story.append(Paragraph(f"Expedido en {empresa.ciudad or 'Colombia'}, {fecha_actual}.", styles['Cuerpo']))
        
        story.append(Spacer(1, 40))
        story.append(Paragraph("_" * 40, styles['Firma']))
        story.append(Paragraph(f"<b>{empresa.representante_legal or 'Representante Legal'}</b>", styles['Firma']))
        story.append(Paragraph(f"{empresa.razon_social}", styles['Firma']))
        story.append(Paragraph(f"NIT: {empresa.nit}", styles['Firma']))
        
        doc.build(story)
        
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename=Certificado_IngresosRetenciones_{tercero.numero_documento}_{year}.pdf'
        return response


class ListaTercerosParaCertificadoView(views.APIView):
    """
    Lista terceros que tienen movimientos para certificados
    GET /api/contabilidad/certificados/terceros/?empresa=1&year=2025&tipo=retencion_fuente
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        year = request.query_params.get('year')
        tipo = request.query_params.get('tipo', 'retencion_fuente')
        
        if not empresa_id or not year:
            return Response({'error': 'Empresa y año son requeridos'}, status=400)
        
        fecha_inicio = f'{year}-01-01'
        fecha_fin = f'{year}-12-31'
        
        # Filtrar según tipo de certificado
        if tipo == 'retencion_fuente':
            # Terceros con retenciones practicadas
            cuenta_filter = 'cuenta__codigo__startswith'
            cuenta_valor = '2365'
        elif tipo == 'retencion_iva':
            cuenta_filter = 'cuenta__codigo__regex'
            cuenta_valor = r'^236[78]'
        elif tipo == 'ingresos_retenciones':
            cuenta_filter = 'cuenta__codigo__startswith'
            cuenta_valor = '51'
        else:
            return Response({'error': 'Tipo no válido'}, status=400)
        
        # Obtener terceros únicos con movimientos
        filter_kwargs = {
            'asiento__empresa_id': empresa_id,
            'asiento__fecha__gte': fecha_inicio,
            'asiento__fecha__lte': fecha_fin,
            'asiento__estado': 'activo',
        }
        
        if tipo == 'retencion_iva':
            filter_kwargs['cuenta__codigo__regex'] = cuenta_valor
        else:
            filter_kwargs['cuenta__codigo__startswith'] = cuenta_valor
        
        tercero_ids = MovimientoContable.objects.filter(
            **filter_kwargs
        ).values_list('asiento__tercero', flat=True).distinct()
        
        terceros = Tercero.objects.filter(id__in=tercero_ids).values(
            'id', 'numero_documento', 'nombre_razon_social', 
            'primer_nombre', 'primer_apellido', 'tipo_documento'
        )
        
        resultado = []
        for t in terceros:
            es_juridica = t['tipo_documento'] == 'NIT'
            nombre = t['nombre_razon_social'] if es_juridica else f"{t['primer_nombre'] or ''} {t['primer_apellido'] or ''}".strip()
            resultado.append({
                'id': t['id'],
                'documento': t['numero_documento'],
                'nombre': nombre or t['nombre_razon_social'],
                'tipo': 'Empresa' if es_juridica else 'Persona'
            })
        
        return Response({
            'terceros': resultado,
            'total': len(resultado)
        })

 # ============================================================================
# 🎩 CONCILIACIÓN BANCARIA - VISTAS
# AGREGAR AL FINAL DE contabilidad/views.py
# ============================================================================

import calendar


class CuentasBancariasView(views.APIView):
    """
    Lista las cuentas bancarias disponibles para conciliación
    GET /api/contabilidad/conciliacion/cuentas-banco/?empresa=1
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)
        
        cuentas = Cuenta.objects.filter(
            empresa_id=empresa_id,
            codigo__regex=r'^11[12]0\d{4}',
            activa=True
        ).values('id', 'codigo', 'nombre').order_by('codigo')
        
        return Response({'cuentas': list(cuentas)})


class IniciarConciliacionView(views.APIView):
    """
    Inicia una nueva conciliación bancaria
    POST /api/contabilidad/conciliacion/iniciar/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        empresa_id = request.data.get('empresa')
        cuenta_id = request.data.get('cuenta')
        año = int(request.data.get('año', 0))
        mes = int(request.data.get('mes', 0))
        saldo_extracto = Decimal(str(request.data.get('saldo_extracto', 0)))
        
        if not all([empresa_id, cuenta_id, año, mes]):
            return Response({'error': 'Datos incompletos'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
            cuenta = Cuenta.objects.get(id=cuenta_id, empresa=empresa)
        except:
            return Response({'error': 'Empresa o cuenta no encontrada'}, status=404)
        
        # Calcular saldo en libros
        ultimo_dia = calendar.monthrange(año, mes)[1]
        fecha_corte = date(año, mes, ultimo_dia)
        
        saldos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__lte=fecha_corte,
            asiento__estado='vigente',
            cuenta=cuenta
        ).aggregate(
            total_d=Sum('debito'),
            total_c=Sum('credito')
        )
        
        saldo_libros = (saldos['total_d'] or Decimal('0')) - (saldos['total_c'] or Decimal('0'))
        
        conc, created = ConciliacionBancaria.objects.update_or_create(
            empresa=empresa,
            cuenta=cuenta,
            año=año,
            mes=mes,
            defaults={
                'saldo_extracto': saldo_extracto,
                'saldo_libros': saldo_libros,
                'saldo_conciliado': saldo_libros,
            }
        )
        
        return Response({
            'id': conc.id,
            'saldo_extracto': float(saldo_extracto),
            'saldo_libros': float(saldo_libros),
            'diferencia': float(saldo_extracto - saldo_libros),
        })


class ImportarExtractoView(views.APIView):
    """
    Importa extracto bancario desde Excel
    POST /api/contabilidad/conciliacion/importar-extracto/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        from openpyxl import load_workbook
        
        conciliacion_id = request.data.get('conciliacion')
        archivo = request.FILES.get('archivo')
        
        if not conciliacion_id or not archivo:
            return Response({'error': 'Conciliación y archivo requeridos'}, status=400)
        
        try:
            conc = ConciliacionBancaria.objects.get(id=conciliacion_id)
        except:
            return Response({'error': 'Conciliación no encontrada'}, status=404)
        
        MovimientoExtracto.objects.filter(conciliacion=conc).delete()
        
        try:
            wb = load_workbook(archivo, data_only=True)
            ws = wb.active
            
            movimientos = []
            col_fecha = col_desc = col_debito = col_credito = col_saldo = None
            headers_row = 0
            
            # Buscar encabezados
            for row_num in range(1, min(10, ws.max_row + 1)):
                for col_num in range(1, ws.max_column + 1):
                    val = str(ws.cell(row_num, col_num).value or '').lower()
                    if 'fecha' in val:
                        col_fecha = col_num
                        headers_row = row_num
                    elif any(x in val for x in ['descrip', 'concepto', 'detalle']):
                        col_desc = col_num
                    elif any(x in val for x in ['débito', 'debito', 'cargo', 'retiro']):
                        col_debito = col_num
                    elif any(x in val for x in ['crédito', 'credito', 'abono', 'depósito']):
                        col_credito = col_num
                    elif 'saldo' in val:
                        col_saldo = col_num
                if col_fecha:
                    break
            
            if not col_fecha:
                return Response({'error': 'No se encontró columna de Fecha'}, status=400)
            
            for row_num in range(headers_row + 1, ws.max_row + 1):
                fecha_val = ws.cell(row_num, col_fecha).value
                if not fecha_val:
                    continue
                
                if isinstance(fecha_val, datetime):
                    fecha = fecha_val.date()
                elif isinstance(fecha_val, date):
                    fecha = fecha_val
                else:
                    try:
                        fecha = datetime.strptime(str(fecha_val).strip(), '%d/%m/%Y').date()
                    except:
                        try:
                            fecha = datetime.strptime(str(fecha_val).strip(), '%Y-%m-%d').date()
                        except:
                            continue
                
                desc = str(ws.cell(row_num, col_desc or 2).value or '')[:255]
                
                def parse_val(cell):
                    v = cell.value if cell else None
                    if v is None:
                        return Decimal('0')
                    if isinstance(v, (int, float)):
                        return Decimal(str(abs(v)))
                    try:
                        return abs(Decimal(str(v).replace('$', '').replace(',', '').replace('.', '')))
                    except:
                        return Decimal('0')
                
                debito = parse_val(ws.cell(row_num, col_debito)) if col_debito else Decimal('0')
                credito = parse_val(ws.cell(row_num, col_credito)) if col_credito else Decimal('0')
                saldo = parse_val(ws.cell(row_num, col_saldo)) if col_saldo else Decimal('0')
                
                if debito == 0 and credito == 0:
                    continue
                
                movimientos.append(MovimientoExtracto(
                    conciliacion=conc,
                    fecha=fecha,
                    debito=debito,
                    credito=credito,
                    saldo=saldo,
                ))
            
            if movimientos:
                MovimientoExtracto.objects.bulk_create(movimientos)
            
            return Response({
                'success': True,
                'movimientos': len(movimientos)
            })
        
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class ComparativoView(views.APIView):
    """
    Comparativo extracto vs libros
    GET /api/contabilidad/conciliacion/comparativo/?conciliacion=1
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        conc_id = request.query_params.get('conciliacion')
        
        try:
            conc = ConciliacionBancaria.objects.get(id=conc_id)
        except:
            return Response({'error': 'Conciliación no encontrada'}, status=404)
        
        # Extracto
        extracto = list(MovimientoExtracto.objects.filter(
            conciliacion=conc
        ).values('id', 'fecha', 'descripcion', 'debito', 'credito', 'saldo', 'conciliado'))
        
        # Libros del mes
        ultimo_dia = calendar.monthrange(conc.año, conc.mes)[1]
        fecha_inicio = date(conc.año, conc.mes, 1)
        fecha_fin = date(conc.año, conc.mes, ultimo_dia)
        
        conciliados_ids = MovimientoExtracto.objects.filter(
            conciliacion=conc,
            movimiento_libro__isnull=False
        ).values_list('movimiento_libro_id', flat=True)
        
        libros_qs = MovimientoContable.objects.filter(
            asiento__empresa=conc.empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta=conc.cuenta
        ).select_related('asiento')
        
        libros = []
        for m in libros_qs:
            libros.append({
                'id': m.id,
                'fecha': m.asiento.fecha.isoformat(),
                'concepto': m.asiento.concepto,
                'numero': m.asiento.numero,
                'debito': float(m.debito),
                'credito': float(m.credito),
                'conciliado': m.id in conciliados_ids
            })
        
        return Response({
            'extracto': extracto,
            'libros': libros,
            'saldo_extracto': float(conc.saldo_extracto),
            'saldo_libros': float(conc.saldo_libros),
            'diferencia': float(conc.saldo_extracto - conc.saldo_libros),
        })


class ConciliarPartidaView(views.APIView):
    """
    Concilia una partida del extracto con libros
    POST /api/contabilidad/conciliacion/conciliar/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        ext_id = request.data.get('extracto_id')
        lib_id = request.data.get('libro_id')
        desconciliar = request.data.get('desconciliar', False)
        
        try:
            mov_ext = MovimientoExtracto.objects.get(id=ext_id)
        except:
            return Response({'error': 'Movimiento no encontrado'}, status=404)
        
        if desconciliar:
            mov_ext.movimiento_libro = None
            mov_ext.conciliado = False
            mov_ext.save()
            return Response({'success': True})
        
        if lib_id:
            try:
                mov_lib = MovimientoContable.objects.get(id=lib_id)
                mov_ext.movimiento_libro = mov_lib
                mov_ext.conciliado = True
                mov_ext.save()
                return Response({'success': True})
            except:
                return Response({'error': 'Movimiento libros no encontrado'}, status=404)
        
        return Response({'error': 'Datos incompletos'}, status=400)


class ConciliacionAutomaticaView(views.APIView):
    """
    Conciliación automática por fecha y monto
    POST /api/contabilidad/conciliacion/automatica/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        conc_id = request.data.get('conciliacion')
        
        try:
            conc = ConciliacionBancaria.objects.get(id=conc_id)
        except:
            return Response({'error': 'Conciliación no encontrada'}, status=404)
        
        extracto_pend = MovimientoExtracto.objects.filter(conciliacion=conc, conciliado=False)
        
        ultimo_dia = calendar.monthrange(conc.año, conc.mes)[1]
        fecha_inicio = date(conc.año, conc.mes, 1)
        fecha_fin = date(conc.año, conc.mes, ultimo_dia)
        
        conc_ids = MovimientoExtracto.objects.filter(
            conciliacion=conc, movimiento_libro__isnull=False
        ).values_list('movimiento_libro_id', flat=True)
        
        libros_pend = list(MovimientoContable.objects.filter(
            asiento__empresa=conc.empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta=conc.cuenta
        ).exclude(id__in=conc_ids))
        
        conciliados = 0
        
        for mov_ext in extracto_pend:
            val_ext = mov_ext.credito - mov_ext.debito
            
            for mov_lib in libros_pend:
                val_lib = mov_lib.debito - mov_lib.credito
                
                if abs(val_ext - val_lib) < 1:
                    diff_dias = abs((mov_ext.fecha - mov_lib.asiento.fecha).days)
                    if diff_dias <= 2:
                        mov_ext.movimiento_libro = mov_lib
                        mov_ext.conciliado = True
                        mov_ext.save()
                        libros_pend.remove(mov_lib)
                        conciliados += 1
                        break
        
        return Response({'conciliados': conciliados})


class ReporteConciliacionPDFView(views.APIView):
    """
    Genera PDF de conciliación
    GET /api/contabilidad/conciliacion/reporte-pdf/?conciliacion=1
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER
        from io import BytesIO
        
        conc_id = request.query_params.get('conciliacion')
        
        try:
            conc = ConciliacionBancaria.objects.select_related('empresa', 'cuenta').get(id=conc_id)
        except:
            return Response({'error': 'No encontrada'}, status=404)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
        
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name='Center', alignment=TA_CENTER, fontSize=12, fontName='Helvetica-Bold'))
        
        story = []
        
        story.append(Paragraph(conc.empresa.razon_social.upper(), styles['Center']))
        story.append(Paragraph(f"NIT: {conc.empresa.nit}", styles['Center']))
        story.append(Spacer(1, 20))
        story.append(Paragraph("CONCILIACIÓN BANCARIA", styles['Center']))
        story.append(Paragraph(f"{conc.cuenta.codigo} - {conc.cuenta.nombre}", styles['Center']))
        story.append(Paragraph(f"Período: {conc.mes}/{conc.año}", styles['Center']))
        story.append(Spacer(1, 30))
        
        def fmt(val):
            return f"${float(val):,.0f}".replace(',', '.')
        
        data = [
            ['CONCEPTO', 'VALOR'],
            ['Saldo según Extracto Bancario', fmt(conc.saldo_extracto)],
            ['', ''],
            ['MÁS: Consignaciones en tránsito', fmt(conc.consignaciones_transito)],
            ['MÁS: Notas Crédito no registradas', fmt(conc.notas_credito_no_registradas)],
            ['', ''],
            ['MENOS: Cheques pendientes de cobro', fmt(conc.cheques_pendientes)],
            ['MENOS: Notas Débito no registradas', fmt(conc.notas_debito_no_registradas)],
            ['', ''],
            ['SALDO CONCILIADO', fmt(conc.saldo_conciliado)],
            ['Saldo según Libros', fmt(conc.saldo_libros)],
            ['DIFERENCIA', fmt(conc.saldo_extracto - conc.saldo_conciliado)],
        ]
        
        t = Table(data, colWidths=[350, 120])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 9), (-1, 11), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 9), (-1, 9), colors.HexColor('#e2e8f0')),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(t)
        
        story.append(Spacer(1, 50))
        firma = [['_' * 30, '_' * 30], ['Elaborado por', 'Revisado por']]
        t2 = Table(firma, colWidths=[200, 200])
        t2.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
        story.append(t2)
        
        story.append(Spacer(1, 20))
        story.append(Paragraph("<font size='8' color='#888'>Don Peppini Contadore 🎩</font>", 
                              ParagraphStyle(name='F', alignment=TA_CENTER)))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename=Conciliacion_{conc.cuenta.codigo}_{conc.mes}_{conc.año}.pdf'
        return response               

      # ============================================================================
# 🎩 NOTAS A LOS ESTADOS FINANCIEROS - VISTAS
# AGREGAR AL FINAL DE contabilidad/views.py
# ============================================================================

import json
from django.db.models.functions import Coalesce


# Plantillas predefinidas de notas NIIF para Pymes
PLANTILLAS_NOTAS = {
    'general': {
        'titulo': 'Información General de la Entidad',
        'orden': 1,
        'contenido': """
**{empresa}** es una entidad constituida conforme a las leyes colombianas, identificada con NIT **{nit}**, 
con domicilio principal en {ciudad}, {direccion}.

**Objeto Social:** {actividad}

**Marco Técnico Normativo:** La entidad pertenece al **{grupo_niif}** y prepara sus estados financieros 
de conformidad con las Normas Internacionales de Información Financiera para Pequeñas y Medianas Entidades 
(NIIF para las PYMES), emitidas por el Consejo de Normas Internacionales de Contabilidad (IASB) y adoptadas 
en Colombia mediante el Decreto 2420 de 2015 y sus modificaciones.

**Moneda Funcional y de Presentación:** Los estados financieros se presentan en pesos colombianos (COP), 
que es la moneda funcional y de presentación de la entidad.

**Fecha de Autorización:** Los presentes estados financieros fueron autorizados para su emisión por la 
administración de la entidad el {fecha_emision}.
"""
    },
    'politicas': {
        'titulo': 'Principales Políticas Contables',
        'orden': 2,
        'contenido': """
Las principales políticas contables aplicadas en la preparación de estos estados financieros se detallan a continuación:

### 2.1 Bases de Preparación
Los estados financieros han sido preparados sobre la base del costo histórico, excepto por ciertos instrumentos 
financieros que se miden a valor razonable.

### 2.2 Efectivo y Equivalentes al Efectivo
Se reconoce como efectivo los saldos en caja, depósitos a la vista y equivalentes de efectivo con vencimiento 
original inferior a 90 días.

### 2.3 Cuentas por Cobrar
Las cuentas por cobrar se reconocen inicialmente a su valor nominal y posteriormente se evalúa el deterioro 
aplicando el modelo de pérdida esperada simplificado.

### 2.4 Inventarios
Los inventarios se miden al menor entre el costo y el precio de venta estimado menos los costos de terminación 
y venta. El costo se determina usando el método {metodo_inventario}.

### 2.5 Propiedad, Planta y Equipo
Se reconocen al costo menos depreciación acumulada y pérdidas por deterioro. La depreciación se calcula 
usando el método de línea recta sobre la vida útil estimada.

### 2.6 Reconocimiento de Ingresos
Los ingresos se reconocen cuando se transfiere el control de los bienes o servicios al cliente, por el 
monto que la entidad espera recibir a cambio.

### 2.7 Impuesto a las Ganancias
El gasto por impuesto incluye el impuesto corriente y el diferido. El impuesto corriente se calcula según 
las tasas y normas fiscales vigentes.
"""
    },
    'efectivo': {
        'titulo': 'Efectivo y Equivalentes al Efectivo',
        'orden': 3,
        'contenido': """
El efectivo y equivalentes al efectivo al {fecha_corte} comprende:

| Concepto | {año} | {año_anterior} |
|----------|------:|---------------:|
| Caja | {caja} | {caja_ant} |
| Bancos nacionales | {bancos} | {bancos_ant} |
| Cuentas de ahorro | {ahorro} | {ahorro_ant} |
| **Total** | **{total_efectivo}** | **{total_efectivo_ant}** |

No existen restricciones sobre la disponibilidad del efectivo.
"""
    },
    'cuentas_cobrar': {
        'titulo': 'Deudores Comerciales y Otras Cuentas por Cobrar',
        'orden': 4,
        'contenido': """
Las cuentas por cobrar al {fecha_corte} se componen de:

| Concepto | {año} | {año_anterior} |
|----------|------:|---------------:|
| Clientes nacionales | {clientes} | {clientes_ant} |
| Anticipos y avances | {anticipos} | {anticipos_ant} |
| Cuentas por cobrar a trabajadores | {trabajadores} | {trabajadores_ant} |
| Deudores varios | {deudores_varios} | {deudores_varios_ant} |
| (-) Deterioro de cartera | {deterioro} | {deterioro_ant} |
| **Total** | **{total_cxc}** | **{total_cxc_ant}** |

**Análisis de antigüedad de cartera:**
- Corriente (0-30 días): {cartera_corriente}
- Vencida 31-60 días: {cartera_31_60}
- Vencida 61-90 días: {cartera_61_90}
- Vencida más de 90 días: {cartera_90_mas}
"""
    },
    'inventarios': {
        'titulo': 'Inventarios',
        'orden': 5,
        'contenido': """
Los inventarios al {fecha_corte} comprenden:

| Concepto | {año} | {año_anterior} |
|----------|------:|---------------:|
| Materias primas | {materias_primas} | {materias_primas_ant} |
| Productos en proceso | {productos_proceso} | {productos_proceso_ant} |
| Productos terminados | {productos_terminados} | {productos_terminados_ant} |
| Mercancías no fabricadas | {mercancias} | {mercancias_ant} |
| (-) Provisión por obsolescencia | {provision_inv} | {provision_inv_ant} |
| **Total** | **{total_inventarios}** | **{total_inventarios_ant}** |

El método de valuación utilizado es {metodo_inventario}.
"""
    },
    'propiedad_planta': {
        'titulo': 'Propiedad, Planta y Equipo',
        'orden': 6,
        'contenido': """
El movimiento de propiedad, planta y equipo durante el período es:

| Concepto | Costo | Depreciación Acum. | Valor Neto |
|----------|------:|-----------------:|----------:|
| Terrenos | {terrenos_costo} | - | {terrenos_neto} |
| Edificaciones | {edificaciones_costo} | {edificaciones_dep} | {edificaciones_neto} |
| Maquinaria y equipo | {maquinaria_costo} | {maquinaria_dep} | {maquinaria_neto} |
| Equipo de oficina | {eq_oficina_costo} | {eq_oficina_dep} | {eq_oficina_neto} |
| Equipo de cómputo | {eq_computo_costo} | {eq_computo_dep} | {eq_computo_neto} |
| Vehículos | {vehiculos_costo} | {vehiculos_dep} | {vehiculos_neto} |
| **Total** | **{total_ppe_costo}** | **{total_ppe_dep}** | **{total_ppe_neto}** |

**Vidas útiles estimadas:**
- Edificaciones: 20 años
- Maquinaria y equipo: 10 años
- Equipo de oficina: 10 años
- Equipo de cómputo: 5 años
- Vehículos: 5 años

No existen activos dados en garantía ni restricciones sobre la propiedad.
"""
    },
    'cuentas_pagar': {
        'titulo': 'Cuentas por Pagar Comerciales',
        'orden': 8,
        'contenido': """
Las cuentas por pagar al {fecha_corte} comprenden:

| Concepto | {año} | {año_anterior} |
|----------|------:|---------------:|
| Proveedores nacionales | {proveedores} | {proveedores_ant} |
| Proveedores del exterior | {prov_exterior} | {prov_exterior_ant} |
| Costos y gastos por pagar | {costos_pagar} | {costos_pagar_ant} |
| Acreedores varios | {acreedores} | {acreedores_ant} |
| **Total** | **{total_cxp}** | **{total_cxp_ant}** |

Todas las cuentas por pagar son de corto plazo y no devengan intereses.
"""
    },
    'obligaciones': {
        'titulo': 'Obligaciones Financieras',
        'orden': 9,
        'contenido': """
Las obligaciones financieras al {fecha_corte} comprenden:

| Concepto | {año} | {año_anterior} |
|----------|------:|---------------:|
| Obligaciones bancarias corto plazo | {oblig_cp} | {oblig_cp_ant} |
| Obligaciones bancarias largo plazo | {oblig_lp} | {oblig_lp_ant} |
| **Total** | **{total_obligaciones}** | **{total_obligaciones_ant}** |

Las obligaciones devengan intereses a tasas de mercado y se encuentran garantizadas con {garantias}.
"""
    },
    'impuestos': {
        'titulo': 'Impuestos, Gravámenes y Tasas',
        'orden': 10,
        'contenido': """
Los impuestos por pagar al {fecha_corte} comprenden:

| Concepto | {año} | {año_anterior} |
|----------|------:|---------------:|
| Impuesto de renta | {renta} | {renta_ant} |
| IVA por pagar | {iva} | {iva_ant} |
| Retención en la fuente | {retefuente} | {retefuente_ant} |
| ICA por pagar | {ica} | {ica_ant} |
| Otros impuestos | {otros_imp} | {otros_imp_ant} |
| **Total** | **{total_impuestos}** | **{total_impuestos_ant}** |

**Conciliación del gasto por impuesto de renta:**

| Concepto | Valor |
|----------|------:|
| Utilidad antes de impuestos | {utilidad_antes_imp} |
| Tasa nominal de impuesto | 35% |
| Impuesto teórico | {imp_teorico} |
| Diferencias permanentes | {diferencias} |
| **Gasto por impuesto corriente** | **{gasto_impuesto}** |
"""
    },
    'patrimonio': {
        'titulo': 'Patrimonio',
        'orden': 12,
        'contenido': """
El patrimonio al {fecha_corte} está conformado por:

| Concepto | {año} | {año_anterior} |
|----------|------:|---------------:|
| Capital social | {capital} | {capital_ant} |
| Reserva legal | {reserva_legal} | {reserva_legal_ant} |
| Otras reservas | {otras_reservas} | {otras_reservas_ant} |
| Resultados de ejercicios anteriores | {resultados_ant} | {resultados_ant_ant} |
| Resultado del ejercicio | {resultado_ejercicio} | {resultado_ejercicio_ant} |
| **Total patrimonio** | **{total_patrimonio}** | **{total_patrimonio_ant}** |

**Capital Social:** El capital autorizado es de {capital_autorizado} representado en {num_acciones} acciones 
de valor nominal {valor_nominal} cada una. El capital suscrito y pagado es de {capital}.

**Reserva Legal:** De acuerdo con disposiciones legales, la entidad debe apropiar como reserva legal el 10% 
de las utilidades líquidas de cada ejercicio hasta completar el 50% del capital suscrito.
"""
    },
    'ingresos': {
        'titulo': 'Ingresos de Actividades Ordinarias',
        'orden': 13,
        'contenido': """
Los ingresos operacionales del período comprenden:

| Concepto | {año} | {año_anterior} |
|----------|------:|---------------:|
| Venta de bienes | {venta_bienes} | {venta_bienes_ant} |
| Prestación de servicios | {servicios} | {servicios_ant} |
| Devoluciones y descuentos | {devoluciones} | {devoluciones_ant} |
| **Total ingresos operacionales** | **{total_ingresos}** | **{total_ingresos_ant}** |

Los ingresos se reconocen cuando se satisfacen las obligaciones de desempeño, es decir, cuando el control 
de los bienes o servicios se transfiere al cliente.
"""
    },
    'costos_gastos': {
        'titulo': 'Costos y Gastos',
        'orden': 14,
        'contenido': """
Los costos y gastos del período comprenden:

| Concepto | {año} | {año_anterior} |
|----------|------:|---------------:|
| **Costo de ventas** | **{costo_ventas}** | **{costo_ventas_ant}** |
| | | |
| **Gastos de administración:** | | |
| Gastos de personal | {gtos_personal_adm} | {gtos_personal_adm_ant} |
| Honorarios | {honorarios} | {honorarios_ant} |
| Arrendamientos | {arrendamientos} | {arrendamientos_ant} |
| Depreciaciones | {depreciaciones} | {depreciaciones_ant} |
| Otros gastos | {otros_gtos_adm} | {otros_gtos_adm_ant} |
| **Subtotal administración** | **{total_gtos_adm}** | **{total_gtos_adm_ant}** |
| | | |
| **Gastos de ventas:** | | |
| Gastos de personal | {gtos_personal_vtas} | {gtos_personal_vtas_ant} |
| Publicidad | {publicidad} | {publicidad_ant} |
| Otros gastos de ventas | {otros_gtos_vtas} | {otros_gtos_vtas_ant} |
| **Subtotal ventas** | **{total_gtos_vtas}** | **{total_gtos_vtas_ant}** |
"""
    },
    'hechos_posteriores': {
        'titulo': 'Hechos Ocurridos Después del Período sobre el que se Informa',
        'orden': 16,
        'contenido': """
Entre el {fecha_corte} y la fecha de autorización de estos estados financieros ({fecha_emision}), 
no han ocurrido hechos significativos que requieran ajuste o revelación en los estados financieros.

{hechos_posteriores_texto}
"""
    },
}


class NotasEEFFListView(views.APIView):
    """
    Lista las notas de una empresa/año
    GET /api/contabilidad/notas-eeff/?empresa=1&año=2025
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        año = request.query_params.get('año', datetime.now().year)
        
        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)
        
        notas = NotaEstadoFinanciero.objects.filter(
            empresa_id=empresa_id,
            año=año
        ).order_by('orden', 'numero').values(
            'id', 'tipo_nota', 'numero', 'titulo', 'contenido',
            'incluir_en_reporte', 'orden', 'fecha_actualizacion'
        )
        
        return Response({
            'notas': list(notas),
            'tipos_disponibles': dict(NotaEstadoFinanciero.TIPO_NOTA_CHOICES)
        })


class GenerarNotasAutomaticasView(views.APIView):
    """
    Genera notas automáticas basadas en los saldos contables
    POST /api/contabilidad/notas-eeff/generar/
    {"empresa": 1, "año": 2025}
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        empresa_id = request.data.get('empresa')
        año = int(request.data.get('año', datetime.now().year))
        
        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        # Obtener saldos para el año actual y anterior
        fecha_corte = date(año, 12, 31)
        fecha_corte_ant = date(año - 1, 12, 31)
        
        saldos = self._obtener_saldos(empresa, fecha_corte)
        saldos_ant = self._obtener_saldos(empresa, fecha_corte_ant)
        
        # Variables para las plantillas
        variables = {
            'empresa': empresa.razon_social,
            'nit': empresa.nit,
            'ciudad': empresa.ciudad or 'Colombia',
            'direccion': empresa.direccion or '',
            'actividad': empresa.descripcion_actividad or 'Actividades comerciales',
            'grupo_niif': empresa.get_grupo_niif_display() if hasattr(empresa, 'get_grupo_niif_display') else 'Grupo 2 - NIIF para Pymes',
            'año': str(año),
            'año_anterior': str(año - 1),
            'fecha_corte': f"31 de diciembre de {año}",
            'fecha_emision': datetime.now().strftime('%d de %B de %Y'),
            'metodo_inventario': 'promedio ponderado',
            
            # Saldos actuales
            **{k: self._formato_moneda(v) for k, v in saldos.items()},
            
            # Saldos anteriores (con sufijo _ant)
            **{f"{k}_ant": self._formato_moneda(v) for k, v in saldos_ant.items()},
        }
        
        # Generar notas
        notas_creadas = 0
        for tipo_nota, plantilla in PLANTILLAS_NOTAS.items():
            contenido = plantilla['contenido']
            
            # Reemplazar variables
            for var, valor in variables.items():
                contenido = contenido.replace(f'{{{var}}}', str(valor))
            
            # Crear o actualizar nota
            nota, created = NotaEstadoFinanciero.objects.update_or_create(
                empresa=empresa,
                año=año,
                tipo_nota=tipo_nota,
                defaults={
                    'titulo': plantilla['titulo'],
                    'contenido': contenido,
                    'orden': plantilla['orden'],
                    'numero': plantilla['orden'],
                    'modificado_por': request.user,
                }
            )
            if created:
                notas_creadas += 1
        
        return Response({
            'success': True,
            'notas_creadas': notas_creadas,
            'notas_actualizadas': len(PLANTILLAS_NOTAS) - notas_creadas,
            'mensaje': f'Se generaron {len(PLANTILLAS_NOTAS)} notas para el año {año}'
        })
    
    def _obtener_saldos(self, empresa, fecha_corte):
        """Obtiene los saldos de las cuentas principales"""
        
        def saldo_cuenta(prefijo):
            """Calcula el saldo de cuentas que empiezan con el prefijo"""
            movs = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__lte=fecha_corte,
                asiento__estado='vigente',
                cuenta__codigo__startswith=prefijo
            ).aggregate(
                total_d=Coalesce(Sum('debito'), Decimal('0')),
                total_c=Coalesce(Sum('credito'), Decimal('0'))
            )
            # Activos y gastos: naturaleza débito
            # Pasivos, patrimonio e ingresos: naturaleza crédito
            if prefijo.startswith(('1', '5', '6', '7')):
                return movs['total_d'] - movs['total_c']
            else:
                return movs['total_c'] - movs['total_d']
        
        return {
            # Efectivo (Nota 3)
            'caja': saldo_cuenta('1105'),
            'bancos': saldo_cuenta('1110'),
            'ahorro': saldo_cuenta('1120'),
            'total_efectivo': saldo_cuenta('11'),
            
            # Cuentas por cobrar (Nota 4)
            'clientes': saldo_cuenta('1305'),
            'anticipos': saldo_cuenta('1330'),
            'trabajadores': saldo_cuenta('1365'),
            'deudores_varios': saldo_cuenta('1380'),
            'deterioro': saldo_cuenta('1399'),
            'total_cxc': saldo_cuenta('13'),
            
            # Inventarios (Nota 5)
            'materias_primas': saldo_cuenta('1405'),
            'productos_proceso': saldo_cuenta('1410'),
            'productos_terminados': saldo_cuenta('1430'),
            'mercancias': saldo_cuenta('1435'),
            'provision_inv': saldo_cuenta('1499'),
            'total_inventarios': saldo_cuenta('14'),
            
            # PPE (Nota 6)
            'terrenos_costo': saldo_cuenta('1504'),
            'terrenos_neto': saldo_cuenta('1504'),
            'edificaciones_costo': saldo_cuenta('1516'),
            'edificaciones_dep': saldo_cuenta('1592'),
            'edificaciones_neto': saldo_cuenta('1516') - saldo_cuenta('1592'),
            'maquinaria_costo': saldo_cuenta('1520'),
            'maquinaria_dep': saldo_cuenta('1596'),
            'maquinaria_neto': saldo_cuenta('1520') - saldo_cuenta('1596'),
            'eq_oficina_costo': saldo_cuenta('1524'),
            'eq_oficina_dep': saldo_cuenta('159208'),
            'eq_oficina_neto': saldo_cuenta('1524'),
            'eq_computo_costo': saldo_cuenta('1528'),
            'eq_computo_dep': saldo_cuenta('159210'),
            'eq_computo_neto': saldo_cuenta('1528'),
            'vehiculos_costo': saldo_cuenta('1540'),
            'vehiculos_dep': saldo_cuenta('159240'),
            'vehiculos_neto': saldo_cuenta('1540'),
            'total_ppe_costo': saldo_cuenta('15'),
            'total_ppe_dep': saldo_cuenta('1592'),
            'total_ppe_neto': saldo_cuenta('15'),
            
            # Cuentas por pagar (Nota 8)
            'proveedores': saldo_cuenta('2205'),
            'prov_exterior': saldo_cuenta('2210'),
            'costos_pagar': saldo_cuenta('2335'),
            'acreedores': saldo_cuenta('2380'),
            'total_cxp': saldo_cuenta('22') + saldo_cuenta('23'),
            
            # Obligaciones (Nota 9)
            'oblig_cp': saldo_cuenta('21'),
            'oblig_lp': saldo_cuenta('2105'),
            'total_obligaciones': saldo_cuenta('21'),
            
            # Impuestos (Nota 10)
            'renta': saldo_cuenta('2404'),
            'iva': saldo_cuenta('2408'),
            'retefuente': saldo_cuenta('2365'),
            'ica': saldo_cuenta('2412'),
            'otros_imp': saldo_cuenta('2495'),
            'total_impuestos': saldo_cuenta('24'),
            
            # Patrimonio (Nota 12)
            'capital': saldo_cuenta('31'),
            'reserva_legal': saldo_cuenta('3305'),
            'otras_reservas': saldo_cuenta('33') - saldo_cuenta('3305'),
            'resultados_ant': saldo_cuenta('36'),
            'resultado_ejercicio': saldo_cuenta('37'),
            'total_patrimonio': saldo_cuenta('3'),
            
            # Ingresos (Nota 13)
            'venta_bienes': saldo_cuenta('4135'),
            'servicios': saldo_cuenta('4145'),
            'devoluciones': saldo_cuenta('4175'),
            'total_ingresos': saldo_cuenta('41'),
            
            # Costos y gastos (Nota 14)
            'costo_ventas': saldo_cuenta('6'),
            'gtos_personal_adm': saldo_cuenta('5105'),
            'honorarios': saldo_cuenta('5110'),
            'arrendamientos': saldo_cuenta('5120'),
            'depreciaciones': saldo_cuenta('5160'),
            'otros_gtos_adm': saldo_cuenta('5195'),
            'total_gtos_adm': saldo_cuenta('51'),
            'gtos_personal_vtas': saldo_cuenta('5205'),
            'publicidad': saldo_cuenta('5240'),
            'otros_gtos_vtas': saldo_cuenta('5295'),
            'total_gtos_vtas': saldo_cuenta('52'),
        }
    
    def _formato_moneda(self, valor):
        """Formatea un valor como moneda colombiana"""
        if valor is None:
            return '$0'
        return f"${abs(float(valor)):,.0f}".replace(',', '.')


class NotaEEFFDetailView(views.APIView):
    """
    Ver/Editar una nota específica
    GET/PUT /api/contabilidad/notas-eeff/<id>/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        try:
            nota = NotaEstadoFinanciero.objects.get(pk=pk)
        except NotaEstadoFinanciero.DoesNotExist:
            return Response({'error': 'Nota no encontrada'}, status=404)
        
        return Response({
            'id': nota.id,
            'tipo_nota': nota.tipo_nota,
            'numero': nota.numero,
            'titulo': nota.titulo,
            'contenido': nota.contenido,
            'incluir_en_reporte': nota.incluir_en_reporte,
            'orden': nota.orden,
        })
    
    def put(self, request, pk):
        try:
            nota = NotaEstadoFinanciero.objects.get(pk=pk)
        except NotaEstadoFinanciero.DoesNotExist:
            return Response({'error': 'Nota no encontrada'}, status=404)
        
        nota.titulo = request.data.get('titulo', nota.titulo)
        nota.contenido = request.data.get('contenido', nota.contenido)
        nota.incluir_en_reporte = request.data.get('incluir_en_reporte', nota.incluir_en_reporte)
        nota.orden = request.data.get('orden', nota.orden)
        nota.modificado_por = request.user
        nota.save()
        
        return Response({'success': True})


class ExportarNotasWordView(views.APIView):
    """
    Exporta las notas a documento Word
    GET /api/contabilidad/notas-eeff/exportar-word/?empresa=1&año=2025
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from docx import Document
        from docx.shared import Pt, Inches
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from io import BytesIO
        
        empresa_id = request.query_params.get('empresa')
        año = request.query_params.get('año', datetime.now().year)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        notas = NotaEstadoFinanciero.objects.filter(
            empresa=empresa,
            año=año,
            incluir_en_reporte=True
        ).order_by('orden', 'numero')
        
        # Crear documento
        doc = Document()
        
        # Título
        titulo = doc.add_heading(empresa.razon_social.upper(), 0)
        titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        subtitulo = doc.add_paragraph(f'NIT: {empresa.nit}')
        subtitulo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        doc.add_paragraph()
        
        titulo_notas = doc.add_heading(f'NOTAS A LOS ESTADOS FINANCIEROS', 1)
        titulo_notas.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        periodo = doc.add_paragraph(f'Por el año terminado el 31 de diciembre de {año}')
        periodo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        periodo_fmt = periodo.runs[0]
        periodo_fmt.italic = True
        
        doc.add_paragraph()
        
        # Agregar cada nota
        for nota in notas:
            # Título de la nota
            doc.add_heading(f'NOTA {nota.numero}: {nota.titulo.upper()}', 2)
            
            # Contenido (procesar markdown básico)
            contenido = nota.contenido or ''
            
            # Separar por párrafos
            parrafos = contenido.split('\n\n')
            for parrafo in parrafos:
                parrafo = parrafo.strip()
                if not parrafo:
                    continue
                
                # Detectar tablas (líneas con |)
                if '|' in parrafo and parrafo.count('|') > 2:
                    # Es una tabla - simplificar para Word
                    lineas = [l.strip() for l in parrafo.split('\n') if l.strip() and '---' not in l]
                    if lineas:
                        # Crear tabla
                        num_cols = lineas[0].count('|') - 1
                        tabla = doc.add_table(rows=len(lineas), cols=num_cols)
                        tabla.style = 'Table Grid'
                        
                        for i, linea in enumerate(lineas):
                            celdas = [c.strip() for c in linea.split('|')[1:-1]]
                            for j, celda in enumerate(celdas):
                                if j < num_cols:
                                    tabla.cell(i, j).text = celda.replace('**', '')
                        
                        doc.add_paragraph()
                else:
                    # Es texto normal
                    p = doc.add_paragraph()
                    
                    # Procesar negritas básicas
                    if '**' in parrafo:
                        partes = parrafo.split('**')
                        for i, parte in enumerate(partes):
                            run = p.add_run(parte.replace('###', '').replace('#', ''))
                            if i % 2 == 1:  # Impar = negrita
                                run.bold = True
                    else:
                        p.add_run(parrafo.replace('###', '').replace('#', ''))
        
        # Guardar en buffer
        buffer = BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        
        response = HttpResponse(
            buffer.read(),
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        response['Content-Disposition'] = f'attachment; filename=Notas_EEFF_{empresa.nit}_{año}.docx'
        return response


class ExportarNotasPDFView(views.APIView):
    """
    Exporta las notas a PDF
    GET /api/contabilidad/notas-eeff/exportar-pdf/?empresa=1&año=2025
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
        from io import BytesIO
        
        empresa_id = request.query_params.get('empresa')
        año = request.query_params.get('año', datetime.now().year)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        notas = NotaEstadoFinanciero.objects.filter(
            empresa=empresa,
            año=año,
            incluir_en_reporte=True
        ).order_by('orden', 'numero')
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                               rightMargin=50, leftMargin=50,
                               topMargin=50, bottomMargin=50)
        
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name='TituloEmpresa',
            parent=styles['Heading1'],
            fontSize=14,
            alignment=TA_CENTER,
            spaceAfter=6
        ))
        styles.add(ParagraphStyle(
            name='TituloNota',
            parent=styles['Heading2'],
            fontSize=11,
            spaceBefore=20,
            spaceAfter=10,
            textColor=colors.HexColor('#1e3a5f')
        ))
        styles.add(ParagraphStyle(
            name='Contenido',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_JUSTIFY,
            spaceBefore=6,
            spaceAfter=6,
            leading=14
        ))
        
        story = []
        
        # Encabezado
        story.append(Paragraph(empresa.razon_social.upper(), styles['TituloEmpresa']))
        story.append(Paragraph(f"NIT: {empresa.nit}", ParagraphStyle(
            name='NIT', parent=styles['Normal'], alignment=TA_CENTER, fontSize=10
        )))
        story.append(Spacer(1, 20))
        story.append(Paragraph("NOTAS A LOS ESTADOS FINANCIEROS", styles['TituloEmpresa']))
        story.append(Paragraph(
            f"Por el año terminado el 31 de diciembre de {año}",
            ParagraphStyle(name='Periodo', parent=styles['Normal'], alignment=TA_CENTER, fontSize=10, fontName='Helvetica-Oblique')
        ))
        story.append(Spacer(1, 30))
        
        # Notas
        for nota in notas:
            story.append(Paragraph(f"NOTA {nota.numero}: {nota.titulo.upper()}", styles['TituloNota']))
            
            contenido = nota.contenido or ''
            parrafos = contenido.split('\n\n')
            
            for parrafo in parrafos:
                parrafo = parrafo.strip()
                if not parrafo:
                    continue
                
                # Detectar tablas
                if '|' in parrafo and parrafo.count('|') > 2:
                    lineas = [l.strip() for l in parrafo.split('\n') if l.strip() and '---' not in l]
                    if lineas:
                        data = []
                        for linea in lineas:
                            celdas = [c.strip().replace('**', '') for c in linea.split('|')[1:-1]]
                            data.append(celdas)
                        
                        if data:
                            num_cols = len(data[0])
                            col_width = 450 / num_cols
                            t = Table(data, colWidths=[col_width] * num_cols)
                            t.setStyle(TableStyle([
                                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                                ('FONTSIZE', (0, 0), (-1, -1), 8),
                                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
                                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                                ('TOPPADDING', (0, 0), (-1, -1), 6),
                            ]))
                            story.append(t)
                            story.append(Spacer(1, 10))
                else:
                    # Texto normal
                    texto = parrafo.replace('###', '').replace('**', '<b>').replace('**', '</b>')
                    texto = texto.replace('<b>', '<b>').replace('</b>', '</b>')
                    # Limpiar marcadores markdown restantes
                    texto = texto.replace('#', '')
                    story.append(Paragraph(texto, styles['Contenido']))
        
        # Pie de página
        story.append(Spacer(1, 40))
        story.append(Paragraph(
            f"<font size='8' color='#888888'>Generado por Don Peppini Contadore 🎩</font>",
            ParagraphStyle(name='Footer', alignment=TA_CENTER)
        ))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename=Notas_EEFF_{empresa.nit}_{año}.pdf'
        return response  

        # ============================================================================
# 🎩 INDICADORES FINANCIEROS - VISTAS
# AGREGAR AL FINAL DE contabilidad/views.py
# ============================================================================

from django.db.models.functions import Coalesce


class IndicadoresFinancierosView(views.APIView):
    """
    Calcula todos los indicadores financieros
    GET /api/contabilidad/indicadores/?empresa=1&año=2025
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        año = int(request.query_params.get('año', datetime.now().year))
        
        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        fecha_corte = date(año, 12, 31)
        fecha_inicio = date(año, 1, 1)
        
        # Obtener saldos y resultados
        saldos = self._obtener_saldos(empresa, fecha_corte)
        resultados = self._obtener_resultados(empresa, fecha_inicio, fecha_corte)
        
        # Calcular todos los indicadores
        indicadores = {
            'liquidez': self._calcular_liquidez(saldos),
            'endeudamiento': self._calcular_endeudamiento(saldos),
            'rentabilidad': self._calcular_rentabilidad(saldos, resultados),
            'actividad': self._calcular_actividad(saldos, resultados),
            'ebitda': self._calcular_ebitda(resultados),
        }
        
        return Response({
            'empresa': empresa.razon_social,
            'año': año,
            'fecha_corte': fecha_corte.isoformat(),
            'indicadores': indicadores,
            'saldos': {k: float(v) for k, v in saldos.items()},
            'resultados': {k: float(v) for k, v in resultados.items()},
        })
    
    def _obtener_saldos(self, empresa, fecha_corte):
        """Obtiene saldos del balance"""
        
        def saldo(prefijo, naturaleza='D'):
            movs = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__lte=fecha_corte,
                asiento__estado='vigente',
                cuenta__codigo__startswith=prefijo
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            return movs['d'] - movs['c'] if naturaleza == 'D' else movs['c'] - movs['d']
        
        return {
            'efectivo': saldo('11'),
            'cuentas_cobrar': saldo('13'),
            'inventarios': saldo('14'),
            'activo_corriente': saldo('11') + saldo('12') + saldo('13') + saldo('14'),
            'activo_no_corriente': saldo('15') + saldo('16') + saldo('17') + saldo('18'),
            'activo_total': saldo('1'),
            'pasivo_corriente': saldo('21', 'C') + saldo('22', 'C') + saldo('23', 'C') + saldo('24', 'C') + saldo('25', 'C'),
            'obligaciones_financieras': saldo('21', 'C'),
            'cuentas_pagar': saldo('22', 'C') + saldo('23', 'C'),
            'pasivo_no_corriente': saldo('26', 'C') + saldo('27', 'C'),
            'pasivo_total': saldo('2', 'C'),
            'patrimonio': saldo('3', 'C'),
        }
    
    def _obtener_resultados(self, empresa, fecha_inicio, fecha_fin):
        """Obtiene resultados del período"""
        
        def resultado(prefijo, naturaleza='C'):
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
            return movs['c'] - movs['d'] if naturaleza == 'C' else movs['d'] - movs['c']
        
        ingresos = resultado('41')
        costos = resultado('6', 'D')
        gastos_admin = resultado('51', 'D')
        gastos_ventas = resultado('52', 'D')
        gastos_financieros = resultado('5305', 'D')
        depreciacion = resultado('5160', 'D') + resultado('5260', 'D')
        amortizacion = resultado('5165', 'D') + resultado('5265', 'D')
        impuesto = resultado('54', 'D')
        
        utilidad_bruta = ingresos - costos
        utilidad_operacional = utilidad_bruta - gastos_admin - gastos_ventas
        utilidad_neta = utilidad_operacional - gastos_financieros - impuesto + resultado('42') - resultado('53', 'D')
        
        return {
            'ingresos': ingresos,
            'costos': costos,
            'utilidad_bruta': utilidad_bruta,
            'gastos_operacionales': gastos_admin + gastos_ventas,
            'utilidad_operacional': utilidad_operacional,
            'gastos_financieros': gastos_financieros,
            'utilidad_neta': utilidad_neta,
            'depreciacion': depreciacion,
            'amortizacion': amortizacion,
        }
    
    def _safe_div(self, a, b, decimales=2):
        if b == 0:
            return 0
        return round(float(a / b), decimales)
    
    def _safe_pct(self, a, b):
        if b == 0:
            return 0
        return round(float(a / b * 100), 2)
    
    def _semaforo(self, valor, verde, amarillo):
        """Devuelve el color del semáforo"""
        if valor >= verde:
            return 'verde'
        elif valor >= amarillo:
            return 'amarillo'
        return 'rojo'
    
    def _semaforo_inv(self, valor, verde, amarillo):
        """Semáforo inverso (menor es mejor)"""
        if valor <= verde:
            return 'verde'
        elif valor <= amarillo:
            return 'amarillo'
        return 'rojo'
    
    def _calcular_liquidez(self, s):
        """Indicadores de liquidez"""
        rc = self._safe_div(s['activo_corriente'], s['pasivo_corriente'])
        pa = self._safe_div(s['activo_corriente'] - s['inventarios'], s['pasivo_corriente'])
        ct = float(s['activo_corriente'] - s['pasivo_corriente'])
        re = self._safe_div(s['efectivo'], s['pasivo_corriente'])
        
        return {
            'razon_corriente': {
                'nombre': 'Razón Corriente',
                'valor': rc,
                'unidad': 'veces',
                'formula': 'Activo Corriente / Pasivo Corriente',
                'interpretacion': f"Por cada $1 de deuda CP tiene ${rc:.2f} para responder",
                'meta': '≥ 1.5',
                'semaforo': self._semaforo(rc, 1.5, 1.0),
            },
            'prueba_acida': {
                'nombre': 'Prueba Ácida',
                'valor': pa,
                'unidad': 'veces',
                'formula': '(Activo Corriente - Inventarios) / Pasivo Corriente',
                'interpretacion': f"Sin inventarios, tiene ${pa:.2f} por cada $1 de deuda",
                'meta': '≥ 1.0',
                'semaforo': self._semaforo(pa, 1.0, 0.7),
            },
            'capital_trabajo': {
                'nombre': 'Capital de Trabajo',
                'valor': ct,
                'unidad': '$',
                'formula': 'Activo Corriente - Pasivo Corriente',
                'interpretacion': 'Recursos disponibles para operación' if ct > 0 else 'Déficit de liquidez',
                'meta': '> 0',
                'semaforo': 'verde' if ct > 0 else 'rojo',
            },
            'razon_efectivo': {
                'nombre': 'Razón de Efectivo',
                'valor': re,
                'unidad': 'veces',
                'formula': 'Efectivo / Pasivo Corriente',
                'interpretacion': f"Capacidad de pago inmediato: {re:.2f}x",
                'meta': '≥ 0.3',
                'semaforo': self._semaforo(re, 0.3, 0.1),
            },
        }
    
    def _calcular_endeudamiento(self, s):
        """Indicadores de endeudamiento"""
        ne = self._safe_pct(s['pasivo_total'], s['activo_total'])
        ep = self._safe_pct(s['pasivo_total'], s['patrimonio'])
        ap = self._safe_div(s['activo_total'], s['patrimonio'])
        cc = self._safe_pct(s['pasivo_corriente'], s['pasivo_total']) if s['pasivo_total'] > 0 else 0
        au = self._safe_pct(s['patrimonio'], s['activo_total'])
        
        return {
            'nivel_endeudamiento': {
                'nombre': 'Nivel de Endeudamiento',
                'valor': ne,
                'unidad': '%',
                'formula': '(Pasivo Total / Activo Total) × 100',
                'interpretacion': f"El {ne:.1f}% de los activos está financiado con deuda",
                'meta': '≤ 60%',
                'semaforo': self._semaforo_inv(ne, 60, 70),
            },
            'endeudamiento_patrimonial': {
                'nombre': 'Endeudamiento Patrimonial',
                'valor': ep,
                'unidad': '%',
                'formula': '(Pasivo Total / Patrimonio) × 100',
                'interpretacion': f"Por cada $100 de patrimonio hay ${ep:.0f} de deuda",
                'meta': '≤ 100%',
                'semaforo': self._semaforo_inv(ep, 100, 150),
            },
            'apalancamiento': {
                'nombre': 'Apalancamiento',
                'valor': ap,
                'unidad': 'veces',
                'formula': 'Activo Total / Patrimonio',
                'interpretacion': f"Por cada $1 de patrimonio tiene ${ap:.2f} en activos",
                'meta': '≤ 2.5',
                'semaforo': self._semaforo_inv(ap, 2.5, 3.0),
            },
            'concentracion_cp': {
                'nombre': 'Concentración Corto Plazo',
                'valor': cc,
                'unidad': '%',
                'formula': '(Pasivo Corriente / Pasivo Total) × 100',
                'interpretacion': f"El {cc:.1f}% de la deuda vence en el corto plazo",
                'meta': '≤ 70%',
                'semaforo': self._semaforo_inv(cc, 70, 80),
            },
            'autonomia': {
                'nombre': 'Autonomía Financiera',
                'valor': au,
                'unidad': '%',
                'formula': '(Patrimonio / Activo Total) × 100',
                'interpretacion': f"El {au:.1f}% de los activos es patrimonio propio",
                'meta': '≥ 40%',
                'semaforo': self._semaforo(au, 40, 30),
            },
        }
    
    def _calcular_rentabilidad(self, s, r):
        """Indicadores de rentabilidad"""
        mb = self._safe_pct(r['utilidad_bruta'], r['ingresos'])
        mo = self._safe_pct(r['utilidad_operacional'], r['ingresos'])
        mn = self._safe_pct(r['utilidad_neta'], r['ingresos'])
        roa = self._safe_pct(r['utilidad_neta'], s['activo_total'])
        roe = self._safe_pct(r['utilidad_neta'], s['patrimonio'])
        
        return {
            'margen_bruto': {
                'nombre': 'Margen Bruto',
                'valor': mb,
                'unidad': '%',
                'formula': '(Utilidad Bruta / Ingresos) × 100',
                'interpretacion': f"Por cada $100 vendidos, ${mb:.1f} es utilidad bruta",
                'meta': '≥ 30%',
                'semaforo': self._semaforo(mb, 30, 20),
            },
            'margen_operacional': {
                'nombre': 'Margen Operacional',
                'valor': mo,
                'unidad': '%',
                'formula': '(Utilidad Operacional / Ingresos) × 100',
                'interpretacion': f"Rentabilidad del negocio principal: {mo:.1f}%",
                'meta': '≥ 15%',
                'semaforo': self._semaforo(mo, 15, 8),
            },
            'margen_neto': {
                'nombre': 'Margen Neto',
                'valor': mn,
                'unidad': '%',
                'formula': '(Utilidad Neta / Ingresos) × 100',
                'interpretacion': f"Ganancia final por cada $100 de ventas: ${mn:.1f}",
                'meta': '≥ 10%',
                'semaforo': self._semaforo(mn, 10, 5),
            },
            'roa': {
                'nombre': 'ROA',
                'valor': roa,
                'unidad': '%',
                'formula': '(Utilidad Neta / Activo Total) × 100',
                'interpretacion': f"Rendimiento de los activos: {roa:.1f}%",
                'meta': '≥ 5%',
                'semaforo': self._semaforo(roa, 5, 2),
            },
            'roe': {
                'nombre': 'ROE',
                'valor': roe,
                'unidad': '%',
                'formula': '(Utilidad Neta / Patrimonio) × 100',
                'interpretacion': f"Rendimiento para los socios: {roe:.1f}%",
                'meta': '≥ 15%',
                'semaforo': self._semaforo(roe, 15, 8),
            },
        }
    
    def _calcular_actividad(self, s, r):
        """Indicadores de actividad"""
        # Rotación de cartera
        rot_cart = self._safe_div(r['ingresos'], s['cuentas_cobrar'], 1) if s['cuentas_cobrar'] > 0 else 0
        dias_cart = round(365 / rot_cart) if rot_cart > 0 else 0
        
        # Rotación de inventarios
        rot_inv = self._safe_div(r['costos'], s['inventarios'], 1) if s['inventarios'] > 0 else 0
        dias_inv = round(365 / rot_inv) if rot_inv > 0 else 0
        
        # Rotación de proveedores
        rot_prov = self._safe_div(r['costos'], s['cuentas_pagar'], 1) if s['cuentas_pagar'] > 0 else 0
        dias_prov = round(365 / rot_prov) if rot_prov > 0 else 0
        
        # Ciclos
        ciclo_op = dias_cart + dias_inv
        ciclo_caja = ciclo_op - dias_prov
        
        # Rotación de activos
        rot_act = self._safe_div(r['ingresos'], s['activo_total'])
        
        return {
            'rotacion_cartera': {
                'nombre': 'Rotación de Cartera',
                'valor': rot_cart,
                'dias': dias_cart,
                'unidad': 'veces/año',
                'formula': 'Ingresos / Cuentas por Cobrar',
                'interpretacion': f"Cartera rota {rot_cart:.1f} veces/año ({dias_cart} días)",
                'meta': '≤ 45 días',
                'semaforo': self._semaforo_inv(dias_cart, 45, 60),
            },
            'rotacion_inventarios': {
                'nombre': 'Rotación de Inventarios',
                'valor': rot_inv,
                'dias': dias_inv,
                'unidad': 'veces/año',
                'formula': 'Costo Ventas / Inventarios',
                'interpretacion': f"Inventario rota {rot_inv:.1f} veces/año ({dias_inv} días)",
                'meta': '≤ 60 días',
                'semaforo': self._semaforo_inv(dias_inv, 60, 90),
            },
            'rotacion_proveedores': {
                'nombre': 'Rotación de Proveedores',
                'valor': rot_prov,
                'dias': dias_prov,
                'unidad': 'veces/año',
                'formula': 'Costo Ventas / Cuentas por Pagar',
                'interpretacion': f"Pago a proveedores cada {dias_prov} días",
                'meta': '≥ 30 días',
                'semaforo': self._semaforo(dias_prov, 30, 15),
            },
            'ciclo_operativo': {
                'nombre': 'Ciclo Operativo',
                'valor': ciclo_op,
                'unidad': 'días',
                'formula': 'Días Cartera + Días Inventario',
                'interpretacion': f"Desde compra hasta cobro: {ciclo_op} días",
                'meta': '≤ 90 días',
                'semaforo': self._semaforo_inv(ciclo_op, 90, 120),
            },
            'ciclo_caja': {
                'nombre': 'Ciclo de Caja',
                'valor': ciclo_caja,
                'unidad': 'días',
                'formula': 'Ciclo Operativo - Días Proveedores',
                'interpretacion': f"Días que financia operación: {ciclo_caja}",
                'meta': '≤ 60 días',
                'semaforo': self._semaforo_inv(ciclo_caja, 60, 90),
            },
            'rotacion_activos': {
                'nombre': 'Rotación de Activos',
                'valor': rot_act,
                'unidad': 'veces',
                'formula': 'Ingresos / Activo Total',
                'interpretacion': f"Por cada $1 de activos genera ${rot_act:.2f} en ventas",
                'meta': '≥ 1.0',
                'semaforo': self._semaforo(rot_act, 1.0, 0.5),
            },
        }
    
    def _calcular_ebitda(self, r):
        """Calcula EBITDA"""
        ebitda = float(r['utilidad_operacional'] + r['depreciacion'] + r['amortizacion'])
        margen = self._safe_pct(Decimal(str(ebitda)), r['ingresos'])
        cobertura = self._safe_div(Decimal(str(ebitda)), r['gastos_financieros']) if r['gastos_financieros'] > 0 else 99
        
        return {
            'ebitda': {
                'nombre': 'EBITDA',
                'valor': ebitda,
                'unidad': '$',
                'formula': 'Utilidad Operacional + Depreciación + Amortización',
                'interpretacion': f"Generación de caja operativa: ${ebitda:,.0f}",
                'componentes': {
                    'utilidad_operacional': float(r['utilidad_operacional']),
                    'depreciacion': float(r['depreciacion']),
                    'amortizacion': float(r['amortizacion']),
                },
            },
            'margen_ebitda': {
                'nombre': 'Margen EBITDA',
                'valor': margen,
                'unidad': '%',
                'formula': '(EBITDA / Ingresos) × 100',
                'interpretacion': f"El {margen:.1f}% de los ingresos es EBITDA",
                'meta': '≥ 15%',
                'semaforo': self._semaforo(margen, 15, 10),
            },
            'cobertura_intereses': {
                'nombre': 'Cobertura de Intereses',
                'valor': min(cobertura, 99),
                'unidad': 'veces',
                'formula': 'EBITDA / Gastos Financieros',
                'interpretacion': f"EBITDA cubre {cobertura:.1f}x los intereses" if cobertura < 99 else "Sin deuda financiera significativa",
                'meta': '≥ 3.0',
                'semaforo': self._semaforo(cobertura, 3.0, 1.5),
            },
        }

        # ============================================================================
# 🎩 DASHBOARD - VISTA DE DATOS
# AGREGAR AL FINAL DE contabilidad/views.py
# ============================================================================


class DashboardDataView(views.APIView):
    """
    Obtiene todos los datos para el dashboard principal
    GET /api/contabilidad/dashboard/?empresa=1
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        
        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        hoy = date.today()
        año_actual = hoy.year
        mes_actual = hoy.month
        
        # Fechas para cálculos
        inicio_mes = date(año_actual, mes_actual, 1)
        if mes_actual == 1:
            inicio_mes_ant = date(año_actual - 1, 12, 1)
            fin_mes_ant = date(año_actual - 1, 12, 31)
        else:
            inicio_mes_ant = date(año_actual, mes_actual - 1, 1)
            import calendar
            fin_mes_ant = date(año_actual, mes_actual - 1, calendar.monthrange(año_actual, mes_actual - 1)[1])
        
        inicio_año = date(año_actual, 1, 1)
        
        # ========== SALDOS PRINCIPALES ==========
        saldos = self._obtener_saldos_principales(empresa, hoy)
        
        # ========== RESULTADOS DEL MES ==========
        resultados_mes = self._obtener_resultados_periodo(empresa, inicio_mes, hoy)
        resultados_mes_ant = self._obtener_resultados_periodo(empresa, inicio_mes_ant, fin_mes_ant)
        
        # ========== INDICADORES CLAVE ==========
        resultados_año = self._obtener_resultados_periodo(empresa, inicio_año, hoy)
        indicadores = self._calcular_indicadores_clave(saldos, resultados_año)
        
        # ========== TENDENCIA 6 MESES ==========
        tendencia = self._obtener_tendencia_ingresos(empresa, 6)
        
        # ========== CARTERA PRINCIPAL ==========
        cartera = self._obtener_top_cartera(empresa, 5)
        
        # ========== ÚLTIMOS MOVIMIENTOS ==========
        movimientos = self._obtener_ultimos_movimientos(empresa, 5)
        
        # ========== ALERTAS ==========
        alertas = self._generar_alertas(empresa, saldos, indicadores)
        
        # Calcular variaciones
        var_ingresos = self._calcular_variacion(resultados_mes['ingresos'], resultados_mes_ant['ingresos'])
        var_gastos = self._calcular_variacion(resultados_mes['gastos'], resultados_mes_ant['gastos'])
        
        return Response({
            'empresa': empresa.razon_social,
            'fecha_actualizacion': hoy.isoformat(),
            'periodo': f"{mes_actual}/{año_actual}",
            
            'saldos': {
                'efectivo': float(saldos['efectivo']),
                'cuentas_cobrar': float(saldos['cuentas_cobrar']),
                'cuentas_pagar': float(saldos['cuentas_pagar']),
                'patrimonio': float(saldos['patrimonio']),
            },
            
            'resultados_mes': {
                'ingresos': float(resultados_mes['ingresos']),
                'gastos': float(resultados_mes['gastos']),
                'utilidad': float(resultados_mes['utilidad']),
                'var_ingresos': var_ingresos,
                'var_gastos': var_gastos,
            },
            
            'indicadores': indicadores,
            'tendencia_ingresos': tendencia,
            'top_cartera': cartera,
            'ultimos_movimientos': movimientos,
            'alertas': alertas,
        })
    
    def _obtener_saldos_principales(self, empresa, fecha_corte):
        """Obtiene saldos de las cuentas principales en UNA sola query"""
        from django.db.models.functions import Left
        
        # Una sola query: agrupar por los primeros 2 dígitos del código de cuenta
        raw = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__lte=fecha_corte,
            asiento__estado='vigente',
        ).annotate(
            prefijo2=Left('cuenta__codigo', 2)
        ).values('prefijo2').annotate(
            d=Coalesce(Sum('debito'), Decimal('0')),
            c=Coalesce(Sum('credito'), Decimal('0')),
        )
        
        # Mapear prefijos a saldos
        p = {}
        for r in raw:
            p[r['prefijo2']] = {'d': r['d'], 'c': r['c']}
        
        def saldo_d(prefijo):  # naturaleza débito
            x = p.get(prefijo, {'d': Decimal('0'), 'c': Decimal('0')})
            return x['d'] - x['c']
        
        def saldo_c(prefijo):  # naturaleza crédito
            x = p.get(prefijo, {'d': Decimal('0'), 'c': Decimal('0')})
            return x['c'] - x['d']
        
        activo_corriente = saldo_d('11') + saldo_d('12') + saldo_d('13') + saldo_d('14')
        pasivo_corriente = saldo_c('21') + saldo_c('22') + saldo_c('23') + saldo_c('24') + saldo_c('25')
        
        # Para totales clase 1, 2, 3 sumar todos los prefijos que empiecen con esa clase
        activo_total = sum(saldo_d(k) for k in p if k.startswith('1'))
        pasivo_total = sum(saldo_c(k) for k in p if k.startswith('2'))
        patrimonio = sum(saldo_c(k) for k in p if k.startswith('3'))
        
        return {
            'efectivo': saldo_d('11'),
            'cuentas_cobrar': saldo_d('13'),
            'cuentas_pagar': saldo_c('22') + saldo_c('23'),
            'patrimonio': patrimonio,
            'activo_corriente': activo_corriente,
            'pasivo_corriente': pasivo_corriente,
            'activo_total': activo_total,
            'pasivo_total': pasivo_total,
        }
    
    def _obtener_resultados_periodo(self, empresa, fecha_inicio, fecha_fin):
        """Obtiene resultados de un período"""
        
        def resultado(prefijo, naturaleza='C'):
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
            return movs['c'] - movs['d'] if naturaleza == 'C' else movs['d'] - movs['c']
        
        ingresos = resultado('41')
        costos = resultado('6', 'D')
        gastos = resultado('51', 'D') + resultado('52', 'D')
        
        return {
            'ingresos': ingresos,
            'costos': costos,
            'gastos': gastos,
            'utilidad': ingresos - costos - gastos,
        }
    
    def _calcular_indicadores_clave(self, saldos, resultados_año):
        """Calcula los 4 indicadores clave reutilizando datos ya obtenidos"""
        
        # Razón corriente
        if saldos['pasivo_corriente'] > 0:
            razon_corriente = float(saldos['activo_corriente'] / saldos['pasivo_corriente'])
        else:
            razon_corriente = 0
        
        # Endeudamiento
        if saldos['activo_total'] > 0:
            endeudamiento = float(saldos['pasivo_total'] / saldos['activo_total'] * 100)
        else:
            endeudamiento = 0
        
        # ROE
        if saldos['patrimonio'] > 0:
            roe = float(resultados_año['utilidad'] / saldos['patrimonio'] * 100)
        else:
            roe = 0
        
        # Margen neto
        if resultados_año['ingresos'] > 0:
            margen_neto = float(resultados_año['utilidad'] / resultados_año['ingresos'] * 100)
        else:
            margen_neto = 0
        
        return {
            'razon_corriente': {
                'valor': round(razon_corriente, 2),
                'meta': 1.5,
                'estado': 'verde' if razon_corriente >= 1.5 else 'amarillo' if razon_corriente >= 1 else 'rojo',
            },
            'endeudamiento': {
                'valor': round(endeudamiento, 1),
                'meta': 60,
                'estado': 'verde' if endeudamiento <= 60 else 'amarillo' if endeudamiento <= 70 else 'rojo',
            },
            'roe': {
                'valor': round(roe, 1),
                'meta': 15,
                'estado': 'verde' if roe >= 15 else 'amarillo' if roe >= 8 else 'rojo',
            },
            'margen_neto': {
                'valor': round(margen_neto, 1),
                'meta': 10,
                'estado': 'verde' if margen_neto >= 10 else 'amarillo' if margen_neto >= 5 else 'rojo',
            },
        }
    
    def _obtener_tendencia_ingresos(self, empresa, meses):
        """Obtiene ingresos de los últimos N meses en UNA sola query"""
        from django.db.models.functions import TruncMonth
        import calendar
        
        hoy = date.today()
        meses_nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                         'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        
        # Calcular fecha inicio del rango
        año_ini = hoy.year
        mes_ini = hoy.month - (meses - 1)
        while mes_ini <= 0:
            mes_ini += 12
            año_ini -= 1
        fecha_inicio = date(año_ini, mes_ini, 1)
        
        # Una sola query agrupada por mes
        raw = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=hoy,
            asiento__estado='vigente',
            cuenta__codigo__startswith='41'
        ).annotate(
            mes_trunc=TruncMonth('asiento__fecha')
        ).values('mes_trunc').annotate(
            total=Coalesce(Sum('credito'), Decimal('0')) - Coalesce(Sum('debito'), Decimal('0'))
        ).order_by('mes_trunc')
        
        # Mapear resultados
        datos_mes = {r['mes_trunc'] if isinstance(r['mes_trunc'], date) else r['mes_trunc'].date(): float(r['total']) for r in raw}
        
        tendencia = []
        for i in range(meses - 1, -1, -1):
            año = hoy.year
            mes = hoy.month - i
            while mes <= 0:
                mes += 12
                año -= 1
            key = date(año, mes, 1)
            tendencia.append({
                'mes': meses_nombres[mes - 1],
                'valor': datos_mes.get(key, 0),
            })
        
        return tendencia
    
    def _obtener_top_cartera(self, empresa, limite):
        """Obtiene los principales deudores en UNA sola query"""
        from django.db.models import Max
        
        cartera = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__estado='vigente',
            cuenta__codigo__startswith='13',
            asiento__tercero__isnull=False
        ).values(
            'asiento__tercero__nombre_razon_social',  
        ).annotate(
            saldo=Sum('debito') - Sum('credito'),
            ultima_fecha=Max('asiento__fecha')
        ).filter(
            saldo__gt=0,
        ).order_by('-saldo')[:limite]
        
        hoy = date.today()
        return [{
            'cliente': item['asiento__tercero__nombre_razon_social'] or 'Sin tercero',
            'valor': float(item['saldo']),
            'dias': (hoy - item['ultima_fecha']).days if item['ultima_fecha'] else 0,
        } for item in cartera]
    
    def _obtener_ultimos_movimientos(self, empresa, limite):
        """Obtiene los últimos movimientos significativos con select_related"""
        
        # Obtener los últimos asientos con su movimiento de mayor valor en una sola query
        asientos = AsientoContable.objects.filter(
            empresa=empresa,
            estado='vigente'
        ).prefetch_related('movimientos__cuenta').order_by('-fecha', '-id')[:limite]
        
        hoy = date.today()
        movimientos = []
        for asiento in asientos:
            # Obtener movimiento principal del prefetch (sin query extra)
            movs = list(asiento.movimientos.all())
            if not movs:
                continue
            mov = max(movs, key=lambda m: max(m.debito or 0, m.credito or 0))
            
            valor = float(mov.debito) if mov.debito > 0 else float(mov.credito)
            codigo = mov.cuenta.codigo
            
            if codigo.startswith('4'):
                tipo = 'ingreso'
            elif codigo.startswith(('5', '6')):
                tipo = 'egreso'
            elif codigo.startswith('11') and mov.debito > 0:
                tipo = 'ingreso'
            elif codigo.startswith('11') and mov.credito > 0:
                tipo = 'egreso'
            else:
                tipo = 'ingreso' if mov.debito > 0 else 'egreso'
            
            if asiento.fecha == hoy:
                fecha_str = 'Hoy'
            elif asiento.fecha == hoy - timedelta(days=1):
                fecha_str = 'Ayer'
            else:
                fecha_str = asiento.fecha.strftime('%d/%m')
            
            concepto = asiento.concepto or ''
            movimientos.append({
                'fecha': fecha_str,
                'concepto': concepto[:40] + '...' if len(concepto) > 40 else concepto,
                'valor': valor,
                'tipo': tipo,
            })
        
        return movimientos
    
    def _generar_alertas(self, empresa, saldos, indicadores):
        """Genera alertas basadas en los indicadores"""
        alertas = []
        
        # Alerta de liquidez
        if indicadores['razon_corriente']['estado'] == 'rojo':
            alertas.append({
                'tipo': 'warning',
                'mensaje': 'Razón corriente por debajo de 1.0',
                'icono': 'alert-triangle',
            })
        
        # Alerta de endeudamiento
        if indicadores['endeudamiento']['estado'] == 'rojo':
            alertas.append({
                'tipo': 'warning',
                'mensaje': f"Endeudamiento alto: {indicadores['endeudamiento']['valor']}%",
                'icono': 'alert-triangle',
            })
        
        # Alerta positiva si todo está bien
        if indicadores['razon_corriente']['estado'] == 'verde' and indicadores['endeudamiento']['estado'] == 'verde':
            alertas.append({
                'tipo': 'success',
                'mensaje': 'Indicadores financieros saludables',
                'icono': 'check-circle',
            })
        
        # Alerta de efectivo bajo (si es menor al 10% del pasivo corriente)
        if saldos['pasivo_corriente'] > 0:
            ratio_efectivo = saldos['efectivo'] / saldos['pasivo_corriente']
            if ratio_efectivo < Decimal('0.1'):
                alertas.append({
                    'tipo': 'warning',
                    'mensaje': 'Nivel de efectivo bajo',
                    'icono': 'alert-triangle',
                })
        
        # Si no hay alertas, agregar una informativa
        if not alertas:
            alertas.append({
                'tipo': 'info',
                'mensaje': 'Sin alertas pendientes',
                'icono': 'info',
            })
        
        return alertas[:3]  # Máximo 3 alertas
    
    def _calcular_variacion(self, actual, anterior):
        """Calcula variación porcentual"""
        if anterior == 0:
            return 0
        return round(float((actual - anterior) / anterior * 100), 1)

        # ============================================================================
# 🎩 CIERRE CONTABLE - VISTAS
# AGREGAR AL FINAL DE contabilidad/views.py
# ============================================================================

from django.conf import settings


class CierreContableListView(views.APIView):
    """
    Lista los cierres contables de una empresa
    GET /api/contabilidad/cierres/?empresa=1
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        
        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)
        
        cierres = CierreContable.objects.filter(
            empresa_id=empresa_id
        ).order_by('-año', '-mes')
        
        data = [{
            'id': c.id,
            'tipo': c.tipo,
            'tipo_display': c.get_tipo_display(),
            'año': c.año,
            'mes': c.mes,
            'periodo': c.periodo_str,
            'fecha_cierre': c.fecha_cierre.isoformat(),
            'fecha_ejecucion': c.fecha_ejecucion.isoformat(),
            'total_ingresos': float(c.total_ingresos),
            'total_costos': float(c.total_costos),
            'total_gastos': float(c.total_gastos),
            'resultado_ejercicio': float(c.resultado_ejercicio),
            'estado': c.estado,
            'asiento_cierre_id': c.asiento_cierre_id,
        } for c in cierres]
        
        return Response({
            'cierres': data,
            'count': len(data)
        })


class VerificarPeriodoView(views.APIView):
    """
    Verifica si un período está cerrado
    GET /api/contabilidad/cierres/verificar/?empresa=1&fecha=2025-01-15
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        fecha_str = request.query_params.get('fecha')
        
        if not empresa_id or not fecha_str:
            return Response({'error': 'Empresa y fecha requeridas'}, status=400)
        
        try:
            fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Formato de fecha inválido'}, status=400)
        
        # Verificar cierre anual
        cierre_anual = CierreContable.objects.filter(
            empresa_id=empresa_id,
            tipo='anual',
            año=fecha.year,
            estado='cerrado'
        ).exists()
        
        if cierre_anual:
            return Response({
                'cerrado': True,
                'tipo': 'anual',
                'mensaje': f'El año {fecha.year} está cerrado'
            })
        
        # Verificar cierre mensual
        cierre_mensual = CierreContable.objects.filter(
            empresa_id=empresa_id,
            tipo='mensual',
            año=fecha.year,
            mes=fecha.month,
            estado='cerrado'
        ).exists()
        
        if cierre_mensual:
            return Response({
                'cerrado': True,
                'tipo': 'mensual',
                'mensaje': f'El mes {fecha.month}/{fecha.year} está cerrado'
            })
        
        return Response({
            'cerrado': False,
            'mensaje': 'Período abierto'
        })


class PreviewCierreView(views.APIView):
    """
    Muestra preview del cierre sin ejecutarlo
    POST /api/contabilidad/cierres/preview/
    Body: { empresa, tipo, año, mes? }
    
    NUEVO: Incluye estimación de impuesto de renta:
    - Utilidad gravable × 35% = Impuesto bruto
    - (-) Retenciones en la fuente a favor (1355xx)
    - (-) Autorretenciones a favor (si aplica)
    - = Impuesto neto estimado
    """
    permission_classes = [IsAuthenticated]

    TASA_RENTA = Decimal('0.35')  # 35% tarifa general

    def post(self, request):
        empresa_id = request.data.get('empresa')
        tipo = request.data.get('tipo', 'anual')
        año = int(request.data.get('año', datetime.now().year))
        mes = request.data.get('mes')

        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)

        # Definir período
        if tipo == 'anual':
            fecha_inicio = date(año, 1, 1)
            fecha_fin = date(año, 12, 31)
        else:
            mes = int(mes)
            fecha_inicio = date(año, mes, 1)
            import calendar
            fecha_fin = date(año, mes, calendar.monthrange(año, mes)[1])

        # Verificar si ya existe cierre
        existe = CierreContable.objects.filter(
            empresa=empresa,
            tipo=tipo,
            año=año,
            mes=mes if tipo == 'mensual' else None,
            estado='cerrado'
        ).exists()

        if existe:
            return Response({
                'error': 'Ya existe un cierre para este período',
                'ya_cerrado': True
            }, status=400)

        # ── Calcular saldos de cuentas de resultados ────────────────────
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
        gastos = saldo_clase('5')
        costos = saldo_clase('6')
        resultado = ingresos - gastos - costos

        # ── Detalle de cuentas a saldar ─────────────────────────────────
        cuentas_a_saldar = []
        for clase in ['4', '5', '6']:
            cuentas = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=clase
            ).values(
                'cuenta__codigo',
                'cuenta__nombre'
            ).annotate(
                debitos=Sum('debito'),
                creditos=Sum('credito')
            ).order_by('cuenta__codigo')

            for c in cuentas:
                saldo = c['debitos'] - c['creditos']
                if clase == '4':
                    saldo = c['creditos'] - c['debitos']

                if saldo != 0:
                    cuentas_a_saldar.append({
                        'codigo': c['cuenta__codigo'],
                        'nombre': c['cuenta__nombre'],
                        'saldo': float(saldo),
                        'accion': 'debitar' if clase == '4' else 'acreditar'
                    })

        # ════════════════════════════════════════════════════════════════
        # 🎩 ESTIMACIÓN DE IMPUESTO DE RENTA
        # ════════════════════════════════════════════════════════════════

        impuesto_data = None
        if resultado > 0:
            # Solo calcular si hay utilidad (con pérdida no hay impuesto)
            impuesto_bruto = resultado * self.TASA_RENTA

            # ── Retenciones en la fuente a favor (activo 1355xx) ────────
            # Estas son las retenciones que NOS practicaron a nosotros
            retenciones_favor = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith='1355'
            ).values(
                'cuenta__codigo',
                'cuenta__nombre'
            ).annotate(
                debitos=Sum('debito'),
                creditos=Sum('credito')
            ).order_by('cuenta__codigo')

            detalle_retenciones = []
            total_retenciones = Decimal('0')
            for r in retenciones_favor:
                saldo = r['debitos'] - r['creditos']
                if saldo > 0:
                    detalle_retenciones.append({
                        'codigo': r['cuenta__codigo'],
                        'nombre': r['cuenta__nombre'],
                        'valor': float(saldo),
                    })
                    total_retenciones += saldo

            # ── Autorretenciones (activo 1355xx subcuentas específicas) ──
            # Buscar también en cuentas de autorretención si existen
            # Las autorretenciones de renta suelen estar en 135515, 135518
            # Ya están incluidas arriba, pero las separamos para claridad

            # ── Retenciones de IVA a favor (1357xx o 135517) ────────────
            # Estas se cruzan contra el IVA, no contra renta
            # Pero las mostramos como referencia
            reteiva_favor = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith='135517'
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            reteiva_saldo = reteiva_favor['d'] - reteiva_favor['c']

            # ── Retenciones que hemos practicado (pasivo 2365xx) ────────
            # Estas son las que DEBEMOS pagar a la DIAN (no se restan)
            retenciones_practicadas = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith='2365'
            ).values(
                'cuenta__codigo',
                'cuenta__nombre'
            ).annotate(
                debitos=Sum('debito'),
                creditos=Sum('credito')
            ).order_by('cuenta__codigo')

            detalle_practicadas = []
            total_practicadas = Decimal('0')
            for r in retenciones_practicadas:
                saldo = r['creditos'] - r['debitos']  # Pasivo = crédito
                if saldo > 0:
                    detalle_practicadas.append({
                        'codigo': r['cuenta__codigo'],
                        'nombre': r['cuenta__nombre'],
                        'valor': float(saldo),
                    })
                    total_practicadas += saldo

            # ── Autorretenciones causadas (pasivo 2367xx o similar) ──────
            # Autorretención de renta Decreto 2201/2016
            autorretencion_renta = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__in=[
                    '236575',  # Autorretención renta
                    '236580',  # Autorretención CREE/renta
                ]
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            total_autorretencion = autorretencion_renta['c'] - autorretencion_renta['d']

            # Solo considerar retenciones de fuente (no IVA) para renta
            # Las 135515 son retefuente a favor, las 135517 son reteIVA
            retefuente_a_favor = Decimal('0')
            detalle_retefuente = []
            for r in detalle_retenciones:
                if not r['codigo'].startswith('135517'):  # Excluir ReteIVA
                    retefuente_a_favor += Decimal(str(r['valor']))
                    detalle_retefuente.append(r)

            impuesto_neto = impuesto_bruto - retefuente_a_favor
            if total_autorretencion > 0:
                impuesto_neto -= total_autorretencion

            impuesto_data = {
                'utilidad_gravable': float(resultado),
                'tasa': float(self.TASA_RENTA * 100),
                'impuesto_bruto': float(impuesto_bruto),

                # Retenciones a favor (activo 1355xx excluyendo ReteIVA)
                'retenciones_a_favor': {
                    'detalle': detalle_retefuente,
                    'total': float(retefuente_a_favor),
                },

                # Autorretenciones de renta
                'autorretenciones': {
                    'total': float(total_autorretencion),
                },

                # ReteIVA (referencia, no se resta de renta)
                'reteiva_a_favor': float(reteiva_saldo),

                # Retenciones practicadas (referencia - lo que debemos)
                'retenciones_practicadas': {
                    'detalle': detalle_practicadas,
                    'total': float(total_practicadas),
                },

                # NETO
                'impuesto_neto': float(max(impuesto_neto, Decimal('0'))),
                'saldo_a_favor': float(abs(impuesto_neto)) if impuesto_neto < 0 else 0,

                'nota': (
                    'Estimación basada en utilidad contable × 35%. '
                    'El impuesto real puede variar por diferencias '
                    'temporarias, deducciones y beneficios tributarios. '
                    'Consultar con el asesor tributario para la declaración definitiva.'
                ),
            }

        return Response({
            'empresa': empresa.razon_social,
            'tipo': tipo,
            'periodo': f"Año {año}" if tipo == 'anual' else f"{mes}/{año}",
            'fecha_inicio': fecha_inicio.isoformat(),
            'fecha_fin': fecha_fin.isoformat(),
            'resumen': {
                'ingresos': float(ingresos),
                'costos': float(costos),
                'gastos': float(gastos),
                'resultado': float(resultado),
                'tipo_resultado': 'Utilidad' if resultado >= 0 else 'Pérdida'
            },
            'cuentas_a_saldar': cuentas_a_saldar,
            'cuenta_destino': {
                'codigo': '3605' if resultado >= 0 else '3610',
                'nombre': 'Utilidad del ejercicio' if resultado >= 0 else 'Pérdida del ejercicio',
                'valor': float(abs(resultado))
            },
            # 🎩 NUEVO: Estimación de impuesto
            'impuesto_estimado': impuesto_data,
        })

class EjecutarCierreView(views.APIView):
    """
    Ejecuta el cierre contable
    POST /api/contabilidad/cierres/ejecutar/
    Body: { empresa, tipo, año, mes?, notas? }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        empresa_id = request.data.get('empresa')
        tipo = request.data.get('tipo', 'anual')
        año = int(request.data.get('año', datetime.now().year))
        mes = request.data.get('mes')
        notas = request.data.get('notas', '')
        
        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)
        
        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)
        
        # Definir período
        if tipo == 'anual':
            fecha_inicio = date(año, 1, 1)
            fecha_fin = date(año, 12, 31)
            mes_cierre = None
        else:
            mes = int(mes)
            fecha_inicio = date(año, mes, 1)
            import calendar
            fecha_fin = date(año, mes, calendar.monthrange(año, mes)[1])
            mes_cierre = mes
        
        # Verificar si ya existe cierre
        cierre_existente = CierreContable.objects.filter(
            empresa=empresa,
            tipo=tipo,
            año=año,
            mes=mes_cierre,
            estado='cerrado'
        ).first()
        
        if cierre_existente:
            return Response({
                'error': 'Ya existe un cierre para este período',
                'cierre_id': cierre_existente.id
            }, status=400)
        
        # Calcular saldos
        def saldo_cuenta(codigo_cuenta, fecha_ini, fecha_f):
            movs = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_ini,
                asiento__fecha__lte=fecha_f,
                asiento__estado='vigente',
                cuenta__codigo=codigo_cuenta
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            return movs['d'], movs['c']
        
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
        gastos = saldo_clase('5')
        costos = saldo_clase('6')
        resultado = ingresos - gastos - costos
        
        # Crear asiento de cierre
        if tipo == 'anual':
            concepto_cierre = f"Cierre anual {año}"
        else:
            concepto_cierre = f"Cierre mensual {mes}/{año}"
        
        # Obtener tercero de la empresa (por NIT)
        nit_sin_dv = empresa.nit.split('-')[0] if '-' in empresa.nit else empresa.nit
        tercero_empresa = Tercero.objects.filter(numero_documento=nit_sin_dv).first()
        if not tercero_empresa:
            tercero_empresa = Tercero.objects.create(
                tipo_documento='NIT',
                numero_documento=nit_sin_dv,
                nombre_razon_social=empresa.razon_social,
                tipo_tercero='OTR',
            )
        
        asiento = AsientoContable.objects.create(
            empresa=empresa,
            fecha=fecha_fin,
            fiscal_year=año,
            fiscal_period=13,
            tercero=tercero_empresa,
            concepto=concepto_cierre,
            estado='vigente'
        )
        
        movimientos_creados = []
        
        # Clase 4 - Ingresos (debitar para saldar)
        from django.db.models import Q
        cuentas_ingresos = MovimientoContable.objects.filter(
            asiento__empresa=empresa,
            asiento__fecha__gte=fecha_inicio,
            asiento__fecha__lte=fecha_fin,
            asiento__estado='vigente',
            cuenta__codigo__startswith='4'
        ).values('cuenta__codigo').annotate(
            total_d=Coalesce(Sum('debito'), Decimal('0')),
            total_c=Coalesce(Sum('credito'), Decimal('0'))
        )
        
        for c in cuentas_ingresos:
            saldo = c['total_c'] - c['total_d']
            if saldo > 0:
                cuenta = Cuenta.objects.get(empresa=empresa, codigo=c['cuenta__codigo'])
                MovimientoContable.objects.create(
                    asiento=asiento,
                    cuenta=cuenta,
                    debito=saldo,
                    credito=Decimal('0')
                )
                movimientos_creados.append(f"D {cuenta.codigo}: {saldo}")
        
        # Clase 5 y 6 - Gastos y Costos (acreditar para saldar)
        for clase in ['5', '6']:
            cuentas_gastos = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__fecha__gte=fecha_inicio,
                asiento__fecha__lte=fecha_fin,
                asiento__estado='vigente',
                cuenta__codigo__startswith=clase
            ).values('cuenta__codigo').annotate(
                total_d=Coalesce(Sum('debito'), Decimal('0')),
                total_c=Coalesce(Sum('credito'), Decimal('0'))
            )
            
            for c in cuentas_gastos:
                saldo = c['total_d'] - c['total_c']
                if saldo > 0:
                    cuenta = Cuenta.objects.get(empresa=empresa, codigo=c['cuenta__codigo'])
                    MovimientoContable.objects.create(
                        asiento=asiento,
                        cuenta=cuenta,
                        debito=Decimal('0'),
                        credito=saldo
                    )
                    movimientos_creados.append(f"C {cuenta.codigo}: {saldo}")
        
        # Cuenta de resultado (3605 Utilidad o 3610 Pérdida)
        if resultado >= 0:
            codigo_resultado = '3605'
            nombre_resultado = 'Utilidad del ejercicio'
        else:
            codigo_resultado = '3610'
            nombre_resultado = 'Pérdida del ejercicio'
        
        # Buscar o crear cuenta de resultado
        cuenta_resultado, created = Cuenta.objects.get_or_create(
            empresa=empresa,
            codigo=codigo_resultado,
            defaults={
                'nombre': nombre_resultado,
                'tipo': 'detalle',
                'naturaleza': 'C'
            }
        )
        
        # Registrar resultado (crédito si utilidad, débito si pérdida)
        if resultado >= 0:
            MovimientoContable.objects.create(
                asiento=asiento,
                cuenta=cuenta_resultado,
                debito=Decimal('0'),
                credito=resultado
            )
        else:
            MovimientoContable.objects.create(
                asiento=asiento,
                cuenta=cuenta_resultado,
                debito=abs(resultado),
                credito=Decimal('0')
            )
        
        # Crear registro de cierre
        cierre = CierreContable.objects.create(
            empresa=empresa,
            tipo=tipo,
            año=año,
            mes=mes_cierre,
            fecha_cierre=fecha_fin,
            total_ingresos=ingresos,
            total_costos=costos,
            total_gastos=gastos,
            resultado_ejercicio=resultado,
            asiento_cierre=asiento,
            estado='cerrado',
            usuario=request.user,
            notas=notas
        )
        
        return Response({
            'success': True,
            'mensaje': f"Cierre {'anual' if tipo == 'anual' else 'mensual'} ejecutado correctamente",
            'cierre_id': cierre.id,
            'asiento_id': asiento.id,
            'resumen': {
                'ingresos': float(ingresos),
                'costos': float(costos),
                'gastos': float(gastos),
                'resultado': float(resultado),
                'tipo_resultado': 'Utilidad' if resultado >= 0 else 'Pérdida'
            }
        })


class TrasladoResultadosView(views.APIView):
    """
    Traslada utilidad/pérdida del ejercicio a utilidades/pérdidas acumuladas.
    3605 (Utilidad del ejercicio) → 3705 (Utilidades acumuladas)
    3610 (Pérdida del ejercicio) → 3710 (Pérdidas acumuladas)
    POST /api/contabilidad/cierres/trasladar-resultados/
    Body: { empresa, año }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        empresa_id = request.data.get('empresa')
        año = int(request.data.get('año', datetime.now().year - 1))

        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)

        # Verificar que exista cierre anual del año
        cierre = CierreContable.objects.filter(
            empresa=empresa, tipo='anual', año=año, estado='cerrado'
        ).first()
        if not cierre:
            return Response({'error': f'No existe cierre anual cerrado para {año}'}, status=400)

        # Tercero de la empresa
        nit_sin_dv = empresa.nit.split('-')[0] if '-' in empresa.nit else empresa.nit
        tercero_empresa = Tercero.objects.filter(numero_documento=nit_sin_dv).first()
        if not tercero_empresa:
            tercero_empresa = Tercero.objects.create(
                tipo_documento='NIT', numero_documento=nit_sin_dv,
                nombre_razon_social=empresa.razon_social, tipo_tercero='OTR',
            )

        movimientos = []

        # Verificar saldo en 3605 (Utilidad del ejercicio)
        for cod_origen, cod_destino, nombre_destino in [
            ('3605', '3705', 'Utilidades acumuladas de ejercicios anteriores'),
            ('3610', '3710', 'Pérdidas acumuladas de ejercicios anteriores'),
        ]:
            saldo_q = MovimientoContable.objects.filter(
                asiento__empresa=empresa,
                asiento__estado='vigente',
                cuenta__codigo=cod_origen
            ).aggregate(
                d=Coalesce(Sum('debito'), Decimal('0')),
                c=Coalesce(Sum('credito'), Decimal('0'))
            )
            saldo = saldo_q['c'] - saldo_q['d']  # Naturaleza crédito para patrimonio

            if abs(saldo) > 0:
                # Crear cuentas si no existen
                cuenta_origen = Cuenta.objects.filter(empresa=empresa, codigo=cod_origen).first()
                cuenta_destino, _ = Cuenta.objects.get_or_create(
                    empresa=empresa, codigo=cod_destino,
                    defaults={'nombre': nombre_destino, 'tipo': 'detalle', 'naturaleza': 'C'}
                )
                if cuenta_origen:
                    movimientos.append({
                        'origen': cuenta_origen,
                        'destino': cuenta_destino,
                        'saldo': saldo,
                    })

        if not movimientos:
            return Response({'error': 'No hay saldos en cuentas 3605/3610 para trasladar'}, status=400)

        # Crear asiento de traslado al 1 de enero del año siguiente
        fecha_traslado = date(año + 1, 1, 1)
        asiento = AsientoContable.objects.create(
            empresa=empresa,
            fecha=fecha_traslado,
            fiscal_year=año + 1,
            fiscal_period=1,
            tercero=tercero_empresa,
            concepto=f"Traslado resultado ejercicio {año} a utilidades acumuladas",
            estado='vigente'
        )

        detalles = []
        for m in movimientos:
            saldo = m['saldo']
            # Si saldo > 0: la cuenta origen tiene saldo crédito → debitar origen, acreditar destino
            # Si saldo < 0: la cuenta origen tiene saldo débito → acreditar origen, debitar destino
            if saldo > 0:
                MovimientoContable.objects.create(
                    asiento=asiento, cuenta=m['origen'],
                    debito=saldo, credito=Decimal('0')
                )
                MovimientoContable.objects.create(
                    asiento=asiento, cuenta=m['destino'],
                    debito=Decimal('0'), credito=saldo
                )
            else:
                MovimientoContable.objects.create(
                    asiento=asiento, cuenta=m['origen'],
                    debito=Decimal('0'), credito=abs(saldo)
                )
                MovimientoContable.objects.create(
                    asiento=asiento, cuenta=m['destino'],
                    debito=abs(saldo), credito=Decimal('0')
                )
            detalles.append({
                'origen': m['origen'].codigo,
                'destino': m['destino'].codigo,
                'valor': float(saldo),
            })

        return Response({
            'success': True,
            'mensaje': f'Traslado de resultados {año} ejecutado correctamente',
            'asiento_id': asiento.id,
            'asiento_numero': asiento.numero,
            'detalles': detalles,
        })


class ReabrirPeriodoView(views.APIView):
    """
    Reabre un período cerrado
    POST /api/contabilidad/cierres/reabrir/
    Body: { cierre_id, motivo }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        cierre_id = request.data.get('cierre_id')
        motivo = request.data.get('motivo', '')
        
        if not cierre_id:
            return Response({'error': 'ID de cierre requerido'}, status=400)
        
        try:
            cierre = CierreContable.objects.get(id=cierre_id)
        except CierreContable.DoesNotExist:
            return Response({'error': 'Cierre no encontrado'}, status=404)
        
        if cierre.estado == 'reabierto':
            return Response({'error': 'El período ya está abierto'}, status=400)
        
        # Anular asiento de cierre
        if cierre.asiento_cierre:
            cierre.asiento_cierre.estado = 'anulado'
            cierre.asiento_cierre.save()
        
        # Cambiar estado del cierre
        cierre.estado = 'reabierto'
        cierre.notas += f"\n[REABIERTO {datetime.now().strftime('%Y-%m-%d %H:%M')}] {motivo}"
        cierre.save()
        
        return Response({
            'success': True,
            'mensaje': f"Período {cierre.periodo_str} reabierto correctamente"
        })


# ============================================================================
# IMPORTANTE: Agregar validación en AsientoContableViewSet
# ============================================================================
# En el método create() y update() del AsientoContableViewSet, agregar:
#
# def create(self, request, *args, **kwargs):
#     fecha = request.data.get('fecha')
#     empresa_id = request.data.get('empresa')
#     
#     # Verificar si el período está cerrado
#     if fecha and empresa_id:
#         from datetime import datetime
#         fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
#         
#         cierre_anual = CierreContable.objects.filter(
#             empresa_id=empresa_id,
#             tipo='anual',
#             año=fecha_obj.year,
#             estado='cerrado'
#         ).exists()
#         
#         if cierre_anual:
#             return Response({
#                 'error': f'El año {fecha_obj.year} está cerrado. No se pueden crear asientos.'
#             }, status=400)
#         
#         cierre_mensual = CierreContable.objects.filter(
#             empresa_id=empresa_id,
#             tipo='mensual',
#             año=fecha_obj.year,
#             mes=fecha_obj.month,
#             estado='cerrado'
#         ).exists()
#         
#         if cierre_mensual:
#             return Response({
#                 'error': f'El mes {fecha_obj.month}/{fecha_obj.year} está cerrado.'
#             }, status=400)
#     
#     return super().create(request, *args, **kwargs)

# ====================================================================
# 🎩 MÓDULO IMPORTACIÓN DIAN + RETENCIONES
# ====================================================================

from terceros.models import Tercero
from empresas.models import Empresa
from rest_framework.parsers import MultiPartParser, FormParser
import json


class ConceptoRetencionListView(views.APIView):
    """Lista todos los conceptos de retención activos"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conceptos = ConceptoRetencion.objects.filter(activo=True).values(
            'id', 'codigo', 'concepto_pago', 'categoria', 'norma',
            'base_minima_pesos', 'tarifa', 'cuenta_retencion'
        )
        return Response({'conceptos': list(conceptos)})


class SeedRetencionesView(views.APIView):
    """Carga/actualiza la tabla de retenciones CETA 2026"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        datos = [
            # COMPRAS GENERALES
            {'codigo': 'CG-D', 'concepto_pago': 'Compras generales - Declarantes', 'categoria': 'compras',
             'norma': 'DUT 1.2.4.9.1 Inc.1 y Inc.4, lit.i', 'base_minima_pesos': 524000, 'tarifa': Decimal('2.5'),
             'cuenta_retencion': '236540'},
            {'codigo': 'CG-ND', 'concepto_pago': 'Compras generales - No declarantes', 'categoria': 'compras',
             'norma': 'DUT 1.2.4.9.1 par.3 y inc.4, lit.i', 'base_minima_pesos': 524000, 'tarifa': Decimal('3.5'),
             'cuenta_retencion': '236540'},
            # COMPRAS AGRÍCOLAS
            {'codigo': 'CA-SP', 'concepto_pago': 'Compras agrícolas sin procesamiento industrial', 'categoria': 'compras',
             'norma': 'DUT 1.2.4.6.7 inc.1 y 2', 'base_minima_pesos': 3666000, 'tarifa': Decimal('1.5'),
             'cuenta_retencion': '236540'},
            {'codigo': 'CA-CP', 'concepto_pago': 'Compras agrícolas con procesamiento industrial', 'categoria': 'compras',
             'norma': 'ET 401 Inc.3; DUT 1.2.4.9.1 inc.4', 'base_minima_pesos': 524000, 'tarifa': Decimal('2.5'),
             'cuenta_retencion': '236540'},
            # COMPRAS TARJETA
            {'codigo': 'CT', 'concepto_pago': 'Compras con tarjeta débito y/o crédito', 'categoria': 'compras',
             'norma': 'DUT 1.3.2.1.8 Inc.1 y 2', 'base_minima_pesos': 0, 'tarifa': Decimal('1.5'),
             'cuenta_retencion': '236540'},
            # COMPRAS CAFÉ
            {'codigo': 'CC', 'concepto_pago': 'Compras de café pergamino o cereza', 'categoria': 'compras',
             'norma': 'DUT 1.2.4.6.8 inc.1 y 2', 'base_minima_pesos': 3666000, 'tarifa': Decimal('0.5'),
             'cuenta_retencion': '236540'},
            # COMPRAS COMBUSTIBLES
            {'codigo': 'COMB', 'concepto_pago': 'Compras combustibles derivados del petróleo', 'categoria': 'compras',
             'norma': 'DUT 1.2.4.10.5', 'base_minima_pesos': 0, 'tarifa': Decimal('0.1'),
             'cuenta_retencion': '236540'},
            # SERVICIOS GENERALES
            {'codigo': 'SG-D', 'concepto_pago': 'Servicios generales - Declarantes', 'categoria': 'servicios',
             'norma': 'DUT 1.2.4.4.14 Inc.1', 'base_minima_pesos': 105000, 'tarifa': Decimal('4'),
             'cuenta_retencion': '236525'},
            {'codigo': 'SG-ND', 'concepto_pago': 'Servicios generales - No declarantes', 'categoria': 'servicios',
             'norma': 'ET 392 Inc.4', 'base_minima_pesos': 105000, 'tarifa': Decimal('6'),
             'cuenta_retencion': '236525'},
            # HOTELES Y RESTAURANTES
            {'codigo': 'HR-D', 'concepto_pago': 'Hoteles y restaurantes - Declarantes', 'categoria': 'servicios',
             'norma': 'DUT 1.2.4.10.6 Inc 1', 'base_minima_pesos': 105000, 'tarifa': Decimal('3.5'),
             'cuenta_retencion': '236525'},
            {'codigo': 'HR-ND', 'concepto_pago': 'Hoteles y restaurantes - No declarantes', 'categoria': 'servicios',
             'norma': 'ET 401 Inc.3, DUT 1.2.4.9.2 Par.3', 'base_minima_pesos': 105000, 'tarifa': Decimal('3.5'),
             'cuenta_retencion': '236525'},
            # TRANSPORTE
            {'codigo': 'TT', 'concepto_pago': 'Transporte terrestre de pasajeros', 'categoria': 'transporte',
             'norma': 'DUT 1.2.4.10.6 Inc.2', 'base_minima_pesos': 524000, 'tarifa': Decimal('3.5'),
             'cuenta_retencion': '236530'},
            {'codigo': 'TA', 'concepto_pago': 'Transporte aéreo o marítimo de pasajeros', 'categoria': 'transporte',
             'norma': 'DUT 1.2.4.4.6', 'base_minima_pesos': 105000, 'tarifa': Decimal('1'),
             'cuenta_retencion': '236530'},
            {'codigo': 'TC', 'concepto_pago': 'Transporte de carga', 'categoria': 'transporte',
             'norma': 'DUT 1.2.4.4.6 y 1.2.4.4.8', 'base_minima_pesos': 105000, 'tarifa': Decimal('1'),
             'cuenta_retencion': '236530'},
            # ARRENDAMIENTOS
            {'codigo': 'AI-D', 'concepto_pago': 'Arrendamiento inmuebles - Declarantes', 'categoria': 'arrendamientos',
             'norma': 'DUT 1.2.4.10.6 Inc.2', 'base_minima_pesos': 524000, 'tarifa': Decimal('3.5'),
             'cuenta_retencion': '236520'},
            {'codigo': 'AI-ND', 'concepto_pago': 'Arrendamiento inmuebles - No declarantes', 'categoria': 'arrendamientos',
             'norma': 'ET 401 Inc.3 y DUT 1.2.4.9.2 Par.3', 'base_minima_pesos': 524000, 'tarifa': Decimal('3.5'),
             'cuenta_retencion': '236520'},
            {'codigo': 'AB', 'concepto_pago': 'Arrendamiento bienes muebles', 'categoria': 'arrendamientos',
             'norma': 'DUT 1.2.4.4.10 Inc.2', 'base_minima_pesos': 0, 'tarifa': Decimal('4'),
             'cuenta_retencion': '236520'},
            # HONORARIOS
            {'codigo': 'HO-PJ', 'concepto_pago': 'Honorarios personas jurídicas y asimiladas', 'categoria': 'honorarios',
             'norma': 'DUT 1.2.4.3.1 Inc.1', 'base_minima_pesos': 0, 'tarifa': Decimal('11'),
             'cuenta_retencion': '236515'},
            {'codigo': 'HO-PN', 'concepto_pago': 'Honorarios persona natural < 3.300 UVT', 'categoria': 'honorarios',
             'norma': 'DUT 1.2.4.3.1 Inc.2', 'base_minima_pesos': 0, 'tarifa': Decimal('10'),
             'cuenta_retencion': '236515'},
            {'codigo': 'HO-PN11', 'concepto_pago': 'Honorarios persona natural > 3.300 UVT', 'categoria': 'honorarios',
             'norma': 'DUT 1.2.4.3.1 Inc.2 lit a', 'base_minima_pesos': 0, 'tarifa': Decimal('11'),
             'cuenta_retencion': '236515'},
            {'codigo': 'HO-ND', 'concepto_pago': 'Honorarios - No declarantes', 'categoria': 'honorarios',
             'norma': 'ET 392 Inc.3', 'base_minima_pesos': 0, 'tarifa': Decimal('10'),
             'cuenta_retencion': '236515'},
            # CONSULTORÍA
            {'codigo': 'CO-D', 'concepto_pago': 'Consultoría personas naturales declarantes', 'categoria': 'consultoria',
             'norma': 'DUT 1.2.4.10.2 Inc.2', 'base_minima_pesos': 0, 'tarifa': Decimal('10'),
             'cuenta_retencion': '236515'},
            {'codigo': 'CO-PJ', 'concepto_pago': 'Consultoría personas jurídicas', 'categoria': 'consultoria',
             'norma': 'DUT 1.2.4.10.2 Inc.1', 'base_minima_pesos': 0, 'tarifa': Decimal('11'),
             'cuenta_retencion': '236515'},
            # SOFTWARE
            {'codigo': 'SW', 'concepto_pago': 'Software (análisis, diseño, desarrollo)', 'categoria': 'software',
             'norma': 'DUT 1.2.4.3.1', 'base_minima_pesos': 0, 'tarifa': Decimal('3.5'),
             'cuenta_retencion': '236515'},
            # SERVICIOS TEMPORALES
            {'codigo': 'ST', 'concepto_pago': 'Empresas de servicios temporales', 'categoria': 'servicios',
             'norma': 'DUT 1.2.4.4.10 Inc.1', 'base_minima_pesos': 105000, 'tarifa': Decimal('1'),
             'cuenta_retencion': '236525'},
            # VIGILANCIA Y ASEO
            {'codigo': 'VA', 'concepto_pago': 'Servicios vigilancia y aseo', 'categoria': 'servicios',
             'norma': 'DUT 1.2.4.4.10 Inc.2', 'base_minima_pesos': 105000, 'tarifa': Decimal('2'),
             'cuenta_retencion': '236525'},
            # SALUD
            {'codigo': 'SS', 'concepto_pago': 'Servicios integrales de salud por IPS', 'categoria': 'servicios',
             'norma': 'ET 392 inc.5 y DUT 1.2.4.4.12', 'base_minima_pesos': 105000, 'tarifa': Decimal('2'),
             'cuenta_retencion': '236525'},
            # INGENIERÍA
            {'codigo': 'ING-PJ', 'concepto_pago': 'Consultoría ingeniería/infraestructura PJ', 'categoria': 'consultoria',
             'norma': 'DUT 1.2.4.10.3 Inc.1', 'base_minima_pesos': 0, 'tarifa': Decimal('6'),
             'cuenta_retencion': '236515'},
            {'codigo': 'ING-PN', 'concepto_pago': 'Consultoría ingeniería/infraestructura PN', 'categoria': 'consultoria',
             'norma': 'DUT 1.2.4.10.3 Inc.2', 'base_minima_pesos': 0, 'tarifa': Decimal('6'),
             'cuenta_retencion': '236515'},
            # CONSTRUCCIÓN
            {'codigo': 'CON', 'concepto_pago': 'Construcción y urbanización', 'categoria': 'construccion',
             'norma': 'DUT 1.2.4.9.1 Inc.2', 'base_minima_pesos': 0, 'tarifa': Decimal('2'),
             'cuenta_retencion': '236540'},
            # OTROS INGRESOS
            {'codigo': 'OI-D', 'concepto_pago': 'Otros ingresos tributarios - Declarantes', 'categoria': 'otros',
             'norma': 'DUT 1.2.4.9.1 Inc.1', 'base_minima_pesos': 524000, 'tarifa': Decimal('2.5'),
             'cuenta_retencion': '236570'},
            {'codigo': 'OI-ND', 'concepto_pago': 'Otros ingresos tributarios - No declarantes', 'categoria': 'otros',
             'norma': 'ET 401 Inc.3 y DUT 1.2.4.9.2 Par.3', 'base_minima_pesos': 524000, 'tarifa': Decimal('3.5'),
             'cuenta_retencion': '236570'},
            # RENDIMIENTOS FINANCIEROS
            {'codigo': 'RF', 'concepto_pago': 'Rendimientos financieros (CDT, bonos)', 'categoria': 'financieros',
             'norma': 'DUT 1.2.4.2.5', 'base_minima_pesos': 0, 'tarifa': Decimal('10'),  # Sobre 70% de la base
             'cuenta_retencion': '236505'},
            {'codigo': 'RF-INT', 'concepto_pago': 'Intereses financieros (CDAT, ahorros)', 'categoria': 'financieros',
             'norma': 'DUT 1.2.4.2.32 y 1.2.4.2.83', 'base_minima_pesos': 0, 'tarifa': Decimal('4'),
             'cuenta_retencion': '236505'},
            # SIN RETENCIÓN
            {'codigo': 'NONE', 'concepto_pago': 'Sin retención', 'categoria': 'ninguno',
             'norma': '', 'base_minima_pesos': 0, 'tarifa': Decimal('0'),
             'cuenta_retencion': ''},
        ]

        creados = 0
        actualizados = 0
        for d in datos:
            obj, created = ConceptoRetencion.objects.update_or_create(
                codigo=d['codigo'],
                defaults=d
            )
            if created:
                creados += 1
            else:
                actualizados += 1

        return Response({
            'success': True,
            'mensaje': f'Retenciones CETA 2026 cargadas: {creados} nuevos, {actualizados} actualizados',
            'total': len(datos),
        })


class ImportDIANPreviewView(views.APIView):
    """
    Sube un Excel DIAN (Emitidos o Recibidos) y devuelve datos parseados para preview.
    POST /api/contabilidad/importar-dian/preview/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        archivo = request.FILES.get('archivo')
        tipo = request.data.get('tipo', 'recibidos')  # emitidos o recibidos
        empresa_id = request.data.get('empresa')

        if not archivo:
            return Response({'error': 'Archivo requerido'}, status=400)
        if not empresa_id:
            return Response({'error': 'Empresa requerida'}, status=400)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)

        import openpyxl
        try:
            wb = openpyxl.load_workbook(archivo, data_only=True)
            ws = wb.active
        except Exception as e:
            return Response({'error': f'Error leyendo Excel: {str(e)}'}, status=400)

        filas = []
        for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
            if not row[0]:
                continue

            nit_col = 9 if tipo == 'recibidos' else 11  # NIT Emisor vs Receptor
            nombre_col = 10 if tipo == 'recibidos' else 12

            nit_raw = str(row[nit_col] or '').strip()
            nombre = str(row[nombre_col] or '').strip()
            folio = f"{row[3] or ''}-{row[2] or ''}"
            fecha_str = str(row[7] or '')

            iva = float(row[13] or 0)
            total = float(row[29] or 0)
            subtotal = round(total - iva, 2)

            # Buscar tercero existente
            tercero_existente = Tercero.objects.filter(numero_documento=nit_raw).first()
            es_nuevo = tercero_existente is None
            es_autoretenedor = tercero_existente.es_autoretenedor if tercero_existente else False
            es_declarante = tercero_existente.es_declarante if tercero_existente else True
            tipo_doc = 'NIT' if len(nit_raw) >= 9 else 'CC'
            if tercero_existente:
                tipo_doc = tercero_existente.tipo_documento

            fila = {
                'idx': idx,
                'incluir': True,
                'nit': nit_raw,
                'nombre': tercero_existente.nombre_razon_social if tercero_existente else nombre,
                'tipo_documento': tipo_doc,
                'folio': folio,
                'fecha': fecha_str,
                'subtotal': subtotal,
                'iva': iva,
                'total': total,
                'tercero_existe': not es_nuevo,
                'tercero_id': tercero_existente.id if tercero_existente else None,
                'es_autoretenedor': es_autoretenedor,
                'es_declarante': es_declarante,
                'concepto_retencion_id': None,
                'retencion_calculada': 0,
                'cuenta_gasto': '613595' if tipo == 'recibidos' else '130505',
                'cuenta_ingreso': '413595' if tipo == 'emitidos' else '',
                'cuenta_iva': '240802' if tipo == 'recibidos' else '240804',
                'estado_dian': str(row[30] or ''),
            }
            filas.append(fila)

        # Cargar cuentas de la empresa para dropdowns
        cuentas = list(Cuenta.objects.filter(
            empresa=empresa, activa=True
        ).values('codigo', 'nombre', 'naturaleza').order_by('codigo')[:500])

        return Response({
            'tipo': tipo,
            'empresa': empresa.razon_social,
            'total_filas': len(filas),
            'filas': filas,
            'cuentas': cuentas,
        })


class ImportDIANExecuteView(views.APIView):
    """
    Ejecuta la importación confirmada: crea terceros + asientos.
    POST /api/contabilidad/importar-dian/ejecutar/
    Body: { empresa, tipo, filas: [...] }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        empresa_id = request.data.get('empresa')
        tipo = request.data.get('tipo', 'recibidos')
        filas = request.data.get('filas', [])

        if not empresa_id or not filas:
            return Response({'error': 'Empresa y filas requeridas'}, status=400)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada'}, status=404)

        terceros_creados = 0
        asientos_creados = 0
        errores = []

        for i, fila in enumerate(filas):
            if not fila.get('incluir', True):
                continue

            nit = str(fila.get('nit', '')).strip()
            if not nit:
                errores.append(f"Fila {i+1}: NIT vacío")
                continue

            # 1. Crear o obtener tercero
            tercero = Tercero.objects.filter(numero_documento=nit).first()
            if not tercero:
                try:
                    tercero = Tercero.objects.create(
                        tipo_documento=fila.get('tipo_documento', 'NIT'),
                        numero_documento=nit,
                        nombre_razon_social=fila.get('nombre', f'Tercero {nit}'),
                        tipo_tercero='PRO' if tipo == 'recibidos' else 'CLI',
                        es_autoretenedor=fila.get('es_autoretenedor', False),
                        es_declarante=fila.get('es_declarante', True),
                    )
                    terceros_creados += 1
                except Exception as e:
                    errores.append(f"Fila {i+1}: Error creando tercero {nit}: {str(e)}")
                    continue
            else:
                # Actualizar flags si cambiaron
                changed = False
                if fila.get('es_autoretenedor') != tercero.es_autoretenedor:
                    tercero.es_autoretenedor = fila.get('es_autoretenedor', False)
                    changed = True
                if fila.get('es_declarante') != tercero.es_declarante:
                    tercero.es_declarante = fila.get('es_declarante', True)
                    changed = True
                if changed:
                    tercero.save()

            # 2. Parsear valores
            subtotal = Decimal(str(fila.get('subtotal', 0)))
            iva = Decimal(str(fila.get('iva', 0)))
            total = Decimal(str(fila.get('total', 0)))
            retencion = Decimal(str(fila.get('retencion_calculada', 0)))
            folio = fila.get('folio', '')
            fecha_str = fila.get('fecha', '')

            # Parsear fecha
            try:
                if '-' in fecha_str and len(fecha_str) == 10:
                    partes = fecha_str.split('-')
                    if len(partes[0]) == 4:
                        fecha = date.fromisoformat(fecha_str)
                    else:
                        fecha = date(int(partes[2]), int(partes[1]), int(partes[0]))
                else:
                    fecha = date.today()
            except:
                fecha = date.today()

            # 3. Crear asiento contable
            try:
                asiento = AsientoContable.objects.create(
                    empresa=empresa,
                    fecha=fecha,
                    tercero=tercero,
                    concepto=f"{'Compra' if tipo == 'recibidos' else 'Venta'} {folio} - {tercero.nombre_razon_social}",
                    estado='vigente',
                )

                cuenta_gasto = fila.get('cuenta_gasto', '')
                cuenta_iva = fila.get('cuenta_iva', '')
                cuenta_retencion = fila.get('cuenta_retencion', '')

                if tipo == 'recibidos':
                    # --- FACTURA DE COMPRA ---
                    # DB: Gasto/Costo (subtotal)
                    if subtotal > 0 and cuenta_gasto:
                        cta = self._get_or_create_cuenta(empresa, cuenta_gasto, 'D')
                        MovimientoContable.objects.create(
                            asiento=asiento, cuenta=cta,
                            debito=subtotal, credito=Decimal('0')
                        )

                    # DB: IVA descontable
                    if iva > 0 and cuenta_iva:
                        cta = self._get_or_create_cuenta(empresa, cuenta_iva, 'D')
                        MovimientoContable.objects.create(
                            asiento=asiento, cuenta=cta,
                            debito=iva, credito=Decimal('0')
                        )

                    # CR: Retención en la fuente
                    if retencion > 0 and cuenta_retencion:
                        cta = self._get_or_create_cuenta(empresa, cuenta_retencion, 'C')
                        MovimientoContable.objects.create(
                            asiento=asiento, cuenta=cta,
                            debito=Decimal('0'), credito=retencion
                        )

                    # CR: Proveedor (total - retención)
                    valor_pagar = total - retencion
                    cta_prov = self._get_or_create_cuenta(empresa, '220505', 'C')
                    MovimientoContable.objects.create(
                        asiento=asiento, cuenta=cta_prov,
                        debito=Decimal('0'), credito=valor_pagar
                    )

                else:
                    # --- FACTURA DE VENTA ---
                    cuenta_ingreso = fila.get('cuenta_ingreso', '413595')

                    # DB: Clientes (total)
                    cta_cli = self._get_or_create_cuenta(empresa, cuenta_gasto or '130505', 'D')
                    MovimientoContable.objects.create(
                        asiento=asiento, cuenta=cta_cli,
                        debito=total, credito=Decimal('0')
                    )

                    # CR: Ingreso (subtotal)
                    if subtotal > 0 and cuenta_ingreso:
                        cta = self._get_or_create_cuenta(empresa, cuenta_ingreso, 'C')
                        MovimientoContable.objects.create(
                            asiento=asiento, cuenta=cta,
                            debito=Decimal('0'), credito=subtotal
                        )

                    # CR: IVA generado
                    if iva > 0 and cuenta_iva:
                        cta = self._get_or_create_cuenta(empresa, cuenta_iva, 'C')
                        MovimientoContable.objects.create(
                            asiento=asiento, cuenta=cta,
                            debito=Decimal('0'), credito=iva
                        )

                asientos_creados += 1

            except Exception as e:
                errores.append(f"Fila {i+1}: Error creando asiento: {str(e)}")
                continue

        return Response({
            'success': True,
            'mensaje': f'Importación completada: {asientos_creados} asientos, {terceros_creados} terceros nuevos',
            'asientos_creados': asientos_creados,
            'terceros_creados': terceros_creados,
            'errores': errores,
        })

    def _get_or_create_cuenta(self, empresa, codigo, naturaleza):
        """Obtiene cuenta o la crea como auxiliar"""
        cuenta = Cuenta.objects.filter(empresa=empresa, codigo=codigo).first()
        if not cuenta:
            # Buscar en CuentaBase
            base = CuentaBase.objects.filter(codigo=codigo).first()
            nombre = base.nombre if base else f"Cuenta {codigo}"
            cuenta = Cuenta.objects.create(
                empresa=empresa,
                codigo=codigo,
                nombre=nombre,
                naturaleza=naturaleza,
                tipo='Auxiliar',
                activa=True,
            )
        return cuenta


# ============================================================
# 🔍 MÓDULO DE AUDITORÍA INTERNA
# ============================================================

class AuditoriaBitacoraView(views.APIView):
    """Bitácora completa de acciones contables."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        fi = _parse_date(request.query_params.get('fecha_inicio'))
        ff = _parse_date(request.query_params.get('fecha_fin'))
        accion = request.query_params.get('accion')  # filtro opcional

        qs = BitacoraAuditoria.objects.filter(empresa_id=empresa_id).select_related('usuario', 'asiento', 'asiento_relacionado')
        if fi:
            qs = qs.filter(fecha__date__gte=fi)
        if ff:
            qs = qs.filter(fecha__date__lte=ff)
        if accion:
            qs = qs.filter(accion=accion)

        data = []
        for b in qs[:500]:
            data.append({
                'id': b.id,
                'fecha': b.fecha.isoformat(),
                'usuario': b.usuario.username if b.usuario else 'Sistema',
                'accion': b.accion,
                'accion_display': b.get_accion_display(),
                'detalle': b.detalle,
                'asiento_id': b.asiento_id,
                'asiento_numero': b.asiento.numero if b.asiento else None,
                'asiento_relacionado_id': b.asiento_relacionado_id,
                'asiento_relacionado_numero': b.asiento_relacionado.numero if b.asiento_relacionado else None,
                'ip_address': b.ip_address,
            })
        return Response(data)


class AuditoriaAnulacionesView(views.APIView):
    """Reporte de todos los asientos anulados y corregidos."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        fi = _parse_date(request.query_params.get('fecha_inicio'))
        ff = _parse_date(request.query_params.get('fecha_fin'))

        qs = AsientoContable.objects.filter(
            empresa_id=empresa_id, estado='anulado'
        ).select_related('tercero', 'anulado_por', 'ajusta_a').order_by('-anulado_en')

        if fi:
            qs = qs.filter(fecha__gte=fi)
        if ff:
            qs = qs.filter(fecha__lte=ff)

        data = []
        for a in qs:
            data.append({
                'id': a.id,
                'numero': a.numero,
                'fecha_asiento': str(a.fecha),
                'concepto': a.concepto,
                'tercero': a.tercero.nombre_razon_social if a.tercero else None,
                'anulado_por': a.anulado_por.username if a.anulado_por else 'N/A',
                'anulado_en': a.anulado_en.isoformat() if a.anulado_en else None,
                'motivo': a.anulacion_motivo or '',
                'es_correccion': 'Corrección rápida' in (a.anulacion_motivo or ''),
                'ajuste_id': a.ajusta_a_id,
                'ajuste_numero': a.ajusta_a.numero if a.ajusta_a else None,
                'total_debito': float(sum(m.debito for m in a.movimientos.all())),
            })
        return Response({
            'total_anulaciones': len(data),
            'total_correcciones': sum(1 for d in data if d['es_correccion']),
            'registros': data,
        })


class AuditoriaNumeracionView(views.APIView):
    """Detecta saltos en la numeración de asientos por tipo de comprobante y año fiscal."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        anio = request.query_params.get('anio')

        qs = AsientoContable.objects.filter(empresa_id=empresa_id)
        if anio:
            qs = qs.filter(fiscal_year=int(anio))

        from collections import defaultdict
        por_tipo_anio = defaultdict(list)
        for a in qs.values('fiscal_year', 'tipo_comprobante', 'numero', 'id', 'estado').order_by('tipo_comprobante', 'fiscal_year', 'numero'):
            key = (a['tipo_comprobante'] or 'OT', a['fiscal_year'])
            por_tipo_anio[key].append(a)

        resultado = []
        for (tipo, year), asientos in sorted(por_tipo_anio.items()):
            numeros = sorted(set(a['numero'] for a in asientos))
            if not numeros:
                continue
            gaps = []
            for i in range(len(numeros) - 1):
                if numeros[i+1] - numeros[i] > 1:
                    for missing in range(numeros[i]+1, numeros[i+1]):
                        gaps.append(missing)
            if numeros[0] != 1:
                for missing in range(1, numeros[0]):
                    gaps.insert(0, missing)

            duplicados = []
            seen = set()
            for n in [a['numero'] for a in asientos]:
                if n in seen:
                    duplicados.append(n)
                seen.add(n)

            tipo_labels = dict(AsientoContable.TIPOS_COMPROBANTE)
            resultado.append({
                'tipo': tipo,
                'tipo_nombre': tipo_labels.get(tipo, tipo),
                'anio': year,
                'total_asientos': len(asientos),
                'rango': f"{numeros[0]} - {numeros[-1]}",
                'gaps': gaps[:50],
                'total_gaps': len(gaps),
                'duplicados': list(set(duplicados)),
                'total_duplicados': len(set(duplicados)),
                'estado': 'OK' if not gaps and not duplicados else 'REVISAR',
            })

        return Response(resultado)


class AuditoriaSaldosContrariosView(views.APIView):
    """Cuentas con saldo contrario a su naturaleza."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        ff = _parse_date(request.query_params.get('fecha_fin'))

        cuentas = Cuenta.objects.filter(empresa_id=empresa_id, activa=True)
        alertas = []

        for c in cuentas:
            movs = MovimientoContable.objects.filter(
                cuenta=c, asiento__empresa_id=empresa_id, asiento__estado='vigente'
            )
            if ff:
                movs = movs.filter(asiento__fecha__lte=ff)
            agg = movs.aggregate(td=Sum('debito'), tc=Sum('credito'))
            td = agg['td'] or Decimal('0')
            tc = agg['tc'] or Decimal('0')
            saldo = td - tc

            # Verificar contra naturaleza
            anormal = False
            if c.naturaleza == 'debito' and saldo < 0:
                anormal = True
            elif c.naturaleza == 'credito' and saldo > 0:
                anormal = True

            if anormal and abs(saldo) > Decimal('0.01'):
                alertas.append({
                    'cuenta_codigo': c.codigo,
                    'cuenta_nombre': c.nombre,
                    'naturaleza': c.naturaleza,
                    'saldo': float(saldo),
                    'esperado': 'Débito (+)' if c.naturaleza == 'debito' else 'Crédito (-)',
                    'encontrado': 'Crédito (-)' if saldo < 0 else 'Débito (+)',
                    'severidad': 'alta' if abs(saldo) > 1000000 else 'media',
                })

        return Response({
            'total_alertas': len(alertas),
            'alertas': sorted(alertas, key=lambda x: abs(x['saldo']), reverse=True),
        })


class AuditoriaDuplicadosView(views.APIView):
    """Detecta asientos potencialmente duplicados."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        fi = _parse_date(request.query_params.get('fecha_inicio'))
        ff = _parse_date(request.query_params.get('fecha_fin'))

        qs = AsientoContable.objects.filter(
            empresa_id=empresa_id, estado='vigente'
        ).prefetch_related('movimientos')
        if fi:
            qs = qs.filter(fecha__gte=fi)
        if ff:
            qs = qs.filter(fecha__lte=ff)

        # Agrupar por (tercero, fecha, total_debito) → posibles duplicados
        from collections import defaultdict
        grupos = defaultdict(list)
        for a in qs.select_related('tercero'):
            total_deb = sum(m.debito for m in a.movimientos.all())
            key = (a.tercero_id, str(a.fecha), str(total_deb))
            grupos[key].append({
                'id': a.id,
                'numero': a.numero,
                'fecha': str(a.fecha),
                'concepto': a.concepto,
                'tercero': a.tercero.nombre_razon_social if a.tercero else 'N/A',
                'total_debito': float(total_deb),
            })

        duplicados = [
            {'clave': f"{items[0]['tercero']} | {items[0]['fecha']} | ${items[0]['total_debito']:,.0f}",
             'asientos': items}
            for items in grupos.values() if len(items) > 1
        ]

        return Response({
            'total_grupos': len(duplicados),
            'duplicados': duplicados[:100],
        })


class AuditoriaMontosInusualesView(views.APIView):
    """Movimientos con montos inusualmente altos vs promedio de la cuenta."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Avg, StdDev
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        umbral = float(request.query_params.get('umbral', 3))  # desviaciones estándar

        # Estadísticas por cuenta
        stats = MovimientoContable.objects.filter(
            asiento__empresa_id=empresa_id, asiento__estado='vigente'
        ).values('cuenta__codigo', 'cuenta__nombre').annotate(
            avg_deb=Avg('debito'), std_deb=StdDev('debito'),
            avg_cre=Avg('credito'), std_cre=StdDev('credito'),
            total=Count('id'),
        ).filter(total__gte=5)  # solo cuentas con suficientes datos

        alertas = []
        for s in stats:
            if not s['std_deb'] and not s['std_cre']:
                continue
            # Buscar movimientos que excedan umbral * std
            movs = MovimientoContable.objects.filter(
                asiento__empresa_id=empresa_id, asiento__estado='vigente',
                cuenta__codigo=s['cuenta__codigo']
            ).select_related('asiento', 'asiento__tercero')

            for m in movs:
                inusual = False
                monto = float(m.debito) if m.debito > 0 else float(m.credito)
                tipo = 'débito' if m.debito > 0 else 'crédito'
                avg = float(s['avg_deb'] or 0) if m.debito > 0 else float(s['avg_cre'] or 0)
                std = float(s['std_deb'] or 0) if m.debito > 0 else float(s['std_cre'] or 0)
                if std > 0 and monto > avg + (umbral * std):
                    inusual = True
                if inusual:
                    alertas.append({
                        'cuenta': s['cuenta__codigo'],
                        'cuenta_nombre': s['cuenta__nombre'],
                        'asiento_id': m.asiento.id,
                        'asiento_numero': m.asiento.numero,
                        'fecha': str(m.asiento.fecha),
                        'tercero': m.asiento.tercero.nombre_razon_social if m.asiento.tercero else 'N/A',
                        'tipo': tipo,
                        'monto': monto,
                        'promedio': round(avg, 2),
                        'desviaciones': round((monto - avg) / std, 1) if std > 0 else 0,
                    })

        return Response({
            'umbral_desviaciones': umbral,
            'total_alertas': len(alertas),
            'alertas': sorted(alertas, key=lambda x: x['desviaciones'], reverse=True)[:100],
        })


class AuditoriaSinSoporteView(views.APIView):
    """Asientos sin descripción adicional (posible falta de soporte)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        fi = _parse_date(request.query_params.get('fecha_inicio'))
        ff = _parse_date(request.query_params.get('fecha_fin'))

        qs = AsientoContable.objects.filter(
            empresa_id=empresa_id, estado='vigente'
        ).filter(
            Q(descripcion_adicional__isnull=True) |
            Q(descripcion_adicional='')
        ).select_related('tercero')

        if fi:
            qs = qs.filter(fecha__gte=fi)
        if ff:
            qs = qs.filter(fecha__lte=ff)

        total_empresa = AsientoContable.objects.filter(
            empresa_id=empresa_id, estado='vigente'
        ).count()

        data = [{
            'id': a.id, 'numero': a.numero, 'fecha': str(a.fecha),
            'concepto': a.concepto,
            'tercero': a.tercero.nombre_razon_social if a.tercero else 'N/A',
            'total_debito': float(sum(m.debito for m in a.movimientos.all())),
        } for a in qs[:200]]

        return Response({
            'total_sin_soporte': qs.count(),
            'total_asientos': total_empresa,
            'porcentaje': round(qs.count() / max(total_empresa, 1) * 100, 1),
            'registros': data,
        })


class AuditoriaConcentracionTercerosView(views.APIView):
    """Concentración de movimientos por tercero."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, Count
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        fi = _parse_date(request.query_params.get('fecha_inicio'))
        ff = _parse_date(request.query_params.get('fecha_fin'))

        qs = AsientoContable.objects.filter(
            empresa_id=empresa_id, estado='vigente'
        )
        if fi:
            qs = qs.filter(fecha__gte=fi)
        if ff:
            qs = qs.filter(fecha__lte=ff)

        total_asientos = qs.count()

        concentracion = qs.values(
            'tercero__numero_documento', 'tercero__nombre_razon_social'
        ).annotate(
            cantidad=Count('id'),
            total_movido=Sum('movimientos__debito'),
        ).order_by('-cantidad')[:20]

        data = [{
            'nit': c['tercero__numero_documento'],
            'nombre': c['tercero__nombre_razon_social'],
            'cantidad_asientos': c['cantidad'],
            'porcentaje': round(c['cantidad'] / max(total_asientos, 1) * 100, 1),
            'total_movido': float(c['total_movido'] or 0),
        } for c in concentracion]

        return Response({
            'total_asientos_periodo': total_asientos,
            'top_terceros': data,
        })


class AuditoriaComparativoMensualView(views.APIView):
    """Comparativo mes a mes por cuenta — detecta variaciones abruptas."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        empresa_id = request.query_params.get('empresa')
        anio = int(request.query_params.get('anio', date.today().year))
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        cuentas = Cuenta.objects.filter(empresa_id=empresa_id, activa=True).order_by('codigo')
        resultado = []

        for c in cuentas:
            meses = []
            tiene_datos = False
            for mes in range(1, 13):
                agg = MovimientoContable.objects.filter(
                    cuenta=c, asiento__empresa_id=empresa_id, asiento__estado='vigente',
                    asiento__fecha__year=anio, asiento__fecha__month=mes,
                ).aggregate(td=Sum('debito'), tc=Sum('credito'))
                td = float(agg['td'] or 0)
                tc = float(agg['tc'] or 0)
                neto = td - tc
                if td > 0 or tc > 0:
                    tiene_datos = True
                meses.append({'mes': mes, 'debito': td, 'credito': tc, 'neto': neto})

            if not tiene_datos:
                continue

            # Detectar variaciones bruscas (>200% respecto al promedio)
            netos = [m['neto'] for m in meses if m['neto'] != 0]
            avg_neto = sum(abs(n) for n in netos) / max(len(netos), 1)
            alertas_mes = []
            for m in meses:
                if avg_neto > 0 and abs(m['neto']) > avg_neto * 3:
                    alertas_mes.append(m['mes'])

            resultado.append({
                'cuenta': c.codigo,
                'nombre': c.nombre,
                'meses': meses,
                'alertas_mes': alertas_mes,
            })

        return Response({
            'anio': anio,
            'cuentas': resultado,
        })


class AuditoriaResumenView(views.APIView):
    """Dashboard resumen de auditoría."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Sum
        empresa_id = request.query_params.get('empresa')
        if not empresa_id:
            return Response({"error": "Empresa requerida"}, status=400)

        total_asientos = AsientoContable.objects.filter(empresa_id=empresa_id).count()
        total_vigentes = AsientoContable.objects.filter(empresa_id=empresa_id, estado='vigente').count()
        total_anulados = AsientoContable.objects.filter(empresa_id=empresa_id, estado='anulado').count()

        # Correcciones rápidas
        total_correcciones = AsientoContable.objects.filter(
            empresa_id=empresa_id, estado='anulado',
            anulacion_motivo__icontains='Corrección rápida'
        ).count()

        # Sin soporte
        sin_soporte = AsientoContable.objects.filter(
            empresa_id=empresa_id, estado='vigente'
        ).filter(
            Q(descripcion_adicional__isnull=True) | Q(descripcion_adicional='')
        ).count()

        # Saldos contrarios (simplificado)
        saldos_contrarios = 0
        cuentas = Cuenta.objects.filter(empresa_id=empresa_id, activa=True)
        for c in cuentas:
            agg = MovimientoContable.objects.filter(
                cuenta=c, asiento__empresa_id=empresa_id, asiento__estado='vigente'
            ).aggregate(td=Sum('debito'), tc=Sum('credito'))
            saldo = (agg['td'] or 0) - (agg['tc'] or 0)
            if c.naturaleza == 'debito' and saldo < -Decimal('0.01'):
                saldos_contrarios += 1
            elif c.naturaleza == 'credito' and saldo > Decimal('0.01'):
                saldos_contrarios += 1

        # Últimas acciones
        ultimas = BitacoraAuditoria.objects.filter(
            empresa_id=empresa_id
        ).select_related('usuario')[:10]

        return Response({
            'total_asientos': total_asientos,
            'vigentes': total_vigentes,
            'anulados': total_anulados,
            'correcciones_rapidas': total_correcciones,
            'sin_soporte': sin_soporte,
            'porcentaje_sin_soporte': round(sin_soporte / max(total_vigentes, 1) * 100, 1),
            'saldos_contrarios': saldos_contrarios,
            'ultimas_acciones': [{
                'fecha': b.fecha.isoformat(),
                'accion': b.get_accion_display(),
                'detalle': b.detalle[:100],
                'usuario': b.usuario.username if b.usuario else 'Sistema',
            } for b in ultimas],
        })
