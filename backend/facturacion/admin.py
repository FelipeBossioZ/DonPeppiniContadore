# backend/facturacion/admin.py
from django.contrib import admin
from .models import Factura, ItemFactura

class ItemFacturaInline(admin.TabularInline):
    """
    Inline para agregar items directamente en la factura
    """
    model = ItemFactura
    extra = 1
    fields = ['descripcion', 'cantidad', 'precio_unitario', 'lleva_iva', 'subtotal_linea']
    readonly_fields = ['subtotal_linea']

@admin.register(Factura)
class FacturaAdmin(admin.ModelAdmin):
    """
    Configuración del admin para Facturas
    """
    list_display = ['id', 'cliente', 'fecha_emision', 'fecha_vencimiento', 'total', 'estado', 'get_estado_badge']
    list_filter = ['estado', 'fecha_emision', 'fecha_vencimiento']
    search_fields = ['id', 'cliente__nombre_razon_social', 'cliente__numero_documento']
    date_hierarchy = 'fecha_emision'
    inlines = [ItemFacturaInline]
    readonly_fields = ['subtotal', 'impuestos', 'total', 'cufe', 'qr_code', 'fecha_creacion', 'fecha_actualizacion']
    
    fieldsets = (
        ('Información General', {
            'fields': ('cliente', 'estado')
        }),
        ('Fechas', {
            'fields': ('fecha_emision', 'fecha_vencimiento')
        }),
        ('Totales', {
            'fields': ('subtotal', 'impuestos', 'total'),
            'classes': ('wide',)
        }),
        ('Facturación Electrónica', {
            'fields': ('cufe', 'qr_code'),
            'classes': ('collapse',)
        }),
        ('Auditoría', {
            'fields': ('fecha_creacion', 'fecha_actualizacion'),
            'classes': ('collapse',)
        }),
    )
    
    def get_estado_badge(self, obj):
        """Muestra el estado con colores"""
        colors = {
            'borrador': 'gray',
            'emitida': 'blue',
            'pagada': 'green',
            'anulada': 'red'
        }
        color = colors.get(obj.estado, 'gray')
        return f'<span style="background-color: {color}; color: white; padding: 3px 10px; border-radius: 3px;">{obj.estado.upper()}</span>'
    
    get_estado_badge.short_description = 'Estado'
    get_estado_badge.allow_tags = True
    
    actions = ['marcar_como_emitida', 'marcar_como_pagada', 'marcar_como_anulada']
    
    def marcar_como_emitida(self, request, queryset):
        """Acción para marcar facturas como emitidas"""
        queryset.update(estado='emitida')
        self.message_user(request, f'{queryset.count()} facturas marcadas como emitidas.')
    marcar_como_emitida.short_description = 'Marcar como Emitida'
    
    def marcar_como_pagada(self, request, queryset):
        """Acción para marcar facturas como pagadas"""
        queryset.update(estado='pagada')
        self.message_user(request, f'{queryset.count()} facturas marcadas como pagadas.')
    marcar_como_pagada.short_description = 'Marcar como Pagada'
    
    def marcar_como_anulada(self, request, queryset):
        """Acción para anular facturas"""
        queryset.update(estado='anulada')
        self.message_user(request, f'{queryset.count()} facturas anuladas.')
    marcar_como_anulada.short_description = 'Anular Factura'

@admin.register(ItemFactura)
class ItemFacturaAdmin(admin.ModelAdmin):
    """
    Configuración del admin para Items de Factura
    """
    list_display = ['factura', 'descripcion', 'cantidad', 'precio_unitario', 'subtotal_linea', 'lleva_iva']
    list_filter = ['lleva_iva', 'factura__estado']
    search_fields = ['descripcion', 'factura__id']
    readonly_fields = ['subtotal_linea']