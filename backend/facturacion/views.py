# backend/facturacion/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny  # DEV; en prod usa IsAuthenticated
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.http import HttpResponse

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm

from .models import Factura, ItemFactura
from .serializers import FacturaSerializer


class FacturaViewSet(viewsets.ModelViewSet):
    """
    CRUD de facturas con items embebidos.
    - Solo se puede eliminar si estado == 'borrador'
    - Acción /pdf para ver/descargar el PDF
    """

    permission_classes = [IsAuthenticated]
    
    queryset = (
        Factura.objects
        .select_related("cliente")
        .prefetch_related("items")
        .all()
    )
    serializer_class = FacturaSerializer

    def destroy(self, request, *args, **kwargs):
        factura: Factura = self.get_object()
        if factura.estado != "borrador":
            return Response(
                {"detail": "Solo se pueden eliminar facturas en estado 'borrador'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """
        Actualiza factura y reemplaza sus items si 'items' viene en el payload.
        """
        partial = kwargs.pop('partial', False)
        instance: Factura = self.get_object()
        data = request.data.copy()

        # Si el front manda items, los reemplazamos por simplicidad
        items_data = data.pop("items", None)

        # Validar/actualizar cabecera
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Reemplazo de items (opcional)
        if items_data is not None:
            instance.items.all().delete()
            for it in items_data:
                ItemFactura.objects.create(
                    factura=instance,
                    descripcion=it.get("descripcion", ""),
                    cantidad=it.get("cantidad", 0),
                    precio_unitario=it.get("precio_unitario", 0),
                    lleva_iva=it.get("lleva_iva", True),
                )
            # recalcular totales
            instance.calcular_totales()

        return Response(self.get_serializer(instance).data, status=200)

    @action(detail=True, methods=["get"], url_path="pdf", permission_classes=[AllowAny])
    def pdf(self, request, pk=None):
        """
        Devuelve el PDF de la factura:
          - inline (ver en iframe)
          - ?download=1 para descarga
        """
        f: Factura = self.get_object()
        download = request.GET.get("download")

        resp = HttpResponse(content_type="application/pdf")
        filename = f"factura_{f.id}.pdf"
        dispo = "attachment" if download else "inline"
        resp["Content-Disposition"] = f'{dispo}; filename="{filename}"'
        resp["X-Frame-Options"] = "ALLOWALL"  # para iframe en dev
        resp["Access-Control-Expose-Headers"] = "Content-Disposition"

        # --- PDF ---
        w, h = letter
        p = canvas.Canvas(resp, pagesize=letter)
        x = 18 * mm
        y = h - 20 * mm

        p.setFont("Helvetica-Bold", 16)
        p.drawString(x, y, f"Factura #{f.id}")
        y -= 8 * mm
        p.setFont("Helvetica", 11)

        cliente = f.cliente
        p.drawString(x, y, f"Cliente: {getattr(cliente, 'nombre_razon_social', '')}"); y -= 6 * mm
        doc = f"{getattr(cliente, 'tipo_documento', '')} {getattr(cliente, 'numero_documento', '')}".strip()
        p.drawString(x, y, f"Documento: {doc}"); y -= 6 * mm
        p.drawString(x, y, f"Fecha emisión: {f.fecha_emision}"); y -= 6 * mm
        p.drawString(x, y, f"Fecha vencimiento: {f.fecha_vencimiento}"); y -= 10 * mm

        # cabecera de items
        p.setFont("Helvetica-Bold", 11)
        p.drawString(x, y, "Descripción")
        p.drawString(120 * mm, y, "Cant.")
        p.drawString(140 * mm, y, "P.Unit")
        p.drawString(170 * mm, y, "Subtotal")
        y -= 6 * mm
        p.line(x, y, w - x, y)
        y -= 4 * mm
        p.setFont("Helvetica", 10)

        for it in f.items.all():
            if y < 30 * mm:
                p.showPage()
                y = h - 20 * mm
            p.drawString(x, y, it.descripcion[:70])
            p.drawRightString(135 * mm, y, f"{it.cantidad}")
            p.drawRightString(160 * mm, y, f"{it.precio_unitario:.2f}")
            p.drawRightString(w - x, y, f"{it.subtotal_linea:.2f}")
            y -= 6 * mm

        y -= 4 * mm
        p.line(x, y, w - x, y)
        y -= 8 * mm

        p.setFont("Helvetica-Bold", 11)
        p.drawRightString(160 * mm, y, "Subtotal:")
        p.drawRightString(w - x, y, f"{f.subtotal:.2f}"); y -= 6 * mm
        p.drawRightString(160 * mm, y, "IVA:")
        p.drawRightString(w - x, y, f"{f.impuestos:.2f}"); y -= 6 * mm
        p.drawRightString(160 * mm, y, "Total:")
        p.drawRightString(w - x, y, f"{f.total:.2f}"); y -= 10 * mm

        p.setFont("Helvetica", 9)
        p.drawString(x, y, f"Estado: {f.estado.upper()}")
        if f.cufe:
            y -= 5 * mm
            p.drawString(x, y, f"CUFE: {f.cufe}")

        p.showPage()
        p.save()
        return resp
