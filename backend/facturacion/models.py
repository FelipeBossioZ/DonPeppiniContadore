# 🎩 Don Peppini Contadore - Modelos de Facturación

from django.db import models
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from decimal import Decimal
from terceros.models import Tercero


class Factura(models.Model):
    """Factura de venta por empresa"""
    
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('emitida', 'Emitida'),
        ('pagada', 'Pagada'),
        ('anulada', 'Anulada'),
    ]

    # === RELACIÓN CON EMPRESA ===
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        related_name='facturas',
        verbose_name="Empresa"
    )
    
    # === NUMERACIÓN ===
    prefijo = models.CharField(max_length=10, blank=True, null=True, verbose_name="Prefijo")
    numero = models.PositiveIntegerField(verbose_name="Número")
    
    # === CLIENTE Y FECHAS ===
    cliente = models.ForeignKey(Tercero, on_delete=models.PROTECT, related_name='facturas')
    fecha_emision = models.DateField()
    fecha_vencimiento = models.DateField()
    
    # === TOTALES ===
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    impuestos = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    # === ESTADO ===
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='borrador')
    
    # === FACTURACIÓN ELECTRÓNICA ===
    cufe = models.CharField(max_length=255, blank=True, null=True, unique=True, verbose_name="CUFE")
    qr_code = models.TextField(blank=True, null=True, verbose_name="Código QR")
    
    # === AUDITORÍA ===
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def calcular_totales(self):
        """Recalcula los totales de la factura"""
        subtotal = Decimal('0')
        impuestos = Decimal('0')
        
        for item in self.items.all():
            subtotal_item = item.cantidad * item.precio_unitario
            subtotal += subtotal_item
            if item.lleva_iva:
                impuestos += subtotal_item * Decimal('0.19')
        
        self.subtotal = subtotal
        self.impuestos = impuestos.quantize(Decimal('0.01'))
        self.total = subtotal + impuestos
        self.save()
    
    def save(self, *args, **kwargs):
        # Auto-numerar facturas por empresa/prefijo
        if not self.numero:
            ultima = Factura.objects.filter(
                empresa=self.empresa,
                prefijo=self.prefijo
            ).order_by('-numero').first()
            self.numero = (ultima.numero + 1) if ultima else 1
        super().save(*args, **kwargs)

    def __str__(self):
        prefijo = f"{self.prefijo}-" if self.prefijo else ""
        return f"Factura {prefijo}{self.numero} - {self.cliente.nombre_razon_social}"

    class Meta:
        verbose_name = "Factura"
        verbose_name_plural = "Facturas"
        ordering = ['-fecha_emision', '-numero']
        unique_together = ['empresa', 'prefijo', 'numero']


class ItemFactura(models.Model):
    """Línea de factura"""
    factura = models.ForeignKey(Factura, on_delete=models.CASCADE, related_name='items')
    descripcion = models.CharField(max_length=255)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = models.DecimalField(max_digits=15, decimal_places=2)
    lleva_iva = models.BooleanField(default=True, verbose_name="¿Lleva IVA?")
    subtotal_linea = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        self.subtotal_linea = self.cantidad * self.precio_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Item: {self.descripcion} en Factura #{self.factura.numero}"

    class Meta:
        verbose_name = "Ítem de Factura"
        verbose_name_plural = "Ítems de Factura"


@receiver(post_save, sender=ItemFactura)
def actualizar_totales_factura_on_save(sender, instance, **kwargs):
    instance.factura.calcular_totales()

@receiver(post_delete, sender=ItemFactura)
def actualizar_totales_factura_on_delete(sender, instance, **kwargs):
    instance.factura.calcular_totales()