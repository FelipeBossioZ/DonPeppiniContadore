# 🎩 Don Peppini Contadore - Módulo PILA
# Cálculo y contabilización de aportes a Seguridad Social y Parafiscales
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from contabilidad.models import Cuenta, AsientoContable, MovimientoContable

TWO = Decimal('0.01')
ZERO = Decimal('0')

# ============================================================
# CUENTAS PUC PARA PILA (deben coincidir con contabilizacion.py)
# ============================================================
CUENTAS_PILA = {
    # CxP que ya fueron creadas por la nómina
    'cxp_eps':          ('237005', 'Aportes a EPS'),
    'cxp_pension':      ('237045', 'Aportes a fondos de pensiones'),
    'cxp_arl':          ('237006', 'Aportes a ARL'),
    'cxp_fsp':          ('237050', 'Fondo de solidaridad pensional'),
    'cxp_caja':         ('237025', 'Caja compensación por pagar'),
    'cxp_icbf':         ('237010', 'ICBF por pagar'),
    'cxp_sena':         ('237015', 'SENA por pagar'),
}

MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']


def calcular_pila(empresa, anio, mes):
    """
    Calcula la planilla PILA a partir de las liquidaciones de nómina del mes.
    Retorna tabla detallada por empleado + totales.
    """
    from .models import Nomina, LiquidacionEmpleado, ParametrosNomina

    params = ParametrosNomina.del_anio(anio)

    # Buscar nóminas del mes
    nominas = Nomina.objects.filter(
        empresa=empresa, anio=anio, mes=mes,
        estado__in=['liquidada', 'pagada']
    )

    if not nominas.exists():
        return {'error': f'No hay nómina liquidada para {MESES[mes]} {anio}'}

    # Obtener liquidaciones
    liquidaciones = LiquidacionEmpleado.objects.filter(
        nomina__in=nominas
    ).select_related('empleado', 'empleado__tercero')

    if not liquidaciones.exists():
        return {'error': f'No hay liquidaciones para {MESES[mes]} {anio}'}

    # Calcular por empleado
    detalle = []
    totales = {
        'ibc': ZERO,
        'eps_empleado': ZERO, 'eps_empleador': ZERO, 'eps_total': ZERO,
        'pension_empleado': ZERO, 'pension_empleador': ZERO, 'pension_total': ZERO,
        'arl': ZERO,
        'fsp': ZERO,
        'icbf': ZERO,
        'sena': ZERO,
        'caja': ZERO,
        'total_empleado': ZERO,
        'total_empleador': ZERO,
        'total_pila': ZERO,
    }

    for liq in liquidaciones:
        emp = liq.empleado
        ibc = liq.total_devengado - liq.auxilio_transporte
        if emp.salario_integral:
            ibc = (emp.salario_base * Decimal('0.70') * Decimal(str(liq.dias_trabajados)) / Decimal('30')).quantize(TWO)
        ibc = max(ibc, (params.smlv * Decimal(str(liq.dias_trabajados)) / Decimal('30')).quantize(TWO))

        fila = {
            'empleado_id': emp.id,
            'nombre': emp.tercero.nombre_razon_social,
            'documento': emp.tercero.numero_documento,
            'eps': emp.eps or 'Sin asignar',
            'afp': emp.afp or 'Sin asignar',
            'arl_nombre': emp.arl_nombre or 'Sin asignar',
            'caja': emp.caja_compensacion or 'Sin asignar',
            'nivel_arl': emp.nivel_arl,
            'dias': liq.dias_trabajados,
            'ibc': float(ibc),
            # Empleado
            'eps_empleado': float(liq.salud_empleado),
            'pension_empleado': float(liq.pension_empleado),
            'fsp': float(liq.fsp),
            # Empleador
            'eps_empleador': float(liq.salud_empleador),
            'pension_empleador': float(liq.pension_empleador),
            'arl': float(liq.arl),
            'icbf': float(liq.icbf),
            'sena': float(liq.sena),
            'caja_comp': float(liq.caja_compensacion),
        }

        # Totales por fila
        fila['total_empleado'] = fila['eps_empleado'] + fila['pension_empleado'] + fila['fsp']
        fila['total_empleador'] = (fila['eps_empleador'] + fila['pension_empleador'] +
                                   fila['arl'] + fila['icbf'] + fila['sena'] + fila['caja_comp'])
        fila['total_fila'] = fila['total_empleado'] + fila['total_empleador']

        detalle.append(fila)

        # Acumular totales
        totales['ibc'] += ibc
        totales['eps_empleado'] += liq.salud_empleado
        totales['eps_empleador'] += liq.salud_empleador
        totales['eps_total'] += liq.salud_empleado + liq.salud_empleador
        totales['pension_empleado'] += liq.pension_empleado
        totales['pension_empleador'] += liq.pension_empleador
        totales['pension_total'] += liq.pension_empleado + liq.pension_empleador
        totales['arl'] += liq.arl
        totales['fsp'] += liq.fsp
        totales['icbf'] += liq.icbf
        totales['sena'] += liq.sena
        totales['caja'] += liq.caja_compensacion
        totales['total_empleado'] += liq.salud_empleado + liq.pension_empleado + liq.fsp
        totales['total_empleador'] += (liq.salud_empleador + liq.pension_empleador +
                                       liq.arl + liq.icbf + liq.sena + liq.caja_compensacion)

    totales['total_pila'] = totales['total_empleado'] + totales['total_empleador']

    # Convertir Decimal a float para JSON
    totales_json = {k: float(v) for k, v in totales.items()}

    return {
        'empresa': empresa.id,
        'anio': anio,
        'mes': mes,
        'mes_nombre': MESES[mes],
        'detalle': detalle,
        'totales': totales_json,
        'parametros': {
            'eps_empleado': float(params.salud_empleado),
            'eps_empleador': float(params.salud_empleador),
            'pension_empleado': float(params.pension_empleado),
            'pension_empleador': float(params.pension_empleador),
            'arl_nivel_1': float(params.arl_i),
            'icbf': float(params.icbf),
            'sena': float(params.sena),
            'caja': float(params.caja_compensacion),
        },
    }


