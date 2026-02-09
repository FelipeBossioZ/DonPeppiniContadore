# 🎩 Don Peppini - Views Nómina
from decimal import Decimal
from datetime import date
from django.db import transaction
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import ParametrosNomina, Empleado, Nomina, LiquidacionEmpleado, DetalleHorasExtras
from .serializers import (
    ParametrosNominaSerializer, EmpleadoSerializer,
    NominaSerializer, LiquidacionEmpleadoSerializer,
    DetalleHorasExtrasSerializer,
)


class ParametrosNominaViewSet(viewsets.ModelViewSet):
    """CRUD de parámetros legales de nómina por año."""
    permission_classes = [IsAuthenticated]
    queryset = ParametrosNomina.objects.all()
    serializer_class = ParametrosNominaSerializer
    pagination_class = None

    @action(detail=False, methods=['get'])
    def vigente(self, request):
        """GET /api/nomina/parametros/vigente/ — Retorna parámetros del año actual."""
        anio = int(request.query_params.get('anio', date.today().year))
        params = ParametrosNomina.del_anio(anio)
        return Response(ParametrosNominaSerializer(params).data)


class EmpleadoViewSet(viewsets.ModelViewSet):
    """CRUD de empleados por empresa."""
    permission_classes = [IsAuthenticated]
    queryset = Empleado.objects.select_related('tercero', 'empresa').all()
    serializer_class = EmpleadoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['tercero__nombre_razon_social', 'tercero__numero_documento', 'cargo']
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        emp = self.request.query_params.get('empresa')
        if emp:
            qs = qs.filter(empresa_id=emp)
        activo = self.request.query_params.get('activo')
        if activo is not None:
            qs = qs.filter(activo=activo.lower() == 'true')
        return qs

    def perform_create(self, serializer):
        emp = self.request.data.get('empresa')
        serializer.save(empresa_id=emp)


class NominaViewSet(viewsets.ModelViewSet):
    """Gestión de nóminas por empresa."""
    permission_classes = [IsAuthenticated]
    queryset = Nomina.objects.prefetch_related(
        'liquidaciones', 'liquidaciones__empleado', 'liquidaciones__empleado__tercero'
    ).all()
    serializer_class = NominaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        emp = self.request.query_params.get('empresa')
        if emp:
            qs = qs.filter(empresa_id=emp)
        anio = self.request.query_params.get('anio')
        if anio:
            qs = qs.filter(anio=anio)
        return qs

    def perform_create(self, serializer):
        emp = self.request.data.get('empresa')
        serializer.save(empresa_id=emp)

    @action(detail=True, methods=['post'])
    def liquidar(self, request, pk=None):
        """
        POST /api/nomina/nominas/{id}/liquidar/
        Genera las liquidaciones para todos los empleados activos de la empresa.
        Acepta novedades opcionales en el body:
        {
          "novedades": {
            "<empleado_id>": {
              "dias_trabajados": 30,
              "horas_extras": 50000,
              "comisiones": 100000,
              "bonificaciones": 0,
              "libranzas": 0,
              "otros_descuentos": 0,
              "detalle_horas": [
                {"tipo": "HED", "cantidad_horas": 5},
                {"tipo": "HEN", "cantidad_horas": 2}
              ]
            }
          }
        }
        """
        nomina = self.get_object()
        if nomina.estado != 'borrador':
            return Response(
                {"detail": "Solo se pueden liquidar nóminas en estado borrador."},
                status=status.HTTP_400_BAD_REQUEST
            )

        novedades = request.data.get('novedades', {})
        empleados = Empleado.objects.filter(empresa=nomina.empresa, activo=True).select_related('tercero')

        if not empleados.exists():
            return Response(
                {"detail": "No hay empleados activos en esta empresa."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Limpiar liquidaciones anteriores (reliquidar)
            nomina.liquidaciones.all().delete()

            liquidaciones = []
            for emp in empleados:
                nov = novedades.get(str(emp.id), {})

                liq = LiquidacionEmpleado(
                    nomina=nomina,
                    empleado=emp,
                    dias_trabajados=nov.get('dias_trabajados', 30),
                    horas_extras=Decimal(str(nov.get('horas_extras', 0))),
                    recargos=Decimal(str(nov.get('recargos', 0))),
                    comisiones=Decimal(str(nov.get('comisiones', 0))),
                    bonificaciones=Decimal(str(nov.get('bonificaciones', 0))),
                    otros_devengados=Decimal(str(nov.get('otros_devengados', 0))),
                    libranzas=Decimal(str(nov.get('libranzas', 0))),
                    otros_descuentos=Decimal(str(nov.get('otros_descuentos', 0))),
                )
                liq.calcular()
                liquidaciones.append(liq)

                # Detalle de horas extras si se envía
                detalle_horas = nov.get('detalle_horas', [])
                for dh in detalle_horas:
                    det = DetalleHorasExtras(
                        liquidacion=liq,
                        tipo=dh['tipo'],
                        cantidad_horas=Decimal(str(dh.get('cantidad_horas', 0))),
                    )
                    det.calcular(emp.salario_base)
                    det.save()

            # Actualizar totales de la nómina
            nomina.total_devengado = sum(l.total_devengado for l in liquidaciones)
            nomina.total_deducciones = sum(l.total_deducciones for l in liquidaciones)
            nomina.total_neto = sum(l.neto_pagar for l in liquidaciones)
            nomina.total_costo_empresa = sum(l.costo_empresa for l in liquidaciones)
            nomina.estado = 'liquidada'
            nomina.fecha_liquidacion = date.today()
            nomina.save()

        # Recargar con liquidaciones
        nomina.refresh_from_db()
        return Response(NominaSerializer(nomina).data)

    @action(detail=True, methods=['post'])
    def pagar(self, request, pk=None):
        """Marca la nómina como pagada."""
        nomina = self.get_object()
        if nomina.estado != 'liquidada':
            return Response(
                {"detail": "Solo se pueden pagar nóminas liquidadas."},
                status=status.HTTP_400_BAD_REQUEST
            )
        nomina.estado = 'pagada'
        nomina.fecha_pago = request.data.get('fecha_pago', date.today())
        nomina.save()
        return Response(NominaSerializer(nomina).data)


class LiquidacionEmpleadoViewSet(viewsets.ModelViewSet):
    """Detalle de liquidaciones individuales."""
    permission_classes = [IsAuthenticated]
    queryset = LiquidacionEmpleado.objects.select_related(
        'empleado', 'empleado__tercero', 'nomina'
    ).prefetch_related('detalle_horas').all()
    serializer_class = LiquidacionEmpleadoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        nomina = self.request.query_params.get('nomina')
        if nomina:
            qs = qs.filter(nomina_id=nomina)
        return qs
