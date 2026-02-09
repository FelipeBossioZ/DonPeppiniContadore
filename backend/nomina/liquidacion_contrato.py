# 🎩 Don Peppini Contadore — Liquidación de Contrato Laboral
# Código Sustantivo del Trabajo (CST) — Art. 64, 249, 306, 186
# Ley 52 de 1975 (intereses cesantías), Ley 1429 de 2010

from decimal import Decimal, ROUND_HALF_UP
from datetime import date

TWO = Decimal('0.01')
ZERO = Decimal('0')
D360 = Decimal('360')
D30 = Decimal('30')
D720 = Decimal('720')


def dias_360(fecha_inicio, fecha_fin):
    """
    Calcula días entre dos fechas con base 360 (año comercial colombiano).
    Cada mes = 30 días, año = 360 días.
    """
    d1, m1, y1 = fecha_inicio.day, fecha_inicio.month, fecha_inicio.year
    d2, m2, y2 = fecha_fin.day, fecha_fin.month, fecha_fin.year
    # Ajustar día 31 → 30
    if d1 == 31:
        d1 = 30
    if d2 == 31:
        d2 = 30
    return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1)


def dias_360_inclusive(fecha_inicio, fecha_fin):
    """Días 360 incluyendo ambos extremos (para liquidación colombiana)."""
    return dias_360(fecha_inicio, fecha_fin) + 1


