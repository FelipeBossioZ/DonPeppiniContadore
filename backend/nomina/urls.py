# 🎩 Don Peppini - URLs Nómina
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ParametrosNominaViewSet, EmpleadoViewSet, NominaViewSet, LiquidacionEmpleadoViewSet

router = DefaultRouter()
router.register(r'parametros', ParametrosNominaViewSet)
router.register(r'empleados', EmpleadoViewSet)
router.register(r'nominas', NominaViewSet)
router.register(r'liquidaciones', LiquidacionEmpleadoViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
