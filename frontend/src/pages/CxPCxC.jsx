// 🎩 Don Peppini Contadore — CxP / CxC (Cuentas por Pagar / por Cobrar)
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, CheckCircle, AlertCircle,
  Loader2, CreditCard, Search, Check, X, DollarSign,
  Building2, Filter
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const fmt = (v) => `$${Math.abs(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export default function CxPCxC() {
  const { empresaId } = useEmpresa();
  const [tipo, setTipo] = useState('cxp');
  const [pendientes, setPendientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Selección para pago
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [montosPago, setMontosPago] = useState({}); // {key: monto} para pago parcial

  // Modal pago
  const [showModal, setShowModal] = useState(false);
  const [cuentasBanco, setCuentasBanco] = useState([]);
  const [cuentaBanco, setCuentaBanco] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [concepto, setConcepto] = useState('');
  const [pagando, setPagando] = useState(false);

  // Filtro
  const [buscar, setBuscar] = useState('');

  useEffect(() => {
    if (empresaId) cargar();
  }, [empresaId, tipo]);

  useEffect(() => {
    if (empresaId) {
      api.get('/contabilidad/cuentas/', { params: { empresa: empresaId } }).then(res => {
        const bancos = res.data.filter(c =>
          (c.codigo.startsWith('1110') || c.codigo.startsWith('1105') || c.codigo.startsWith('1120'))
          && c.codigo.length >= 6
        );
        setCuentasBanco(bancos);
        if (bancos.length > 0) setCuentaBanco(bancos[0].codigo);
      });
    }
  }, [empresaId]);

  const cargar = async () => {
    setLoading(true); setError(null); setSeleccionados(new Set()); setMontosPago({});
    try {
      const res = await api.get('/contabilidad/cxp-cxc/pendientes/', {
        params: { empresa: empresaId, tipo }
      });
      setPendientes(res.data.pendientes);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  const key = (p) => `${p.cuenta_codigo}|${p.tercero_id || 'null'}`;

  const toggleSel = (p) => {
    const k = key(p);
    const nuevo = new Set(seleccionados);
    if (nuevo.has(k)) {
      nuevo.delete(k);
      const m = { ...montosPago };
      delete m[k];
      setMontosPago(m);
    } else {
      nuevo.add(k);
      setMontosPago(prev => ({ ...prev, [k]: p.saldo }));
    }
    setSeleccionados(nuevo);
  };

  const toggleAll = () => {
    if (seleccionados.size === filtrados.length) {
      setSeleccionados(new Set());
      setMontosPago({});
    } else {
      const nuevo = new Set();
      const montos = {};
      filtrados.forEach(p => { const k = key(p); nuevo.add(k); montos[k] = p.saldo; });
      setSeleccionados(nuevo);
      setMontosPago(montos);
    }
  };

  const updateMonto = (p, val) => {
    const k = key(p);
    const num = parseFloat(val) || 0;
    setMontosPago(prev => ({ ...prev, [k]: Math.min(num, p.saldo) }));
  };

  const filtrados = useMemo(() => {
    if (!buscar) return pendientes;
    const s = buscar.toLowerCase();
    return pendientes.filter(p =>
      p.cuenta_codigo.includes(s) ||
      p.cuenta_nombre.toLowerCase().includes(s) ||
      p.tercero_nombre.toLowerCase().includes(s) ||
      p.tercero_doc.includes(s)
    );
  }, [pendientes, buscar]);

  const totalSeleccionado = useMemo(() => {
    let t = 0;
    seleccionados.forEach(k => { t += montosPago[k] || 0; });
    return t;
  }, [seleccionados, montosPago]);

  const abrirPago = () => {
    if (seleccionados.size === 0) { setError('Selecciona al menos una cuenta'); return; }
    setShowModal(true);
    setConcepto('');
  };

  const ejecutarPago = async () => {
    setPagando(true); setError(null);
    const items = [];
    filtrados.forEach(p => {
      const k = key(p);
      if (seleccionados.has(k)) {
        items.push({
          cuenta_codigo: p.cuenta_codigo,
          tercero_id: p.tercero_id,
          tercero_nombre: p.tercero_nombre,
          monto: montosPago[k] || p.saldo,
        });
      }
    });

    try {
      const res = await api.post('/contabilidad/cxp-cxc/pagar/', {
        empresa: empresaId,
        tipo,
        fecha: fechaPago,
        cuenta_banco: cuentaBanco,
        items,
        concepto,
      });
      setSuccess(`✅ Asiento ${res.data.numero} creado — ${fmt(res.data.total)}`);
      setShowModal(false);
      cargar(); // Recargar
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar');
    } finally {
      setPagando(false);
    }
  };

  const isCxP = tipo === 'cxp';

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            {isCxP ? <ArrowDownCircle className="text-red-500" size={28} /> : <ArrowUpCircle className="text-green-500" size={28} />}
            {isCxP ? 'Cuentas por Pagar' : 'Cuentas por Cobrar'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isCxP ? 'Obligaciones pendientes de pago (pasivos corrientes)'
                    : 'Derechos pendientes de cobro (deudores)'}
          </p>
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          <button onClick={() => setTipo('cxp')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              tipo === 'cxp' ? 'bg-red-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>
            <ArrowDownCircle size={16} /> CxP
          </button>
          <button onClick={() => setTipo('cxc')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              tipo === 'cxc' ? 'bg-green-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>
            <ArrowUpCircle size={16} /> CxC
          </button>
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

      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por cuenta, nombre o tercero..."
            className="pl-9 pr-3 py-2 border rounded-lg w-full text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {filtrados.length} pendiente{filtrados.length !== 1 ? 's' : ''} — Total: <strong className={isCxP ? 'text-red-700' : 'text-green-700'}>{fmt(total)}</strong>
          </span>
          <button onClick={cargar} disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 underline">
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle className="h-12 w-12 mx-auto mb-3" />
            <p className="text-lg font-medium">No hay {isCxP ? 'cuentas por pagar' : 'cuentas por cobrar'} pendientes</p>
            <p className="text-sm">¡Todo al día!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox"
                      checked={seleccionados.size === filtrados.length && filtrados.length > 0}
                      onChange={toggleAll}
                      className="rounded" />
                  </th>
                  <th className="text-left px-3 py-3">Cuenta</th>
                  <th className="text-left px-3 py-3">Tercero</th>
                  <th className="text-right px-3 py-3">Saldo</th>
                  <th className="text-right px-4 py-3 w-36">Monto a {isCxP ? 'pagar' : 'cobrar'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((p, i) => {
                  const k = key(p);
                  const sel = seleccionados.has(k);
                  return (
                    <tr key={i}
                      className={`hover:bg-gray-50 transition cursor-pointer ${sel ? (isCxP ? 'bg-red-50' : 'bg-green-50') : ''}`}
                      onClick={() => toggleSel(p)}>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={sel} onChange={() => toggleSel(p)}
                          className="rounded" />
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs bg-gray-100 rounded px-1.5 py-0.5">{p.cuenta_codigo}</span>
                        <span className="ml-2 text-gray-700">{p.cuenta_nombre}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">{p.tercero_nombre}</div>
                        {p.tercero_doc && <div className="text-xs text-gray-400">{p.tercero_doc}</div>}
                      </td>
                      <td className={`px-3 py-3 text-right font-mono font-medium ${isCxP ? 'text-red-700' : 'text-green-700'}`}>
                        {fmt(p.saldo)}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        {sel ? (
                          <input type="number"
                            value={montosPago[k] || ''}
                            onChange={e => updateMonto(p, e.target.value)}
                            max={p.saldo}
                            min={0}
                            step="0.01"
                            className="w-full text-right border rounded px-2 py-1 text-sm font-mono" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Barra inferior fija */}
      {seleccionados.size > 0 && (
        <div className={`sticky bottom-0 rounded-xl border-2 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg ${
          isCxP ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div>
            <span className="font-medium text-gray-900">
              {seleccionados.size} seleccionada{seleccionados.size > 1 ? 's' : ''}
            </span>
            <span className={`ml-3 text-lg font-bold ${isCxP ? 'text-red-700' : 'text-green-700'}`}>
              {fmt(totalSeleccionado)}
            </span>
          </div>
          <button onClick={abrirPago}
            className={`px-6 py-2.5 rounded-lg text-white font-medium flex items-center gap-2 ${
              isCxP ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
            <CreditCard size={18} />
            {isCxP ? 'Pagar seleccionadas' : 'Cobrar seleccionadas'}
          </button>
        </div>
      )}

      {/* Modal de confirmación */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CreditCard className={isCxP ? 'text-red-600' : 'text-green-600'} size={20} />
                {isCxP ? 'Confirmar Pago' : 'Confirmar Cobro'}
              </h3>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            {/* Resumen */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Items seleccionados:</span>
                <span className="font-medium">{seleccionados.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className={`font-bold text-lg ${isCxP ? 'text-red-700' : 'text-green-700'}`}>
                  {fmt(totalSeleccionado)}
                </span>
              </div>
            </div>

            {/* Detalle items */}
            <div className="max-h-40 overflow-y-auto text-xs space-y-1">
              {filtrados.filter(p => seleccionados.has(key(p))).map((p, i) => (
                <div key={i} className="flex justify-between text-gray-600 px-2 py-1 bg-gray-50 rounded">
                  <span>{p.cuenta_codigo} — {p.tercero_nombre}</span>
                  <span className="font-mono font-medium">{fmt(montosPago[key(p)])}</span>
                </div>
              ))}
            </div>

            {/* Campos */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Fecha</label>
                <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full mt-1" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Cuenta {isCxP ? 'de salida' : 'de ingreso'}</label>
                <select value={cuentaBanco} onChange={e => setCuentaBanco(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full mt-1">
                  {cuentasBanco.map(c => (
                    <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Concepto (opcional, se auto-genera)</label>
                <input value={concepto} onChange={e => setConcepto(e.target.value)}
                  placeholder={`${isCxP ? 'Pago' : 'Cobro'} de...`}
                  className="border rounded-lg px-3 py-2 w-full mt-1" />
              </div>
            </div>

            {/* Preview del asiento */}
            <details className="text-xs">
              <summary className="text-gray-500 cursor-pointer">Vista previa del asiento</summary>
              <div className="mt-2 bg-gray-50 rounded-lg p-3 font-mono space-y-1">
                {filtrados.filter(p => seleccionados.has(key(p))).map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{p.cuenta_codigo} {p.tercero_nombre}</span>
                    {isCxP
                      ? <span className="text-blue-700">Db {fmt(montosPago[key(p)])}</span>
                      : <span className="text-red-700">Cr {fmt(montosPago[key(p)])}</span>
                    }
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>{cuentaBanco} (Banco/Caja)</span>
                  {isCxP
                    ? <span className="text-red-700">Cr {fmt(totalSeleccionado)}</span>
                    : <span className="text-blue-700">Db {fmt(totalSeleccionado)}</span>
                  }
                </div>
              </div>
            </details>

            {/* Botones */}
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={ejecutarPago} disabled={pagando}
                className={`flex-1 py-2.5 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${
                  isCxP ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}>
                {pagando ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign size={18} />}
                {isCxP ? 'Confirmar Pago' : 'Confirmar Cobro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
