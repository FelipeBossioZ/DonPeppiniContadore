# 🎩 Don Peppini Contadore - URLs Contabilidad COMPLETO
# backend/contabilidad/urls.py
# REEMPLAZAR EL ARCHIVO COMPLETO

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CuentaViewSet, 
    AsientoContableViewSet,
    LibroDiarioView,
    BalancePruebasView,
    BalancePorTercerosView,
    LibroMayorView,
    EstadoResultadosView,
    BalanceGeneralView,
    ImportarAsientosView,
    # NIIF
    EstadoSituacionFinancieraView,
    EstadoResultadosIntegralView,
    EstadoCambiosPatrimonioView,
    EstadoFlujosEfectivoView,
    # Medios Magnéticos
    MediosMagneticosView,
    CertificadosTributariosView,
    ListaTercerosParaCertificadoView,
    #Conciliacion Bancaria
    CuentasBancariasView,
    IniciarConciliacionView,
    ImportarExtractoView,
    ComparativoView,
    ConciliarPartidaView,
    ConciliacionAutomaticaView,
    ReporteConciliacionPDFView,
    #Notas NIIF
    NotasEEFFListView,
    GenerarNotasAutomaticasView,
    NotaEEFFDetailView,
    ExportarNotasWordView,
    ExportarNotasPDFView,
    #Indicadores y Dashboard
    IndicadoresFinancierosView,
    DashboardDataView,
    #Cierre Contable
    CierreContableListView,
    VerificarPeriodoView,
    PreviewCierreView,
    EjecutarCierreView,
    ReabrirPeriodoView,
)

router = DefaultRouter()
router.register(r'cuentas', CuentaViewSet, basename='cuenta')
router.register(r'asientos', AsientoContableViewSet, basename='asiento')

urlpatterns = [
    path('', include(router.urls)),
    
    # Reportes básicos
    path('reportes/libro-diario/', LibroDiarioView.as_view(), name='libro-diario'),
    path('reportes/balance-pruebas/', BalancePruebasView.as_view(), name='balance-pruebas'),
    path('reportes/balance-terceros/', BalancePorTercerosView.as_view(), name='balance-terceros'),
    path('reportes/libro-mayor/<str:cuenta_codigo>/', LibroMayorView.as_view(), name='libro-mayor'),
    path('reportes/estado-resultados/', EstadoResultadosView.as_view(), name='estado-resultados'),
    path('reportes/balance-general/', BalanceGeneralView.as_view(), name='balance-general'),
    
    # Importación Excel
    path('importar-asientos/', ImportarAsientosView.as_view(), name='importar-asientos'),
    
    # Estados Financieros NIIF
    path('niif/situacion-financiera/', EstadoSituacionFinancieraView.as_view(), name='estado-situacion'),
    path('niif/resultados-integral/', EstadoResultadosIntegralView.as_view(), name='resultados-integral'),
    path('niif/cambios-patrimonio/', EstadoCambiosPatrimonioView.as_view(), name='cambios-patrimonio'),
    path('niif/flujos-efectivo/', EstadoFlujosEfectivoView.as_view(), name='flujos-efectivo'),
    
    # Medios Magnéticos DIAN
    path('medios-magneticos/', MediosMagneticosView.as_view(), name='medios-magneticos'),

    # Certificados tributarios
    path('certificados/', CertificadosTributariosView.as_view(), name='certificados'),
    path('certificados/terceros/', ListaTercerosParaCertificadoView.as_view(), name='certificados-terceros'),

    # Conciliación Bancaria
    path('conciliacion/cuentas-banco/', CuentasBancariasView.as_view()),
    path('conciliacion/iniciar/', IniciarConciliacionView.as_view()),
    path('conciliacion/importar-extracto/', ImportarExtractoView.as_view()),
    path('conciliacion/comparativo/', ComparativoView.as_view()),
    path('conciliacion/conciliar/', ConciliarPartidaView.as_view()),
    path('conciliacion/automatica/', ConciliacionAutomaticaView.as_view()),
    path('conciliacion/reporte-pdf/', ReporteConciliacionPDFView.as_view()),

    #Notas NIIF
    path('notas-eeff/', NotasEEFFListView.as_view()),
    path('notas-eeff/generar/', GenerarNotasAutomaticasView.as_view()),
    path('notas-eeff/<int:pk>/', NotaEEFFDetailView.as_view()),
    path('notas-eeff/exportar-word/', ExportarNotasWordView.as_view()),
    path('notas-eeff/exportar-pdf/', ExportarNotasPDFView.as_view()),

    #Indicadores y Dashboard
    path('indicadores/', IndicadoresFinancierosView.as_view()),
    path('dashboard/', DashboardDataView.as_view()),

    #Cierre Contable
    path('cierres/', CierreContableListView.as_view()),
    path('cierres/verificar/', VerificarPeriodoView.as_view()),
    path('cierres/preview/', PreviewCierreView.as_view()),
    path('cierres/ejecutar/', EjecutarCierreView.as_view()),
    path('cierres/reabrir/', ReabrirPeriodoView.as_view()),
]