// 🎩 Don Peppini Contadore - Flujo de Efectivo v2 (Modelo Variaciones)
// frontend/src/components/FlujoEfectivoV2.jsx
// Usado dentro de EstadosFinancieros.jsx cuando activeTab === 'flujos'

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, Info } from 'lucide-react';

const fmt = (v) => {
  const n = Number(v) || 0;
  const prefix = n < 0 ? '-' : '';
  return `${prefix}$${Math.abs(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
};

const CLASIF_COLORS = {
  'VERIF': 'bg-blue-100 text-blue-800',
  'CTNO-A': 'bg-emerald-100 text-emerald-800',
  'CTNO-P': 'bg-amber-100 text-amber-800',
  'NO-EF': 'bg-purple-100 text-purple-800',
  'EAI': 'bg-orange-100 text-orange-800',
  'EAF': 'bg-indigo-100 text-indigo-800',
  'OTRO': 'bg-gray-100 text-gray-800',
};

const CLASIF_LABELS = {
  'VERIF': 'Efectivo',
  'CTNO-A': 'CTNO Activo',
  'CTNO-P': 'CTNO Pasivo',
  'NO-EF': 'No Efectivo',
  'EAI': 'Inversión',
  'EAF': 'Financiación',
};

// ====== COMPONENTE DE VARIACIONES (HOJA AUXILIAR) ======
function TablaVariaciones({ variaciones }) {
  const [showVariaciones, setShowVariaciones] = useState(false);

  if (!variaciones || variaciones.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowVariaciones(!showVariaciones)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-2"
      >
        {showVariaciones ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        📊 Hoja de Variaciones ({variaciones.length} cuentas)
      </button>

      {showVariaciones && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-2 text-left">Código</th>
                <th className="px-2 py-2 text-left">Cuenta</th>
                <th className="px-2 py-2 text-right">Saldo Inicial</th>
                <th className="px-2 py-2 text-right">Saldo Final</th>
                <th className="px-2 py-2 text-right">Variación</th>
                <th className="px-2 py-2 text-center">Clasif.</th>
              </tr>
            </thead>
            <tbody>
              {variaciones.map((v, i) => (
                <tr key={i} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-2 py-1 font-mono">{v.codigo}</td>
                  <td className="px-2 py-1">{v.nombre}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmt(v.saldo_inicial)}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmt(v.saldo_final)}</td>
                  <td className={`px-2 py-1 text-right font-mono font-semibold ${v.variacion > 0 ? 'text-green-700' : v.variacion < 0 ? 'text-red-700' : ''}`}>
                    {fmt(v.variacion)}
                  </td>
                  <td className="px-2 py-1 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CLASIF_COLORS[v.clasificacion] || 'bg-gray-100'}`}>
                      {CLASIF_LABELS[v.clasificacion] || v.clasificacion}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ====== FILA DEL FLUJO ======
function FilaFlujo({ concepto, valor, indent = false, bold = false, total = false, subtotal = false }) {
  const n = Number(valor) || 0;
  return (
    <tr className={`${total ? 'bg-indigo-50 font-bold' : subtotal ? 'bg-gray-50 font-semibold' : ''}`}>
      <td className={`py-1.5 px-4 ${indent ? 'pl-8' : ''} ${bold ? 'font-semibold' : ''} ${total ? 'text-indigo-900' : ''}`}>
        {concepto}
      </td>
      <td className={`py-1.5 px-4 text-right font-mono ${n < 0 ? 'text-red-600' : n > 0 ? 'text-green-700' : ''} ${bold || total || subtotal ? 'font-bold' : ''}`}>
        {fmt(n)}
      </td>
    </tr>
  );
}

