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

    @action(detail=True, methods=['post'])
    def upload_logo(self, request, pk=None):
        """Sube logo de empresa (PNG, JPG, SVG). Se guarda en ConfiguracionEmpresa.logo."""
        empresa = self.get_object()
        archivo = request.FILES.get('logo')
        if not archivo:
            return Response({'error': 'No se envió archivo'}, status=status.HTTP_400_BAD_REQUEST)

        # Validar tipo
        allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/tiff']
        if archivo.content_type not in allowed:
            return Response({'error': f'Tipo no soportado: {archivo.content_type}'}, status=400)

        # Convertir TIFF a PNG si es necesario
        logo_bytes = archivo.read()
        content_type = archivo.content_type

        if content_type == 'image/tiff':
            try:
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(logo_bytes))
                buf = io.BytesIO()
                img.save(buf, format='PNG')
                logo_bytes = buf.getvalue()
                content_type = 'image/png'
            except Exception as e:
                return Response({'error': f'Error convirtiendo TIFF: {str(e)}'}, status=400)

        config, _ = ConfiguracionEmpresa.objects.get_or_create(empresa=empresa)
        config.logo = logo_bytes
        config.save(update_fields=['logo'])

        return Response({
            'mensaje': 'Logo actualizado',
            'size': len(logo_bytes),
            'content_type': content_type,
        })

    @action(detail=True, methods=['get'])
    def logo(self, request, pk=None):
        """Descarga el logo de la empresa como imagen."""
        from django.http import HttpResponse
        empresa = self.get_object()
        try:
            config = empresa.configuracion
        except ConfiguracionEmpresa.DoesNotExist:
            return Response({'error': 'Sin logo'}, status=404)

        if not config.logo:
            return Response({'error': 'Sin logo'}, status=404)

        logo_data = bytes(config.logo)
        # Detectar tipo por magic bytes
        ct = 'image/png'
        if logo_data[:4] == b'\x89PNG':
            ct = 'image/png'
        elif logo_data[:2] in (b'\xff\xd8',):
            ct = 'image/jpeg'
        elif logo_data[:5] == b'<?xml' or logo_data[:4] == b'<svg':
            ct = 'image/svg+xml'

        response = HttpResponse(logo_data, content_type=ct)
        response['Content-Disposition'] = f'inline; filename="logo_{empresa.nit}.png"'
        response['Cache-Control'] = 'max-age=3600'
        return response

    @action(detail=True, methods=['delete'])
    def delete_logo(self, request, pk=None):
        """Elimina el logo de la empresa."""
        empresa = self.get_object()
        try:
            config = empresa.configuracion
            config.logo = None
            config.save(update_fields=['logo'])
        except ConfiguracionEmpresa.DoesNotExist:
            pass
        return Response({'mensaje': 'Logo eliminado'})
