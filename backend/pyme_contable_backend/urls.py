# 🎩 Don Peppini Contadore - URLs principales
from django.contrib import admin
from django.urls import path, include
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# Documentación API
schema_view = get_schema_view(
   openapi.Info(
      title="🎩 Don Peppini Contadore API",
      default_version='v1',
      description="Sistema Contable NIIF para Pymes - Colombia",
      contact=openapi.Contact(email="soporte@donpeppini.com"),
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)

# Configuración Admin
admin.site.site_header = "🎩 Don Peppini Contadore"
admin.site.site_title = "Don Peppini Admin"
admin.site.index_title = "Panel de Administración"

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # 🎩 API REST
    path('api/empresas/', include('empresas.urls')),
    path('api/terceros/', include('terceros.urls')),     
    path('api/contabilidad/', include('contabilidad.urls')), 
    path('api/facturacion/', include('facturacion.urls')),   
    path('api/nomina/', include('nomina.urls')),
    
    # Autenticación JWT
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Documentación
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path('api/docs/', schema_view.with_ui('swagger', cache_timeout=0), name='api-docs'),
]