def calcular_liquidacion_contrato(
    # Datos del empleado
    fecha_ingreso: date,
    fecha_retiro: date,
    salario_base: Decimal,
    salario_integral: bool = False,
    tipo_contrato: str = 'IND',
    # Motivo
    motivo: str = 'RENUNCIA',
    # Para contrato fijo
    fecha_fin_contrato: date = None,
    # Vacaciones ya disfrutadas en el último periodo anual
    dias_vacaciones_disfrutados: Decimal = ZERO,
    # Parámetros legales
    smlv: Decimal = Decimal('1750905'),
    auxilio_transporte: Decimal = Decimal('249095'),
    trabajo_remoto: bool = False,
    # Días del último mes trabajado (si ya se pagó parte)
    ultimo_mes_ya_pagado: bool = False,
) -> dict:
    """
    Calcula la liquidación definitiva de un contrato laboral colombiano.

    Conceptos:
    1. Salario proporcional (días del último mes)
    2. Auxilio de transporte proporcional
    3. Vacaciones compensadas (Art. 186 CST)
    4. Prima de servicios proporcional (Art. 306 CST)
    5. Cesantías proporcionales (Art. 249 CST)
    6. Intereses sobre cesantías (Ley 52/1975, 12% anual)
    7. Indemnización (Art. 64 CST, solo despido sin justa causa)
    """

    result = {}

    # ─── PERÍODO TOTAL ───
    dias_totales = dias_360_inclusive(fecha_ingreso, fecha_retiro)
    result['dias_totales'] = int(dias_totales)
    result['fecha_ingreso'] = fecha_ingreso
    result['fecha_retiro'] = fecha_retiro

    # Años y meses para mostrar
    anios = dias_totales // 360
    meses_rest = (dias_totales % 360) // 30
    dias_rest = dias_totales % 30
    result['tiempo_servicio'] = f"{int(anios)} año(s), {int(meses_rest)} mes(es), {int(dias_rest)} día(s)"

    # ─── AUXILIO DE TRANSPORTE ───
    tiene_auxilio = salario_base <= smlv * 2 and not salario_integral and not trabajo_remoto

    # ─── 1. SALARIO PROPORCIONAL (último mes) ───
    if not ultimo_mes_ya_pagado:
        dia_retiro = min(fecha_retiro.day, 30)  # base 30
        # Si el empleado empezó en el mismo mes de retiro, descontar días antes de ingreso
        if fecha_ingreso.year == fecha_retiro.year and fecha_ingreso.month == fecha_retiro.month:
            dia_inicio = min(fecha_ingreso.day, 30)
            dias_ultimo_mes = dia_retiro - dia_inicio + 1
        else:
            dias_ultimo_mes = dia_retiro
        dias_ultimo_mes = max(dias_ultimo_mes, 0)
        salario_prop = (salario_base * Decimal(str(dias_ultimo_mes)) / D30).quantize(TWO)
        auxilio_prop = ZERO
        if tiene_auxilio:
            auxilio_prop = (auxilio_transporte * Decimal(str(dias_ultimo_mes)) / D30).quantize(TWO)
    else:
        dias_ultimo_mes = 0
        salario_prop = ZERO
        auxilio_prop = ZERO

    result['dias_ultimo_mes'] = dias_ultimo_mes
    result['salario_proporcional'] = salario_prop
    result['auxilio_transporte_prop'] = auxilio_prop

    # ─── BASE PRESTACIONAL ───
    # Para prima y cesantías: salario + auxilio transporte
    if salario_integral:
        base_prestacional = salario_base  # ya incluye factor prestacional
    else:
        base_prest_mensual = salario_base + (auxilio_transporte if tiene_auxilio else ZERO)
        base_prestacional = base_prest_mensual

    # Para vacaciones: solo salario (sin auxilio transporte)
    base_vacaciones = salario_base
    if salario_integral:
        base_vacaciones = (salario_base * Decimal('0.70')).quantize(TWO)

    # ─── 2. VACACIONES COMPENSADAS (Art. 186 CST) ───
    # 15 días hábiles por año = 15 días calendario por cada 360 días
    # Fórmula: salario_base * dias_totales / 720
    # Menos: días ya disfrutados en el periodo
    dias_vac_causados = (Decimal(str(dias_totales)) * Decimal('15') / D360).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    dias_vac_pendientes = max(dias_vac_causados - dias_vacaciones_disfrutados, ZERO)

    # Vacaciones se pagan sobre salario SIN auxilio transporte
    vacaciones = (base_vacaciones * dias_vac_pendientes / D30).quantize(TWO)

    # Para salario integral: vacaciones sobre el 70% (factor salarial)
    if salario_integral:
        vacaciones = (base_vacaciones * dias_vac_pendientes / D30).quantize(TWO)

    result['dias_vacaciones_causados'] = float(dias_vac_causados)
    result['dias_vacaciones_disfrutados'] = float(dias_vacaciones_disfrutados)
    result['dias_vacaciones_pendientes'] = float(dias_vac_pendientes)
    result['vacaciones'] = vacaciones

    # ─── 3. PRIMA DE SERVICIOS PROPORCIONAL (Art. 306 CST) ───
    # Períodos: Ene 1 – Jun 30, Jul 1 – Dic 31
    # Proporcional desde inicio del semestre hasta fecha retiro
    if fecha_retiro.month <= 6:
        inicio_semestre = date(fecha_retiro.year, 1, 1)
    else:
        inicio_semestre = date(fecha_retiro.year, 7, 1)

    # Usar la fecha mayor entre inicio_semestre y fecha_ingreso
    fecha_inicio_prima = max(inicio_semestre, fecha_ingreso)
    dias_prima = dias_360_inclusive(fecha_inicio_prima, fecha_retiro)
    dias_prima = max(dias_prima, 0)

    if salario_integral:
        # Salario integral: no hay prima (ya está incluida en el 30%)
        prima_servicios = ZERO
        dias_prima = 0
    else:
        prima_servicios = (base_prestacional * Decimal(str(dias_prima)) / D360).quantize(TWO)

    result['dias_prima'] = int(dias_prima)
    result['inicio_semestre'] = inicio_semestre
    result['prima_servicios'] = prima_servicios

    # ─── 4. CESANTÍAS PROPORCIONALES (Art. 249 CST) ───
    # Período: Ene 1 al fecha de retiro (o desde fecha_ingreso si fue en el año)
    inicio_anio = date(fecha_retiro.year, 1, 1)
    fecha_inicio_cesantias = max(inicio_anio, fecha_ingreso)
    dias_cesantias = dias_360_inclusive(fecha_inicio_cesantias, fecha_retiro)
    dias_cesantias = max(dias_cesantias, 0)

    if salario_integral:
        # Salario integral: no hay cesantías (ya incluidas)
        cesantias = ZERO
        dias_cesantias = 0
    else:
        cesantias = (base_prestacional * Decimal(str(dias_cesantias)) / D360).quantize(TWO)

    result['dias_cesantias'] = int(dias_cesantias)
    result['inicio_periodo_cesantias'] = fecha_inicio_cesantias
    result['cesantias'] = cesantias

    # ─── 5. INTERESES SOBRE CESANTÍAS (Ley 52 de 1975) ───
    # 12% anual sobre las cesantías, proporcional al tiempo
    if salario_integral or cesantias == ZERO:
        intereses_cesantias = ZERO
    else:
        intereses_cesantias = (cesantias * Decimal(str(dias_cesantias)) * Decimal('0.12') / D360).quantize(TWO)

    result['intereses_cesantias'] = intereses_cesantias

    # ─── 6. INDEMNIZACIÓN (Art. 64 CST) ───
    indemnizacion = ZERO

    if motivo == 'DESPIDO_INJUSTA':
        if tipo_contrato == 'IND':
            # Contrato indefinido
            anios_servicio = dias_totales / D360

            if salario_base < smlv * 10:
                # Menos de 10 SMLV:
                # - 30 días por el primer año
                # - 20 días por cada año adicional (proporcional)
                indemnizacion = salario_base  # 30 días primer año
                if anios_servicio > 1:
                    anios_extra = anios_servicio - 1
                    indemnizacion += (salario_base * Decimal('20') * anios_extra / D30).quantize(TWO)
            else:
                # 10 SMLV o más:
                # - 20 días por el primer año
                # - 15 días por cada año adicional (proporcional)
                indemnizacion = (salario_base * Decimal('20') / D30).quantize(TWO)
                if anios_servicio > 1:
                    anios_extra = anios_servicio - 1
                    indemnizacion += (salario_base * Decimal('15') * anios_extra / D30).quantize(TWO)

        elif tipo_contrato == 'FIJ' and fecha_fin_contrato:
            # Contrato fijo: salario por los días faltantes
            dias_faltantes = dias_360(fecha_retiro, fecha_fin_contrato)
            if dias_faltantes > 0:
                indemnizacion = (salario_base * Decimal(str(dias_faltantes)) / D30).quantize(TWO)
            # Mínimo: 15 días de salario
            minimo_15_dias = (salario_base * Decimal('15') / D30).quantize(TWO)
            indemnizacion = max(indemnizacion, minimo_15_dias)

        elif tipo_contrato == 'OBR':
            # Obra o labor: mínimo 15 días de salario (Art. 64 CST par. transitorio)
            indemnizacion = (salario_base * Decimal('15') / D30).quantize(TWO)

    result['indemnizacion'] = indemnizacion
    result['aplica_indemnizacion'] = motivo == 'DESPIDO_INJUSTA'

    # ─── DEDUCCIONES ───
    # Seguridad social sobre salario proporcional del último mes
    ibc = salario_prop
    if salario_integral:
        ibc = (salario_prop * Decimal('0.70')).quantize(TWO)

    deduccion_salud = (ibc * Decimal('0.04')).quantize(TWO)
    deduccion_pension = (ibc * Decimal('0.04')).quantize(TWO)

    result['deduccion_salud'] = deduccion_salud
    result['deduccion_pension'] = deduccion_pension

    # ─── TOTALES ───
    total_devengado = (
        salario_prop + auxilio_prop + vacaciones + prima_servicios +
        cesantias + intereses_cesantias + indemnizacion
    ).quantize(TWO)

    total_deducciones = (deduccion_salud + deduccion_pension).quantize(TWO)
    neto_pagar = (total_devengado - total_deducciones).quantize(TWO)

    result['total_devengado'] = total_devengado
    result['total_deducciones'] = total_deducciones
    result['neto_pagar'] = neto_pagar

    # Base prestacional para referencia
    result['base_prestacional'] = base_prestacional
    result['base_vacaciones'] = base_vacaciones
    result['tiene_auxilio'] = tiene_auxilio

    return result
