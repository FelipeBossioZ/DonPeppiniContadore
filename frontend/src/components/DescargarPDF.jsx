// 🎩 Don Peppini Contadore - Botón Descargar PDF (MEJORADO)
// frontend/src/components/DescargarPDF.jsx
// REEMPLAZAR EL ARCHIVO ANTERIOR

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

const DescargarPDF = ({ nombreArchivo = 'reporte', titulo, empresa, fecha }) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = () => {
    setLoading(true);
    
    const contenido = document.getElementById('reporte-contenido');
    if (!contenido) {
      alert('No se encontró el contenido para descargar');
      setLoading(false);
      return;
    }

    // Clonar el contenido para modificarlo sin afectar la página
    const contenidoClone = contenido.cloneNode(true);
    
    // Eliminar botones de colapso (los que tienen ChevronDown/ChevronRight)
    const botones = contenidoClone.querySelectorAll('button');
    botones.forEach(btn => {
      // Convertir el botón en un título simple
      const texto = btn.textContent.replace(/[▼▲]/g, '').trim();
      const titulo = document.createElement('h4');
      titulo.textContent = texto;
      titulo.style.cssText = 'font-weight: bold; font-size: 12px; margin: 10px 0 5px 0; color: #374151;';
      btn.parentNode.replaceChild(titulo, btn);
    });

    // Eliminar SVGs (iconos)
    const svgs = contenidoClone.querySelectorAll('svg');
    svgs.forEach(svg => svg.remove());

    const ventana = window.open('', '_blank');
    ventana.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${nombreArchivo}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 10px;
            line-height: 1.3;
            color: #1f2937;
            padding: 15px 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #4f46e5;
          }
          .header h1 {
            font-size: 16px;
            color: #1f2937;
            margin-bottom: 3px;
          }
          .header h2 {
            font-size: 13px;
            color: #4f46e5;
            margin-bottom: 3px;
          }
          .header p {
            font-size: 10px;
            color: #6b7280;
          }
          
          /* Contenedor principal en dos columnas */
          .grid {
            display: flex;
            gap: 20px;
          }
          .grid > div {
            flex: 1;
          }
          
          /* Tablas */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 5px 0;
            font-size: 9px;
          }
          th, td {
            padding: 4px 6px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }
          th {
            background-color: #f3f4f6;
            font-weight: 600;
          }
          
          /* Títulos de sección */
          h3 {
            font-size: 12px;
            font-weight: bold;
            margin: 12px 0 8px 0;
            padding-bottom: 4px;
            border-bottom: 2px solid #4f46e5;
          }
          h4 {
            font-size: 10px;
            font-weight: 600;
            margin: 8px 0 4px 0;
            color: #374151;
          }
          
          /* Utilidades */
          .text-right, [class*="text-right"] {
            text-align: right !important;
          }
          .text-center {
            text-align: center;
          }
          .font-bold, .font-medium, [class*="font-bold"], [class*="font-medium"] {
            font-weight: 600;
          }
          
          /* Fondos */
          [class*="bg-gray"], [class*="bg-slate"] {
            background-color: #f9fafb !important;
          }
          [class*="bg-indigo"] {
            background-color: #eef2ff !important;
          }
          [class*="bg-green"] {
            background-color: #ecfdf5 !important;
          }
          [class*="bg-red"] {
            background-color: #fef2f2 !important;
          }
          [class*="bg-amber"], [class*="bg-yellow"] {
            background-color: #fffbeb !important;
          }
          [class*="bg-blue"] {
            background-color: #eff6ff !important;
          }
          
          /* Colores de texto */
          [class*="text-red"] {
            color: #dc2626 !important;
          }
          [class*="text-green"] {
            color: #059669 !important;
          }
          [class*="text-indigo"] {
            color: #4f46e5 !important;
          }
          
          /* Totales destacados */
          .total-row, [class*="bg-indigo-50"], [class*="bg-green-50"] {
            font-weight: 600;
          }
          
          /* Padding/margin helpers */
          [class*="py-"], [class*="px-"], [class*="p-"] {
            padding: 4px 6px;
          }
          [class*="pl-6"], [class*="pl-8"] {
            padding-left: 20px !important;
          }
          
          /* Bordes */
          [class*="border-b"] {
            border-bottom: 1px solid #e5e7eb;
          }
          [class*="rounded"] {
            border-radius: 4px;
          }
          
          /* Ocultar elementos interactivos */
          button, [role="button"], .cursor-pointer {
            all: unset;
            display: block;
            font-weight: bold;
            margin: 8px 0 4px 0;
          }
          
          /* Verificación ecuación */
          [class*="items-center"] {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .footer {
            margin-top: 25px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            font-size: 8px;
            color: #9ca3af;
            text-align: center;
          }
          
          @media print {
            body { 
              padding: 0; 
              font-size: 9px;
            }
            .no-print { display: none; }
            @page {
              margin: 1cm;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${empresa || 'Empresa'}</h1>
          <h2>${titulo || 'Estado Financiero'}</h2>
          <p>NIT: ${fecha || ''} | NIIF para Pymes - Grupo 2</p>
        </div>
        ${contenidoClone.innerHTML}
        <div class="footer">
          <p>🎩 Generado por Don Peppini Contadore | ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}</p>
          <p>Este documento es una representación digital de los Estados Financieros según NIIF para Pymes</p>
        </div>
      </body>
      </html>
    `);
    
    ventana.document.close();
    
    setTimeout(() => {
      ventana.print();
      setLoading(false);
    }, 500);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Descargar PDF
    </button>
  );
};

export default DescargarPDF;
