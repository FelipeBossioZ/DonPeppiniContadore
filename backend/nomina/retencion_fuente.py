# 🎩 Don Peppini Contadore — Retención en la Fuente sobre Salarios
# Procedimiento 1 — Art. 383, 385, 387, 388 del Estatuto Tributario
# UVT 2026: $52.374 (Resolución 000238 del 15-dic-2025)

from decimal import Decimal, ROUND_HALF_UP

TWO = Decimal('0.01')

# ============================================================
# TABLA ART. 383 ET — Ley 2277 de 2022 (7 rangos)
# Tarifa marginal progresiva
# ============================================================
TABLA_383 = [
    # (tope_uvt, tarifa_marginal)
    (Decimal('95'),   Decimal('0.00')),    # 0 — 95:     0%
    (Decimal('150'),  Decimal('0.19')),    # >95 — 150:  19%
    (Decimal('360'),  Decimal('0.28')),    # >150 — 360: 28%
    (Decimal('640'),  Decimal('0.33')),    # >360 — 640: 33%
    (Decimal('945'),  Decimal('0.35')),    # >640 — 945: 35%
    (Decimal('2300'), Decimal('0.37')),    # >945 — 2300: 37%
    (None,            Decimal('0.39')),    # >2300:      39%
]


def aplicar_tabla_383(base_uvt: Decimal) -> Decimal:
    """
    Aplica la tabla de retención del Art. 383 ET.
    
    Recibe la base gravable en UVT y retorna el impuesto en UVT.
    Cálculo por rangos marginales (no acumulados) para máxima precisión.
    """
    if base_uvt <= 0:
        return Decimal('0')

    impuesto_uvt = Decimal('0')
    limite_inferior = Decimal('0')

    for tope, tarifa in TABLA_383:
        if base_uvt <= limite_inferior:
            break

        if tope is None:
            # Último rango: sin tope
            gravable = base_uvt - limite_inferior
        else:
            gravable = min(base_uvt, tope) - limite_inferior

        if gravable > 0:
            impuesto_uvt += gravable * tarifa

        if tope is not None:
            limite_inferior = tope
        else:
            break

    return impuesto_uvt