// ====== SECCIÓN COLAPSABLE ======
function SeccionFlujo({ titulo, color, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const colores = {
    blue: 'bg-blue-50 text-blue-800',
    amber: 'bg-amber-50 text-amber-800',
    green: 'bg-green-50 text-green-800',
    indigo: 'bg-indigo-100 text-indigo-800',
  };

  return (
    <>
      <tr>
        <td colSpan="2" className="p-0">
          <button
            onClick={() => setOpen(!open)}
            className={`w-full flex items-center gap-2 py-2.5 px-4 font-bold text-sm ${colores[color] || colores.blue}`}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {titulo}
          </button>
        </td>
      </tr>
      {open && children}
    </>
  );
}

// ====== COMPONENTE PRINCIPAL ======
export default function FlujoEfectivoV2({ data }) {
  if (!data || !data.eao) {
    return <p className="text-gray-500 text-center py-8">No hay datos de flujo de efectivo</p>;
  }

  const { eao, eai, eaf, resumen, variaciones } = data;

  return (
    <div>
      {/* Variaciones (colapsable) */}
      <TablaVariaciones variaciones={variaciones} />

      {/* Flujo de Efectivo */}
      <div className="overflow-hidden border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="py-3 px-4 text-left font-semibold">Concepto</th>
              <th className="py-3 px-4 text-right font-semibold w-40">Valor</th>
            </tr>
          </thead>
          <tbody>
            {/* === EAO: ACTIVIDADES DE OPERACIÓN === */}
            <SeccionFlujo titulo="EAO — ACTIVIDADES DE OPERACIÓN" color="blue">
              <FilaFlujo concepto="Resultado Neto del Período" valor={eao.resultado_neto} bold />

              {/* Detalle resultado */}
              <tr>
                <td colSpan="2" className="px-8 py-1">
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Ingresos: {fmt(eao.detalle_resultado?.ingresos)}</span>
                    <span>Costos: {fmt(eao.detalle_resultado?.costos)}</span>
                    <span>Gastos: {fmt(eao.detalle_resultado?.gastos)}</span>
                  </div>
                </td>
              </tr>

              {/* Partidas que no afectan efectivo */}
              {eao.partidas_no_efectivo?.length > 0 && (
                <>
                  <tr><td colSpan="2" className="px-4 pt-2 text-xs text-gray-500 font-medium">Partidas que no afectan el efectivo:</td></tr>
                  {eao.partidas_no_efectivo.map((p, i) => (
                    <FilaFlujo key={i} concepto={`(+) ${p.concepto}`} valor={p.valor} indent />
                  ))}
                </>
              )}

              <FilaFlujo concepto="= EGO (Efectivo Generado por la Operación)" valor={eao.ego} subtotal />

              {/* Variación CTNO */}
              <tr><td colSpan="2" className="px-4 pt-3 text-xs text-gray-500 font-medium">Variación Capital de Trabajo Neto Operativo:</td></tr>
              {eao.variacion_ctno?.map((v, i) => (
                <FilaFlujo key={i} concepto={v.concepto} valor={v.valor} indent />
              ))}
              <FilaFlujo concepto="= Variación CTNO" valor={eao.total_variacion_ctno} subtotal />

              <FilaFlujo concepto="TOTAL EAO" valor={eao.total_eao} total />
            </SeccionFlujo>

            {/* === EAI: ACTIVIDADES DE INVERSIÓN === */}
            <SeccionFlujo titulo="EAI — ACTIVIDADES DE INVERSIÓN" color="amber">
              {eai.detalle?.length > 0 ? (
                eai.detalle.map((v, i) => (
                  <FilaFlujo key={i} concepto={v.concepto} valor={v.valor} indent />
                ))
              ) : (
                <tr><td colSpan="2" className="px-8 py-2 text-xs text-gray-400 italic">Sin movimientos de inversión</td></tr>
              )}
              <FilaFlujo concepto="TOTAL EAI" valor={eai.total_eai} total />
            </SeccionFlujo>

            {/* === EAF: ACTIVIDADES DE FINANCIACIÓN === */}
            <SeccionFlujo titulo="EAF — ACTIVIDADES DE FINANCIACIÓN" color="green">
              {eaf.detalle?.length > 0 ? (
                eaf.detalle.map((v, i) => (
                  <FilaFlujo key={i} concepto={v.concepto} valor={v.valor} indent />
                ))
              ) : (
                <tr><td colSpan="2" className="px-8 py-2 text-xs text-gray-400 italic">Sin movimientos de financiación</td></tr>
              )}
              <FilaFlujo concepto="TOTAL EAF" valor={eaf.total_eaf} total />
            </SeccionFlujo>

            {/* === RESUMEN === */}
            <tr><td colSpan="2" className="bg-indigo-100 py-2 px-4 font-bold text-indigo-900 text-sm">RESUMEN</td></tr>
            <FilaFlujo concepto="Variación Neta del Efectivo" valor={resumen.variacion_neta} bold />
            <FilaFlujo concepto="Efectivo al Inicio del Período" valor={resumen.efectivo_inicial} />
            <FilaFlujo concepto="Efectivo al Final del Período" valor={resumen.efectivo_final_calculado} bold />

            {/* Verificación */}
            <tr>
              <td colSpan="2" className={`px-4 py-2 text-center text-sm font-medium ${resumen.cuadra ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {resumen.cuadra ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle size={16} /> ✓ CUADRADO — Efectivo real: {fmt(resumen.efectivo_final_real)}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <AlertCircle size={16} /> ✗ DESCUADRE — Calculado: {fmt(resumen.efectivo_final_calculado)} vs Real: {fmt(resumen.efectivo_final_real)}
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Leyenda de clasificaciones */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(CLASIF_LABELS).map(([key, label]) => (
          <span key={key} className={`px-2 py-1 rounded text-xs ${CLASIF_COLORS[key]}`}>
            {key}: {label}
          </span>
        ))}
      </div>
    </div>
  );
}
