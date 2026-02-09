# 🎩 Don Peppini Contadore - Modelos de Contabilidad

from django.db import models
from django.core.exceptions import ValidationError
from terceros.models import Tercero
from django.utils import timezone
from datetime import date
from django.conf import settings


class CuentaBase(models.Model):
    """
    Plan Único de Cuentas BASE (compartido por todas las empresas).
    Contiene las 375 cuentas estándar del PUC colombiano.
    """
    codigo = models.CharField(max_length=20, unique=True, primary_key=True, verbose_name="Código")
    nombre = models.CharField(max_length=255, verbose_name="Nombre de la Cuenta")
    nivel = models.PositiveSmallIntegerField(default=1, verbose_name="Nivel")
    naturaleza = models.CharField(
        max_length=1,
        choices=[('D', 'Débito'), ('C', 'Crédito')],
        default='D',
        verbose_name="Naturaleza"
    )
    tipo = models.CharField(
        max_length=20,
        choices=[
            ('Clase', 'Clase'),
            ('Grupo', 'Grupo'),
            ('Cuenta', 'Cuenta'),
            ('Subcuenta', 'Subcuenta'),
            ('Auxiliar', 'Auxiliar'),
        ],
        default='Cuenta',
        verbose_name="Tipo"
    )
    padre = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='hijos')
    
    def __str__(self): 
        return f"{self.codigo} - {self.nombre}"
    
    class Meta:
        verbose_name = "Cuenta PUC Base"
        verbose_name_plural = "Plan de Cuentas Base"
        ordering = ['codigo']


class Cuenta(models.Model):
    """
    Cuenta contable POR EMPRESA.
    Puede ser una copia de CuentaBase o una cuenta auxiliar personalizada.
    """
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='cuentas',
        verbose_name="Empresa"
    )
    codigo = models.CharField(max_length=20, verbose_name="Código")
    nombre = models.CharField(max_length=255, verbose_name="Nombre de la Cuenta")
    nivel = models.PositiveSmallIntegerField(default=4, verbose_name="Nivel")
    naturaleza = models.CharField(
        max_length=1,
        choices=[('D', 'Débito'), ('C', 'Crédito')],
        default='D',
        verbose_name="Naturaleza"
    )
    tipo = models.CharField(
        max_length=20,
        choices=[
            ('Clase', 'Clase'),
            ('Grupo', 'Grupo'),
            ('Cuenta', 'Cuenta'),
            ('Subcuenta', 'Subcuenta'),
            ('Auxiliar', 'Auxiliar'),
        ],
        default='Auxiliar',
        verbose_name="Tipo"
    )
    cuenta_base = models.ForeignKey(
        CuentaBase,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cuentas_empresa',
        verbose_name="Cuenta PUC Base"
    )
    padre = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='hijos')
    
    # Clasificación NIIF
    clasificacion_niif = models.CharField(max_length=100, blank=True, null=True)
    seccion_niif = models.CharField(max_length=50, blank=True, null=True)
    
    # Estado
    activa = models.BooleanField(default=True)
    
    def __str__(self): 
        return f"{self.codigo} - {self.nombre}"
    
    class Meta:
        verbose_name = "Cuenta Contable"
        verbose_name_plural = "Plan de Cuentas"
        ordering = ['codigo']
        unique_together = ['empresa', 'codigo']


class AsientoContable(models.Model):
    """Asiento contable por empresa"""
    
    # === RELACIÓN CON EMPRESA ===
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='asientos',
        verbose_name="Empresa"
    )
    
    # === NUMERACIÓN ===
    numero = models.PositiveIntegerField(default=0, verbose_name="Número de Asiento")
    
    # === FECHA Y PERIODO ===
    fecha = models.DateField(verbose_name="Fecha del Asiento")
    fiscal_year = models.PositiveIntegerField(db_index=True, default=0)
    fiscal_period = models.PositiveSmallIntegerField(db_index=True, default=0)
    
    # === TERCERO Y CONCEPTO ===
    tercero = models.ForeignKey(Tercero, on_delete=models.PROTECT, verbose_name="Tercero")
    concepto = models.CharField(max_length=500, verbose_name="Concepto")
    descripcion = models.TextField(blank=True, null=True, verbose_name="Descripción")
    descripcion_adicional = models.TextField(blank=True, null=True)
    
    # === AUDITORÍA ===
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    # === ESTADO Y ANULACIÓN ===
    estado = models.CharField(max_length=10, default="vigente", choices=[("vigente","Vigente"),("anulado","Anulado")])
    anulado_por = models.ForeignKey("auth.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    anulado_en = models.DateTimeField(null=True, blank=True)
    anulacion_motivo = models.TextField(blank=True, null=True)
    ajusta_a = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="ajustes")

    def save(self, *args, **kwargs):
        # Derivar año/periodo de la fecha si no se envían
        if not self.fiscal_year and self.fecha:
            self.fiscal_year = self.fecha.year
        if not self.fiscal_period and self.fecha:
            self.fiscal_period = self.fecha.month
        
        # Auto-numerar asientos por empresa y año
        if not self.numero:
            ultimo = AsientoContable.objects.filter(
                empresa=self.empresa,
                fiscal_year=self.fiscal_year
            ).order_by('-numero').first()
            self.numero = (ultimo.numero + 1) if ultimo else 1
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Asiento #{self.numero} del {self.fecha} - {self.concepto}"

    class Meta:
        verbose_name = "Asiento Contable"
        verbose_name_plural = "Asientos Contables"
        ordering = ['-fecha', '-numero']
        unique_together = ['empresa', 'fiscal_year', 'numero']


