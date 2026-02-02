# 🎩 Don Peppini Contadore - Admin de Empresas
from django.contrib import admin
from .models import Empresa, ConfiguracionEmpresa


class ConfiguracionEmpresaInline(admin.StackedInline):
    model = ConfiguracionEmpresa
    can_delete = False


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ['razon_social', 'nit', 'tipo_persona', 'grupo_niif', 'activa']
    list_filter = ['activa', 'tipo_persona', 'grupo_niif', 'regimen']
    search_fields = ['razon_social', 'nit', 'nombre_comercial']
    inlines = [ConfiguracionEmpresaInline]
    
    fieldsets = (
        ('Identificación', {
            'fields': ('nit', 'razon_social', 'nombre_comercial')
        }),
        ('Clasificación Tributaria', {
            'fields': ('tipo_persona', 'regimen', 'grupo_niif', 'tipo_contribuyente')
        }),
        ('Actividad Económica', {
            'fields': ('actividad_principal', 'descripcion_actividad')
        }),
        ('Ubicación', {
            'fields': ('direccion', 'ciudad', 'departamento', 'codigo_municipio', 'codigo_departamento')
        }),
        ('Contacto', {
            'fields': ('telefono', 'email')
        }),
        ('Representante Legal', {
            'fields': ('representante_legal', 'documento_representante')
        }),
        ('Contador', {
            'fields': ('contador_nombre', 'contador_documento', 'contador_tarjeta')
        }),
        ('Configuración', {
            'fields': ('fecha_inicio_actividades', 'periodo_contable_actual', 'activa')
        }),
    )
