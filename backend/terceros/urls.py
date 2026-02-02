from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TerceroViewSet

router = DefaultRouter()
router.register(r'terceros', TerceroViewSet, basename='tercero')

urlpatterns = [
    path('', include(router.urls)),
]