class MovimientoContable(models.Model):
    """Movimiento de un asiento (línea de débito o crédito)"""
    asiento = models.ForeignKey(AsientoContable, on_delete=models.CASCADE, related_name='movimientos')
    cuenta = models.ForeignKey(Cuenta, on_delete=models.PROTECT)
    tercero = models.ForeignKey(
        Tercero, on_delete=models.PROTECT,
        null=True, blank=True,
        verbose_name="Tercero (línea)",
        help_text="Si vacío, hereda el tercero del asiento."
    )
    debito = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Débito")
    credito = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Crédito")
    
    def clean(self):
        if self.debito > 0 and self.credito > 0:
            raise ValidationError("Un movimiento no puede tener valor en Débito y Crédito simultáneamente.")
        if self.debito == 0 and self.credito == 0:
            raise ValidationError("El movimiento debe tener un valor en Débito o en Crédito.")
    
    def __str__(self):
        if self.debito > 0: 
            return f"Débito a {self.cuenta.codigo} por {self.debito}"
        return f"Crédito a {self.cuenta.codigo} por {self.credito}"
    
    class Meta:
        verbose_name = "Movimiento Contable"
        verbose_name_plural = "Movimientos Contables"
        ordering = ['asiento', 'id']


class PeriodoContable(models.Model):
    """Control de periodo contable POR EMPRESA"""
    ESTADOS = (('abierto','Abierto'),('cierre','En Cierre'),('cerrado','Cerrado'))
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='periodos',
        verbose_name="Empresa"
    )
    anio = models.PositiveIntegerField(verbose_name="Año")
    estado = models.CharField(max_length=10, choices=ESTADOS, default='abierto')
    ajustes_inicio = models.DateField(verbose_name="Inicio ventana ajustes")
    ajustes_fin = models.DateField(verbose_name="Fin ventana ajustes")
    habilitar_mes13 = models.BooleanField(default=True)
    requiere_pins_en_ajustes = models.BooleanField(default=True)

    def in_ajustes(self, d: date) -> bool:
        return self.ajustes_inicio <= d <= self.ajustes_fin

    @classmethod
    def ensure(cls, empresa, anio: int):
        obj, _ = cls.objects.get_or_create(
            empresa=empresa,
            anio=anio,
            defaults=dict(
                estado='abierto',
                ajustes_inicio=date(anio+1, 1, 1),
                ajustes_fin=date(anio+1, 3, 31),
                habilitar_mes13=True,
                requiere_pins_en_ajustes=True,
            )
        )
        return obj

    class Meta:
        verbose_name = "Periodo Contable"
        verbose_name_plural = "Periodos Contables"
        unique_together = ['empresa', 'anio']
        ordering = ['empresa', '-anio']
    
    def __str__(self):
        return f"{self.empresa.razon_social} - {self.anio} ({self.estado})"

        # 🎩 Don Peppini Contadore - Modelos de Conciliación Bancaria
# CREAR ARCHIVO: contabilidad/models_conciliacion.py
# O AGREGAR AL FINAL DE contabilidad/models.py

from django.db import models
from decimal import Decimal


