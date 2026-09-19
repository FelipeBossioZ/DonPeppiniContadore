# -*- coding: utf-8 -*-
from django.urls import path
from . import views

urlpatterns = [
    path("estado/", views.estado),
    path("respaldar/", views.respaldar),
    path("respaldos/", views.respaldos),
    path("restaurar/", views.restaurar),
    path("importar/", views.importar_db),
    path("exportar/", views.exportar),
    path("boveda/pull/", views.boveda_pull),
    path("boveda/push/", views.boveda_push),
    path("cambiar-ruta/", views.cambiar_ruta),
]
