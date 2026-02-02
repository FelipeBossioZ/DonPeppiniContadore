# 🎩 Don Peppini Contadore - Views de Terceros
from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Tercero
from .serializers import (
    TerceroListSerializer,
    TerceroDetailSerializer,
    TerceroCreateSerializer,
    TerceroSerializer,
)


class TerceroViewSet(viewsets.ModelViewSet):
    """
    🎩 ViewSet para gestión de Terceros
    
    Filtra automáticamente por empresa según el parámetro `empresa` en la query.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre_razon_social', 'numero_documento', 'primer_apellido', 'primer_nombre']
    ordering_fields = ['nombre_razon_social', 'numero_documento', 'tipo_tercero']
    ordering = ['nombre_razon_social']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TerceroListSerializer
        elif self.action == 'create':
            return TerceroCreateSerializer
        return TerceroDetailSerializer
    
    def get_queryset(self):
        qs = Tercero.objects.filter(activo=True)
        
        # Filtrar por empresa (requerido)
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        
        # Filtrar por tipo de tercero
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo_tercero=tipo)
        
        # Incluir inactivos si se solicita
        if self.request.query_params.get('incluir_inactivos') == 'true':
            qs = Tercero.objects.all()
            if empresa_id:
                qs = qs.filter(empresa_id=empresa_id)
        
        return qs
    
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