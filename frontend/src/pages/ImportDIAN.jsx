// 🎩 Don Peppini Contadore - Importador DIAN con Retenciones
// frontend/src/pages/ImportDIAN.jsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, Building2, Loader2, AlertCircle, CheckCircle,
  X, Search, ChevronDown, Check, Trash2, Download, RefreshCw, Info
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const formatMoney = (v) => `$${Math.abs(Number(v) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export default function ImportDIAN() {
  const { empresaActual, empresaId } = useEmpresa();

  // Estado principal
  const [tipo, setTipo] = useState('recibidos');
  const [archivo, setArchivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Datos parseados
  const [filas, setFilas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Conceptos retención
  const [conceptos, setConceptos] = useState([]);
  const [loadingConceptos, setLoadingConceptos] = useState(false);

  // Confirmación
  const [showConfirm, setShowConfirm] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    cargarConceptos();
  }, []);

  const cargarConceptos = async () => {
    setLoadingConceptos(true);
    try {
      const res = await api.get('/contabilidad/retenciones/');
      setConceptos(res.data.conceptos || []);
    } catch {
      // Si no hay conceptos, intentar seed
      try {
        await api.post('/contabilidad/retenciones/seed/');
        const res = await api.get('/contabilidad/retenciones/');
        setConceptos(res.data.conceptos || []);
      } catch (e) {
        console.error('Error cargando conceptos:', e);
      }
    }
    setLoadingConceptos(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setArchivo(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setArchivo(file);
    }
  };

  const subirYParsear = async () => {
    if (!archivo || !empresaId) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('tipo', tipo);
    formData.append('empresa', empresaId);

    try {
      const res = await api.post('/contabilidad/importar-dian/preview/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFilas(res.data.filas || []);
      setCuentas(res.data.cuentas || []);
      setShowModal(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error procesando archivo');
    }
    setLoading(false);
  };

  // Actualizar campo de una fila
  const updateFila = useCallback((idx, campo, valor) => {
    setFilas(prev => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [campo]: valor };

      // Auto-calcular retención al cambiar concepto, subtotal o autoretenedor
      if (['concepto_retencion_id', 'subtotal', 'es_autoretenedor'].includes(campo)) {
        const fila = copia[idx];
        const concepto = conceptos.find(c => c.id === (campo === 'concepto_retencion_id' ? valor : fila.concepto_retencion_id));
        const sub = Number(campo === 'subtotal' ? valor : fila.subtotal) || 0;
        const autoret = campo === 'es_autoretenedor' ? valor : fila.es_autoretenedor;

        if (autoret || !concepto || concepto.codigo === 'NONE') {
          copia[idx].retencion_calculada = 0;
          copia[idx].cuenta_retencion = '';
        } else {
          const base = Number(concepto.base_minima_pesos) || 0;
          if (base > 0 && sub < base) {
            copia[idx].retencion_calculada = 0;
            copia[idx].cuenta_retencion = '';
          } else {
            copia[idx].retencion_calculada = Math.round(sub * Number(concepto.tarifa) / 100);
            copia[idx].cuenta_retencion = concepto.cuenta_retencion || '';
          }
        }

        // Recalcular total si cambió subtotal
        if (campo === 'subtotal') {
          copia[idx].total = Number(valor) + Number(copia[idx].iva || 0);
        }
      }

      if (campo === 'iva') {
        copia[idx].total = Number(copia[idx].subtotal || 0) + Number(valor || 0);
      }

      return copia;
    });
  }, [conceptos]);

  const toggleAll = (checked) => {
    setFilas(prev => prev.map(f => ({ ...f, incluir: checked })));
  };

  const filasSeleccionadas = filas.filter(f => f.incluir);
  const totalRetenciones = filasSeleccionadas.reduce((s, f) => s + Number(f.retencion_calculada || 0), 0);
  const totalFacturas = filasSeleccionadas.reduce((s, f) => s + Number(f.total || 0), 0);

  const ejecutarImportacion = async () => {
    setEjecutando(true);
    setError(null);
    try {
      const res = await api.post('/contabilidad/importar-dian/ejecutar/', {
        empresa: empresaId,
        tipo,
        filas: filasSeleccionadas,
      });
      setResultado(res.data);
      setSuccess(res.data.mensaje);
      setShowConfirm(false);
      setShowModal(false);
      setArchivo(null);
      setFilas([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Error en importación');
    }
    setEjecutando(false);
  };

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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <span>🎩</span> Importar Facturas DIAN
        </h1>
        <p className="text-gray-600 mt-1">{empresaActual.razon_social} — Importar desde Excel DIAN con retenciones automáticas</p>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5" /> {success}
          <button onClick={() => setSuccess(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="mb-6 bg-white border rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" /> Importación completada
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>Asientos creados: <span className="font-bold">{resultado.asientos_creados}</span></div>
            <div>Terceros nuevos: <span className="font-bold">{resultado.terceros_creados}</span></div>
          </div>
          {resultado.errores?.length > 0 && (
            <div className="mt-3 text-sm text-amber-700">
              <p className="font-semibold">⚠️ Errores:</p>
              {resultado.errores.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">¿Cómo funciona?</p>
            <p>1. Descarga el Excel de facturas desde el portal DIAN (Emitidos o Recibidos)</p>
            <p>2. Súbelo aquí → Don Peppini parsea los datos y te muestra una tabla editable</p>
            <p>3. Clasifica cada factura por concepto de retención → se calcula automáticamente</p>
            <p>4. Revisa, edita lo que necesites y confirma → se crean terceros + asientos contables</p>
          </div>
        </div>
      </div>

      {/* Upload area */}
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        {/* Tipo selector */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTipo('recibidos')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
              tipo === 'recibidos'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <Download className="h-5 w-5 inline mr-2" />
            📥 Facturas Recibidas (Compras)
          </button>
          <button
            onClick={() => setTipo('emitidos')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
              tipo === 'emitidos'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <Upload className="h-5 w-5 inline mr-2" />
            📤 Facturas Emitidas (Ventas)
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors"
        >
          <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          {archivo ? (
            <div>
              <p className="text-gray-900 font-medium">{archivo.name}</p>
              <p className="text-gray-500 text-sm mt-1">{(archivo.size / 1024).toFixed(0)} KB</p>
              <button onClick={() => setArchivo(null)} className="text-red-500 text-sm mt-2 hover:underline">
                Quitar archivo
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">Arrastra el Excel DIAN aquí o</p>
              <label className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700">
                Seleccionar archivo
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          )}
        </div>

        {/* Botón procesar */}
        {archivo && (
          <button
            onClick={subirYParsear}
            disabled={loading}
            className="mt-4 w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            {loading ? 'Procesando...' : 'Procesar y previsualizar'}
          </button>
        )}
      </div>

      {/* ========== MODAL TABLA EDITABLE ========== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-[98vw] max-w-[1600px] mx-4 mb-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {tipo === 'recibidos' ? '📥 Facturas Recibidas' : '📤 Facturas Emitidas'} — Preview
                </h2>
                <p className="text-sm text-gray-500">
                  {filasSeleccionadas.length} de {filas.length} facturas seleccionadas ·
                  Total: {formatMoney(totalFacturas)} ·
                  {tipo === 'recibidos' && ` Retenciones: ${formatMoney(totalRetenciones)} ·`}
                  Todos los campos son editables
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Table container */}
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2 text-left">
                      <input type="checkbox"
                        checked={filas.every(f => f.incluir)}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                    </th>
                    <th className="px-2 py-2 text-left">NIT</th>
                    <th className="px-2 py-2 text-left min-w-[180px]">Nombre / Razón Social</th>
                    <th className="px-2 py-2 text-left">Folio</th>
                    <th className="px-2 py-2 text-left">Fecha</th>
                    <th className="px-2 py-2 text-right">Subtotal</th>
                    <th className="px-2 py-2 text-right">IVA</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2 text-left min-w-[100px]">
                      {tipo === 'recibidos' ? 'Cta Gasto' : 'Cta CxC'}
                    </th>
                    {tipo === 'emitidos' && (
                      <th className="px-2 py-2 text-left min-w-[100px]">Cta Ingreso</th>
                    )}
                    <th className="px-2 py-2 text-left min-w-[80px]">Cta IVA</th>
                    {tipo === 'recibidos' && (
                      <>
                        <th className="px-2 py-2 text-center">Auto-Ret</th>
                        <th className="px-2 py-2 text-left min-w-[200px]">Concepto Retención</th>
                        <th className="px-2 py-2 text-left min-w-[80px]">Cta Rete</th>
                        <th className="px-2 py-2 text-right">Retención</th>
                      </>
                    )}
                    <th className="px-2 py-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, i) => (
                    <tr key={i} className={`border-b hover:bg-gray-50 ${!fila.incluir ? 'opacity-40' : ''} ${!fila.tercero_existe ? 'bg-yellow-50' : ''}`}>
                      {/* Incluir */}
                      <td className="px-2 py-1">
                        <input type="checkbox" checked={fila.incluir}
                          onChange={(e) => updateFila(i, 'incluir', e.target.checked)} />
                      </td>
                      {/* NIT */}
                      <td className="px-2 py-1">
                        <input value={fila.nit} onChange={(e) => updateFila(i, 'nit', e.target.value)}
                          className="w-24 border rounded px-1 py-0.5 text-xs font-mono" />
                      </td>
                      {/* Nombre */}
                      <td className="px-2 py-1">
                        <input value={fila.nombre} onChange={(e) => updateFila(i, 'nombre', e.target.value)}
                          className="w-full border rounded px-1 py-0.5 text-xs" />
                        {!fila.tercero_existe && (
                          <span className="text-[10px] text-amber-600 block">🆕 Nuevo tercero</span>
                        )}
                      </td>
                      {/* Folio */}
                      <td className="px-2 py-1">
                        <input value={fila.folio} onChange={(e) => updateFila(i, 'folio', e.target.value)}
                          className="w-24 border rounded px-1 py-0.5 text-xs font-mono" />
                      </td>
                      {/* Fecha */}
                      <td className="px-2 py-1">
                        <input value={fila.fecha} onChange={(e) => updateFila(i, 'fecha', e.target.value)}
                          className="w-24 border rounded px-1 py-0.5 text-xs" />
                      </td>
                      {/* Subtotal */}
                      <td className="px-2 py-1">
                        <input type="number" value={fila.subtotal}
                          onChange={(e) => updateFila(i, 'subtotal', Number(e.target.value))}
                          className="w-24 border rounded px-1 py-0.5 text-xs text-right font-mono" />
                      </td>
                      {/* IVA */}
                      <td className="px-2 py-1">
                        <input type="number" value={fila.iva}
                          onChange={(e) => updateFila(i, 'iva', Number(e.target.value))}
                          className="w-20 border rounded px-1 py-0.5 text-xs text-right font-mono" />
                      </td>
                      {/* Total */}
                      <td className="px-2 py-1 text-right font-mono font-semibold text-xs">
                        {formatMoney(fila.total)}
                      </td>
                      {/* Cuenta Gasto/CxC */}
                      <td className="px-2 py-1">
                        <input value={fila.cuenta_gasto}
                          onChange={(e) => updateFila(i, 'cuenta_gasto', e.target.value)}
                          className="w-20 border rounded px-1 py-0.5 text-xs font-mono"
                          list={`cuentas-${i}`} />
                        <datalist id={`cuentas-${i}`}>
                          {cuentas.filter(c => tipo === 'recibidos'
                            ? (c.codigo.startsWith('5') || c.codigo.startsWith('6'))
                            : c.codigo.startsWith('13')
                          ).map(c => (
                            <option key={c.id || c.codigo} value={c.codigo}>{c.codigo} - {c.nombre}</option>
                          ))}
                        </datalist>
                      </td>
                      {/* Cuenta Ingreso (solo emitidos) */}
                      {tipo === 'emitidos' && (
                        <td className="px-2 py-1">
                          <input value={fila.cuenta_ingreso || ''}
                            onChange={(e) => updateFila(i, 'cuenta_ingreso', e.target.value)}
                            className="w-20 border rounded px-1 py-0.5 text-xs font-mono"
                            list={`cuentas-ing-${i}`} />
                          <datalist id={`cuentas-ing-${i}`}>
                            {cuentas.filter(c => c.codigo.startsWith('4')).map(c => (
                              <option key={c.id || c.codigo} value={c.codigo}>{c.codigo} - {c.nombre}</option>
                            ))}
                          </datalist>
                        </td>
                      )}
                      {/* Cuenta IVA */}
                      <td className="px-2 py-1">
                        <input value={fila.cuenta_iva}
                          onChange={(e) => updateFila(i, 'cuenta_iva', e.target.value)}
                          className="w-20 border rounded px-1 py-0.5 text-xs font-mono" />
                      </td>
                      {/* Campos de retención (solo recibidos) */}
                      {tipo === 'recibidos' && (
                        <>
                          {/* Autoretenedor */}
                          <td className="px-2 py-1 text-center">
                            <input type="checkbox" checked={fila.es_autoretenedor}
                              onChange={(e) => updateFila(i, 'es_autoretenedor', e.target.checked)} />
                          </td>
                          {/* Concepto retención */}
                          <td className="px-2 py-1">
                            <select value={fila.concepto_retencion_id || ''}
                              onChange={(e) => updateFila(i, 'concepto_retencion_id', e.target.value ? Number(e.target.value) : null)}
                              className={`w-full border rounded px-1 py-0.5 text-xs ${fila.es_autoretenedor ? 'bg-gray-100 text-gray-400' : ''}`}
                              disabled={fila.es_autoretenedor}
                            >
                              <option value="">— Seleccionar —</option>
                              {conceptos.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.concepto_pago} ({c.tarifa}%)
                                </option>
                              ))}
                            </select>
                          </td>
                          {/* Cuenta retención */}
                          <td className="px-2 py-1">
                            <input value={fila.cuenta_retencion || ''}
                              onChange={(e) => updateFila(i, 'cuenta_retencion', e.target.value)}
                              className="w-20 border rounded px-1 py-0.5 text-xs font-mono"
                              disabled={fila.es_autoretenedor} />
                          </td>
                          {/* Retención calculada */}
                          <td className="px-2 py-1 text-right font-mono text-xs">
                            {Number(fila.retencion_calculada) > 0 ? (
                              <span className="text-red-600 font-semibold">{formatMoney(fila.retencion_calculada)}</span>
                            ) : (
                              <span className="text-gray-400">$0</span>
                            )}
                          </td>
                        </>
                      )}
                      {/* Estado */}
                      <td className="px-2 py-1 text-center">
                        {fila.tercero_existe ? (
                          <span className="text-green-600" title="Tercero existe">✓</span>
                        ) : (
                          <span className="text-amber-500" title="Tercero nuevo">🆕</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{filasSeleccionadas.length}</span> facturas ·
                Total <span className="font-semibold">{formatMoney(totalFacturas)}</span>
                {tipo === 'recibidos' && (
                  <> · Retenciones <span className="font-semibold text-red-600">{formatMoney(totalRetenciones)}</span></>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100">
                  Cancelar
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={filasSeleccionadas.length === 0}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  Registrar ({filasSeleccionadas.length} facturas)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== CONFIRMACIÓN ========== */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">¿Estás seguro?</h3>
            <p className="text-gray-600 mb-4">
              Se van a registrar <span className="font-bold">{filasSeleccionadas.length}</span> facturas
              {tipo === 'recibidos' ? ' de compra' : ' de venta'} como asientos contables.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div>Total facturas: <span className="font-bold">{formatMoney(totalFacturas)}</span></div>
              {tipo === 'recibidos' && (
                <div>Total retenciones: <span className="font-bold text-red-600">{formatMoney(totalRetenciones)}</span></div>
              )}
              <div>Terceros nuevos: <span className="font-bold">{filasSeleccionadas.filter(f => !f.tercero_existe).length}</span></div>
            </div>
            <p className="text-amber-600 text-sm mb-4">⚠️ Esta acción creará asientos y terceros en el sistema.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100">
                No, cancelar
              </button>
              <button onClick={ejecutarImportacion} disabled={ejecutando}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                {ejecutando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {ejecutando ? 'Registrando...' : 'Sí, registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
