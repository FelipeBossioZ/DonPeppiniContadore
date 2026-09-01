# 🎩 Don Peppini Contadore - Serializers de Empresas
from rest_framework import serializers
from .models import Empresa, ConfiguracionEmpresa


class ConfiguracionEmpresaSerializer(serializers.ModelSerializer):
    has_logo = serializers.SerializerMethodField()

    class Meta:
        model = ConfiguracionEmpresa
        fields = ['pin_contador', 'pin_gerente', 'politicas_contables', 'notas_eeff_plantilla', 'has_logo']
        extra_kwargs = {
            'pin_contador': {'write_only': True},
            'pin_gerente': {'write_only': True},
        }

    def get_has_logo(self, obj):
        return bool(obj.logo)


class EmpresaListSerializer(serializers.ModelSerializer):
    """Serializer para listados"""
    class Meta:
        model = Empresa
        fields = ['id', 'nit', 'razon_social', 'nombre_comercial', 'tipo_persona', 'grupo_niif', 'activa']


class EmpresaDetailSerializer(serializers.ModelSerializer):
    """Serializer completo"""
    configuracion = ConfiguracionEmpresaSerializer(read_only=True)
    nit_sin_dv = serializers.ReadOnlyField()
    digito_verificacion = serializers.ReadOnlyField()
    
    class Meta:
        model = Empresa
        fields = '__all__'
        read_only_fields = ['fecha_creacion', 'fecha_actualizacion']


class EmpresaCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear empresas"""
    
    class Meta:
        model = Empresa
        fields = [
            'nit', 'razon_social', 'nombre_comercial',
            'tipo_persona', 'regimen', 'grupo_niif', 'tipo_contribuyente',
            'actividad_principal', 'descripcion_actividad',
            'direccion', 'ciudad', 'departamento', 'codigo_municipio', 'codigo_departamento',
            'telefono', 'email',
            'representante_legal', 'documento_representante',
            'contador_nombre', 'contador_documento', 'contador_tarjeta',
            'fecha_inicio_actividades', 'periodo_contable_actual'
        ]
    
    def create(self, validated_data):
        empresa = Empresa.objects.create(**validated_data)
        ConfiguracionEmpresa.objects.create(empresa=empresa)
        return empresa
