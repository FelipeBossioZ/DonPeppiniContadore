# 🎩 Don Peppini Contadore - Serializers de Terceros (GLOBALES)
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
            'es_autoretenedor',
            'es_gran_contribuyente',
            'es_declarante',
        ]


class TerceroDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalle y edición"""
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
            'es_autoretenedor',
            'es_gran_contribuyente',
            'es_declarante',
            'fecha_creacion',
            'fecha_actualizacion'
        ]
        read_only_fields = ['id', 'fecha_creacion', 'fecha_actualizacion']


class TerceroCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear terceros - SIN campo empresa (globales)"""

    class Meta:
        model = Tercero
        fields = [
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
            'es_autoretenedor',
            'es_gran_contribuyente',
            'es_declarante',
        ]

    def validate_numero_documento(self, value):
        """Validar que el documento sea único globalmente"""
        instance = getattr(self, 'instance', None)
        qs = Tercero.objects.filter(numero_documento=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Ya existe un tercero con este número de documento.'
            )
        return value


# Alias para compatibilidad
TerceroSerializer = TerceroDetailSerializer
