# 🎩 Don Peppini - Serializers Nómina
from rest_framework import serializers
from .models import (
    ParametrosNomina, Empleado, Nomina, LiquidacionEmpleado,
    DetalleHorasExtras, LiquidacionContrato,
    Vacaciones, PrimaSemestral, DetallePrima,
    CesantiasAnuales, DetalleCesantias,
)


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
            # Retención en la fuente
            'tiene_dependientes', 'deduccion_vivienda',
            'deduccion_medicina_prepagada', 'aportes_voluntarios_pension',
            'aportes_afc',
            'trabajo_remoto',
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
            'salud_empleado', 'pension_empleado', 'fsp', 'retencion_fuente', 'total_deducciones',
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
    liquidaciones = LiquidacionEmpleadoSerializer(many=True, read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    num_empleados = serializers.SerializerMethodField()
    asiento_numero = serializers.SerializerMethodField()
    asiento_id = serializers.IntegerField(source='asiento_contable_id', read_only=True)

    class Meta:
        model = Nomina
        fields = [
            'id', 'empresa', 'tipo', 'tipo_display', 'anio', 'mes',
            'fecha_liquidacion', 'fecha_pago', 'estado', 'estado_display', 'notas',
            'total_devengado', 'total_deducciones', 'total_neto', 'total_costo_empresa',
            'num_empleados', 'liquidaciones',
            'asiento_contable', 'asiento_id', 'asiento_numero',
        ]
        read_only_fields = [
            'id', 'total_devengado', 'total_deducciones',
            'total_neto', 'total_costo_empresa',
            'asiento_contable', 'asiento_id', 'asiento_numero',
        ]
        extra_kwargs = {
            'empresa': {'required': False},
        }

    def get_num_empleados(self, obj):
        return obj.liquidaciones.count()

    def get_asiento_numero(self, obj):
        if obj.asiento_contable:
            return f"#{obj.asiento_contable.numero}"
        return None


class LiquidacionContratoSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.tercero.nombre_razon_social', read_only=True)
    empleado_documento = serializers.CharField(source='empleado.tercero.numero_documento', read_only=True)
    empleado_cargo = serializers.CharField(source='empleado.cargo', read_only=True)
    motivo_display = serializers.CharField(source='get_motivo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    asiento_numero = serializers.SerializerMethodField()

    class Meta:
        model = LiquidacionContrato
        fields = [
            'id', 'empresa', 'empleado',
            'empleado_nombre', 'empleado_documento', 'empleado_cargo',
            'motivo', 'motivo_display', 'fecha_retiro', 'fecha_liquidacion',
            'estado', 'estado_display', 'notas',
            # Snapshot
            'salario_base', 'fecha_ingreso', 'tipo_contrato', 'salario_integral',
            'fecha_fin_contrato', 'dias_vacaciones_disfrutados', 'trabajo_remoto',
            # Conceptos
            'dias_ultimo_mes', 'salario_proporcional', 'auxilio_transporte_prop',
            'dias_vacaciones_pendientes', 'vacaciones',
            'dias_prima', 'prima_servicios',
            'dias_cesantias', 'cesantias',
            'intereses_cesantias', 'indemnizacion',
            # Deducciones
            'retencion_fuente', 'deduccion_salud', 'deduccion_pension', 'otros_descuentos',
            # Totales
            'total_devengado', 'total_deducciones', 'neto_pagar',
            'asiento_contable', 'asiento_numero',
        ]
        read_only_fields = [
            'id', 'fecha_liquidacion', 'salario_base', 'fecha_ingreso',
            'tipo_contrato', 'salario_integral', 'trabajo_remoto',
            'dias_ultimo_mes', 'salario_proporcional', 'auxilio_transporte_prop',
            'dias_vacaciones_pendientes', 'vacaciones',
            'dias_prima', 'prima_servicios',
            'dias_cesantias', 'cesantias',
            'intereses_cesantias', 'indemnizacion',
            'retencion_fuente', 'deduccion_salud', 'deduccion_pension',
            'total_devengado', 'total_deducciones', 'neto_pagar',
            'asiento_contable', 'asiento_numero',
        ]
        extra_kwargs = {
            'empresa': {'required': False},
        }

    def get_asiento_numero(self, obj):
        if obj.asiento_contable:
            return f"#{obj.asiento_contable.numero}"
        return None

    def validate_fecha_retiro(self, value):
        if self.instance and value < self.instance.fecha_ingreso:
            raise serializers.ValidationError(
                f"La fecha de retiro no puede ser anterior a la de ingreso ({self.instance.fecha_ingreso})")
        return value


class VacacionesSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.tercero.nombre_razon_social', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Vacaciones
        fields = ['id', 'empresa', 'empleado', 'empleado_nombre',
                  'fecha_inicio', 'fecha_fin', 'dias_habiles',
                  'estado', 'estado_display', 'notas', 'created_at']
        extra_kwargs = {'empresa': {'required': False}}


class DetallePrimaSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.tercero.nombre_razon_social', read_only=True)

    class Meta:
        model = DetallePrima
        fields = ['id', 'empleado', 'empleado_nombre', 'salario_base',
                  'auxilio_transporte', 'dias_trabajados', 'valor_prima']


class PrimaSemestralSerializer(serializers.ModelSerializer):
    detalles = DetallePrimaSerializer(many=True, read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    asiento_numero = serializers.SerializerMethodField()

    class Meta:
        model = PrimaSemestral
        fields = ['id', 'empresa', 'anio', 'semestre', 'fecha_liquidacion',
                  'estado', 'estado_display', 'total', 'detalles',
                  'asiento_contable', 'asiento_numero']
        extra_kwargs = {'empresa': {'required': False}}

    def get_asiento_numero(self, obj):
        if obj.asiento_contable:
            return f"#{obj.asiento_contable.numero}"
        return None


class DetalleCesantiasSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.tercero.nombre_razon_social', read_only=True)

    class Meta:
        model = DetalleCesantias
        fields = ['id', 'empleado', 'empleado_nombre', 'salario_base',
                  'auxilio_transporte', 'dias_trabajados',
                  'valor_cesantias', 'valor_intereses']


class CesantiasAnualesSerializer(serializers.ModelSerializer):
    detalles = DetalleCesantiasSerializer(many=True, read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    asiento_numero = serializers.SerializerMethodField()

    class Meta:
        model = CesantiasAnuales
        fields = ['id', 'empresa', 'anio', 'fecha_liquidacion',
                  'estado', 'estado_display', 'total_cesantias', 'total_intereses',
                  'detalles', 'asiento_contable', 'asiento_numero']
        extra_kwargs = {'empresa': {'required': False}}

    def get_asiento_numero(self, obj):
        if obj.asiento_contable:
            return f"#{obj.asiento_contable.numero}"
        return None
