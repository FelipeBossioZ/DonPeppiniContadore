from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TerceroViewSet, CompartirTerceroView

router = DefaultRouter()
router.register(r'', TerceroViewSet, basename='tercero')

urlpatterns = [
    path('compartir/', CompartirTerceroView.as_view(), name='compartir-tercero'),
    path('', include(router.urls)),
]