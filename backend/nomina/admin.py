from django.contrib import admin
from .models import ParametrosNomina, Empleado, Nomina, LiquidacionEmpleado, DetalleHorasExtras


@admin.register(ParametrosNomina)
class ParametrosNominaAdmin(admin.ModelAdmin):
    list_display = ['anio', 'smlv', 'auxilio_transporte']


class LiquidacionInline(admin.TabularInline):
    model = LiquidacionEmpleado
    extra = 0
    readonly_fields = ['empleado', 'total_devengado', 'total_deducciones', 'neto_pagar', 'costo_empresa']


@admin.register(Empleado)
class EmpleadoAdmin(admin.ModelAdmin):
    list_display = ['tercero', 'empresa', 'cargo', 'salario_base', 'tipo_contrato', 'activo']
    list_filter = ['empresa', 'activo', 'tipo_contrato']
    search_fields = ['tercero__nombre_razon_social', 'tercero__numero_documento']


@admin.register(Nomina)
class NominaAdmin(admin.ModelAdmin):
    list_display = ['empresa', 'tipo', 'mes', 'anio', 'estado', 'total_neto', 'total_costo_empresa']
    list_filter = ['empresa', 'estado', 'anio']
    inlines = [LiquidacionInline]


@admin.register(LiquidacionEmpleado)
class LiquidacionEmpleadoAdmin(admin.ModelAdmin):
    list_display = ['empleado', 'nomina', 'total_devengado', 'total_deducciones', 'neto_pagar']
    list_filter = ['nomina__empresa', 'nomina__anio', 'nomina__mes']
