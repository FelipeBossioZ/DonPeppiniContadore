# 🎩 Don Peppini — Comprobante de Nómina PDF
# Logo se carga desde ConfiguracionEmpresa.logo (por empresa)

import io
import os
import tempfile
from decimal import Decimal
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle


def peso(valor):
    v = float(valor or 0)
    return f"-$ {abs(v):,.0f}" if v < 0 else f"$ {v:,.0f}"


def _draw_empresa_header(c, empresa, y, w, azul, gris):
    """Header reutilizable: logo + datos empresa. Retorna nuevo y."""
    x_text = 50
    try:
        config = empresa.configuracion
        if config.logo:
            logo_data = bytes(config.logo)
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                tmp.write(logo_data)
                tmp_path = tmp.name
            try:
                c.drawImage(tmp_path, 50, y - 40, width=55, height=55,
                           preserveAspectRatio=True, mask='auto')
                x_text = 115
            except Exception:
                pass
            finally:
                os.unlink(tmp_path)
    except Exception:
        pass

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(azul)
    c.drawString(x_text, y, empresa.razon_social.upper())
    y -= 16
    c.setFont("Helvetica", 9)
    c.setFillColor(gris)
    c.drawString(x_text, y, f"NIT: {empresa.nit}")
    if empresa.direccion:
        c.drawString(350, y, empresa.direccion)
    y -= 12
    if empresa.ciudad:
        c.drawString(x_text, y, f"{empresa.ciudad}{', ' + empresa.departamento if empresa.departamento else ''}")
    if empresa.telefono:
        c.drawString(350, y, f"Tel: {empresa.telefono}")
    y -= 5
    c.setStrokeColor(azul)
    c.setLineWidth(2)
    c.line(50, y, w - 50, y)
    y -= 20
    return y