def calcular_retencion_fuente(
    # === Ingresos ===
    salario_devengado: Decimal,
    auxilio_transporte: Decimal,
    horas_extras: Decimal = Decimal('0'),
    comisiones: Decimal = Decimal('0'),
    bonificaciones: Decimal = Decimal('0'),
    otros_devengados: Decimal = Decimal('0'),
    # === Parámetros legales ===
    uvt: Decimal = Decimal('52374'),
    # === Aportes obligatorios (ya calculados) ===
    aporte_salud_empleado: Decimal = Decimal('0'),
    aporte_pension_empleado: Decimal = Decimal('0'),
    aporte_fsp: Decimal = Decimal('0'),
    # === Deducciones Art. 387 ET ===
    tiene_dependientes: bool = False,
    deduccion_vivienda: Decimal = Decimal('0'),
    deduccion_medicina_prepagada: Decimal = Decimal('0'),
    # === Rentas exentas ===
    aportes_voluntarios_pension: Decimal = Decimal('0'),
    aportes_afc: Decimal = Decimal('0'),
    # === Salario integral ===
    salario_integral: bool = False,
    salario_base_mensual: Decimal = Decimal('0'),
) -> dict:
    """
    Calcula la retención en la fuente sobre salarios usando Procedimiento 1.
    
    Proceso de depuración según Art. 388 ET:
    1. Ingreso laboral total
    2. (-) Ingresos no constitutivos de renta (INCR)
    3. = Ingreso neto
    4. (-) Deducciones Art. 387
    5. (-) Rentas exentas
    6. Aplicar límite 40% del ingreso neto / 1340 UVT anuales
    7. = Base gravable → UVT → Tabla Art. 383
    
    Retorna dict con el desglose completo de la depuración.
    """

    # ─── 1. INGRESO LABORAL TOTAL ───
    # No incluye auxilio de transporte (ingreso no constitutivo)
    ingreso_laboral = (
        salario_devengado + horas_extras + comisiones +
        bonificaciones + otros_devengados
    )

    # Para salario integral: el 25% prestacional no es ingreso laboral gravable
    # pero sí entra al cálculo completo (el 70% es el factor salarial)
    # En la práctica, el ingreso laboral es el 100% y se depura normalmente

    # ─── 2. INGRESOS NO CONSTITUTIVOS DE RENTA (INCR) ───
    # Art. 55 ET — Aportes obligatorios a pensión (empleado)
    # Art. 56 ET — Aportes obligatorios a salud (empleado)
    incr_salud = aporte_salud_empleado
    incr_pension = aporte_pension_empleado
    incr_fsp = aporte_fsp

    total_incr = incr_salud + incr_pension + incr_fsp

    # ─── 3. INGRESO NETO ───
    ingreso_neto = max(ingreso_laboral - total_incr, Decimal('0'))

    # ─── 4. DEDUCCIONES (Art. 387 ET) ───
    # 4a. Intereses vivienda — hasta 100 UVT mensuales
    tope_vivienda = (uvt * Decimal('100')).quantize(TWO)
    ded_vivienda = min(deduccion_vivienda, tope_vivienda)

    # 4b. Medicina prepagada — hasta 16 UVT mensuales
    tope_medicina = (uvt * Decimal('16')).quantize(TWO)
    ded_medicina = min(deduccion_medicina_prepagada, tope_medicina)

    # 4c. Dependientes — 10% del ingreso bruto, hasta 32 UVT mensuales
    ded_dependientes = Decimal('0')
    if tiene_dependientes:
        tope_dependientes = (uvt * Decimal('32')).quantize(TWO)
        ded_dependientes = min(
            (ingreso_laboral * Decimal('0.10')).quantize(TWO),
            tope_dependientes
        )

    total_deducciones = ded_vivienda + ded_medicina + ded_dependientes

    # ─── 5. RENTAS EXENTAS ───
    # 5a. Aportes voluntarios a pensión (Art. 126-1 ET)
    # Exentos hasta 25% del ingreso laboral, tope compartido con AFC y AVO
    renta_exenta_vol_pension = min(
        aportes_voluntarios_pension,
        (ingreso_laboral * Decimal('0.25')).quantize(TWO)
    )

    # 5b. Aportes AFC (Art. 126-4 ET)
    renta_exenta_afc = min(
        aportes_afc,
        (ingreso_laboral * Decimal('0.25')).quantize(TWO)
    )

    # 5c. Renta exenta del 25% (Art. 206 numeral 10 ET)
    # Se calcula DESPUÉS de restar INCR, deducciones y demás rentas exentas
    subtotal_antes_25 = ingreso_neto - total_deducciones - renta_exenta_vol_pension - renta_exenta_afc
    subtotal_antes_25 = max(subtotal_antes_25, Decimal('0'))
    renta_exenta_25 = (subtotal_antes_25 * Decimal('0.25')).quantize(TWO)

    total_rentas_exentas = renta_exenta_vol_pension + renta_exenta_afc + renta_exenta_25

    # ─── 6. LÍMITE 40% (Art. 388 ET — Ley 2277 de 2022) ───
    # Total deducciones + rentas exentas NO puede exceder:
    #   a) 40% del ingreso neto
    #   b) 1340 UVT anuales = ~111.67 UVT mensuales
    total_beneficios = total_deducciones + total_rentas_exentas

    limite_40_pct = (ingreso_neto * Decimal('0.40')).quantize(TWO)
    limite_1340_uvt_mensual = (uvt * Decimal('1340') / Decimal('12')).quantize(TWO)

    tope_beneficios = min(limite_40_pct, limite_1340_uvt_mensual)

    if total_beneficios > tope_beneficios:
        # Recortar proporcionalmente
        total_beneficios = tope_beneficios

    # ─── 7. BASE GRAVABLE ───
    base_gravable = max(ingreso_neto - total_beneficios, Decimal('0'))

    # Convertir a UVT
    base_gravable_uvt = (base_gravable / uvt).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # ─── 8. APLICAR TABLA ART. 383 ───
    impuesto_uvt = aplicar_tabla_383(base_gravable_uvt)

    # Convertir impuesto de UVT a pesos
    retencion = (impuesto_uvt * uvt).quantize(TWO, rounding=ROUND_HALF_UP)

    # Redondear a pesos enteros (práctica común)
    retencion = retencion.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

    return {
        'retencion': retencion,
        # Desglose depuración
        'ingreso_laboral': ingreso_laboral,
        'incr_salud': incr_salud,
        'incr_pension': incr_pension,
        'incr_fsp': incr_fsp,
        'total_incr': total_incr,
        'ingreso_neto': ingreso_neto,
        'ded_vivienda': ded_vivienda,
        'ded_medicina': ded_medicina,
        'ded_dependientes': ded_dependientes,
        'total_deducciones': total_deducciones,
        'renta_exenta_vol_pension': renta_exenta_vol_pension,
        'renta_exenta_afc': renta_exenta_afc,
        'renta_exenta_25': renta_exenta_25,
        'total_rentas_exentas': total_rentas_exentas,
        'total_beneficios': total_beneficios,
        'tope_beneficios': tope_beneficios,
        'limite_40_pct': limite_40_pct,
        'base_gravable': base_gravable,
        'base_gravable_uvt': base_gravable_uvt,
        'impuesto_uvt': impuesto_uvt,
        'uvt': uvt,
    }
