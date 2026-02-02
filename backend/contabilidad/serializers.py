
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from .models import Cuenta, AsientoContable, MovimientoContable, PeriodoContable
from terceros.models import Tercero 
from datetime import date


TWOPLACES = Decimal("0.01")



# --- Plan de cuentas ---
class CuentaSerializer(serializers.ModelSerializer):
    padre = serializers.SlugRelatedField(slug_field="codigo", read_only=True)

    class Meta:
        model = Cuenta
        fields = ["codigo", "nombre", "padre"]  # no exponemos 'id'


# --- Movimientos ---
class MovimientoContableSerializer(serializers.ModelSerializer):
    # Permite mandar código en lugar de FK de cuenta
    cuenta_codigo = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = MovimientoContable
        fields = ["id", "cuenta", "cuenta_codigo", "debito", "credito"]
        read_only_fields = ["id"]
        extra_kwargs = {
            "cuenta": {"required": False},  # porque podemos usar cuenta_codigo
        }

    def validate(self, attrs):
        # cuenta por id o por código
        if not attrs.get("cuenta") and not attrs.get("cuenta_codigo"):
            raise serializers.ValidationError("Debe enviar 'cuenta' (id) o 'cuenta_codigo' (código).")

        # normalizar a 2 decimales y validar exclusión
        deb = Decimal(attrs.get("debito") or 0).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        cre = Decimal(attrs.get("credito") or 0).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        attrs["debito"], attrs["credito"] = deb, cre

        if deb <= 0 and cre <= 0:
            raise serializers.ValidationError("Cada movimiento debe tener débito o crédito > 0.")
        if deb > 0 and cre > 0:
            raise serializers.ValidationError("Un movimiento no puede tener débito y crédito a la vez.")
        return attrs

    def _resolve_cuenta(self, attrs):
        code = attrs.pop("cuenta_codigo", None)
        if code and not attrs.get("cuenta"):
            try:
                attrs["cuenta"] = Cuenta.objects.get(codigo=code)
            except Cuenta.DoesNotExist:
                raise serializers.ValidationError({"cuenta_codigo": f"No existe la cuenta con código '{code}'."})
        return attrs

    def create(self, validated_data):
        validated_data = self._resolve_cuenta(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._resolve_cuenta(validated_data)
        return super().update(instance, validated_data)


# --- Asiento con movimientos anidados ---
class AsientoContableSerializer(serializers.ModelSerializer):
    movimientos = MovimientoContableSerializer(many=True)
    tercero = serializers.PrimaryKeyRelatedField(queryset=Tercero.objects.all())

    class Meta:
        model = AsientoContable
        fields = [
            "id", "fecha", "concepto", "tercero",
            "descripcion", "descripcion_adicional",
            "fiscal_year", "fiscal_period",        # <<< AÑADIR
            "movimientos", "estado", "anulado_por", "anulado_en", "anulacion_motivo", "ajusta_a",
        ]
        read_only_fields = ["id", "estado", "anulado_por", "anulado_en", "ajusta_a"]

    def validate(self, attrs):
        errors = {}

        # --- Fecha obligatoria
        fecha = attrs.get("fecha") or getattr(self.instance, "fecha", None)
        if not fecha:
            errors["fecha"] = "La fecha es obligatoria."

        # --- Tercero obligatorio
        tercero = attrs.get("tercero") or getattr(self.instance, "tercero", None) or self.initial_data.get("tercero")
        if not tercero:
            errors["tercero"] = "Seleccione un tercero."

        # --- Movimientos (tu lógica actual, intacta)
        movs_in = attrs.get("movimientos") or self.initial_data.get("movimientos", [])
        if not movs_in:
            errors["movimientos"] = ["Debe registrar al menos un movimiento."]
        else:
            fila_errores = []
            total_deb = Decimal("0.00")
            total_cre = Decimal("0.00")
            for i, m in enumerate(movs_in, start=1):
                get = m.get if isinstance(m, dict) else lambda k, d=None: getattr(m, k, d)
                code = get("cuenta_codigo")
                cuenta = get("cuenta")
                if not cuenta and not code:
                    fila_errores.append(f"Fila {i}: falta 'cuenta' o 'cuenta_codigo'.")
                # (si quieres validar existencia de code aquí, mantén tu lógica)
                deb = Decimal(str(get("debito") or 0)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
                cre = Decimal(str(get("credito") or 0)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
                if deb <= 0 and cre <= 0: fila_errores.append(f"Fila {i}: debe tener valor en Débito o en Crédito.")
                if deb > 0 and cre > 0:   fila_errores.append(f"Fila {i}: no puede tener Débito y Crédito a la vez.")
                total_deb += deb; total_cre += cre
            if fila_errores: errors["movimientos"] = fila_errores
            if total_deb.quantize(TWOPLACES) != total_cre.quantize(TWOPLACES):
                errors.setdefault("movimientos", []).append("El asiento no cuadra (∑débitos ≠ ∑créditos).")

        if errors:
            raise serializers.ValidationError(errors)

        # --- Validación de PERÍODO CONTABLE / Mes 13
        fy = attrs.get("fiscal_year")   or (fecha.year if fecha else None)
        fp = attrs.get("fiscal_period") or (fecha.month if fecha else None)
        p = PeriodoContable.ensure(fy)

        if fp == 13:
            if not p.habilitar_mes13:
                raise serializers.ValidationError("Mes 13 deshabilitado para este año.")
            # La FECHA real debe estar dentro de la ventana de ajustes del año 'fy'
            if not p.in_ajustes(fecha):
                raise serializers.ValidationError("Mes 13 solo permitido dentro de la ventana de ajustes del período.")
        else:
            if p.estado == 'cerrado':
                raise serializers.ValidationError(f"Período {fy} cerrado. Use Mes 13 durante la ventana de ajustes.")

        attrs["fiscal_year"]   = fy
        attrs["fiscal_period"] = fp
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        movimientos_data = validated_data.pop("movimientos", [])
        asiento = AsientoContable.objects.create(**validated_data)
        for m in movimientos_data:
            m["asiento"] = asiento
            MovimientoContableSerializer().create(m)
        return asiento

    @transaction.atomic
    def update(self, instance, validated_data):
        movimientos_data = validated_data.pop("movimientos", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if movimientos_data is not None:
            instance.movimientos.all().delete()
            for m in movimientos_data:
                m["asiento"] = instance
                MovimientoContableSerializer().create(m)
        return instance