def generar_comprobante_nomina(liquidacion, empresa, buffer=None):
    if buffer is None:
        buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    w, h = letter
    emp = liquidacion.empleado
    nomina = liquidacion.nomina

    AZUL = colors.HexColor('#1a365d')
    GRIS = colors.HexColor('#6b7280')
    NEGRO = colors.black

    y = _draw_empresa_header(c, empresa, h - 40, w, AZUL, GRIS)

    # Título
    meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    tipo_map = {'MEN': 'Mensual', 'Q1': 'Primera Quincena', 'Q2': 'Segunda Quincena'}
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(AZUL)
    c.drawCentredString(w / 2, y, f"COMPROBANTE DE NÓMINA — {meses[nomina.mes]} {nomina.anio}")
    y -= 14
    c.setFont("Helvetica", 9)
    c.setFillColor(GRIS)
    c.drawCentredString(w / 2, y, f"Período: {tipo_map.get(nomina.tipo, nomina.tipo)}")
    y -= 25

    # Datos empleado
    c.setFillColor(colors.HexColor('#e8edf3'))
    c.rect(50, y - 55, w - 100, 60, fill=True, stroke=False)
    c.setFillColor(NEGRO)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(60, y, "EMPLEADO")
    c.setFont("Helvetica", 9)
    y -= 14
    c.drawString(60, y, f"Nombre: {emp.tercero.nombre_razon_social}")
    c.drawString(350, y, f"Documento: {emp.tercero.numero_documento}")
    y -= 13
    c.drawString(60, y, f"Cargo: {emp.cargo or 'N/A'}")
    c.drawString(350, y, f"Ingreso: {emp.fecha_ingreso}")
    y -= 13
    c.drawString(60, y, f"Salario base: {peso(liquidacion.salario_base)}")
    c.drawString(350, y, f"Días trabajados: {liquidacion.dias_trabajados}")
    y -= 25

    # Tablas devengados/deducciones
    col_w = (w - 100) / 2 - 10

    devengados = [['CONCEPTO', 'VALOR']]
    for label, val in [
        ('Salario', liquidacion.salario_devengado),
        ('Auxilio transporte', liquidacion.auxilio_transporte),
        ('Horas extras', liquidacion.horas_extras),
        ('Recargos', liquidacion.recargos),
        ('Comisiones', liquidacion.comisiones),
        ('Bonificaciones', liquidacion.bonificaciones),
        ('Otros devengados', liquidacion.otros_devengados),
    ]:
        if val > 0:
            devengados.append([label, peso(val)])
    devengados.append(['TOTAL DEVENGADO', peso(liquidacion.total_devengado)])

    deducciones = [['CONCEPTO', 'VALOR']]
    for label, val in [
        ('Salud (4%)', liquidacion.salud_empleado),
        ('Pensión (4%)', liquidacion.pension_empleado),
        ('Fondo solidaridad', liquidacion.fsp),
        ('Retención fuente', liquidacion.retencion_fuente),
        ('Libranzas', liquidacion.libranzas),
        ('Otros descuentos', liquidacion.otros_descuentos),
    ]:
        if val > 0:
            deducciones.append([label, peso(val)])
    deducciones.append(['TOTAL DEDUCCIONES', peso(liquidacion.total_deducciones)])

    while len(devengados) < len(deducciones):
        devengados.insert(-1, ['', ''])
    while len(deducciones) < len(devengados):
        deducciones.insert(-1, ['', ''])

    def draw_table(data, x_pos, y_pos, title_color):
        t = Table(data, colWidths=[col_w * 0.6, col_w * 0.4])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), title_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f3f4f6')),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
        ]))
        tw, th = t.wrapOn(c, col_w, 400)
        t.drawOn(c, x_pos, y_pos - th)
        return th

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor('#166534'))
    c.drawString(55, y, "DEVENGADOS")
    c.setFillColor(colors.HexColor('#991b1b'))
    c.drawString(55 + col_w + 20, y, "DEDUCCIONES")
    y -= 5

    h1 = draw_table(devengados, 50, y, colors.HexColor('#166534'))
    h2 = draw_table(deducciones, 50 + col_w + 20, y, colors.HexColor('#991b1b'))
    y -= max(h1, h2) + 20

    # Neto
    c.setFillColor(AZUL)
    c.rect(50, y - 30, w - 100, 35, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(60, y - 20, "NETO A PAGAR")
    c.drawRightString(w - 60, y - 20, peso(liquidacion.neto_pagar))
    y -= 50

    # Aportes empleador
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(GRIS)
    c.drawString(50, y, "APORTES EMPLEADOR (informativo)")
    y -= 15
    aportes = []
    for label, val in [('Salud', liquidacion.salud_empleador), ('Pensión', liquidacion.pension_empleador),
                       ('ARL', liquidacion.arl), ('Caja', liquidacion.caja_compensacion),
                       ('SENA', liquidacion.sena), ('ICBF', liquidacion.icbf)]:
        if val > 0:
            aportes.append(f"{label}: {peso(val)}")
    c.setFont("Helvetica", 8)
    c.drawString(50, y, "  |  ".join(aportes))
    y -= 20

    # Provisiones
    provs = []
    for label, val in [('Prima', liquidacion.provision_prima), ('Cesantías', liquidacion.provision_cesantias),
                       ('Int. ces.', liquidacion.provision_int_cesantias), ('Vacaciones', liquidacion.provision_vacaciones)]:
        if val > 0:
            provs.append(f"{label}: {peso(val)}")
    if provs:
        c.setFont("Helvetica-Bold", 9)
        c.drawString(50, y, "PROVISIONES")
        y -= 14
        c.setFont("Helvetica", 8)
        c.drawString(50, y, "  |  ".join(provs))
        y -= 20

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(NEGRO)
    c.drawString(50, y, f"Costo total empresa: {peso(liquidacion.costo_empresa)}")
    y -= 40

    # Firmas
    c.setStrokeColor(GRIS)
    c.setLineWidth(0.5)
    c.line(60, y, 260, y)
    c.setFont("Helvetica", 8)
    c.setFillColor(GRIS)
    c.drawCentredString(160, y - 12, "Firma Empleador")
    c.line(340, y, 540, y)
    c.drawCentredString(440, y - 12, "Firma Empleado")

    c.setFont("Helvetica", 7)
    c.drawCentredString(w / 2, 30, f"Generado por Don Peppini Contadore — {empresa.razon_social}")
    c.save()
    buffer.seek(0)
    return buffer


def generar_comprobante_liquidacion_contrato(liq, empresa, buffer=None):
    if buffer is None:
        buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    w, h = letter

    AZUL = colors.HexColor('#1a365d')
    ROJO = colors.HexColor('#991b1b')
    GRIS = colors.HexColor('#6b7280')

    y = _draw_empresa_header(c, empresa, h - 40, w, AZUL, GRIS)

    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(ROJO)
    c.drawCentredString(w / 2, y, "LIQUIDACIÓN DEFINITIVA DE CONTRATO DE TRABAJO")
    y -= 15
    c.setFont("Helvetica", 9)
    c.setFillColor(GRIS)
    c.drawCentredString(w / 2, y, f"Motivo: {liq.get_motivo_display()}")
    y -= 25

    emp = liq.empleado
    c.setFillColor(colors.HexColor('#fef2f2'))
    c.rect(50, y - 55, w - 100, 60, fill=True, stroke=False)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(60, y, "DATOS DEL TRABAJADOR")
    y -= 14
    c.setFont("Helvetica", 9)
    c.drawString(60, y, f"Nombre: {emp.tercero.nombre_razon_social}")
    c.drawString(350, y, f"Doc: {emp.tercero.numero_documento}")
    y -= 13
    c.drawString(60, y, f"Ingreso: {liq.fecha_ingreso}")
    c.drawString(200, y, f"Retiro: {liq.fecha_retiro}")
    c.drawString(350, y, f"Salario: {peso(liq.salario_base)}")
    y -= 13
    c.drawString(60, y, f"Cargo: {emp.cargo or 'N/A'}")
    contrato_map = {'IND': 'Indefinido', 'FIJ': 'Fijo', 'OBR': 'Obra o labor'}
    c.drawString(350, y, f"Contrato: {contrato_map.get(liq.tipo_contrato, liq.tipo_contrato)}")
    y -= 30

    data = [['CONCEPTO', 'DÍAS', 'VALOR']]
    if liq.salario_proporcional > 0:
        data.append(['Salario proporcional', str(liq.dias_ultimo_mes), peso(liq.salario_proporcional)])
    if liq.auxilio_transporte_prop > 0:
        data.append(['Auxilio transporte', '', peso(liq.auxilio_transporte_prop)])
    data.append(['Vacaciones compensadas', f'{float(liq.dias_vacaciones_pendientes):.1f}', peso(liq.vacaciones)])
    if liq.prima_servicios > 0:
        data.append(['Prima de servicios', str(liq.dias_prima), peso(liq.prima_servicios)])
    if liq.cesantias > 0:
        data.append(['Cesantías', str(liq.dias_cesantias), peso(liq.cesantias)])
    if liq.intereses_cesantias > 0:
        data.append(['Intereses cesantías (12%)', '', peso(liq.intereses_cesantias)])
    if liq.indemnizacion > 0:
        data.append(['INDEMNIZACIÓN (Art. 64 CST)', '', peso(liq.indemnizacion)])
    data.append(['TOTAL DEVENGADO', '', peso(liq.total_devengado)])
    data.append(['', '', ''])
    data.append(['DEDUCCIONES', '', ''])
    if liq.deduccion_salud > 0:
        data.append(['  Salud empleado (4%)', '', peso(liq.deduccion_salud)])
    if liq.deduccion_pension > 0:
        data.append(['  Pensión empleado (4%)', '', peso(liq.deduccion_pension)])
    if liq.retencion_fuente > 0:
        data.append(['  Retención en la fuente', '', peso(liq.retencion_fuente)])
    data.append(['TOTAL DEDUCCIONES', '', peso(liq.total_deducciones)])

    t = Table(data, colWidths=[280, 60, 150])
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), AZUL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
    ]
    for i, row in enumerate(data):
        if row[0].startswith('TOTAL') or row[0] == 'DEDUCCIONES' or 'INDEMNIZACIÓN' in row[0]:
            style.append(('FONTNAME', (0, i), (-1, i), 'Helvetica-Bold'))
        if 'TOTAL DEVENGADO' in row[0]:
            style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f0fdf4')))
        if 'TOTAL DEDUCCIONES' in row[0]:
            style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#fef2f2')))
    t.setStyle(TableStyle(style))
    tw, th = t.wrapOn(c, 500, 400)
    t.drawOn(c, 55, y - th)
    y -= th + 25

    c.setFillColor(ROJO)
    c.rect(50, y - 30, w - 100, 35, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(60, y - 20, "NETO A PAGAR")
    c.drawRightString(w - 60, y - 20, peso(liq.neto_pagar))
    y -= 60

    c.setStrokeColor(GRIS)
    c.line(60, y, 260, y)
    c.setFont("Helvetica", 8)
    c.setFillColor(GRIS)
    c.drawCentredString(160, y - 12, "Firma Empleador")
    c.line(340, y, 540, y)
    c.drawCentredString(440, y - 12, "Firma Empleado")

    c.setFont("Helvetica", 7)
    c.drawCentredString(w / 2, 30, f"Generado por Don Peppini Contadore — {empresa.razon_social}")
    c.save()
    buffer.seek(0)
    return buffer
