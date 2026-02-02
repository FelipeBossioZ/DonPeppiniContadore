# 🎩 Don Peppini Contadore - Modelo de Terceros
from django.db import models


class Tercero(models.Model):
    """
    Tercero (cliente, proveedor, empleado, socio).
    Cada tercero pertenece a una empresa específica.
    """
    TIPO_DOCUMENTO_CHOICES = [
        ('CC', 'Cédula de Ciudadanía'),
        ('NIT', 'NIT'),
        ('CE', 'Cédula de Extranjería'),
        ('PA', 'Pasaporte'),
        ('TI', 'Tarjeta de Identidad'),
        ('RC', 'Registro Civil'),
        ('TE', 'Tarjeta de Extranjería'),
        ('DIE', 'Doc. Identificación Extranjero'),
    ]
    
    TIPO_TERCERO_CHOICES = [
        ('CLI', 'Cliente'),
        ('PRO', 'Proveedor'),
        ('EMP', 'Empleado'),
        ('SOC', 'Socio/Accionista'),
        ('OTR', 'Otro'),
    ]
    
    # === RELACIÓN CON EMPRESA ===
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='terceros',
        verbose_name="Empresa"
    )
    
    # === IDENTIFICACIÓN ===
    tipo_documento = models.CharField(max_length=3, choices=TIPO_DOCUMENTO_CHOICES, verbose_name="Tipo Doc.")
    numero_documento = models.CharField(max_length=20, verbose_name="Número Doc.")
    digito_verificacion = models.CharField(max_length=1, blank=True, null=True, verbose_name="DV")
    
    # === NOMBRES (Personas Naturales) ===
    primer_apellido = models.CharField(max_length=100, blank=True, null=True)
    segundo_apellido = models.CharField(max_length=100, blank=True, null=True)
    primer_nombre = models.CharField(max_length=100, blank=True, null=True)
    otros_nombres = models.CharField(max_length=100, blank=True, null=True)
    
    # === RAZÓN SOCIAL (Personas Jurídicas / Nombre completo) ===
    nombre_razon_social = models.CharField(max_length=255, verbose_name="Nombre o Razón Social")
    
    # === TIPO DE TERCERO ===
    tipo_tercero = models.CharField(max_length=3, choices=TIPO_TERCERO_CHOICES, default='OTR')
    
    # === UBICACIÓN (para Medios Magnéticos) ===
    direccion = models.CharField(max_length=255, blank=True, null=True)
    ciudad = models.CharField(max_length=100, blank=True, null=True)
    departamento = models.CharField(max_length=100, blank=True, null=True)
    codigo_municipio = models.CharField(max_length=5, blank=True, null=True, verbose_name="Cód. Municipio")
    codigo_departamento = models.CharField(max_length=2, blank=True, null=True, verbose_name="Cód. Dpto")
    codigo_pais = models.CharField(max_length=3, default='169', verbose_name="Cód. País")
    
    # === CONTACTO ===
    telefono = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(max_length=254, blank=True, null=True)
    
    # === ESTADO ===
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.nombre_razon_social} ({self.tipo_documento} {self.numero_documento})"
    
    @property
    def nombre_completo(self):
        """Nombre completo para personas naturales"""
        if self.tipo_documento != 'NIT':
            partes = [self.primer_nombre, self.otros_nombres, self.primer_apellido, self.segundo_apellido]
            return ' '.join(p for p in partes if p)
        return self.nombre_razon_social
    
    @property
    def documento_completo(self):
        """Documento con DV si aplica"""
        if self.tipo_documento == 'NIT' and self.digito_verificacion:
            return f"{self.numero_documento}-{self.digito_verificacion}"
        return self.numero_documento

    class Meta:
        verbose_name = "Tercero"
        verbose_name_plural = "Terceros"
        ordering = ['nombre_razon_social']
        unique_together = ['empresa', 'numero_documento']