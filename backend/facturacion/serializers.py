# backend/facturacion/serializers.py
from rest_framework import serializers
from django.db import transaction
from decimal import Decimal
from .models import Factura, ItemFactura

# Tasa de IVA estándar en Colombia
IVA_RATE = Decimal('0.19')

class ItemFacturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemFactura
        fields = ['id', 'descripcion', 'cantidad', 'precio_unitario', 'lleva_iva', 'subtotal_linea']
        read_only_fields = ['id', 'subtotal_linea']

class FacturaSerializer(serializers.ModelSerializer):
    items = ItemFacturaSerializer(many=True)
    cliente_nombre = serializers.CharField(source='cliente.nombre_razon_social', read_only=True)

    class Meta:
        model = Factura
        fields = [
            'id', 'cliente', 'cliente_nombre', 'fecha_emision', 'fecha_vencimiento',
            'subtotal', 'impuestos', 'total', 'estado', 'cufe', 'qr_code', 'items'
        ]
        read_only_fields = ['id', 'subtotal', 'impuestos', 'total', 'cufe', 'qr_code', 'cliente_nombre']

    # ----- CREAR (ya lo tenías) -----
    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        factura = Factura.objects.create(**validated_data)

        subtotal_factura = Decimal('0.00')
        impuestos_factura = Decimal('0.00')

        for item_data in items_data:
            item = ItemFactura.objects.create(factura=factura, **item_data)  # usa save() -> calcula subtotal_linea
            subtotal_factura += item.subtotal_linea
            if item.lleva_iva:
                impuestos_factura += item.subtotal_linea * IVA_RATE

        factura.subtotal = subtotal_factura
        factura.impuestos = impuestos_factura.quantize(Decimal('0.01'))
        factura.total = subtotal_factura + impuestos_factura
        factura.save()

        return factura

    # ----- EDITAR (nuevo) -----
    @transaction.atomic
    def update(self, instance: Factura, validated_data):
        """
        Edita encabezado y, si 'items' viene en el payload, reemplaza TODOS los ítems.
        Si haces PATCH y no envías 'items', los ítems se mantienen igual.
        """
        items_data = validated_data.pop('items', None)

        # actualizar campos del encabezado
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            # Reemplazo simple: borro y creo (suficiente para ahora)
            instance.items.all().delete()

            subtotal_factura = Decimal('0.00')
            impuestos_factura = Decimal('0.00')

            for item_data in items_data:
                item = ItemFactura.objects.create(factura=instance, **item_data)
                subtotal_factura += item.subtotal_linea
                if item.lleva_iva:
                    impuestos_factura += item.subtotal_linea * IVA_RATE

            instance.subtotal = subtotal_factura
            instance.impuestos = impuestos_factura.quantize(Decimal('0.01'))
            instance.total = subtotal_factura + impuestos_factura
            instance.save()

        return instance

    # (Opcional) Si quieres evitar que una factura NO borrador sea editada:
    def validate(self, attrs):
        # Solo aplica cuando ya existe (update)
        if self.instance and self.instance.estado != 'borrador':
            # permite cambiar estado a 'emitida/pagada/anulada', pero bloquea edición de contenido si envían items
            if 'items' in self.initial_data:
                raise serializers.ValidationError("No puedes modificar los ítems si la factura no está en 'borrador'.")
        return attrs