class ConciliacionBancaria(models.Model):
    """
    Encabezado de una conciliación bancaria mensual
    """
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('conciliado', 'Conciliado'),
        ('aprobado', 'Aprobado'),
    ]
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='conciliaciones'
    )
    
    cuenta_banco = models.ForeignKey(
        'contabilidad.Cuenta',
        on_delete=models.PROTECT,
        related_name='conciliaciones',
        verbose_name="Cuenta Contable del Banco"
    )
    
    # Período
    año = models.PositiveIntegerField()
    mes = models.PositiveIntegerField()
    fecha_corte = models.DateField(verbose_name="Fecha de Corte")
    
    # Saldos
    saldo_extracto = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        verbose_name="Saldo según Extracto Bancario"
    )
    saldo_libros = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        verbose_name="Saldo según Libros"
    )
    saldo_conciliado = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        verbose_name="Saldo Conciliado"
    )
    
    # Partidas conciliatorias (totales)
    cheques_pendientes = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    depositos_transito = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notas_debito_banco = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notas_credito_banco = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    # Estado
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='borrador')
    observaciones = models.TextField(blank=True, null=True)
    
    # Auditoría
    creado_por = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True,
        related_name='conciliaciones_creadas'
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Conciliación Bancaria"
        verbose_name_plural = "Conciliaciones Bancarias"
        ordering = ['-año', '-mes']
        unique_together = ['empresa', 'cuenta_banco', 'año', 'mes']
    
    def __str__(self):
        return f"Conciliación {self.cuenta_banco.nombre} - {self.mes}/{self.año}"
    
    @property
    def diferencia(self):
        """Diferencia entre saldo extracto y saldo libros ajustado"""
        saldo_libros_ajustado = (
            self.saldo_libros 
            - self.cheques_pendientes 
            + self.depositos_transito
            - self.notas_debito_banco
            + self.notas_credito_banco
        )
        return self.saldo_extracto - saldo_libros_ajustado
    
    @property
    def esta_conciliado(self):
        """Verifica si la conciliación cuadra"""
        return abs(self.diferencia) < Decimal('0.01')


class MovimientoExtracto(models.Model):
    """
    Movimientos importados del extracto bancario
    """
    TIPO_CHOICES = [
        ('debito', 'Débito (Salida)'),
        ('credito', 'Crédito (Entrada)'),
    ]
    
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('conciliado', 'Conciliado'),
        ('no_aplica', 'No Aplica'),
    ]
    
    conciliacion = models.ForeignKey(
        ConciliacionBancaria,
        on_delete=models.CASCADE,
        related_name='movimientos_extracto'
    )
    
    fecha = models.DateField()
    descripcion = models.CharField(max_length=255)
    referencia = models.CharField(max_length=100, blank=True, null=True)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    valor = models.DecimalField(max_digits=15, decimal_places=2)
    saldo = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    
    # Conciliación
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='pendiente')
    movimiento_contable = models.ForeignKey(
        'contabilidad.MovimientoContable',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='movimientos_extracto'
    )
    
    # Clasificación de partida conciliatoria
    es_cheque_pendiente = models.BooleanField(default=False)
    es_deposito_transito = models.BooleanField(default=False)
    es_nota_debito = models.BooleanField(default=False)
    es_nota_credito = models.BooleanField(default=False)
    
    observacion = models.CharField(max_length=255, blank=True, null=True)
    
    class Meta:
        verbose_name = "Movimiento de Extracto"
        verbose_name_plural = "Movimientos de Extracto"
        ordering = ['fecha', 'id']
    
    def __str__(self):
        return f"{self.fecha} - {self.descripcion[:30]} - ${self.valor}"


