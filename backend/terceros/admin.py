# backend/terceros/admin.py
from django.contrib import admin
from .models import Tercero

@admin.register(Tercero)
class TerceroAdmin(admin.ModelAdmin):
    """
    Configuración del panel de administración para Terceros
    """
    list_display = ['numero_documento', 'nombre_razon_social', 'tipo_documento', 'telefono', 'email']
    list_filter = ['tipo_documento', 'fecha_creacion']
    search_fields = ['numero_documento', 'nombre_razon_social', 'email']
    ordering = ['nombre_razon_social']
    
    fieldsets = (
        ('Información Principal', {
            'fields': ('tipo_documento', 'numero_documento', 'nombre_razon_social')
        }),
        ('Contacto', {
            'fields': ('direccion', 'telefono', 'email')
        }),
        ('Fechas', {
            'fields': ('fecha_creacion', 'fecha_actualizacion'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('fecha_creacion', 'fecha_actualizacion')