def _get_o_crear_cuenta(empresa, codigo, nombre):
    """Obtiene o crea una cuenta PUC."""
    cuenta, created = Cuenta.objects.get_or_create(
        empresa=empresa,
        codigo=codigo,
        defaults={'nombre': nombre, 'tipo': 'detalle', 'naturaleza': 'D' if codigo[0] in '1567' else 'C'}
    )
    return cuenta


@transaction.atomic
def pagar_pila(empresa, anio, mes, fecha_pago, cuenta_banco_codigo, usuario=None):
    """
    Genera el asiento de PAGO de PILA.
    Débito: CxP seguridad social y parafiscales (2370xx)
    Crédito: Bancos / Caja (11xxxx)
    """
    data = calcular_pila(empresa, anio, mes)
    if 'error' in data:
        return data

    t = data['totales']
    concepto = f"Pago PILA {MESES[mes]} {anio}"

    # Cuenta de banco/caja
    try:
        cuenta_banco = Cuenta.objects.get(empresa=empresa, codigo=cuenta_banco_codigo)
    except Cuenta.DoesNotExist:
        return {'error': f'Cuenta {cuenta_banco_codigo} no encontrada'}

    asiento = AsientoContable.objects.create(
        empresa=empresa,
        fecha=fecha_pago,
        concepto=concepto,
        tipo_comprobante='CE',
        fiscal_year=fecha_pago.year,
        fiscal_period=fecha_pago.month,
    )

    lineas = []
    total_pago = ZERO

    def add_debito(clave, monto):
        nonlocal total_pago
        if monto <= 0:
            return
        codigo, nombre = CUENTAS_PILA[clave]
        cuenta = _get_o_crear_cuenta(empresa, codigo, nombre)
        m = Decimal(str(monto)).quantize(TWO)
        lineas.append({'cuenta': cuenta, 'debito': m, 'credito': ZERO})
        total_pago += m

    # Débitos: cancelar CxP
    add_debito('cxp_eps', t['eps_total'])
    add_debito('cxp_pension', t['pension_total'])
    add_debito('cxp_arl', t['arl'])
    add_debito('cxp_icbf', t['icbf'])
    add_debito('cxp_sena', t['sena'])
    add_debito('cxp_caja', t['caja'])
    if t['fsp'] > 0:
        add_debito('cxp_fsp', t['fsp'])

    # Crédito: Banco
    lineas.append({
        'cuenta': cuenta_banco,
        'debito': ZERO,
        'credito': total_pago,
    })

    for linea in lineas:
        MovimientoContable.objects.create(asiento=asiento, **linea)

    return {
        'success': True,
        'asiento_id': asiento.id,
        'numero': f"{asiento.tipo_comprobante}-{asiento.numero:04d}",
        'concepto': concepto,
        'total_pago': float(total_pago),
        'lineas': len(lineas),
    }
