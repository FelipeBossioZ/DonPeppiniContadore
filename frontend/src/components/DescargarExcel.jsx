// 🎩 Don Peppini Contadore - Botón Descargar Excel
// frontend/src/components/DescargarExcel.jsx

import React, { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';

/**
 * Exporta los estados financieros a Excel
 * Usa la librería SheetJS (xlsx) que ya está disponible en el proyecto
 */
const DescargarExcel = ({ data, tipo, nombreArchivo = 'estado-financiero' }) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    
    try {
      // Importar xlsx dinámicamente
      const XLSX = await import('xlsx');
      
      let workbook = XLSX.utils.book_new();
      
      switch (tipo) {
        case 'situacion':
          generarSituacionFinanciera(XLSX, workbook, data);
          break;
        case 'resultados':
          generarResultadosIntegral(XLSX, workbook, data);
          break;
        case 'patrimonio':
          generarCambiosPatrimonio(XLSX, workbook, data);
          break;
        case 'flujos':
          generarFlujosEfectivo(XLSX, workbook, data);
          break;
        default:
          alert('Tipo de reporte no soportado');
          setLoading(false);
          return;
      }
      
      // Descargar
      XLSX.writeFile(workbook, `${nombreArchivo}.xlsx`);
      
    } catch (error) {
      console.error('Error exportando:', error);
      alert('Error al exportar. Asegúrate de tener la librería xlsx instalada: npm install xlsx');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading || !data}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" />
      )}
      Excel
    </button>
  );
};

// ============================================================================
// GENERADORES POR TIPO DE ESTADO FINANCIERO
// ============================================================================

function generarSituacionFinanciera(XLSX, workbook, data) {
  const rows = [
    [data.empresa?.razon_social || 'Empresa'],
    ['Estado de Situación Financiera'],
    [`NIT: ${data.empresa?.nit || ''}`],
    [`Al ${data.fecha_corte}`],
    ['NIIF para Pymes - Sección 4'],
    [],
    ['ACTIVOS'],
    [],
    ['Activos Corrientes'],
    ['Código', 'Cuenta', 'Saldo'],
  ];
  
  // Activos corrientes
  data.activos?.corrientes?.detalle?.forEach(item => {
    rows.push([item.codigo, item.nombre, item.saldo]);
  });
  rows.push(['', 'Total Activos Corrientes', data.activos?.corrientes?.total || 0]);
  rows.push([]);
  
  // Activos no corrientes
  rows.push(['Activos No Corrientes']);
  rows.push(['Código', 'Cuenta', 'Saldo']);
  data.activos?.no_corrientes?.detalle?.forEach(item => {
    rows.push([item.codigo, item.nombre, item.saldo]);
  });
  rows.push(['', 'Total Activos No Corrientes', data.activos?.no_corrientes?.total || 0]);
  rows.push([]);
  rows.push(['', 'TOTAL ACTIVOS', data.activos?.total || 0]);
  rows.push([]);
  
  // Pasivos
  rows.push(['PASIVOS']);
  rows.push([]);
  rows.push(['Pasivos Corrientes']);
  rows.push(['Código', 'Cuenta', 'Saldo']);
  data.pasivos?.corrientes?.detalle?.forEach(item => {
    rows.push([item.codigo, item.nombre, item.saldo]);
  });
  rows.push(['', 'Total Pasivos Corrientes', data.pasivos?.corrientes?.total || 0]);
  rows.push([]);
  
  rows.push(['Pasivos No Corrientes']);
  rows.push(['Código', 'Cuenta', 'Saldo']);
  data.pasivos?.no_corrientes?.detalle?.forEach(item => {
    rows.push([item.codigo, item.nombre, item.saldo]);
  });
  rows.push(['', 'Total Pasivos No Corrientes', data.pasivos?.no_corrientes?.total || 0]);
  rows.push([]);
  rows.push(['', 'TOTAL PASIVOS', data.pasivos?.total || 0]);
  rows.push([]);
  
  // Patrimonio
  rows.push(['PATRIMONIO']);
  rows.push(['Código', 'Cuenta', 'Saldo']);
  data.patrimonio?.detalle?.forEach(item => {
    rows.push([item.codigo, item.nombre, item.saldo]);
  });
  rows.push(['', 'Resultado del Ejercicio', data.patrimonio?.resultado_ejercicio || 0]);
  rows.push(['', 'TOTAL PATRIMONIO', data.patrimonio?.total || 0]);
  rows.push([]);
  rows.push(['', 'TOTAL PASIVO + PATRIMONIO', data.verificacion?.pasivos_patrimonio || 0]);
  rows.push([]);
  rows.push(['Verificación:', data.verificacion?.ecuacion_ok ? 'Cuadra correctamente ✓' : 'Error en ecuación']);
  
  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Ajustar anchos de columna
  ws['!cols'] = [
    { wch: 12 },
    { wch: 40 },
    { wch: 18 },
  ];
  
  XLSX.utils.book_append_sheet(workbook, ws, 'Situación Financiera');
}

