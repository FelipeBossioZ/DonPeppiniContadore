// 🎩 Don Peppini Contadore - Cierre Contable
// frontend/src/pages/CierreContable.jsx

import React, { useState, useEffect } from 'react';
import { 
  Building2, Lock, Unlock, Calendar, Loader2, AlertCircle,
  CheckCircle, AlertTriangle, FileText, TrendingUp, TrendingDown,
  Info, ChevronDown, ChevronUp, RefreshCw, X
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CierreContable() {
  const { empresaActual, empresaId } = useEmpresa();
  
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal nuevo cierre
  const [showModal, setShowModal] = useState(false);
  const [tipoCierre, setTipoCierre] = useState('anual');
  const [añoCierre, setAñoCierre] = useState(new Date().getFullYear());
  const [mesCierre, setMesCierre] = useState(new Date().getMonth() + 1);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [notas, setNotas] = useState('');
  
  // Modal reabrir
  const [showReabrir, setShowReabrir] = useState(false);
  const [cierreReabrir, setCierreReabrir] = useState(null);
  const [motivoReabrir, setMotivoReabrir] = useState('');

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (empresaId) cargarCierres();
  }, [empresaId]);

  const cargarCierres = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/contabilidad/cierres/', {
        params: { empresa: empresaId }
      });
      setCierres(res.data.cierres || []);
    } catch (err) {
      setError('Error al cargar cierres');
    } finally {
      setLoading(false);
    }
  };

  const obtenerPreview = async () => {
    setLoadingPreview(true);
    setPreview(null);
    try {
      const res = await api.post('/contabilidad/cierres/preview/', {
        empresa: empresaId,
        tipo: tipoCierre,
        año: añoCierre,
        mes: tipoCierre === 'mensual' ? mesCierre : null
      });
      setPreview(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al obtener preview');
      if (err.response?.data?.ya_cerrado) {
        setShowModal(false);
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const ejecutarCierre = async () => {
    setEjecutando(true);
    try {
      const res = await api.post('/contabilidad/cierres/ejecutar/', {
        empresa: empresaId,
        tipo: tipoCierre,
        año: añoCierre,
        mes: tipoCierre === 'mensual' ? mesCierre : null,
        notas
      });
      
      alert(`✅ ${res.data.mensaje}\n\nResultado: ${res.data.resumen.tipo_resultado} de $${Math.abs(res.data.resumen.resultado).toLocaleString('es-CO')}`);
      
      setShowModal(false);
      setPreview(null);
      setNotas('');
      cargarCierres();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al ejecutar cierre');
    } finally {
      setEjecutando(false);
    }
  };

  const reabrirPeriodo = async () => {
    if (!motivoReabrir.trim()) {
      alert('Debe indicar el motivo para reabrir el período');
      return;
    }
    
    try {
      await api.post('/contabilidad/cierres/reabrir/', {
        cierre_id: cierreReabrir.id,
        motivo: motivoReabrir
      });
      
      alert('Período reabierto correctamente');
      setShowReabrir(false);
      setCierreReabrir(null);
      setMotivoReabrir('');
      cargarCierres();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al reabrir período');
    }
  };

  const formatMoney = (val) => `$${Math.abs(val || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

  if (!empresaActual) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Building2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Selecciona una empresa</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <span>🎩</span> Cierre Contable
          </h1>
          <p className="text-gray-600 mt-1">{empresaActual.razon_social}</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setPreview(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Lock className="h-4 w-4" />
          Nuevo Cierre
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <Info className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">¿Qué hace el cierre contable?</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Salda las cuentas de Ingresos (clase 4), Costos (clase 6) y Gastos (clase 5)</li>
              <li>Traslada el resultado a Utilidad o Pérdida del Ejercicio (cuenta 3605 o 3610)</li>
              <li>Bloquea el período para evitar modificaciones</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />{error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Lista de cierres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-900">Historial de Cierres</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
          </div>
        ) : cierres.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Lock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No hay cierres registrados</p>
            <p className="text-sm mt-1">Los períodos están abiertos para modificación</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-sm text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left">Período</th>
                <th className="px-6 py-3 text-left">Tipo</th>
                <th className="px-6 py-3 text-right">Ingresos</th>
                <th className="px-6 py-3 text-right">Costos+Gastos</th>
                <th className="px-6 py-3 text-right">Resultado</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cierres.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{c.periodo}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      c.tipo === 'anual' 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {c.tipo_display}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-green-600">{formatMoney(c.total_ingresos)}</td>
                  <td className="px-6 py-4 text-right text-red-600">{formatMoney(c.total_costos + c.total_gastos)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${c.resultado_ejercicio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {c.resultado_ejercicio >= 0 ? '+' : '-'}{formatMoney(c.resultado_ejercicio)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {c.estado === 'cerrado' ? (
                      <span className="flex items-center justify-center gap-1 text-green-600">
                        <Lock className="h-4 w-4" /> Cerrado
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-amber-600">
                        <Unlock className="h-4 w-4" /> Reabierto
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {c.estado === 'cerrado' && (
                      <button
                        onClick={() => { setCierreReabrir(c); setShowReabrir(true); }}
                        className="text-sm text-amber-600 hover:text-amber-700"
                      >
                        Reabrir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Nuevo Cierre */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nuevo Cierre Contable</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Selección de período */}
              {!preview && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Cierre</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="anual"
                          checked={tipoCierre === 'anual'}
                          onChange={(e) => setTipoCierre(e.target.value)}
                          className="text-indigo-600"
                        />
                        <span>Anual</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="mensual"
                          checked={tipoCierre === 'mensual'}
                          onChange={(e) => setTipoCierre(e.target.value)}
                          className="text-indigo-600"
                        />
                        <span>Mensual</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                      <select
                        value={añoCierre}
                        onChange={(e) => setAñoCierre(parseInt(e.target.value))}
                        className="border rounded-lg px-3 py-2 w-full"
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    {tipoCierre === 'mensual' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                        <select
                          value={mesCierre}
                          onChange={(e) => setMesCierre(parseInt(e.target.value))}
                          className="border rounded-lg px-3 py-2 w-full"
                        >
                          {MESES.slice(1).map((m, i) => (
                            <option key={i + 1} value={i + 1}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={obtenerPreview}
                    disabled={loadingPreview}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                  >
                    {loadingPreview ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Ver Preview</>
                    )}
                  </button>
                </div>
              )}
              
              {/* Preview */}
              {preview && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {preview.tipo === 'anual' ? 'Cierre Anual' : 'Cierre Mensual'}: {preview.periodo}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Período: {preview.fecha_inicio} al {preview.fecha_fin}
                    </p>
                  </div>
                  
                  {/* Resumen */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-sm text-green-700">Total Ingresos</div>
                      <div className="text-2xl font-bold text-green-700">{formatMoney(preview.resumen.ingresos)}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="text-sm text-red-700">Costos + Gastos</div>
                      <div className="text-2xl font-bold text-red-700">
                        {formatMoney(preview.resumen.costos + preview.resumen.gastos)}
                      </div>
                    </div>
                  </div>
                  
                  <div className={`rounded-lg p-4 ${preview.resumen.resultado >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-sm ${preview.resumen.resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {preview.resumen.tipo_resultado} del Ejercicio
                        </div>
                        <div className={`text-3xl font-bold ${preview.resumen.resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatMoney(preview.resumen.resultado)}
                        </div>
                      </div>
                      {preview.resumen.resultado >= 0 ? (
                        <TrendingUp className="h-12 w-12 text-green-500" />
                      ) : (
                        <TrendingDown className="h-12 w-12 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  {/* Cuenta destino */}
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="text-sm text-indigo-700">Se registrará en:</div>
                    <div className="font-semibold text-indigo-900">
                      {preview.cuenta_destino.codigo} - {preview.cuenta_destino.nombre}
                    </div>
                  </div>
                  
                  {/* Cuentas a saldar (colapsable) */}
                  {preview.cuentas_a_saldar?.length > 0 && (
                    <details className="bg-gray-50 rounded-lg">
                      <summary className="px-4 py-3 cursor-pointer font-medium text-gray-700">
                        Ver {preview.cuentas_a_saldar.length} cuentas a saldar
                      </summary>
                      <div className="px-4 pb-3 max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1">Cuenta</th>
                              <th className="text-right py-1">Saldo</th>
                              <th className="text-right py-1">Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.cuentas_a_saldar.map((c, i) => (
                              <tr key={i} className="border-t">
                                <td className="py-1">{c.codigo} - {c.nombre}</td>
                                <td className="py-1 text-right">{formatMoney(c.saldo)}</td>
                                <td className="py-1 text-right text-xs">
                                  <span className={c.accion === 'debitar' ? 'text-blue-600' : 'text-orange-600'}>
                                    {c.accion}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                  
                  {/* Notas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                    <textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      className="border rounded-lg px-3 py-2 w-full"
                      rows={2}
                      placeholder="Observaciones del cierre..."
                    />
                  </div>
                  
                  {/* Botones */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPreview(null)}
                      className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Volver
                    </button>
                    <button
                      onClick={ejecutarCierre}
                      disabled={ejecutando}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      {ejecutando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Ejecutar Cierre
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Reabrir */}
      {showReabrir && cierreReabrir && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-amber-600 flex items-center gap-2">
                <Unlock className="h-5 w-5" />
                Reabrir Período
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                ¿Está seguro de reabrir el período <strong>{cierreReabrir.periodo}</strong>?
              </p>
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                ⚠️ Esto anulará el asiento de cierre y permitirá modificar asientos en este período.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo de reapertura *
                </label>
                <textarea
                  value={motivoReabrir}
                  onChange={(e) => setMotivoReabrir(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full"
                  rows={2}
                  placeholder="Indique el motivo..."
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowReabrir(false); setCierreReabrir(null); setMotivoReabrir(''); }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={reabrirPeriodo}
                  className="flex-1 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Confirmar Reapertura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
