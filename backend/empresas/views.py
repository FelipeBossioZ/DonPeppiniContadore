# 🎩 Don Peppini Contadore - Views de Empresas
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Empresa, ConfiguracionEmpresa
from .serializers import (
    EmpresaListSerializer,
    EmpresaDetailSerializer,
    EmpresaCreateSerializer,
    ConfiguracionEmpresaSerializer
)


class EmpresaViewSet(viewsets.ModelViewSet):
    """
    🎩 ViewSet para gestión de Empresas
    """
    permission_classes = [IsAuthenticated]
    queryset = Empresa.objects.filter(activa=True)
    
    def get_serializer_class(self):
        if self.action == 'list':
            return EmpresaListSerializer
        elif self.action == 'create':
            return EmpresaCreateSerializer
        return EmpresaDetailSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('todas') == 'true':
            qs = Empresa.objects.all()
        return qs.order_by('razon_social')
    
    @action(detail=True, methods=['post'])
    def activar(self, request, pk=None):
        empresa = self.get_object()
        empresa.activa = True
        empresa.save()
        return Response({'status': 'Empresa activada'})
    
    @action(detail=True, methods=['post'])
    def desactivar(self, request, pk=None):
        empresa = self.get_object()
        empresa.activa = False
        empresa.save()
        return Response({'status': 'Empresa desactivada'})
    
    @action(detail=True, methods=['get', 'patch'])
    def configuracion(self, request, pk=None):
        empresa = self.get_object()
        config, _ = ConfiguracionEmpresa.objects.get_or_create(empresa=empresa)
        
        if request.method == 'GET':
            serializer = ConfiguracionEmpresaSerializer(config)
            return Response(serializer.data)
        
        serializer = ConfiguracionEmpresaSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def resumen(self, request, pk=None):
        empresa = self.get_object()
        return Response({
            'id': empresa.id,
            'nit': empresa.nit,
            'razon_social': empresa.razon_social,
            'nombre_comercial': empresa.nombre_comercial or empresa.razon_social,
            'grupo_niif': empresa.get_grupo_niif_display(),
            'periodo_actual': empresa.periodo_contable_actual,
        })
