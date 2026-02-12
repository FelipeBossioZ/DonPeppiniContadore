// 🎩 Don Peppini Contadore - Preview de Impuesto de Renta
// frontend/src/components/PreviewImpuestos.jsx
// Se integra en CierreContable.jsx como botón/sección adicional

import React, { useState } from 'react';
import { Calculator, TrendingUp, TrendingDown, DollarSign, AlertCircle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import api from '../services/api';

const fmt = (v) => `$${Math.abs(Number(v) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export default function PreviewImpuestos({ empresaId, año }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDetalle, setShowDetalle] = useState(false);
  const [showRetCausadas, setShowRetCausadas] = useState(false);

  const calcular = async () => {
    if (!empresaId || !año) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/contabilidad/cierres/preview-impuestos/', {
        empresa: empresaId,
        año: año,
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error calculando impuestos');
    }
    setLoading(false);
  };

  if (!data) {
    return (
      <div className="mt-4 border border-dashed border-amber-300 rounded-lg p-4 bg-amber-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Preview de Impuesto de Renta {año}
            </span>
          </div>
          <button
            onClick={calcular}
            disabled={loading}
            className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <DollarSign size={14} />
            )}
            Calcular Estimado
          </button>
        </div>
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </div>
    );
  }

  const { estado_resultados, impuesto, anticipos_a_favor, impuesto_neto, info_retenciones_causadas } = data;
  const hayUtilidad = estado_resultados.utilidad_antes_impuestos > 0;

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 ${hayUtilidad ? 'bg-amber-100' : 'bg-gray-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator size={18} className={hayUtilidad ? 'text-amber-700' : 'text-gray-500'} />
            <span className="font-semibold text-sm">
              Estimación Impuesto de Renta {data.año}
            </span>
            <span className="text-xs text-gray-500">(Tarifa: {data.tarifa_aplicada}%)</span>
          </div>
          <button
            onClick={() => { setData(null); setError(null); }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Recalcular
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Estado de Resultados resumido */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="bg-green-50 rounded-lg p-2">
            <p className="text-xs text-green-600">Ingresos</p>
            <p className="font-semibold text-green-800 text-sm">{fmt(estado_resultados.ingresos)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2">
            <p className="text-xs text-red-600">Costos</p>
            <p className="font-semibold text-red-800 text-sm">{fmt(estado_resultados.costos)}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <p className="text-xs text-orange-600">Gastos</p>
            <p className="font-semibold text-orange-800 text-sm">{fmt(estado_resultados.gastos)}</p>
          </div>
          <div className={`rounded-lg p-2 ${hayUtilidad ? 'bg-blue-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-600">{estado_resultados.tipo_resultado}</p>
            <p className={`font-bold text-sm ${hayUtilidad ? 'text-blue-800' : 'text-gray-500'}`}>
              {hayUtilidad ? '' : '-'}{fmt(estado_resultados.utilidad_antes_impuestos)}
            </p>
          </div>
        </div>

        {!hayUtilidad ? (
          <div className="bg-gray-50 border rounded-lg p-3 text-center">
            <p className="text-gray-600 text-sm">📉 Pérdida fiscal — No hay impuesto de renta a provisionar</p>
            <p className="text-gray-400 text-xs mt-1">La pérdida podrá compensarse en años siguientes (Art. 147 ET)</p>
          </div>
        ) : (
          <>
            {/* Cálculo del impuesto */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {/* Impuesto Bruto */}
                  <tr className="border-b">
                    <td className="px-4 py-2">Utilidad gravable</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(impuesto.base_gravable)}</td>
                  </tr>
                  <tr className="border-b bg-amber-50">
                    <td className="px-4 py-2 font-semibold">
                      × Impuesto Bruto ({impuesto.tarifa})
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-amber-800">
                      {fmt(impuesto.impuesto_bruto)}
                    </td>
                  </tr>

                  {/* Anticipos a favor */}
                  <tr className="border-b">
                    <td className="px-4 py-1 pt-2" colSpan={2}>
                      <button
                        onClick={() => setShowDetalle(!showDetalle)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        {showDetalle ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        Retenciones y anticipos a favor ({anticipos_a_favor.detalle.length} cuentas)
                      </button>
                    </td>
                  </tr>

                  {showDetalle && anticipos_a_favor.detalle.map((r, i) => (
                    <tr key={i} className="border-b bg-blue-50/50">
                      <td className="px-8 py-1 text-xs">
                        <span className="font-mono text-gray-500">{r.codigo}</span> {r.nombre}
                      </td>
                      <td className="px-4 py-1 text-right text-xs font-mono text-blue-700">
                        -{fmt(r.saldo)}
                      </td>
                    </tr>
                  ))}

                  <tr className="border-b bg-blue-50">
                    <td className="px-4 py-2 font-semibold">
                      (-) Total Anticipos a Favor
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-blue-800">
                      -{fmt(anticipos_a_favor.total)}
                    </td>
                  </tr>

                  {/* IMPUESTO NETO */}
                  <tr className="bg-indigo-100">
                    <td className="px-4 py-3 font-bold text-indigo-900 text-base">
                      = IMPUESTO NETO ESTIMADO
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-900 text-lg">
                      {fmt(impuesto_neto.valor)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mensaje de acción */}
            <div className={`rounded-lg p-3 flex items-start gap-2 ${impuesto_neto.valor > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <Info size={16} className={impuesto_neto.valor > 0 ? 'text-amber-600 mt-0.5' : 'text-green-600 mt-0.5'} />
              <div>
                <p className={`text-sm font-medium ${impuesto_neto.valor > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                  {impuesto_neto.mensaje}
                </p>
                {impuesto_neto.valor > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    💡 Este es un estimado. El valor final depende de la declaración de renta con todas las deducciones, rentas exentas y descuentos tributarios aplicables.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Info: Retenciones causadas a terceros */}
        {info_retenciones_causadas.detalle.length > 0 && (
          <div className="border-t pt-3">
            <button
              onClick={() => setShowRetCausadas(!showRetCausadas)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {showRetCausadas ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              ℹ️ Retenciones practicadas a terceros (pasivo): {fmt(info_retenciones_causadas.total)}
            </button>
            {showRetCausadas && (
              <div className="mt-2 bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-400 mb-1">{info_retenciones_causadas.nota}</p>
                {info_retenciones_causadas.detalle.map((r, i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5">
                    <span><span className="font-mono text-gray-400">{r.codigo}</span> {r.nombre}</span>
                    <span className="font-mono">{fmt(r.saldo)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
