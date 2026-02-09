# 🎩 Don Peppini Contadore - Módulo de Nómina Colombia
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal, ROUND_HALF_UP
from datetime import date

TWO = Decimal("0.01")


# ============================================================
# PARÁMETROS LEGALES (por año)
# ============================================================
class ParametrosNomina(models.Model):
    """
    Parámetros legales de nómina por año.
    SMLV, auxilio de transporte, porcentajes de seguridad social, etc.
    """
    anio = models.PositiveIntegerField(unique=True, verbose_name="Año")

    # Salarios
    smlv = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="SMLV")
    auxilio_transporte = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Auxilio de transporte")

    # Seguridad social — Empleado
    salud_empleado = models.DecimalField(max_digits=5, decimal_places=3, default=4.000, verbose_name="% Salud empleado")
    pension_empleado = models.DecimalField(max_digits=5, decimal_places=3, default=4.000, verbose_name="% Pensión empleado")
    fsp_empleado = models.DecimalField(max_digits=5, decimal_places=3, default=0.000,
        verbose_name="% Fondo Solidaridad Pensional",
        help_text="Aplica a salarios >= 4 SMLV")

    # Seguridad social — Empleador
    salud_empleador = models.DecimalField(max_digits=5, decimal_places=3, default=8.500, verbose_name="% Salud empleador")
    pension_empleador = models.DecimalField(max_digits=5, decimal_places=3, default=12.000, verbose_name="% Pensión empleador")
    arl_i = models.DecimalField(max_digits=5, decimal_places=3, default=0.522, verbose_name="% ARL Nivel I")
    arl_ii = models.DecimalField(max_digits=5, decimal_places=3, default=1.044, verbose_name="% ARL Nivel II")
    arl_iii = models.DecimalField(max_digits=5, decimal_places=3, default=2.436, verbose_name="% ARL Nivel III")
    arl_iv = models.DecimalField(max_digits=5, decimal_places=3, default=4.350, verbose_name="% ARL Nivel IV")
    arl_v = models.DecimalField(max_digits=5, decimal_places=3, default=6.960, verbose_name="% ARL Nivel V")

    # Parafiscales
    caja_compensacion = models.DecimalField(max_digits=5, decimal_places=3, default=4.000, verbose_name="% Caja compensación")
    sena = models.DecimalField(max_digits=5, decimal_places=3, default=2.000, verbose_name="% SENA")
    icbf = models.DecimalField(max_digits=5, decimal_places=3, default=3.000, verbose_name="% ICBF")

    # Prestaciones sociales (factores)
    factor_prima = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal("8.3333"),
        verbose_name="% Prima mensual", help_text="8.3333% = 30 días / 360")
    factor_cesantias = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal("8.3333"),
        verbose_name="% Cesantías mensual")
    factor_int_cesantias = models.DecimalField(max_digits=5, decimal_places=3, default=Decimal("12.000"),
        verbose_name="% Intereses sobre cesantías", help_text="12% anual sobre cesantías")
    factor_vacaciones = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal("4.1667"),
        verbose_name="% Vacaciones mensual", help_text="15 días / 360 = 4.1667%")

    # Horas extras (recargos sobre hora ordinaria)
    recargo_extra_diurna = models.DecimalField(max_digits=5, decimal_places=2, default=25, verbose_name="% Recargo hora extra diurna")
    recargo_extra_nocturna = models.DecimalField(max_digits=5, decimal_places=2, default=75, verbose_name="% Recargo hora extra nocturna")
    recargo_dominical_diurna = models.DecimalField(max_digits=5, decimal_places=2, default=100, verbose_name="% Recargo dominical/festiva diurna")
    recargo_dominical_nocturna = models.DecimalField(max_digits=5, decimal_places=2, default=150, verbose_name="% Recargo dominical/festiva nocturna")
    recargo_nocturno = models.DecimalField(max_digits=5, decimal_places=2, default=35, verbose_name="% Recargo nocturno ordinario")

    class Meta:
        verbose_name = "Parámetros de Nómina"
        verbose_name_plural = "Parámetros de Nómina"
        ordering = ['-anio']

    def __str__(self):
        return f"Parámetros {self.anio} — SMLV ${self.smlv:,.0f}"

    @classmethod
    def del_anio(cls, anio=None):
        anio = anio or date.today().year
        obj, _ = cls.objects.get_or_create(anio=anio, defaults={
            'smlv': Decimal('1750905'),
            'auxilio_transporte': Decimal('249095'),
        })
        return obj

    def tope_auxilio_transporte(self):
        """Tope: empleados que ganan hasta 2 SMLV tienen derecho."""
        return self.smlv * 2

    def arl_por_nivel(self, nivel):
        mapping = {1: self.arl_i, 2: self.arl_ii, 3: self.arl_iii, 4: self.arl_iv, 5: self.arl_v}
        return mapping.get(nivel, self.arl_i)

    def valor_hora_ordinaria(self, salario_mensual):
        """Hora ordinaria = salario / 240 (jornada de 48h semanales)."""
        return (salario_mensual / Decimal('240')).quantize(TWO, rounding=ROUND_HALF_UP)


