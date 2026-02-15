// 🎩 Don Peppini Contadore — Módulo PILA (Seguridad Social y Parafiscales)
import React, { useState, useEffect } from 'react';
import {
  Shield, Calculator, CheckCircle, AlertCircle, Loader2,
  CreditCard, FileText, ChevronDown, ChevronUp, Building2,
  DollarSign
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const fmt = (v) => `$${Math.abs(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export default function PILA() {
  const { empresaId } = useEmpresa();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDetalle, setShowDetalle] = useState(false);

  // Para pago
  const [cuentasBanco, setCuentasBanco] = useState([]);
  const [cuentaBanco, setCuentaBanco] = useState('');
  const [fechaPago, setFechaPago] = useState(hoy.toISOString().slice(0, 10));

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

  const calcular = async () => {
    setLoading(true); setError(null); setSuccess(null); setPreview(null);
    try {
      const res = await api.get('/nomina/pila/preview/', {
        params: { empresa: empresaId, anio, mes }
      });
      setPreview(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al calcular PILA');
    } finally {
      setLoading(false);
    }
  };

  const pagar = async () => {
    if (!cuentaBanco) { setError('Selecciona cuenta de banco/caja'); return; }
    if (!confirm(`¿Registrar pago PILA ${MESES[mes]} ${anio} desde ${cuentaBanco}?`)) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await api.post('/nomina/pila/pagar/', {
        empresa: empresaId, anio, mes, fecha: fechaPago, cuenta_banco: cuentaBanco
      });
      setSuccess(`✅ Asiento ${res.data.numero} creado — Pago PILA ${fmt(res.data.total_pago)}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  const t = preview?.totales || {};

  return (
    <div className="space-y-6">
      {/* Header + Selector */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">PILA — Seguridad Social y Parafiscales</h2>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Año</label>
            <input type="number" value={anio} onChange={e => setAnio(+e.target.value)}
              className="border rounded-lg px-3 py-2 w-24" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mes</label>
            <select value={mes} onChange={e => setMes(+e.target.value)}
              className="border rounded-lg px-3 py-2">
              {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <button onClick={calcular} disabled={loading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Calcular PILA
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5" /> {success}
        </div>
      )}

      {preview && (
        <>
          {/* Resumen Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500">Total IBC</p>
              <p className="text-lg font-bold text-gray-900">{fmt(t.ibc)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <p className="text-xs text-blue-600">Aportes Empleado</p>
              <p className="text-lg font-bold text-blue-800">{fmt(t.total_empleado)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-xs text-amber-600">Aportes Empleador</p>
              <p className="text-lg font-bold text-amber-800">{fmt(t.total_empleador)}</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <p className="text-xs text-green-600">Total PILA</p>
              <p className="text-lg font-bold text-green-800">{fmt(t.total_pila)}</p>
            </div>
          </div>

          {/* Tabla resumen por concepto */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">
                Resumen PILA — {preview.mes_nombre} {preview.anio}
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="text-left px-6 py-3">Concepto</th>
                  <th className="text-right px-4 py-3">Empleado</th>
                  <th className="text-right px-4 py-3">Empleador</th>
                  <th className="text-right px-6 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-6 py-3 font-medium">EPS (Salud)</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.eps_empleado)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.eps_empleador)}</td>
                  <td className="px-6 py-3 text-right font-mono font-medium">{fmt(t.eps_total)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium">Pensión</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.pension_empleado)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.pension_empleador)}</td>
                  <td className="px-6 py-3 text-right font-mono font-medium">{fmt(t.pension_total)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium">ARL</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">—</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.arl)}</td>
                  <td className="px-6 py-3 text-right font-mono font-medium">{fmt(t.arl)}</td>
                </tr>
                {t.fsp > 0 && (
                  <tr>
                    <td className="px-6 py-3 font-medium">Fondo Solidaridad</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(t.fsp)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">—</td>
                    <td className="px-6 py-3 text-right font-mono font-medium">{fmt(t.fsp)}</td>
                  </tr>
                )}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-6 py-3">Subtotal Seguridad Social</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.eps_empleado + t.pension_empleado + t.fsp)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.eps_empleador + t.pension_empleador + t.arl)}</td>
                  <td className="px-6 py-3 text-right font-mono">{fmt(t.eps_total + t.pension_total + t.arl + t.fsp)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium">ICBF</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">—</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.icbf)}</td>
                  <td className="px-6 py-3 text-right font-mono font-medium">{fmt(t.icbf)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium">SENA</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">—</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.sena)}</td>
                  <td className="px-6 py-3 text-right font-mono font-medium">{fmt(t.sena)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium">Caja Compensación</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">—</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.caja)}</td>
                  <td className="px-6 py-3 text-right font-mono font-medium">{fmt(t.caja)}</td>
                </tr>
                <tr className="bg-green-50 font-bold text-green-900">
                  <td className="px-6 py-3">TOTAL PILA</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.total_empleado)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(t.total_empleador)}</td>
                  <td className="px-6 py-3 text-right font-mono">{fmt(t.total_pila)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detalle por empleado (colapsable) */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <button onClick={() => setShowDetalle(!showDetalle)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <span className="font-semibold text-gray-700">
                Detalle por empleado ({preview.detalle.length})
              </span>
              {showDetalle ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showDetalle && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 uppercase tracking-wider">
                      <th className="text-left px-3 py-2">Empleado</th>
                      <th className="text-right px-2 py-2">IBC</th>
                      <th className="text-right px-2 py-2">EPS Emp.</th>
                      <th className="text-right px-2 py-2">EPS Pat.</th>
                      <th className="text-right px-2 py-2">Pens Emp.</th>
                      <th className="text-right px-2 py-2">Pens Pat.</th>
                      <th className="text-right px-2 py-2">ARL</th>
                      <th className="text-right px-2 py-2">ICBF</th>
                      <th className="text-right px-2 py-2">SENA</th>
                      <th className="text-right px-2 py-2">Caja</th>
                      <th className="text-right px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.detalle.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{d.nombre}</td>
                        <td className="px-2 py-2 text-right font-mono">{fmt(d.ibc)}</td>
                        <td className="px-2 py-2 text-right font-mono text-blue-600">{fmt(d.eps_empleado)}</td>
                        <td className="px-2 py-2 text-right font-mono text-amber-600">{fmt(d.eps_empleador)}</td>
                        <td className="px-2 py-2 text-right font-mono text-blue-600">{fmt(d.pension_empleado)}</td>
                        <td className="px-2 py-2 text-right font-mono text-amber-600">{fmt(d.pension_empleador)}</td>
                        <td className="px-2 py-2 text-right font-mono text-amber-600">{fmt(d.arl)}</td>
                        <td className="px-2 py-2 text-right font-mono text-amber-600">{fmt(d.icbf)}</td>
                        <td className="px-2 py-2 text-right font-mono text-amber-600">{fmt(d.sena)}</td>
                        <td className="px-2 py-2 text-right font-mono text-amber-600">{fmt(d.caja_comp)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{fmt(d.total_fila)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Info causación + Acción pago */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Causación automática</p>
              <p className="text-blue-600 mt-1">
                Los gastos y CxP de seguridad social y parafiscales se causan automáticamente
                al liquidar la nómina. Aquí solo necesitas registrar el pago.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CreditCard className="h-5 w-5" />
              <h3 className="font-semibold">Registrar Pago PILA</h3>
            </div>
            <p className="text-sm text-gray-500">
              Cancela las CxP de seguridad social y parafiscales (2370xx) contra la cuenta de banco seleccionada.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Fecha de pago</label>
                <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full mt-1" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Cuenta de salida</label>
                <select value={cuentaBanco} onChange={e => setCuentaBanco(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full mt-1">
                  {cuentasBanco.length === 0 && <option value="">Sin cuentas de banco/caja</option>}
                  {cuentasBanco.map((c, idx) => (
                    <option key={`${c.codigo}-${idx}`} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={pagar} disabled={loading || !cuentaBanco}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-lg font-medium">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <DollarSign className="h-5 w-5" />}
              Pagar PILA — {fmt(t.total_pila)}
            </button>
          </div>

          {/* Porcentajes de referencia */}
          {preview.parametros && (
            <details className="bg-gray-50 rounded-xl border p-4">
              <summary className="text-sm font-medium text-gray-600 cursor-pointer">
                📋 Porcentajes aplicados ({anio})
              </summary>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                <div>EPS empleado: {preview.parametros.eps_empleado}%</div>
                <div>EPS empleador: {preview.parametros.eps_empleador}%</div>
                <div>Pensión empleado: {preview.parametros.pension_empleado}%</div>
                <div>Pensión empleador: {preview.parametros.pension_empleador}%</div>
                <div>ARL Nivel I: {preview.parametros.arl_nivel_1}%</div>
                <div>ICBF: {preview.parametros.icbf}%</div>
                <div>SENA: {preview.parametros.sena}%</div>
                <div>Caja: {preview.parametros.caja}%</div>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