class PartidaConciliatoria(models.Model):
    """
    Partidas que explican las diferencias entre extracto y libros
    """
    TIPO_CHOICES = [
        ('cheque_pendiente', 'Cheque girado no cobrado'),
        ('deposito_transito', 'Depósito en tránsito'),
        ('nota_debito_banco', 'Nota débito del banco no registrada'),
        ('nota_credito_banco', 'Nota crédito del banco no registrada'),
        ('error_banco', 'Error del banco'),
        ('error_libros', 'Error en libros'),
        ('otro', 'Otro'),
    ]
    
    conciliacion = models.ForeignKey(
        ConciliacionBancaria,
        on_delete=models.CASCADE,
        related_name='partidas_conciliatorias'
    )
    
    tipo = models.CharField(max_length=25, choices=TIPO_CHOICES)
    fecha = models.DateField()
    descripcion = models.CharField(max_length=255)
    referencia = models.CharField(max_length=100, blank=True, null=True)
    valor = models.DecimalField(max_digits=15, decimal_places=2)
    
    # Referencias opcionales
    movimiento_extracto = models.ForeignKey(
        MovimientoExtracto,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    movimiento_contable = models.ForeignKey(
        'contabilidad.MovimientoContable',
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    
    resuelta = models.BooleanField(default=False)
    fecha_resolucion = models.DateField(blank=True, null=True)
    
    class Meta:
        verbose_name = "Partida Conciliatoria"
        verbose_name_plural = "Partidas Conciliatorias"
        ordering = ['tipo', 'fecha']
    
    def __str__(self):
        return f"{self.get_tipo_display()} - ${self.valor}"

# ============================================================================
# 🎩 NOTAS A LOS ESTADOS FINANCIEROS - MODELOS
# AGREGAR AL FINAL DE contabilidad/models.py
# ============================================================================


class NotaEstadoFinanciero(models.Model):
    """
    Nota individual a los estados financieros.
    Puede ser una nota estándar (plantilla) o personalizada por empresa/año.
    """
    TIPO_NOTA_CHOICES = [
        ('general', '1. Información General'),
        ('politicas', '2. Políticas Contables'),
        ('efectivo', '3. Efectivo y Equivalentes'),
        ('cuentas_cobrar', '4. Cuentas por Cobrar'),
        ('inventarios', '5. Inventarios'),
        ('propiedad_planta', '6. Propiedad, Planta y Equipo'),
        ('intangibles', '7. Activos Intangibles'),
        ('cuentas_pagar', '8. Cuentas por Pagar'),
        ('obligaciones', '9. Obligaciones Financieras'),
        ('impuestos', '10. Impuestos'),
        ('provisiones', '11. Provisiones y Contingencias'),
        ('patrimonio', '12. Patrimonio'),
        ('ingresos', '13. Ingresos Operacionales'),
        ('costos_gastos', '14. Costos y Gastos'),
        ('partes_relacionadas', '15. Partes Relacionadas'),
        ('hechos_posteriores', '16. Hechos Posteriores'),
        ('otras', '17. Otras Revelaciones'),
    ]
    
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='notas_eeff'
    )
    
    año = models.PositiveIntegerField()
    tipo_nota = models.CharField(max_length=30, choices=TIPO_NOTA_CHOICES)
    numero = models.PositiveIntegerField(default=1)
    titulo = models.CharField(max_length=255)
    
    # Contenido en Markdown/HTML
    contenido = models.TextField(blank=True, null=True)
    
    # Datos estructurados (JSON) para tablas automáticas
    datos_json = models.JSONField(blank=True, null=True)
    
    # Control
    incluir_en_reporte = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)
    
    # Auditoría
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    modificado_por = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    
    class Meta:
        verbose_name = "Nota a Estados Financieros"
        verbose_name_plural = "Notas a Estados Financieros"
        ordering = ['año', 'orden', 'numero']
        unique_together = ['empresa', 'año', 'tipo_nota']
    
    def __str__(self):
        return f"Nota {self.numero}: {self.titulo} ({self.año})"


class PlantillaNotaEEFF(models.Model):
    """
    Plantillas predefinidas de notas (a nivel sistema, no por empresa).
    Sirven como base para generar las notas de cada empresa.
    """
    tipo_nota = models.CharField(max_length=30, primary_key=True)
    titulo_default = models.CharField(max_length=255)
    contenido_plantilla = models.TextField(
        help_text="Usar marcadores como {empresa}, {nit}, {año}, {saldo_efectivo}, etc."
    )
    seccion_niif = models.CharField(max_length=100, blank=True, null=True)
    obligatoria = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)
    
    class Meta:
        verbose_name = "Plantilla de Nota"
        verbose_name_plural = "Plantillas de Notas"
        ordering = ['orden']
    
    def __str__(self):
        return self.titulo_default

        # ============================================================================
# 🎩 CIERRE CONTABLE - MODELO
# AGREGAR A contabilidad/models.py
# ============================================================================

class CierreContable(models.Model):
    """Registro de cierres contables por período"""
    
    TIPO_CHOICES = [
        ('mensual', 'Cierre Mensual'),
        ('anual', 'Cierre Anual'),
    ]
    
    ESTADO_CHOICES = [
        ('cerrado', 'Cerrado'),
        ('reabierto', 'Reabierto'),
    ]
    
    empresa = models.ForeignKey('empresas.Empresa', on_delete=models.CASCADE, related_name='cierres')
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    año = models.IntegerField()
    mes = models.IntegerField(null=True, blank=True)  # Solo para cierres mensuales
    
    fecha_cierre = models.DateField()  # Último día del período
    fecha_ejecucion = models.DateTimeField(auto_now_add=True)
    
    # Resultados del cierre
    total_ingresos = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_costos = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_gastos = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    resultado_ejercicio = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    
    # Asiento generado
    asiento_cierre = models.ForeignKey(
        'contabilidad.AsientoContable', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='cierre_origen'
    )
    
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='cerrado')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,  # Este está bien así
        on_delete=models.SET_NULL, 
        null=True,
        related_name='cierres_realizados'
    )
    notas = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['empresa', 'tipo', 'año', 'mes']
        ordering = ['-año', '-mes']
    
    def __str__(self):
        if self.tipo == 'anual':
            return f"Cierre Anual {self.año} - {self.empresa.razon_social}"
        return f"Cierre {self.mes}/{self.año} - {self.empresa.razon_social}"
    
    @property
    def periodo_str(self):
        if self.tipo == 'anual':
            return f"Año {self.año}"
        meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        return f"{meses[self.mes]} {self.año}"