function generarResultadosIntegral(XLSX, workbook, data) {
  const rows = [
    [data.empresa?.razon_social || 'Empresa'],
    ['Estado de Resultados Integral'],
    [`NIT: ${data.empresa?.nit || ''}`],
    [`Del ${data.periodo?.inicio} al ${data.periodo?.fin}`],
    ['NIIF para Pymes - Sección 5'],
    [],
    ['Concepto', 'Valor'],
    [],
    ['INGRESOS OPERACIONALES'],
  ];
  
  data.ingresos?.operacionales?.detalle?.forEach(item => {
    rows.push([`  ${item.codigo} - ${item.nombre}`, item.valor]);
  });
  rows.push(['Total Ingresos', data.ingresos?.total || 0]);
  rows.push([]);
  
  rows.push(['(-) COSTO DE VENTAS']);
  data.costos?.detalle?.forEach(item => {
    rows.push([`  ${item.codigo} - ${item.nombre}`, -item.valor]);
  });
  rows.push(['Total Costos', -(data.costos?.total || 0)]);
  rows.push([]);
  
  rows.push(['= UTILIDAD BRUTA', data.utilidad_bruta || 0]);
  rows.push([]);
  
  rows.push(['(-) GASTOS OPERACIONALES']);
  rows.push(['Gastos de Administración']);
  data.gastos?.administracion?.detalle?.forEach(item => {
    rows.push([`  ${item.codigo} - ${item.nombre}`, -item.valor]);
  });
  rows.push(['Gastos de Ventas']);
  data.gastos?.ventas?.detalle?.forEach(item => {
    rows.push([`  ${item.codigo} - ${item.nombre}`, -item.valor]);
  });
  rows.push(['Total Gastos Operacionales', -(data.gastos?.total_operacionales || 0)]);
  rows.push([]);
  
  rows.push(['= UTILIDAD OPERACIONAL', data.utilidad_operacional || 0]);
  rows.push([]);
  rows.push(['(-) Impuesto de Renta (35%)', -(data.impuesto_renta || 0)]);
  rows.push([]);
  rows.push(['= UTILIDAD NETA DEL EJERCICIO', data.utilidad_neta || 0]);
  
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 45 },
    { wch: 18 },
  ];
  
  XLSX.utils.book_append_sheet(workbook, ws, 'Resultados Integral');
}

function generarCambiosPatrimonio(XLSX, workbook, data) {
  const rows = [
    [data.empresa?.razon_social || 'Empresa'],
    ['Estado de Cambios en el Patrimonio'],
    [`NIT: ${data.empresa?.nit || ''}`],
    [`Del ${data.periodo?.inicio} al ${data.periodo?.fin}`],
    ['NIIF para Pymes - Sección 6'],
    [],
    ['Concepto', 'Saldo Inicial', 'Aumentos', 'Disminuciones', 'Saldo Final'],
  ];
  
  data.componentes?.forEach(item => {
    rows.push([
      item.concepto,
      item.saldo_inicial,
      item.aumentos,
      item.disminuciones,
      item.saldo_final
    ]);
  });
  
  rows.push([]);
  rows.push([
    'TOTAL PATRIMONIO',
    data.totales?.saldo_inicial || 0,
    '',
    '',
    data.totales?.saldo_final || 0
  ]);
  
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 35 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];
  
  XLSX.utils.book_append_sheet(workbook, ws, 'Cambios Patrimonio');
}

