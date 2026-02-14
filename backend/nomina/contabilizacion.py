# 🎩 Don Peppini Contadore - Contabilización Automática de Nómina
# backend/nomina/contabilizacion.py
"""
Genera el asiento contable cuando se liquida una nómina.

Mapeo PUC colombiano estándar:
  DÉBITOS → Gastos de personal (51xx)
  CRÉDITOS → Pasivos laborales (23xx, 25xx, 26xx)

El asiento se crea balanceado (sum débitos == sum créditos).
"""

from decimal import Decimal
from django.db import transaction
from contabilidad.models import Cuenta, AsientoContable, MovimientoContable


# ============================================================
# MAPEO DE CUENTAS PUC PARA NÓMINA
# ============================================================
CUENTAS_NOMINA = {
    # ─── GASTOS DE PERSONAL (Débitos) ─── Clase 5
    'gasto_sueldos':            ('510506', 'Sueldos'),
    'gasto_horas_extras':       ('510515', 'Horas extras y recargos'),
    'gasto_comisiones':         ('510518', 'Comisiones'),
    'gasto_bonificaciones':     ('510521', 'Bonificaciones'),
    'gasto_auxilio_transporte': ('510527', 'Auxilio de transporte'),
    'gasto_cesantias':          ('510530', 'Cesantías'),
    'gasto_int_cesantias':      ('510533', 'Intereses sobre cesantías'),
    'gasto_prima':              ('510536', 'Prima de servicios'),
    'gasto_vacaciones':         ('510539', 'Vacaciones'),
    'gasto_arl':                ('510568', 'Aportes a ARL'),
    'gasto_eps_empleador':      ('510570', 'Aportes EPS empleador'),
    'gasto_pension_empleador':  ('510572', 'Aportes pensión empleador'),
    'gasto_caja_compensacion':  ('510575', 'Aportes caja de compensación'),
    'gasto_icbf':               ('510578', 'Aportes ICBF'),
    'gasto_sena':               ('510581', 'Aportes SENA'),

    # ─── PASIVOS LABORALES (Créditos) ─── Clase 2
    'salarios_por_pagar':       ('250505', 'Salarios por pagar'),
    'retencion_fuente':         ('236505', 'Retención fuente - salarios'),
    'aportes_eps':              ('237005', 'Aportes a EPS'),
    'aportes_pension':          ('237045', 'Aportes a fondos de pensiones'),
    'aportes_arl':              ('237006', 'Aportes a ARL'),
    'fondo_solidaridad':        ('237050', 'Fondo de solidaridad pensional'),
    'caja_comp_pagar':          ('237025', 'Caja compensación por pagar'),
    'icbf_pagar':               ('237010', 'ICBF por pagar'),
    'sena_pagar':               ('237015', 'SENA por pagar'),
    'cesantias_consolidadas':   ('261005', 'Cesantías consolidadas'),
    'int_cesantias_pagar':      ('261505', 'Intereses sobre cesantías'),
    'prima_pagar':              ('262005', 'Prima de servicios por pagar'),
    'vacaciones_pagar':         ('262505', 'Vacaciones consolidadas'),
    'libranzas':                ('253505', 'Libranzas y descuentos'),
}

ZERO = Decimal('0')


def _asegurar_cuenta(empresa, codigo, nombre):
    """
    Obtiene o crea la Cuenta contable para la empresa.
    Determina automáticamente naturaleza y tipo según el código.
    """
    cuenta, created = Cuenta.objects.get_or_create(
        empresa=empresa,
        codigo=codigo,
        defaults={
            'nombre': nombre,
            'nivel': len(codigo),
            'naturaleza': 'D' if codigo[0] in ('1', '5', '6') else 'C',
            'tipo': 'Auxiliar' if len(codigo) >= 6 else 'Subcuenta',
            'activa': True,
        }
    )
    return cuenta


def _agregar_linea(lineas, codigo, nombre, monto, tipo='debito', tercero=None):
    """Agrega una línea al asiento si el monto > 0."""
    monto = monto if isinstance(monto, Decimal) else Decimal(str(monto))
    if monto > ZERO:
        lineas.append({
            'codigo': codigo,
            'nombre': nombre,
            'debito': monto if tipo == 'debito' else ZERO,
            'credito': monto if tipo == 'credito' else ZERO,
            'tercero': tercero,
        })


