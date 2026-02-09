# 🎩 Don Peppini - Serializers Nómina
from rest_framework import serializers
from .models import ParametrosNomina, Empleado, Nomina, LiquidacionEmpleado, DetalleHorasExtras


class ParametrosNominaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametrosNomina
        fields = '__all__'


class EmpleadoSerializer(serializers.ModelSerializer):
    tercero_nombre = serializers.CharField(source='tercero.nombre_razon_social', read_only=True)
    tercero_documento = serializers.CharField(source='tercero.numero_documento', read_only=True)
    tiene_auxilio = serializers.BooleanField(source='tiene_auxilio_transporte', read_only=True)

    class Meta:
        model = Empleado
        fields = [
            'id', 'empresa', 'tercero', 'tercero_nombre', 'tercero_documento',
            'tipo_contrato', 'fecha_ingreso', 'fecha_retiro',
            'salario_base', 'salario_integral', 'nivel_arl',
            'eps', 'afp', 'caja_compensacion', 'arl_nombre',
            'cargo', 'centro_costo', 'activo', 'tiene_auxilio',
        ]
        read_only_fields = ['id', 'tercero_nombre', 'tercero_documento', 'tiene_auxilio']
        extra_kwargs = {
            'empresa': {'required': False},
        }


class DetalleHorasExtrasSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = DetalleHorasExtras
        fields = [
            'id', 'tipo', 'tipo_display', 'cantidad_horas',
            'valor_hora', 'porcentaje_recargo', 'valor_total',
        ]
        read_only_fields = ['id', 'valor_hora', 'porcentaje_recargo', 'valor_total']


class LiquidacionEmpleadoSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.tercero.nombre_razon_social', read_only=True)
    empleado_documento = serializers.CharField(source='empleado.tercero.numero_documento', read_only=True)
    empleado_cargo = serializers.CharField(source='empleado.cargo', read_only=True)
    detalle_horas = DetalleHorasExtrasSerializer(many=True, read_only=True)

    class Meta:
        model = LiquidacionEmpleado
        fields = [
            'id', 'nomina', 'empleado', 'empleado_nombre', 'empleado_documento', 'empleado_cargo',
            'dias_trabajados', 'salario_base', 'auxilio_transporte',
            # Devengados
            'salario_devengado', 'horas_extras', 'recargos', 'comisiones',
            'bonificaciones', 'otros_devengados', 'total_devengado',
            # Deducciones
            'salud_empleado', 'pension_empleado', 'fsp', 'retencion_fuente',
            'libranzas', 'otros_descuentos', 'total_deducciones',
            # Neto
            'neto_pagar',
            # Aportes empleador
            'salud_empleador', 'pension_empleador', 'arl',
            'caja_compensacion', 'sena', 'icbf',
            # Provisiones
            'provision_prima', 'provision_cesantias',
            'provision_int_cesantias', 'provision_vacaciones',
            # Costo total
            'costo_empresa',
            # Detalle
            'detalle_horas',
        ]
        read_only_fields = [
            'id', 'salario_base', 'auxilio_transporte',
            'salario_devengado', 'total_devengado',
            'salud_empleado', 'pension_empleado', 'fsp', 'total_deducciones',
            'neto_pagar',
            'salud_empleador', 'pension_empleador', 'arl',
            'caja_compensacion', 'sena', 'icbf',
            'provision_prima', 'provision_cesantias',
            'provision_int_cesantias', 'provision_vacaciones',
            'costo_empresa',
        ]


class LiquidacionResumenSerializer(serializers.ModelSerializer):
    """Versión compacta para la lista de liquidaciones."""
    empleado_nombre = serializers.CharField(source='empleado.tercero.nombre_razon_social', read_only=True)
    empleado_cargo = serializers.CharField(source='empleado.cargo', read_only=True)

    class Meta:
        model = LiquidacionEmpleado
        fields = [
            'id', 'empleado', 'empleado_nombre', 'empleado_cargo',
            'dias_trabajados', 'total_devengado', 'total_deducciones',
            'neto_pagar', 'costo_empresa',
        ]


class NominaSerializer(serializers.ModelSerializer):
    liquidaciones = LiquidacionResumenSerializer(many=True, read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    num_empleados = serializers.SerializerMethodField()

    class Meta:
        model = Nomina
        fields = [
            'id', 'empresa', 'tipo', 'tipo_display', 'anio', 'mes',
            'fecha_liquidacion', 'fecha_pago', 'estado', 'estado_display', 'notas',
            'total_devengado', 'total_deducciones', 'total_neto', 'total_costo_empresa',
            'num_empleados', 'liquidaciones',
        ]
        read_only_fields = [
            'id', 'total_devengado', 'total_deducciones',
            'total_neto', 'total_costo_empresa',
        ]
        extra_kwargs = {
            'empresa': {'required': False},
        }

    def get_num_empleados(self, obj):
        return obj.liquidaciones.count()