# ============================================================
# EMPLEADO
# ============================================================
class Empleado(models.Model):
    """Empleado vinculado a una empresa y a un tercero."""
    empresa = models.ForeignKey('empresas.Empresa', on_delete=models.CASCADE, related_name='empleados')
    tercero = models.ForeignKey('terceros.Tercero', on_delete=models.PROTECT, related_name='empleo')

    TIPO_CONTRATO_CHOICES = [
        ('IND', 'Indefinido'),
        ('FIJ', 'Fijo'),
        ('OBR', 'Obra o labor'),
        ('PRE', 'Prestación de servicios'),
    ]

    NIVEL_ARL_CHOICES = [(i, f'Nivel {i}') for i in range(1, 6)]

    # Contrato
    tipo_contrato = models.CharField(max_length=3, choices=TIPO_CONTRATO_CHOICES, default='IND')
    fecha_ingreso = models.DateField(verbose_name="Fecha de ingreso")
    fecha_retiro = models.DateField(null=True, blank=True, verbose_name="Fecha de retiro")

    # Salario
    salario_base = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Salario base mensual")
    salario_integral = models.BooleanField(default=False,
        verbose_name="Salario integral",
        help_text="Si es True, el 70% es factor salarial y 30% factor prestacional.")

    # Seguridad social
    nivel_arl = models.PositiveSmallIntegerField(choices=NIVEL_ARL_CHOICES, default=1, verbose_name="Nivel ARL")

    # EPS / AFP / Caja
    eps = models.CharField(max_length=100, blank=True, null=True, verbose_name="EPS")
    afp = models.CharField(max_length=100, blank=True, null=True, verbose_name="AFP (Fondo de pensiones)")
    caja_compensacion = models.CharField(max_length=100, blank=True, null=True, verbose_name="Caja de compensación")
    arl_nombre = models.CharField(max_length=100, blank=True, null=True, verbose_name="ARL")

    # Centro de costo / cargo
    cargo = models.CharField(max_length=100, blank=True, null=True)
    centro_costo = models.CharField(max_length=50, blank=True, null=True)

    # Estado
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Empleado"
        verbose_name_plural = "Empleados"
        unique_together = ['empresa', 'tercero']
        ordering = ['tercero__nombre_razon_social']

    def __str__(self):
        return f"{self.tercero.nombre_razon_social} — {self.cargo or 'Sin cargo'}"

    @property
    def tiene_auxilio_transporte(self):
        params = ParametrosNomina.del_anio()
        return self.salario_base <= params.tope_auxilio_transporte() and not self.salario_integral

    @property
    def ibc_salud_pension(self):
        """Ingreso Base de Cotización para salud y pensión."""
        if self.salario_integral:
            return (self.salario_base * Decimal('0.70')).quantize(TWO)
        return self.salario_base


# ============================================================
# NÓMINA (Período de liquidación)
# ============================================================
class Nomina(models.Model):
    """Nómina de un período (quincenal o mensual)."""
    empresa = models.ForeignKey('empresas.Empresa', on_delete=models.CASCADE, related_name='nominas')

    TIPO_CHOICES = [
        ('MEN', 'Mensual'),
        ('Q1', 'Primera quincena'),
        ('Q2', 'Segunda quincena'),
    ]
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('liquidada', 'Liquidada'),
        ('pagada', 'Pagada'),
        ('anulada', 'Anulada'),
    ]

    tipo = models.CharField(max_length=3, choices=TIPO_CHOICES, default='MEN')
    anio = models.PositiveIntegerField(verbose_name="Año")
    mes = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)], verbose_name="Mes")
    fecha_liquidacion = models.DateField(null=True, blank=True)
    fecha_pago = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='borrador')
    notas = models.TextField(blank=True, null=True)

    # Totales
    total_devengado = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_deducciones = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_neto = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_costo_empresa = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Nómina"
        verbose_name_plural = "Nóminas"
        unique_together = ['empresa', 'anio', 'mes', 'tipo']
        ordering = ['-anio', '-mes']

    def __str__(self):
        return f"Nómina {self.get_tipo_display()} — {self.mes}/{self.anio} ({self.get_estado_display()})"


