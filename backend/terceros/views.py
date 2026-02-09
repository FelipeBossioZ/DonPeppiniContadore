# 🎩 Don Peppini Contadore - Views de Terceros (GLOBALES)
from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from .models import Tercero
from .serializers import (
    TerceroListSerializer,
    TerceroDetailSerializer,
    TerceroCreateSerializer,
    TerceroSerializer,
)


class TerceroViewSet(viewsets.ModelViewSet):
    """
    🎩 ViewSet para gestión de Terceros (GLOBALES)

    Los terceros son compartidos entre todas las empresas.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre_razon_social', 'numero_documento', 'primer_apellido', 'primer_nombre']
    ordering_fields = ['nombre_razon_social', 'numero_documento', 'tipo_tercero']
    ordering = ['nombre_razon_social']

    def get_serializer_class(self):
        if self.action == 'create':
            return TerceroCreateSerializer
        return TerceroDetailSerializer

    def get_queryset(self):
        qs = Tercero.objects.filter(activo=True)

        # Filtrar por tipo de tercero (opcional)
        tipo = self.request.query_params.get('tipo') or self.request.query_params.get('tipo_tercero')
        if tipo:
            qs = qs.filter(tipo_tercero=tipo)

        # Incluir inactivos si se solicita
        if self.request.query_params.get('incluir_inactivos') == 'true':
            qs = Tercero.objects.all()

        # IGNORA parámetro empresa (retrocompatibilidad)
        # Antes se filtraba por empresa, ahora todos son globales

        return qs

    def create(self, request, *args, **kwargs):
        """Crear tercero global - sin requerir empresa"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tercero = serializer.save()
        # Retornar con serializer completo para que el frontend tenga todos los campos
        return Response(
            TerceroDetailSerializer(tercero).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def desactivar(self, request, pk=None):
        """Desactivar un tercero (soft delete)"""
        tercero = self.get_object()
        tercero.activo = False
        tercero.save()
        return Response({'status': 'Tercero desactivado'})

    @action(detail=True, methods=['post'])
    def activar(self, request, pk=None):
        """Activar un tercero"""
        tercero = self.get_object()
        tercero.activo = True
        tercero.save()
        return Response({'status': 'Tercero activado'})

    @action(detail=False, methods=['get'])
    def buscar(self, request):
        """
        Búsqueda rápida: GET /api/terceros/buscar/?q=banco
        """
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])

        qs = Tercero.objects.filter(
            Q(numero_documento__icontains=q) |
            Q(nombre_razon_social__icontains=q) |
            Q(primer_nombre__icontains=q) |
            Q(primer_apellido__icontains=q)
        ).filter(activo=True)[:20]

        return Response(TerceroListSerializer(qs, many=True).data)
