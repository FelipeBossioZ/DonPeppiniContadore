// 🎩 Don Peppini Contadore — Plantillas de Asiento + Asientos Programados
import React, { useState, useEffect } from 'react';
import {
  Bookmark, Plus, Trash2, Play, Clock, CheckCircle,
  AlertCircle, Loader2, X, Calendar, ToggleLeft, ToggleRight,
  Copy, FileText
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const fmt = (v) => `$${Math.abs(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export default function Plantillas() {
  const { empresaId } = useEmpresa();
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal crear
  const [showCrear, setShowCrear] = useState(false);
  const [nombre, setNombre] = useState('');
  const [concepto, setConcepto] = useState('');
  const [tipoComp, setTipoComp] = useState('OT');
  const [diaDelMes, setDiaDelMes] = useState('');

  // Modal desde asiento
  const [showDesdeAsiento, setShowDesdeAsiento] = useState(false);
  const [asientoId, setAsientoId] = useState('');
  const [nombreDesde, setNombreDesde] = useState('');
  const [diaDesde, setDiaDesde] = useState('');

  // Expandido
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (empresaId) cargar();
  }, [empresaId]);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await api.get('/contabilidad/plantillas/', { params: { empresa: empresaId } });
      setPlantillas(res.data);
    } catch (err) {
      setError('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  const crearDesdeAsiento = async () => {
    if (!asientoId || !nombreDesde) { setError('ID de asiento y nombre son requeridos'); return; }
    try {
      await api.post('/contabilidad/plantillas/crear/', {
        empresa: empresaId,
        nombre: nombreDesde,
        desde_asiento_id: parseInt(asientoId),
        dia_del_mes: diaDesde || undefined,
      });
      setSuccess('✅ Plantilla creada desde asiento');
      setShowDesdeAsiento(false);
      setAsientoId(''); setNombreDesde(''); setDiaDesde('');
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear');
    }
  };

  const eliminar = async (id, nombre) => {
    if (!confirm(`¿Eliminar plantilla "${nombre}"?`)) return;
    try {
      await api.delete(`/contabilidad/plantillas/${id}/eliminar/`);
      cargar();
    } catch (err) {
      setError('Error al eliminar');
    }
  };

  const toggleProgramado = async (plantilla, nuevoActivo) => {
    const dia = plantilla.programado?.dia_del_mes || parseInt(prompt('¿Qué día del mes? (1-28)'));
    if (!dia || dia < 1 || dia > 28) return;
    try {
      await api.post('/contabilidad/plantillas/programado/', {
        empresa: empresaId,
        plantilla_id: plantilla.id,
        dia_del_mes: dia,
        activo: nuevoActivo,
      });
      cargar();
    } catch (err) {
      setError('Error al programar');
    }
  };

  const generarBorradores = async () => {
    try {
      const res = await api.post('/contabilidad/plantillas/generar-borradores/', {
        empresa: empresaId,
      });
      if (res.data.count > 0) {
        setSuccess(`✅ ${res.data.count} borrador(es) generado(s): ${res.data.generados.map(g => g.numero).join(', ')}`);
      } else {
        setSuccess('No hay borradores pendientes para generar');
      }
      cargar();
    } catch (err) {
      setError('Error al generar borradores');
    }
  };

  const usarPlantilla = (p) => {
    // Copiar datos al clipboard como JSON para usar en Contabilidad
    const data = {
      tipo_comprobante: p.tipo_comprobante,
      concepto: p.concepto,
      lineas: p.lineas.map(l => ({
        cuenta_codigo: l.cuenta_codigo,
        cuenta_nombre: l.cuenta_nombre,
        tercero_id: l.tercero_id,
        tercero_nombre: l.tercero_nombre,
        debito: l.tipo === 'debito' ? l.monto : 0,
        credito: l.tipo === 'credito' ? l.monto : 0,
      })),
    };
    // Store in localStorage for Contabilidad to pick up
    localStorage.setItem('plantilla_asiento', JSON.stringify(data));
    setSuccess(`📋 Plantilla "${p.nombre}" lista — ve a Contabilidad y crea un nuevo asiento`);
  };

  const programados = plantillas.filter(p => p.programado?.activo);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Bookmark className="text-purple-600" size={28} />
            Plantillas de Asiento
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Guarda asientos frecuentes y programa borradores automáticos
          </p>
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          <button onClick={() => setShowDesdeAsiento(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-1.5">
            <Copy size={16} /> Crear desde asiento
          </button>
          {programados.length > 0 && (
            <button onClick={generarBorradores}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-1.5">
              <Play size={16} /> Generar borradores
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5 shrink-0" /> {success}
          <button onClick={() => setSuccess(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {/* Info programados */}
      {programados.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
            <Clock size={18} /> {programados.length} asiento(s) programado(s)
          </div>
          <div className="flex flex-wrap gap-2">
            {programados.map(p => (
              <span key={p.id} className="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full">
                {p.nombre} — Día {p.programado.dia_del_mes}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lista de plantillas */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : plantillas.length === 0 ? (
        <div className="bg-white rounded-xl border text-center py-12">
          <Bookmark className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No hay plantillas</p>
          <p className="text-sm text-gray-400 mt-1">
            Crea una desde un asiento existente con el botón "Crear desde asiento"
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plantillas.map(p => (
            <div key={p.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                  <div className="bg-purple-100 rounded-lg p-2">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.nombre}</h3>
                    <p className="text-sm text-gray-500">
                      {p.tipo_comprobante} — {p.lineas.length} líneas
                      {p.concepto && ` — ${p.concepto.substring(0, 50)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Toggle programado */}
                  <button onClick={() => toggleProgramado(p, !p.programado?.activo)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      p.programado?.activo
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {p.programado?.activo
                      ? <><ToggleRight size={14} /> Día {p.programado.dia_del_mes}</>
                      : <><ToggleLeft size={14} /> Programar</>
                    }
                  </button>

                  <button onClick={() => usarPlantilla(p)}
                    className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 flex items-center gap-1">
                    <Play size={14} /> Usar
                  </button>
                  <button onClick={() => eliminar(p.id, p.nombre)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Detalle expandible */}
              {expanded === p.id && (
                <div className="border-t bg-gray-50 px-5 py-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-1">Cuenta</th>
                        <th className="text-left py-1">Tercero</th>
                        <th className="text-right py-1">Débito</th>
                        <th className="text-right py-1">Crédito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.lineas.map((l, i) => (
                        <tr key={i} className="border-t border-gray-200">
                          <td className="py-1.5">
                            <span className="font-mono bg-gray-200 rounded px-1">{l.cuenta_codigo}</span>
                            <span className="ml-1 text-gray-700">{l.cuenta_nombre}</span>
                          </td>
                          <td className="py-1.5 text-gray-600">{l.tercero_nombre || '—'}</td>
                          <td className="py-1.5 text-right font-mono text-blue-700">
                            {l.tipo === 'debito' && l.monto > 0 ? fmt(l.monto) : ''}
                          </td>
                          <td className="py-1.5 text-right font-mono text-red-700">
                            {l.tipo === 'credito' && l.monto > 0 ? fmt(l.monto) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear desde asiento */}
      {showDesdeAsiento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Copy className="text-purple-600" size={20} />
                Crear plantilla desde asiento
              </h3>
              <button onClick={() => setShowDesdeAsiento(false)}><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500">
              Copia la estructura de un asiento existente. Los montos se guardan como referencia
              y puedes modificarlos al usar la plantilla.
            </p>
            <div>
              <label className="text-xs text-gray-500">ID del asiento (número en la lista)</label>
              <input type="number" value={asientoId} onChange={e => setAsientoId(e.target.value)}
                placeholder="Ej: 42"
                className="border rounded-lg px-3 py-2 w-full mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Nombre de la plantilla</label>
              <input value={nombreDesde} onChange={e => setNombreDesde(e.target.value)}
                placeholder="Ej: Factura Neurológico, Arriendo consultorio"
                className="border rounded-lg px-3 py-2 w-full mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Programar automático (opcional) — Día del mes</label>
              <input type="number" min="1" max="28" value={diaDesde}
                onChange={e => setDiaDesde(e.target.value)}
                placeholder="Ej: 8 (deja vacío para no programar)"
                className="border rounded-lg px-3 py-2 w-full mt-1" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDesdeAsiento(false)}
                className="flex-1 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={crearDesdeAsiento}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                Crear plantilla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