# ============================================================
# LIQUIDACIÓN POR EMPLEADO
# ============================================================
class LiquidacionEmpleado(models.Model):
    """Liquidación individual de nómina por empleado en un período."""
    nomina = models.ForeignKey(Nomina, on_delete=models.CASCADE, related_name='liquidaciones')
    empleado = models.ForeignKey(Empleado, on_delete=models.PROTECT, related_name='liquidaciones')

    # Días trabajados
    dias_trabajados = models.PositiveSmallIntegerField(default=30)

    # Salario y auxilio aplicados
    salario_base = models.DecimalField(max_digits=12, decimal_places=2)
    auxilio_transporte = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # === DEVENGADOS ===
    salario_devengado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    horas_extras = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    recargos = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    comisiones = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonificaciones = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    otros_devengados = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_devengado = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # === DEDUCCIONES (empleado) ===
    salud_empleado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    pension_empleado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fsp = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Fondo Solidaridad Pensional")
    retencion_fuente = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    libranzas = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    otros_descuentos = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deducciones = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # === NETO A PAGAR ===
    neto_pagar = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # === APORTES EMPLEADOR (no descuento al empleado) ===
    salud_empleador = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    pension_empleador = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    arl = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    caja_compensacion = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sena = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    icbf = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # === PROVISIONES PRESTACIONES ===
    provision_prima = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    provision_cesantias = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    provision_int_cesantias = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    provision_vacaciones = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # === COSTO TOTAL EMPRESA ===
    costo_empresa = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Liquidación de Empleado"
        verbose_name_plural = "Liquidaciones de Empleados"
        unique_together = ['nomina', 'empleado']

    def __str__(self):
        return f"{self.empleado} — Neto: ${self.neto_pagar:,.0f}"

    def calcular(self):
        """Calcula todos los valores de la liquidación según parámetros legales."""
        params = ParametrosNomina.del_anio(self.nomina.anio)
        emp = self.empleado
        dias = Decimal(str(self.dias_trabajados))

        # --- Salario proporcional ---
        self.salario_base = emp.salario_base
        salario_prop = (emp.salario_base * dias / Decimal('30')).quantize(TWO)
        self.salario_devengado = salario_prop

        # --- Auxilio de transporte ---
        if emp.tiene_auxilio_transporte and dias > 0:
            self.auxilio_transporte = (params.auxilio_transporte * dias / Decimal('30')).quantize(TWO)
        else:
            self.auxilio_transporte = Decimal('0')

        # --- Total devengado ---
        self.total_devengado = (
            self.salario_devengado + self.auxilio_transporte +
            self.horas_extras + self.recargos + self.comisiones +
            self.bonificaciones + self.otros_devengados
        ).quantize(TWO)

        # --- IBC (Ingreso Base de Cotización) ---
        # IBC NO incluye auxilio de transporte
        ibc = (self.total_devengado - self.auxilio_transporte).quantize(TWO)
        if emp.salario_integral:
            ibc = (emp.salario_base * Decimal('0.70') * dias / Decimal('30')).quantize(TWO)

        # Piso: IBC mínimo = SMLV proporcional
        ibc_minimo = (params.smlv * dias / Decimal('30')).quantize(TWO)
        ibc = max(ibc, ibc_minimo)

        # --- DEDUCCIONES EMPLEADO ---
        self.salud_empleado = (ibc * params.salud_empleado / Decimal('100')).quantize(TWO)
        self.pension_empleado = (ibc * params.pension_empleado / Decimal('100')).quantize(TWO)

        # FSP: aplica si salario >= 4 SMLV
        if emp.salario_base >= params.smlv * 4:
            fsp_pct = Decimal('1.000')  # 1% para 4-16 SMLV
            if emp.salario_base >= params.smlv * 16:
                fsp_pct = Decimal('1.200')
            elif emp.salario_base >= params.smlv * 17:
                fsp_pct = Decimal('1.400')
            elif emp.salario_base >= params.smlv * 18:
                fsp_pct = Decimal('1.600')
            elif emp.salario_base >= params.smlv * 19:
                fsp_pct = Decimal('1.800')
            elif emp.salario_base >= params.smlv * 20:
                fsp_pct = Decimal('2.000')
            self.fsp = (ibc * fsp_pct / Decimal('100')).quantize(TWO)
        else:
            self.fsp = Decimal('0')

        self.total_deducciones = (
            self.salud_empleado + self.pension_empleado + self.fsp +
            self.retencion_fuente + self.libranzas + self.otros_descuentos
        ).quantize(TWO)

        # --- NETO A PAGAR ---
        self.neto_pagar = (self.total_devengado - self.total_deducciones).quantize(TWO)

        # --- APORTES EMPLEADOR ---
        self.salud_empleador = (ibc * params.salud_empleador / Decimal('100')).quantize(TWO)
        self.pension_empleador = (ibc * params.pension_empleador / Decimal('100')).quantize(TWO)
        self.arl = (ibc * params.arl_por_nivel(emp.nivel_arl) / Decimal('100')).quantize(TWO)
        self.caja_compensacion = (ibc * params.caja_compensacion / Decimal('100')).quantize(TWO)
        self.sena = (ibc * params.sena / Decimal('100')).quantize(TWO)
        self.icbf = (ibc * params.icbf / Decimal('100')).quantize(TWO)

        # --- PROVISIONES PRESTACIONES ---
        # Base prestacional = salario + auxilio transporte (para prima y cesantías)
        base_prest = self.salario_devengado + self.auxilio_transporte + self.horas_extras + self.recargos + self.comisiones
        self.provision_prima = (base_prest * params.factor_prima / Decimal('100')).quantize(TWO)
        self.provision_cesantias = (base_prest * params.factor_cesantias / Decimal('100')).quantize(TWO)
        self.provision_int_cesantias = (self.provision_cesantias * params.factor_int_cesantias / Decimal('100')).quantize(TWO)
        # Vacaciones sobre salario SIN auxilio transporte
        base_vac = self.salario_devengado + self.horas_extras + self.recargos + self.comisiones
        self.provision_vacaciones = (base_vac * params.factor_vacaciones / Decimal('100')).quantize(TWO)

        # --- COSTO TOTAL EMPRESA ---
        self.costo_empresa = (
            self.total_devengado +
            self.salud_empleador + self.pension_empleador + self.arl +
            self.caja_compensacion + self.sena + self.icbf +
            self.provision_prima + self.provision_cesantias +
            self.provision_int_cesantias + self.provision_vacaciones
        ).quantize(TWO)

        self.save()
        return self


