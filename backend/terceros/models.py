# 🎩 Don Peppini Contadore - Modelo de Terceros (GLOBALES)
from django.db import models


class Tercero(models.Model):
    """
    Tercero (cliente, proveedor, empleado, socio).
    🎩 GLOBAL: Compartido entre todas las empresas.
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

    # === IDENTIFICACIÓN ===
    tipo_documento = models.CharField(max_length=3, choices=TIPO_DOCUMENTO_CHOICES, verbose_name="Tipo Doc.")
    numero_documento = models.CharField(max_length=20, unique=True, verbose_name="Número Doc.")
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
    es_autoretenedor = models.BooleanField(default=False, verbose_name="Autoretenedor")
    regimen_simple = models.BooleanField(default=False, verbose_name="Regimen Simple de Tributacion (RST)")
    es_gran_contribuyente = models.BooleanField(default=False, verbose_name="Gran Contribuyente")
    es_declarante = models.BooleanField(default=True, verbose_name="Declarante de Renta")
    regimen_simple = models.BooleanField(default=False, verbose_name="Régimen Simple de Tributación")
    es_compartido = models.BooleanField(default=False, verbose_name="Compartido (todas las empresas)")
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Auto-calcular dígito de verificación
        if self.numero_documento:
            self.digito_verificacion = self._calcular_dv(self.numero_documento)
        super().save(*args, **kwargs)

    @staticmethod
    def _calcular_dv(nit):
        """Algoritmo Módulo 11 DIAN Colombia"""
        import re
        s = re.sub(r'\D', '', str(nit))
        if not s:
            return ''
        primos = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3]
        padded = s.zfill(15)
        suma = sum(int(padded[i]) * primos[i] for i in range(15))
        residuo = suma % 11
        if residuo == 0:
            return '0'
        if residuo == 1:
            return '1'
        return str(11 - residuo)

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
        # SIN unique_together - numero_documento ya es unique global

class EmpresaTercero(models.Model):
    """Relación many-to-many entre Empresas y Terceros (compartir tercero)."""
    empresa = models.ForeignKey('empresas.Empresa', on_delete=models.CASCADE, related_name='terceros_rel')
    tercero = models.ForeignKey('Tercero', on_delete=models.CASCADE, related_name='empresas_rel')

    class Meta:
        unique_together = ['empresa', 'tercero']
        verbose_name = "Empresa-Tercero"
        verbose_name_plural = "Empresas-Terceros"

    def __str__(self):
        return f"{self.empresa} <-> {self.tercero}"
