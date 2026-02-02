# 🎩 Don Peppini Contadore - Serializers de Terceros
from rest_framework import serializers
from .models import Tercero


class TerceroListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados de terceros"""
    nombre = serializers.CharField(source="nombre_razon_social", read_only=True)
    documento_completo = serializers.ReadOnlyField()
    nombre_completo = serializers.ReadOnlyField()
    
    class Meta:
        model = Tercero
        fields = [
            'id',
            'tipo_documento',
            'numero_documento',
            'digito_verificacion',
            'documento_completo',
            'nombre_razon_social',
            'nombre',
            'nombre_completo',
            'tipo_tercero',
            'activo',
        ]


class TerceroDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalle y edición"""
    nombre = serializers.CharField(source="nombre_razon_social", read_only=True)
    documento_completo = serializers.ReadOnlyField()
    nombre_completo = serializers.ReadOnlyField()
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    
    class Meta:
        model = Tercero
        fields = [
            'id',
            'empresa',
            'empresa_nombre',
            'tipo_documento',
            'numero_documento',
            'digito_verificacion',
            'documento_completo',
            'primer_apellido',
            'segundo_apellido',
            'primer_nombre',
            'otros_nombres',
            'nombre_razon_social',
            'nombre',
            'nombre_completo',
            'tipo_tercero',
            'direccion',
            'ciudad',
            'departamento',
            'codigo_municipio',
            'codigo_departamento',
            'codigo_pais',
            'telefono',
            'email',
            'activo',
            'fecha_creacion',
            'fecha_actualizacion'
        ]
        read_only_fields = ['id', 'fecha_creacion', 'fecha_actualizacion']


class TerceroCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear terceros"""
    
    class Meta:
        model = Tercero
        fields = [
            'empresa',
            'tipo_documento',
            'numero_documento',
            'digito_verificacion',
            'primer_apellido',
            'segundo_apellido',
            'primer_nombre',
            'otros_nombres',
            'nombre_razon_social',
            'tipo_tercero',
            'direccion',
            'ciudad',
            'departamento',
            'codigo_municipio',
            'codigo_departamento',
            'codigo_pais',
            'telefono',
            'email',
        ]
    
    def validate(self, data):
        """Validar que el documento sea único por empresa"""
        empresa = data.get('empresa')
        numero_documento = data.get('numero_documento')
        
        if Tercero.objects.filter(empresa=empresa, numero_documento=numero_documento).exists():
            raise serializers.ValidationError({
                'numero_documento': 'Ya existe un tercero con este documento en la empresa.'
            })
        
        return data


# Alias para compatibilidad
TerceroSerializer = TerceroDetailSerializer