# 🎩 Don Peppini — Contabilización de Liquidación de Contrato
# Mapeo PUC colombiano para liquidación definitiva

from decimal import Decimal
from django.db import transaction
from contabilidad.models import Cuenta, AsientoContable, MovimientoContable

ZERO = Decimal('0')

# Cuentas PUC para liquidación de contrato
CUENTAS_LIQ = {
    # GASTOS (Débitos - clase 5)
    'gasto_sueldos':       ('510506', 'Sueldos'),
    'gasto_aux_transporte':('510527', 'Auxilio de transporte'),
    'gasto_vacaciones':    ('510539', 'Vacaciones'),
    'gasto_prima':         ('510536', 'Prima de servicios'),
    'gasto_cesantias':     ('510530', 'Cesantías'),
    'gasto_int_cesantias': ('510533', 'Intereses sobre cesantías'),
    'gasto_indemnizacion': ('510545', 'Indemnizaciones laborales'),
    # PASIVOS (Créditos - clase 2)
    'por_pagar':           ('250505', 'Salarios por pagar'),
    'retencion_fuente':    ('236505', 'Retención fuente - salarios'),
    'aportes_eps':         ('237005', 'Aportes a EPS'),
    'aportes_pension':     ('237006', 'Aportes a fondos de pensiones'),
    # Contra-provisiones (Débitos para reversar provisiones acumuladas)
    'cesantias_consolidadas': ('261005', 'Cesantías consolidadas'),
    'int_cesantias_pagar':    ('261505', 'Intereses sobre cesantías'),
    'prima_pagar':            ('262005', 'Prima de servicios por pagar'),
    'vacaciones_pagar':       ('262505', 'Vacaciones consolidadas'),
}


def _asegurar_cuenta(empresa, codigo, nombre):
    """Busca o crea la cuenta PUC."""
    cuenta, _ = Cuenta.objects.get_or_create(
        empresa=empresa,
        codigo=codigo,
        defaults={
            'nombre': nombre,
            'nivel': len(codigo),
            'naturaleza': 'D' if codigo[0] in ('1', '5', '6') else 'C',
            'tipo': 'Auxiliar' if len(codigo) >= 6 else 'Subcuenta',
        }
    )
    return cuenta


@transaction.atomic
def contabilizar_liquidacion_contrato(liq):
    """
    Genera el asiento contable para una liquidación de contrato.
    
    Estrategia:
    - Débito: gastos por los conceptos de liquidación
    - Crédito: pasivos por pagar al empleado, retenciones, SS
    - Si había provisiones acumuladas: se debitan para reversar
    """
    empresa = liq.empresa
    C = CUENTAS_LIQ
    tercero = liq.empleado.tercero

    # Crear asiento
    concepto = f"Liquidación contrato — {liq.empleado.tercero.nombre_razon_social} — {liq.get_motivo_display()}"

    asiento = AsientoContable.objects.create(
        empresa=empresa,
        fecha=liq.fecha_retiro,
        tercero=tercero,
        concepto=concepto,
        descripcion=f"Contabilización automática — {concepto}",
    )

    lineas = []

    def _add(codigo_key, valor, tipo_mov):
        if valor <= ZERO:
            return
        codigo, nombre = C[codigo_key]
        cuenta = _asegurar_cuenta(empresa, codigo, nombre)
        lineas.append(MovimientoContable(
            asiento=asiento,
            cuenta=cuenta,
            tercero=tercero,
            debito=valor if tipo_mov == 'debito' else ZERO,
            credito=valor if tipo_mov == 'credito' else ZERO,
        ))

    # ─── DÉBITOS (Gastos) ───
    _add('gasto_sueldos', liq.salario_proporcional, 'debito')
    _add('gasto_aux_transporte', liq.auxilio_transporte_prop, 'debito')
    _add('gasto_vacaciones', liq.vacaciones, 'debito')
    _add('gasto_prima', liq.prima_servicios, 'debito')
    _add('gasto_cesantias', liq.cesantias, 'debito')
    _add('gasto_int_cesantias', liq.intereses_cesantias, 'debito')
    _add('gasto_indemnizacion', liq.indemnizacion, 'debito')

    # ─── CRÉDITOS (Pasivos) ───
    _add('por_pagar', liq.neto_pagar, 'credito')
    _add('retencion_fuente', liq.retencion_fuente, 'credito')
    _add('aportes_eps', liq.deduccion_salud, 'credito')
    _add('aportes_pension', liq.deduccion_pension, 'credito')

    # Crear movimientos
    MovimientoContable.objects.bulk_create(lineas)

    # Verificar balance
    total_debito = sum(l.debito for l in lineas)
    total_credito = sum(l.credito for l in lineas)

    if total_debito != total_credito:
        raise ValueError(
            f"Asiento desbalanceado: D={total_debito} C={total_credito}. "
            f"Diferencia: {total_debito - total_credito}"
        )

    # Vincular asiento
    liq.asiento_contable = asiento
    liq.save(update_fields=['asiento_contable'])

    return asiento