# ============================================================
# DETALLE HORAS EXTRAS (opcional, para desglose)
# ============================================================
class DetalleHorasExtras(models.Model):
    """Desglose de horas extras y recargos por liquidación."""
    liquidacion = models.ForeignKey(LiquidacionEmpleado, on_delete=models.CASCADE, related_name='detalle_horas')

    TIPO_CHOICES = [
        ('HED', 'Hora extra diurna'),
        ('HEN', 'Hora extra nocturna'),
        ('HEDD', 'Hora extra dominical diurna'),
        ('HEDN', 'Hora extra dominical nocturna'),
        ('RN', 'Recargo nocturno'),
        ('RDD', 'Recargo dominical diurno'),
        ('RDN', 'Recargo dominical nocturno'),
    ]

    tipo = models.CharField(max_length=4, choices=TIPO_CHOICES)
    cantidad_horas = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    valor_hora = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    porcentaje_recargo = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    valor_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Detalle Horas Extra"
        verbose_name_plural = "Detalle Horas Extra"

    def calcular(self, salario_base):
        params = ParametrosNomina.del_anio()
        self.valor_hora = params.valor_hora_ordinaria(salario_base)

        recargo_map = {
            'HED': params.recargo_extra_diurna,
            'HEN': params.recargo_extra_nocturna,
            'HEDD': params.recargo_dominical_diurna,
            'HEDN': params.recargo_dominical_nocturna,
            'RN': params.recargo_nocturno,
            'RDD': Decimal('75'),  # 75% recargo dominical
            'RDN': Decimal('110'),  # 75% + 35%
        }
        self.porcentaje_recargo = recargo_map.get(self.tipo, Decimal('0'))
        factor = (Decimal('1') + self.porcentaje_recargo / Decimal('100'))
        self.valor_total = (self.cantidad_horas * self.valor_hora * factor).quantize(TWO)
        return self