def contabilizar_nomina(nomina):
    """
    Genera un AsientoContable a partir de una Nómina liquidada.

    Estructura del asiento:
      DÉBITOS:
        - Gastos de personal (sueldos, aux transporte, horas extras, etc.)
        - Aportes empleador (EPS, pensión, ARL, parafiscales)
        - Provisiones (cesantías, intereses, prima, vacaciones)
      CRÉDITOS:
        - Salarios por pagar (neto)
        - Deducciones empleado (salud, pensión, retención, libranzas)
        - Aportes por pagar (EPS, pensión, ARL, parafiscales empleador)
        - Provisiones por pagar (cesantías, int, prima, vacaciones)

    Returns:
        AsientoContable creado, o None si la nómina no tiene liquidaciones.
    """
    liquidaciones = nomina.liquidaciones.select_related('empleado', 'empleado__tercero').all()
    if not liquidaciones.exists():
        return None

    empresa = nomina.empresa
    MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    concepto = f"Nómina {MESES[nomina.mes]} {nomina.anio} — {nomina.get_tipo_display()}"

    # ── Acumular totales de todas las liquidaciones ──
    tot = {
        'sueldos': ZERO,
        'auxilio_transporte': ZERO,
        'horas_extras': ZERO,
        'recargos': ZERO,
        'comisiones': ZERO,
        'bonificaciones': ZERO,
        'otros_devengados': ZERO,
        # Deducciones empleado
        'salud_empleado': ZERO,
        'pension_empleado': ZERO,
        'fsp': ZERO,
        'retencion_fuente': ZERO,
        'libranzas': ZERO,
        'otros_descuentos': ZERO,
        # Neto
        'neto_pagar': ZERO,
        # Aportes empleador
        'salud_empleador': ZERO,
        'pension_empleador': ZERO,
        'arl': ZERO,
        'caja_compensacion': ZERO,
        'sena': ZERO,
        'icbf': ZERO,
        # Provisiones
        'provision_prima': ZERO,
        'provision_cesantias': ZERO,
        'provision_int_cesantias': ZERO,
        'provision_vacaciones': ZERO,
    }

    for liq in liquidaciones:
        tot['sueldos'] += liq.salario_devengado
        tot['auxilio_transporte'] += liq.auxilio_transporte
        tot['horas_extras'] += liq.horas_extras + liq.recargos
        tot['comisiones'] += liq.comisiones
        tot['bonificaciones'] += liq.bonificaciones + liq.otros_devengados
        tot['salud_empleado'] += liq.salud_empleado
        tot['pension_empleado'] += liq.pension_empleado
        tot['fsp'] += liq.fsp
        tot['retencion_fuente'] += liq.retencion_fuente
        tot['libranzas'] += liq.libranzas + liq.otros_descuentos
        tot['neto_pagar'] += liq.neto_pagar
        tot['salud_empleador'] += liq.salud_empleador
        tot['pension_empleador'] += liq.pension_empleador
        tot['arl'] += liq.arl
        tot['caja_compensacion'] += liq.caja_compensacion
        tot['sena'] += liq.sena
        tot['icbf'] += liq.icbf
        tot['provision_prima'] += liq.provision_prima
        tot['provision_cesantias'] += liq.provision_cesantias
        tot['provision_int_cesantias'] += liq.provision_int_cesantias
        tot['provision_vacaciones'] += liq.provision_vacaciones

    # ── Construir líneas del asiento ──
    lineas = []
    C = CUENTAS_NOMINA  # alias

    # DÉBITOS — Gastos de personal
    _agregar_linea(lineas, *C['gasto_sueldos'], tot['sueldos'], 'debito')
    _agregar_linea(lineas, *C['gasto_auxilio_transporte'], tot['auxilio_transporte'], 'debito')
    _agregar_linea(lineas, *C['gasto_horas_extras'], tot['horas_extras'], 'debito')
    _agregar_linea(lineas, *C['gasto_comisiones'], tot['comisiones'], 'debito')
    _agregar_linea(lineas, *C['gasto_bonificaciones'], tot['bonificaciones'], 'debito')

    # DÉBITOS — Aportes empleador
    _agregar_linea(lineas, *C['gasto_eps_empleador'], tot['salud_empleador'], 'debito')
    _agregar_linea(lineas, *C['gasto_pension_empleador'], tot['pension_empleador'], 'debito')
    _agregar_linea(lineas, *C['gasto_arl'], tot['arl'], 'debito')
    _agregar_linea(lineas, *C['gasto_caja_compensacion'], tot['caja_compensacion'], 'debito')
    _agregar_linea(lineas, *C['gasto_icbf'], tot['icbf'], 'debito')
    _agregar_linea(lineas, *C['gasto_sena'], tot['sena'], 'debito')

    # DÉBITOS — Provisiones prestaciones
    _agregar_linea(lineas, *C['gasto_cesantias'], tot['provision_cesantias'], 'debito')
    _agregar_linea(lineas, *C['gasto_int_cesantias'], tot['provision_int_cesantias'], 'debito')
    _agregar_linea(lineas, *C['gasto_prima'], tot['provision_prima'], 'debito')
    _agregar_linea(lineas, *C['gasto_vacaciones'], tot['provision_vacaciones'], 'debito')

    # CRÉDITOS — Salarios por pagar (neto)
    _agregar_linea(lineas, *C['salarios_por_pagar'], tot['neto_pagar'], 'credito')

    # CRÉDITOS — Deducciones empleado
    _agregar_linea(lineas, *C['aportes_eps'], tot['salud_empleado'], 'credito')
    _agregar_linea(lineas, *C['aportes_pension'], tot['pension_empleado'], 'credito')
    _agregar_linea(lineas, *C['fondo_solidaridad'], tot['fsp'], 'credito')
    _agregar_linea(lineas, *C['retencion_fuente'], tot['retencion_fuente'], 'credito')
    _agregar_linea(lineas, *C['libranzas'], tot['libranzas'], 'credito')

    # CRÉDITOS — Aportes empleador por pagar
    _agregar_linea(lineas, *C['aportes_eps'], tot['salud_empleador'], 'credito')
    _agregar_linea(lineas, *C['aportes_pension'], tot['pension_empleador'], 'credito')
    _agregar_linea(lineas, *C['aportes_arl'], tot['arl'], 'credito')
    _agregar_linea(lineas, *C['caja_comp_pagar'], tot['caja_compensacion'], 'credito')
    _agregar_linea(lineas, *C['icbf_pagar'], tot['icbf'], 'credito')
    _agregar_linea(lineas, *C['sena_pagar'], tot['sena'], 'credito')

    # CRÉDITOS — Provisiones por pagar
    _agregar_linea(lineas, *C['cesantias_consolidadas'], tot['provision_cesantias'], 'credito')
    _agregar_linea(lineas, *C['int_cesantias_pagar'], tot['provision_int_cesantias'], 'credito')
    _agregar_linea(lineas, *C['prima_pagar'], tot['provision_prima'], 'credito')
    _agregar_linea(lineas, *C['vacaciones_pagar'], tot['provision_vacaciones'], 'credito')

    if not lineas:
        return None

    # ── Verificar balance ──
    total_db = sum(l['debito'] for l in lineas)
    total_cr = sum(l['credito'] for l in lineas)
    diff = total_db - total_cr
    if abs(diff) > Decimal('1'):
        raise ValueError(
            f"Asiento de nómina desbalanceado: Débitos={total_db}, Créditos={total_cr}, Diff={diff}"
        )
    # Ajuste de centavos por redondeo (si existe)
    if diff != ZERO:
        if diff > ZERO:
            # Agregar crédito de ajuste
            _agregar_linea(lineas, *C['salarios_por_pagar'], abs(diff), 'credito')
        else:
            _agregar_linea(lineas, *C['gasto_sueldos'], abs(diff), 'debito')

    # ── Necesitamos un tercero para el asiento — usar la empresa como tercero ──
    from terceros.models import Tercero
    tercero_empresa = Tercero.objects.filter(
        numero_documento=empresa.nit
    ).first()

    # Si no existe, buscar cualquier tercero (el asiento requiere tercero)
    if not tercero_empresa:
        # Obtener el primer empleado de la nómina como tercero del asiento
        primer_emp = liquidaciones.first().empleado.tercero if liquidaciones.exists() else None
        tercero_empresa = primer_emp or Tercero.objects.first()

    if not tercero_empresa:
        raise ValueError("No se encontró un tercero para asociar al asiento contable.")

    # ── Crear el asiento ──
    with transaction.atomic():
        # Borrar asiento anterior si existe (reliquidación)
        if hasattr(nomina, 'asiento_contable') and nomina.asiento_contable:
            old_asiento = nomina.asiento_contable
            nomina.asiento_contable = None
            nomina.save(update_fields=['asiento_contable'])
            old_asiento.movimientos.all().delete()
            old_asiento.delete()

        fecha = nomina.fecha_liquidacion or nomina.fecha_pago
        if not fecha:
            from datetime import date
            fecha = date.today()

        asiento = AsientoContable.objects.create(
            empresa=empresa,
            fecha=fecha,
            tercero=tercero_empresa,
            concepto=concepto,
            descripcion=f"Contabilización automática — {concepto}",
        )

        # Consolidar líneas con misma cuenta (EPS y pensión tienen parte empleado + empleador)
        consolidado = {}
        for linea in lineas:
            key = (linea['codigo'], 'D' if linea['debito'] > ZERO else 'C')
            if key in consolidado:
                consolidado[key]['debito'] += linea['debito']
                consolidado[key]['credito'] += linea['credito']
            else:
                consolidado[key] = {**linea}

        # Crear movimientos
        for linea in consolidado.values():
            cuenta = _asegurar_cuenta(empresa, linea['codigo'], linea['nombre'])
            MovimientoContable.objects.create(
                asiento=asiento,
                cuenta=cuenta,
                debito=linea['debito'],
                credito=linea['credito'],
            )

        # Guardar referencia en la nómina
        nomina.asiento_contable = asiento
        nomina.save(update_fields=['asiento_contable'])

    return asiento
