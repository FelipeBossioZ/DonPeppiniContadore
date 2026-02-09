# 🎩 Don Peppini - URLs Nómina
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ParametrosNominaViewSet, EmpleadoViewSet, NominaViewSet,
    LiquidacionEmpleadoViewSet, SimularRetencionView,
    LiquidacionContratoViewSet,
    ComprobantePDFView, ComprobanteContratoView,
    VacacionesViewSet, PrimaSemestralViewSet, CesantiasAnualesViewSet,
    DashboardNominaView, ImportarEmpleadosView,
)

router = DefaultRouter()
router.register(r'parametros', ParametrosNominaViewSet)
router.register(r'empleados', EmpleadoViewSet)
router.register(r'nominas', NominaViewSet)
router.register(r'liquidaciones', LiquidacionEmpleadoViewSet)
router.register(r'liquidaciones-contrato', LiquidacionContratoViewSet)
router.register(r'vacaciones', VacacionesViewSet)
router.register(r'primas', PrimaSemestralViewSet)
router.register(r'cesantias', CesantiasAnualesViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('simular-retencion/', SimularRetencionView.as_view(), name='simular-retencion'),
    path('comprobante-pdf/<int:pk>/', ComprobantePDFView.as_view(), name='comprobante-pdf'),
    path('comprobante-contrato/<int:pk>/', ComprobanteContratoView.as_view(), name='comprobante-contrato'),
    path('dashboard/', DashboardNominaView.as_view(), name='dashboard-nomina'),
    path('importar-empleados/', ImportarEmpleadosView.as_view(), name='importar-empleados'),
]
