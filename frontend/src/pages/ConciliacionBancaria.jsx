// 🎩 Don Peppini Contadore - Conciliación Bancaria
// frontend/src/pages/ConciliacionBancaria.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Upload, Check, X, Download, Loader2, AlertCircle, 
  CheckCircle, Search, Zap, ArrowRight, Landmark, BookOpen, 
  Calendar, Link2, FileSpreadsheet, Info
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ConciliacionBancaria() {
  const { empresaActual, empresaId } = useEmpresa();
  
  const [cuentas, setCuentas] = useState([]);
  const [cuentaSel, setCuentaSel] = useState('');
  const [año, setAño] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [saldoExtracto, setSaldoExtracto] = useState('');
  
  const [conciliacion, setConciliacion] = useState(null);
  const [movExtracto, setMovExtracto] = useState([]);
  const [movLibros, setMovLibros] = useState([]);
  
  const [selExt, setSelExt] = useState(null);
  const [selLib, setSelLib] = useState(null);
  
  const [filtroExt, setFiltroExt] = useState('');
  const [filtroLib, setFiltroLib] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [loadingAccion, setLoadingAccion] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showImportar, setShowImportar] = useState(false);
  const [archivo, setArchivo] = useState(null);

  useEffect(() => { empresaId && cargarCuentas(); }, [empresaId]);

  const cargarCuentas = async () => {
    try {
      const res = await api.get('/contabilidad/conciliacion/cuentas-banco/', { params: { empresa: empresaId } });
      setCuentas(res.data.cuentas || []);
    } catch (e) { console.error(e); }
  };

  const iniciar = async () => {
    if (!cuentaSel || !saldoExtracto) { setError('Completa cuenta y saldo'); return; }
    setLoading(true); setError(null);
    try {
      const res = await api.post('/contabilidad/conciliacion/iniciar/', {
        empresa: empresaId, cuenta: cuentaSel, año, mes,
        saldo_extracto: parseFloat(saldoExtracto.replace(/[^\d.-]/g, ''))
      });
      setConciliacion(res.data);
      res.data.id && cargarComparativo(res.data.id);
    } catch (e) { setError(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  const cargarComparativo = async (id) => {
    try {
      const res = await api.get('/contabilidad/conciliacion/comparativo/', { params: { conciliacion: id } });
      setMovExtracto(res.data.extracto || []);
      setMovLibros(res.data.libros || []);
      setConciliacion(p => ({ ...p, ...res.data }));
    } catch (e) { console.error(e); }
  };

  const importar = async (e) => {
    e.preventDefault();
    if (!archivo || !conciliacion?.id) return;
    setLoadingAccion(true);
    const fd = new FormData();
    fd.append('archivo', archivo);
    fd.append('conciliacion', conciliacion.id);
    try {
      const res = await api.post('/contabilidad/conciliacion/importar-extracto/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess(`Importados ${res.data.movimientos} movimientos`);
      setShowImportar(false); setArchivo(null);
      cargarComparativo(conciliacion.id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Error'); }
    finally { setLoadingAccion(false); }
  };

  const conciliar = async () => {
    if (!selExt || !selLib) return;
    setLoadingAccion(true);
    try {
      await api.post('/contabilidad/conciliacion/conciliar/', { extracto_id: selExt.id, libro_id: selLib.id });
      setMovExtracto(p => p.map(m => m.id === selExt.id ? { ...m, conciliado: true } : m));
      setMovLibros(p => p.map(m => m.id === selLib.id ? { ...m, conciliado: true } : m));
      setSelExt(null); setSelLib(null);
      setSuccess('✓ Conciliado'); setTimeout(() => setSuccess(null), 2000);
    } catch (e) { setError('Error'); }
    finally { setLoadingAccion(false); }
  };

  const autoConc = async () => {
    if (!conciliacion?.id) return;
    setLoadingAccion(true);
    try {
      const res = await api.post('/contabilidad/conciliacion/automatica/', { conciliacion: conciliacion.id });
      setSuccess(`⚡ ${res.data.conciliados} conciliados automáticamente`);
      cargarComparativo(conciliacion.id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) { setError('Error'); }
    finally { setLoadingAccion(false); }
  };

  const descargarPDF = async () => {
    if (!conciliacion?.id) return;
    try {
      const res = await api.get('/contabilidad/conciliacion/reporte-pdf/', { params: { conciliacion: conciliacion.id }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `Conciliacion_${mes}_${año}.pdf`;
      a.click(); a.remove();
    } catch (e) { setError('Error PDF'); }
  };

  const extFiltrado = useMemo(() => movExtracto.filter(m => 
    (!soloPendientes || !m.conciliado) && (!filtroExt || m.descripcion?.toLowerCase().includes(filtroExt.toLowerCase()))
  ), [movExtracto, filtroExt, soloPendientes]);

  const libFiltrado = useMemo(() => movLibros.filter(m =>
    (!soloPendientes || !m.conciliado) && (!filtroLib || m.concepto?.toLowerCase().includes(filtroLib.toLowerCase()))
  ), [movLibros, filtroLib, soloPendientes]);

  const stats = useMemo(() => ({
    pendExt: movExtracto.filter(m => !m.conciliado).length,
    pendLib: movLibros.filter(m => !m.conciliado).length,
  }), [movExtracto, movLibros]);

  const fmt = (v) => `$${Number(v||0).toLocaleString('es-CO')}`;

  if (!empresaActual) return (
    <div className="p-6"><div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
      <Building2 className="h-12 w-12 text-amber-500 mx-auto mb-4" /><p className="text-gray-600">Selecciona una empresa</p>
    </div></div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3"><span>🎩</span> Conciliación Bancaria</h1>
        <p className="text-gray-600 mt-1">{empresaActual.razon_social}</p>
      </div>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />{error}<button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
      </div>}
      {success && <div className="mb-4 bg-green-50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <CheckCircle className="h-5 w-5" />{success}
      </div>}

      {/* Config */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Calendar className="h-5 w-5 text-indigo-600" />Configurar</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta</label>
            <select value={cuentaSel} onChange={e => setCuentaSel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Seleccionar...</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            <select value={año} onChange={e => setAño(+e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {[0,1,2,3,4].map(i => <option key={i} value={new Date().getFullYear()-i}>{new Date().getFullYear()-i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
            <select value={mes} onChange={e => setMes(+e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Extracto</label>
            <input type="text" value={saldoExtracto} onChange={e => setSaldoExtracto(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div className="flex items-end">
            <button onClick={iniciar} disabled={loading||!cuentaSel} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Iniciar
            </button>
          </div>
        </div>
      </div>

      {conciliacion && <>
        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="text-xs text-gray-500 uppercase">Saldo Extracto</div>
            <div className="text-xl font-bold text-indigo-600">{fmt(conciliacion.saldo_extracto)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="text-xs text-gray-500 uppercase">Saldo Libros</div>
            <div className="text-xl font-bold text-emerald-600">{fmt(conciliacion.saldo_libros)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="text-xs text-gray-500 uppercase">Diferencia</div>
            <div className={`text-xl font-bold ${Math.abs(conciliacion.diferencia||0)<1?'text-green-600':'text-red-600'}`}>{fmt(conciliacion.diferencia)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="text-xs text-gray-500 uppercase">Pendientes</div>
            <div className="text-lg font-bold text-amber-600">{stats.pendExt} / {stats.pendLib}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col gap-2">
            <button onClick={() => setShowImportar(true)} className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Upload className="h-4 w-4" />Importar
            </button>
            <div className="flex gap-2">
              <button onClick={autoConc} disabled={loadingAccion} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-500 text-white rounded-lg text-sm" title="Auto">
                <Zap className="h-4 w-4" />
              </button>
              <button onClick={descargarPDF} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 text-white rounded-lg text-sm" title="PDF">
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} className="rounded" />Solo pendientes
          </label>
        </div>

        {/* Columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Extracto */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-4 py-3 bg-indigo-50 border-b flex justify-between items-center">
              <h3 className="font-semibold text-indigo-900 flex items-center gap-2"><Landmark className="h-5 w-5" />Extracto Bancario</h3>
              <span className="text-sm text-indigo-600">{stats.pendExt} pendientes</span>
            </div>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Buscar..." value={filtroExt} onChange={e => setFiltroExt(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {extFiltrado.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>{movExtracto.length ? 'Sin pendientes' : 'Importa el extracto'}</p>
                </div>
              ) : extFiltrado.map(m => (
                <div key={m.id} onClick={() => !m.conciliado && setSelExt(m)}
                  className={`px-4 py-3 border-b cursor-pointer transition-all ${m.conciliado?'bg-green-50 opacity-50':selExt?.id===m.id?'bg-indigo-100 border-l-4 border-indigo-500':'hover:bg-gray-50'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{m.descripcion}</div>
                      <div className="text-xs text-gray-500">{m.fecha}</div>
                    </div>
                    <div className="text-right ml-3">
                      {m.credito>0 && <div className="text-green-600 font-semibold">+{fmt(m.credito)}</div>}
                      {m.debito>0 && <div className="text-red-600 font-semibold">-{fmt(m.debito)}</div>}
                    </div>
                    {m.conciliado && <Check className="h-5 w-5 text-green-500 ml-2" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Libros */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b flex justify-between items-center">
              <h3 className="font-semibold text-emerald-900 flex items-center gap-2"><BookOpen className="h-5 w-5" />Libros Contables</h3>
              <span className="text-sm text-emerald-600">{stats.pendLib} pendientes</span>
            </div>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Buscar..." value={filtroLib} onChange={e => setFiltroLib(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {libFiltrado.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <BookOpen className="h-10 w-10 mx-auto mb-2 text-gray-300" /><p>Sin movimientos</p>
                </div>
              ) : libFiltrado.map(m => (
                <div key={m.id} onClick={() => !m.conciliado && setSelLib(m)}
                  className={`px-4 py-3 border-b cursor-pointer transition-all ${m.conciliado?'bg-green-50 opacity-50':selLib?.id===m.id?'bg-emerald-100 border-l-4 border-emerald-500':'hover:bg-gray-50'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{m.concepto}</div>
                      <div className="text-xs text-gray-500">{m.fecha} • #{m.numero}</div>
                    </div>
                    <div className="text-right ml-3">
                      {m.debito>0 && <div className="text-green-600 font-semibold">+{fmt(m.debito)}</div>}
                      {m.credito>0 && <div className="text-red-600 font-semibold">-{fmt(m.credito)}</div>}
                    </div>
                    {m.conciliado && <Check className="h-5 w-5 text-green-500 ml-2" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Barra conciliar */}
        {selExt && selLib && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border p-4 flex items-center gap-4 z-50">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 px-3 py-2 rounded-lg">
                <div className="text-xs text-indigo-600">Extracto</div>
                <div className="font-medium text-sm">{selExt.descripcion?.substring(0,20)}...</div>
                <div className="text-xs">{fmt(selExt.credito||selExt.debito)}</div>
              </div>
              <Link2 className="h-5 w-5 text-gray-400" />
              <div className="bg-emerald-100 px-3 py-2 rounded-lg">
                <div className="text-xs text-emerald-600">Libros</div>
                <div className="font-medium text-sm">{selLib.concepto?.substring(0,20)}...</div>
                <div className="text-xs">{fmt(selLib.debito||selLib.credito)}</div>
              </div>
            </div>
            <button onClick={conciliar} disabled={loadingAccion} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium">
              {loadingAccion?<Loader2 className="h-4 w-4 animate-spin" />:<Check className="h-4 w-4" />}Conciliar
            </button>
            <button onClick={() => {setSelExt(null);setSelLib(null);}} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5" /></button>
          </div>
        )}
      </>}

      {/* Modal Importar */}
      {showImportar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Upload className="h-5 w-5 text-indigo-600" />Importar Extracto</h3>
            <form onSubmit={importar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Archivo Excel</label>
                <input type="file" accept=".xlsx,.xls" onChange={e => setArchivo(e.target.files[0])} className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-blue-800 text-sm">
                <Info className="h-5 w-5 flex-shrink-0" />
                <div><p className="font-medium">Columnas:</p><p className="text-xs mt-1">Fecha, Descripción, Débito, Crédito, Saldo</p></div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => {setShowImportar(false);setArchivo(null);}} className="px-4 py-2 border rounded-lg">Cancelar</button>
                <button type="submit" disabled={loadingAccion||!archivo} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
                  {loadingAccion?<Loader2 className="h-4 w-4 animate-spin" />:<Upload className="h-4 w-4" />}Importar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