function generarFlujosEfectivo(XLSX, workbook, data) {
  // ── Hoja 1: Estado de Flujos de Efectivo ──────────────────────────
  const rows = [
    [data.empresa?.razon_social || 'Empresa'],
    ['Estado de Flujos de Efectivo'],
    ['Método Indirecto'],
    [`NIT: ${data.empresa?.nit || ''}`],
    [`Del ${data.periodo?.inicio} al ${data.periodo?.fin}`],
    ['NIIF para Pymes - Sección 7'],
    [],
    ['Concepto', 'Valor'],
    [],
    ['EAO — ACTIVIDADES DE OPERACIÓN'],
    ['Resultado Neto del Ejercicio', data.operacion?.resultado_neto || 0],
    [],
    ['Partidas que no afectan el efectivo:'],
  ];

  // Partidas no efectivo
  (data.operacion?.partidas_no_efectivo || []).forEach(p => {
    rows.push(['  (+) ' + p.nombre, p.valor]);
  });
  rows.push(['Total partidas no efectivo', data.operacion?.total_no_efectivo || 0]);
  rows.push([]);
  rows.push(['EGO — Efectivo Generado por la Operación', data.operacion?.ego || 0]);
  rows.push([]);
  rows.push(['Variación Capital de Trabajo Neto Operativo:']);
  
  // CTNO items
  (data.operacion?.variacion_ctno || []).forEach(item => {
    rows.push(['  ' + item.nombre, item.valor]);
  });
  rows.push(['Total Variación CTNO', data.operacion?.total_ctno || 0]);
  rows.push([]);
  rows.push(['TOTAL EAO', '', data.operacion?.total || 0]);
  rows.push([]);

  // EAI
  rows.push(['EAI — ACTIVIDADES DE INVERSIÓN']);
  (data.inversion?.items || []).forEach(item => {
    rows.push(['  ' + item.nombre, item.valor]);
  });
  rows.push(['TOTAL EAI', '', data.inversion?.total || 0]);
  rows.push([]);

  // EAF
  rows.push(['EAF — ACTIVIDADES DE FINANCIACIÓN']);
  (data.financiacion?.items || []).forEach(item => {
    rows.push(['  ' + item.nombre, item.valor]);
  });
  rows.push(['TOTAL EAF', '', data.financiacion?.total || 0]);
  rows.push([]);

  // Resumen
  rows.push(['RESUMEN']);
  rows.push(['Variación Neta del Efectivo', data.resumen?.variacion_neta || 0]);
  rows.push(['Efectivo al Inicio del Período', data.resumen?.efectivo_inicial || 0]);
  rows.push(['EFECTIVO AL FINAL DEL PERÍODO', data.resumen?.efectivo_final_calculado || 0]);
  rows.push([]);
  rows.push(['Saldo según Balance', data.resumen?.efectivo_final_balance || 0]);
  rows.push(['Verificación', data.resumen?.cuadra ? '✓ CUADRADO' : '✗ DESCUADRE']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, ws, 'Flujos Efectivo');

  // ── Hoja 2: Tabla de Variaciones ──────────────────────────────────
  if (data.variaciones?.length > 0) {
    const varRows = [
      ['ANÁLISIS DE VARIACIONES'],
      [data.empresa?.razon_social || ''],
      [`Del ${data.periodo?.inicio} al ${data.periodo?.fin}`],
      [],
      ['Código', 'Cuenta', 'Saldo Inicial', 'Saldo Final', 'Variación', 'Clasificación', 'Efecto EFE'],
    ];
    data.variaciones.forEach(v => {
      varRows.push([
        v.codigo, v.nombre, v.saldo_inicial, v.saldo_final,
        v.variacion, v.clasificacion, v.efecto_efe || 0,
      ]);
    });
    const wsVar = XLSX.utils.aoa_to_sheet(varRows);
    wsVar['!cols'] = [
      { wch: 10 }, { wch: 30 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 10 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsVar, 'Variaciones');
  }
}

export default DescargarExcel;
