# backend/contabilidad/admin.py
from django.contrib import admin
from .models import Cuenta, AsientoContable, MovimientoContable, PeriodoContable

#class MovimientoContableInline(admin.TabularInline):
  #  """
 #   Inline para editar movimientos directamente desde el asiento
 #   """
  #  model = MovimientoContable
   # extra = 2  # Muestra 2 líneas vacías por defecto
   # fields = ['cuenta', 'debito', 'credito']

@admin.register(Cuenta)
class CuentaAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "padre")
    search_fields = ("codigo", "nombre")
    list_filter = ("padre",)

class MovimientoInline(admin.TabularInline):
    model = MovimientoContable
    extra = 0

@admin.action(description="Rellenar año/periodo fiscal a partir de la fecha")
def rellenar_fiscal_desde_fecha(modeladmin, request, queryset):
    updated = 0
    for a in queryset:
        fy = a.fiscal_year or (a.fecha.year if a.fecha else None)
        fp = a.fiscal_period or (a.fecha.month if a.fecha else None)
        if fy and fp and (a.fiscal_year != fy or a.fiscal_period != fp):
            a.fiscal_year = fy
            a.fiscal_period = fp
            a.save(update_fields=['fiscal_year', 'fiscal_period'])
            updated += 1
    modeladmin.message_user(request, f"Asientos actualizados: {updated}")    

@admin.register(AsientoContable)
class AsientoContableAdmin(admin.ModelAdmin):
    list_display = ("id", "fecha", "fiscal_year", "fiscal_period", "concepto", "tercero", "estado")
    list_filter  = ("fiscal_year", "fiscal_period", "estado")
    search_fields = ("id", "concepto", "tercero__nombre_razon_social")
    date_hierarchy = "fecha"
    inlines = [MovimientoInline]
    

    fieldsets = (
        ('Información General', {
            'fields': ('fecha', 'tercero', 'concepto', 'descripcion', 'descripcion_adicional')
        }),
        ('Atribución fiscal', {
            'fields': ('fiscal_year', 'fiscal_period'),
            'description': "Año contable (Y) y periodo (1..12 o 13). Use 13 en la ventana de ajustes del año siguiente."
        }),
    )
    
    actions = [rellenar_fiscal_desde_fecha]

    def get_total_debitos(self, obj):
        """Calcula el total de débitos del asiento"""
        total = sum(m.debito for m in obj.movimientos.all())
        return f"${total:,.2f}"
    get_total_debitos.short_description = 'Total Débitos'
    
    def get_total_creditos(self, obj):
        """Calcula el total de créditos del asiento"""
        total = sum(m.credito for m in obj.movimientos.all())
        return f"${total:,.2f}"
    get_total_creditos.short_description = 'Total Créditos'


@admin.register(PeriodoContable)
class PeriodoAdmin(admin.ModelAdmin):
    # 👉 Ajustado a los campos reales del modelo
    list_display  = ("anio", "estado", "ajustes_inicio", "ajustes_fin",
                     "habilitar_mes13", "requiere_pins_en_ajustes")
    list_editable = ("estado", "ajustes_inicio", "ajustes_fin",
                     "habilitar_mes13", "requiere_pins_en_ajustes")
    search_fields = ("anio",)
    list_filter   = ("estado", "habilitar_mes13", "requiere_pins_en_ajustes")    

@admin.register(MovimientoContable)
class MovimientoContableAdmin(admin.ModelAdmin):
    """
    Configuración del admin para Movimientos Contables
    """
    list_display = ['asiento', 'cuenta', 'debito', 'credito']
    list_filter = ['asiento__fecha', 'cuenta']
    search_fields = ['asiento__concepto', 'cuenta__nombre']

