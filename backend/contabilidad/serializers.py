
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from .models import Cuenta, AsientoContable, MovimientoContable, PeriodoContable
from terceros.models import Tercero
from datetime import date


TWOPLACES = Decimal("0.01")


# --- Plan de cuentas (lectura + escritura) ---
class CuentaSerializer(serializers.ModelSerializer):
    padre = serializers.SlugRelatedField(
        slug_field="codigo", read_only=True
    )
    padre_codigo = serializers.CharField(
        write_only=True, required=False, allow_blank=True,
        help_text="Código del padre. Se resuelve automáticamente si se omite."
    )

    class Meta:
        model = Cuenta
        fields = [
            "id", "codigo", "nombre", "naturaleza", "tipo",
            "nivel", "activa", "padre", "padre_codigo",
            "empresa",
        ]
        read_only_fields = ["id", "padre", "nivel", "tipo"]
        extra_kwargs = {
            "empresa": {"required": False},
            "naturaleza": {"required": False},
        }

    def _auto_fields(self, codigo):
        """Determinar naturaleza, tipo, nivel y padre automáticamente por código."""
        result = {}
        if not codigo:
            return result

        # Naturaleza por primer dígito (NIIF Colombia)
        first = codigo[0]
        if first in ("2", "3", "4"):
            result["naturaleza"] = "C"
        else:
            result["naturaleza"] = "D"

        # Tipo y nivel por longitud
        length = len(codigo)
        tipo_map = {1: "Clase", 2: "Grupo", 4: "Cuenta", 6: "Subcuenta"}
        result["tipo"] = tipo_map.get(length, "Auxiliar")
        result["nivel"] = min(length, 6)

        return result

    def _resolve_padre(self, codigo, empresa):
        """Buscar cuenta padre más cercana por prefijo."""
        if not codigo or len(codigo) <= 1:
            return None
        for end in range(len(codigo) - 1, 0, -1):
            prefix = codigo[:end]
            padre = Cuenta.objects.filter(empresa=empresa, codigo=prefix).first()
            if padre:
                return padre
        return None

    def create(self, validated_data):
        padre_codigo = validated_data.pop("padre_codigo", None)
        codigo = validated_data.get("codigo", "")

        # Auto-determinar campos
        auto = self._auto_fields(codigo)
        for k, v in auto.items():
            validated_data.setdefault(k, v)

        # Resolver padre
        empresa = validated_data.get("empresa")
        if padre_codigo:
            try:
                validated_data["padre"] = Cuenta.objects.get(
                    empresa=empresa, codigo=padre_codigo
                )
            except Cuenta.DoesNotExist:
                raise serializers.ValidationError(
                    {"padre_codigo": f"No existe cuenta '{padre_codigo}' en esta empresa."}
                )
        else:
            validated_data["padre"] = self._resolve_padre(codigo, empresa)

        return super().create(validated_data)

    def update(self, instance, validated_data):
        padre_codigo = validated_data.pop("padre_codigo", None)
        codigo = validated_data.get("codigo", instance.codigo)

        if codigo != instance.codigo:
            auto = self._auto_fields(codigo)
            for k, v in auto.items():
                validated_data.setdefault(k, v)

        if padre_codigo is not None:
            empresa = validated_data.get("empresa", instance.empresa)
            if padre_codigo == "":
                validated_data["padre"] = None
            else:
                try:
                    validated_data["padre"] = Cuenta.objects.get(
                        empresa=empresa, codigo=padre_codigo
                    )
                except Cuenta.DoesNotExist:
                    raise serializers.ValidationError(
                        {"padre_codigo": f"No existe cuenta '{padre_codigo}'."}
                    )

        return super().update(instance, validated_data)


# --- Movimientos (ahora con tercero por línea) ---
class MovimientoContableSerializer(serializers.ModelSerializer):
    cuenta_codigo = serializers.CharField(write_only=True, required=False)
    cuenta_codigo_display = serializers.CharField(source='cuenta.codigo', read_only=True)
    cuenta_nombre = serializers.CharField(source='cuenta.nombre', read_only=True)
    tercero = serializers.PrimaryKeyRelatedField(
        queryset=Tercero.objects.all(), required=False, allow_null=True
    )
    tercero_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoContable
        fields = [
            "id", "cuenta", "cuenta_codigo", "cuenta_codigo_display", "cuenta_nombre",
            "tercero", "tercero_nombre",
            "debito", "credito",
        ]
        read_only_fields = ["id", "cuenta_codigo_display", "cuenta_nombre", "tercero_nombre"]
        extra_kwargs = {
            "cuenta": {"required": False},
        }

    def get_tercero_nombre(self, obj):
        if obj.tercero:
            return obj.tercero.nombre_razon_social
        return None

    def validate(self, attrs):
        if not attrs.get("cuenta") and not attrs.get("cuenta_codigo"):
            raise serializers.ValidationError("Debe enviar 'cuenta' (id) o 'cuenta_codigo' (código).")

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
            except Cuenta.MultipleObjectsReturned:
                attrs["cuenta"] = Cuenta.objects.filter(codigo=code).first()
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
    tercero_nombre = serializers.SerializerMethodField()

    class Meta:
        model = AsientoContable
        fields = [
            "id", "empresa", "numero", "fecha", "concepto", "tercero", "tercero_nombre",
            "descripcion", "descripcion_adicional",
            "fiscal_year", "fiscal_period",
            "movimientos", "estado", "anulado_por", "anulado_en", "anulacion_motivo", "ajusta_a",
        ]
        read_only_fields = ["id", "estado", "anulado_por", "anulado_en", "ajusta_a", "tercero_nombre"]

    def get_tercero_nombre(self, obj):
        if obj.tercero:
            return obj.tercero.nombre_razon_social
        return None

    def validate(self, attrs):
        errors = {}

        fecha = attrs.get("fecha") or getattr(self.instance, "fecha", None)
        if not fecha:
            errors["fecha"] = "La fecha es obligatoria."

        tercero = attrs.get("tercero") or getattr(self.instance, "tercero", None) or self.initial_data.get("tercero")
        if not tercero:
            errors["tercero"] = "Seleccione un tercero."

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

        fy = attrs.get("fiscal_year")   or (fecha.year if fecha else None)
        fp = attrs.get("fiscal_period") or (fecha.month if fecha else None)

        # Obtener empresa para validación de periodo
        empresa = attrs.get("empresa") or getattr(self.instance, "empresa", None)
        if not empresa:
            raise serializers.ValidationError({"empresa": "La empresa es obligatoria."})

        p = PeriodoContable.ensure(empresa, fy)

        if fp == 13:
            if not p.habilitar_mes13:
                raise serializers.ValidationError("Mes 13 deshabilitado para este año.")
            from datetime import date as _date
            hoy = _date.today()
            if not p.in_ajustes(hoy):
                raise serializers.ValidationError(
                    f"Mes 13 solo permitido durante la ventana de ajustes ({p.ajustes_inicio} a {p.ajustes_fin})."
                )
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
