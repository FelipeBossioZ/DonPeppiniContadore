# 🎩 Don Peppini Contadore - Modelo de Empresas
from django.db import models
from django.core.validators import RegexValidator


class Empresa(models.Model):
    """
    Modelo para gestionar múltiples empresas en el sistema.
    Cada empresa tiene su propia contabilidad, terceros y configuración.
    """
    
    TIPO_PERSONA_CHOICES = [
        ('N', 'Persona Natural'),
        ('J', 'Persona Jurídica'),
    ]
    
    REGIMEN_CHOICES = [
        ('RC', 'Responsable de IVA'),
        ('RS', 'No Responsable de IVA'),
        ('GC', 'Gran Contribuyente'),
    ]
    
    GRUPO_NIIF_CHOICES = [
        ('1', 'Grupo 1 - NIIF Plenas'),
        ('2', 'Grupo 2 - NIIF para Pymes'),
        ('3', 'Grupo 3 - Contabilidad Simplificada'),
    ]
    
    TIPO_CONTRIBUYENTE_CHOICES = [
        ('GC', 'Gran Contribuyente'),
        ('AR', 'Autorretenedor'),
        ('RC', 'Responsable de IVA'),
        ('NR', 'No Responsable de IVA'),
    ]
    
    # === IDENTIFICACIÓN BÁSICA ===
    nit = models.CharField(
        max_length=15,
        unique=True,
        verbose_name="NIT",
        help_text="Formato: 123456789-0"
    )
    razon_social = models.CharField(max_length=255, verbose_name="Razón Social")
    nombre_comercial = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nombre Comercial")
    
    # === CLASIFICACIÓN TRIBUTARIA ===
    tipo_persona = models.CharField(max_length=1, choices=TIPO_PERSONA_CHOICES, default='J')
    regimen = models.CharField(max_length=2, choices=REGIMEN_CHOICES, default='RC')
    grupo_niif = models.CharField(max_length=1, choices=GRUPO_NIIF_CHOICES, default='2')
    tipo_contribuyente = models.CharField(max_length=2, choices=TIPO_CONTRIBUYENTE_CHOICES, default='RC')
    
    # === ACTIVIDAD ECONÓMICA ===
    actividad_principal = models.CharField(max_length=10, blank=True, null=True, verbose_name="Código CIIU")
    descripcion_actividad = models.CharField(max_length=255, blank=True, null=True)
    
    # === UBICACIÓN ===
    direccion = models.CharField(max_length=255, blank=True, null=True)
    ciudad = models.CharField(max_length=100, blank=True, null=True)
    departamento = models.CharField(max_length=100, blank=True, null=True)
    codigo_municipio = models.CharField(max_length=5, blank=True, null=True, verbose_name="Código DANE Municipio")
    codigo_departamento = models.CharField(max_length=2, blank=True, null=True, verbose_name="Código DANE Dpto")
    
    # === CONTACTO ===
    telefono = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    
    # === REPRESENTANTE LEGAL ===
    representante_legal = models.CharField(max_length=255, blank=True, null=True)
    documento_representante = models.CharField(max_length=20, blank=True, null=True)
    
    # === CONTADOR ===
    contador_nombre = models.CharField(max_length=255, blank=True, null=True)
    contador_documento = models.CharField(max_length=20, blank=True, null=True)
    contador_tarjeta = models.CharField(max_length=20, blank=True, null=True, verbose_name="Tarjeta Profesional")
    
    # === CONFIGURACIÓN CONTABLE ===
    fecha_inicio_actividades = models.DateField(blank=True, null=True)
    periodo_contable_actual = models.PositiveIntegerField(default=2025)
    
    # === ESTADO ===
    activa = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"
        ordering = ['razon_social']
    
    def __str__(self):
        return f"{self.razon_social} ({self.nit})"
    
    @property
    def nit_sin_dv(self):
        return self.nit.split('-')[0] if '-' in self.nit else self.nit
    
    @property
    def digito_verificacion(self):
        return self.nit.split('-')[1] if '-' in self.nit else ''


class ConfiguracionEmpresa(models.Model):
    """Configuraciones adicionales por empresa"""
    empresa = models.OneToOneField(Empresa, on_delete=models.CASCADE, related_name='configuracion')
    
    # PINs para control de periodo
    pin_contador = models.CharField(max_length=10, blank=True, null=True)
    pin_gerente = models.CharField(max_length=10, blank=True, null=True)
    
    # Políticas contables (markdown)
    politicas_contables = models.TextField(blank=True, null=True)
    
    # Notas EEFF plantilla
    notas_eeff_plantilla = models.TextField(blank=True, null=True)
    
    # Logo (binario)
    logo = models.BinaryField(blank=True, null=True)
    
    class Meta:
        verbose_name = "Configuración de Empresa"
        verbose_name_plural = "Configuraciones de Empresas"
    
    def __str__(self):
        return f"Config: {self.empresa.razon_social}"
