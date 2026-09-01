// 🎩 Don Peppini Contadore - Balance por Terceros
// frontend/src/pages/BalanceTerceros.jsx

import React, { useState, useMemo } from "react";
import {
  Users, Search, Download, ChevronDown, ChevronRight,
  FileSpreadsheet, Filter, Building2, Loader2
} from "lucide-react";
import { useEmpresa } from "../context/EmpresaContext";
import { getBalanceTerceros } from "../services/api";
import { exportBalanceTerceros } from "../utils/exports";

const fmtMoney = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v || 0);

export default function BalanceTerceros() {
  const { empresaActual, empresaId } = useEmpresa();
  const [fechaInicio, setFechaInicio] = useState(`${new Date().getFullYear()}-01-01`);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [cuentaFiltro, setCuentaFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [expandidas, setExpandidas] = useState({});
  const [busqueda, setBusqueda] = useState("");

  const generar = async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getBalanceTerceros({
        empresa: empresaId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        cuenta: cuentaFiltro,
      });
      setData(result);
      // Expandir todas las cuentas por defecto
      const exp = {};
      (result.detalle || []).forEach((g) => { exp[g.cuenta_codigo] = true; });
      setExpandidas(exp);
    } catch (e) {
      setError(e.response?.data?.error || "Error al generar reporte");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleCuenta = (codigo) => {
    setExpandidas((prev) => ({ ...prev, [codigo]: !prev[codigo] }));
  };

  const expandirTodo = () => {
    const exp = {};
    (data?.detalle || []).forEach((g) => { exp[g.cuenta_codigo] = true; });
    setExpandidas(exp);
  };

  const colapsarTodo = () => setExpandidas({});

  // Filtrar por búsqueda
  const detalleFiltrado = useMemo(() => {
    if (!data?.detalle || !busqueda) return data?.detalle || [];
    const q = busqueda.toLowerCase();
    return data.detalle
      .map((grupo) => ({
        ...grupo,
        terceros: grupo.terceros.filter(
          (t) =>
            t.tercero_nombre?.toLowerCase().includes(q) ||
            t.tercero_documento?.includes(q)
        ),
      }))
      .filter((g) => g.terceros.length > 0);
  }, [data, busqueda]);

  if (!empresaActual) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Building2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Selecciona una empresa para ver el Balance por Terceros</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="h-7 w-7 text-indigo-600" />
            Balance por Terceros
          </h1>
          <p className="text-gray-500 mt-1">{empresaActual.razon_social}</p>
        </div>
        {data && (
          <button
            onClick={() =>
              exportBalanceTerceros({
                inicio: fechaInicio,
                fin: fechaFin,
                empresa: empresaId,
                cuenta: cuentaFiltro,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="h-3.5 w-3.5 inline mr-1" />
              Filtrar cuenta (prefijo)
            </label>
            <input
              type="text"
              value={cuentaFiltro}
              onChange={(e) => setCuentaFiltro(e.target.value)}
              placeholder="Ej: 23, 13, 2505..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={generar}
              disabled={loading}
              className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Generar
            </button>
          </div>
        </div>
        {cuentaFiltro && (
          <p className="mt-2 text-xs text-gray-500">
            Mostrando cuentas que empiecen con <strong>{cuentaFiltro}*</strong>
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Resultados */}
      {data && (
        <>
          {/* Barra de búsqueda y controles */}
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar tercero por nombre o documento..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={expandirTodo} className="text-xs text-indigo-600 hover:underline">
                Expandir todo
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={colapsarTodo} className="text-xs text-indigo-600 hover:underline">
                Colapsar todo
              </button>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Cuenta / Tercero</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700">Documento</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Saldo Inicial</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Débitos</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Créditos</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Saldo Final</th>
                </tr>
              </thead>
              <tbody>
                {detalleFiltrado.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      {busqueda ? "No se encontraron terceros con esa búsqueda" : "Sin movimientos para este período"}
                    </td>
                  </tr>
                )}
                {detalleFiltrado.map((grupo) => (
                  <React.Fragment key={grupo.cuenta_codigo}>
                    {/* Fila de cuenta (cabecera colapsable) */}
                    <tr
                      className="bg-indigo-50 border-t cursor-pointer hover:bg-indigo-100 transition-colors"
                      onClick={() => toggleCuenta(grupo.cuenta_codigo)}
                    >
                      <td className="px-4 py-2.5 font-semibold text-indigo-900 flex items-center gap-2" colSpan={2}>
                        {expandidas[grupo.cuenta_codigo] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {grupo.cuenta_codigo} — {grupo.cuenta_nombre}
                        <span className="text-xs text-indigo-500 font-normal ml-2">
                          ({grupo.terceros.length} tercero{grupo.terceros.length !== 1 ? "s" : ""})
                        </span>
                      </td>
                      <td className="text-right px-4 py-2.5 font-semibold text-indigo-800">
                        {fmtMoney(grupo.subtotal.saldo_inicial)}
                      </td>
                      <td className="text-right px-4 py-2.5 font-semibold text-indigo-800">
                        {fmtMoney(grupo.subtotal.debitos)}
                      </td>
                      <td className="text-right px-4 py-2.5 font-semibold text-indigo-800">
                        {fmtMoney(grupo.subtotal.creditos)}
                      </td>
                      <td className="text-right px-4 py-2.5 font-semibold text-indigo-800">
                        {fmtMoney(grupo.subtotal.saldo_final)}
                      </td>
                    </tr>

                    {/* Filas de terceros */}
                    {expandidas[grupo.cuenta_codigo] &&
                      grupo.terceros.map((t, i) => (
                        <tr key={`${grupo.cuenta_codigo}-${i}`} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 pl-10 text-gray-700">{t.tercero_nombre}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{t.tercero_documento}</td>
                          <td className="text-right px-4 py-2">{fmtMoney(t.saldo_inicial)}</td>
                          <td className="text-right px-4 py-2">{fmtMoney(t.debitos)}</td>
                          <td className="text-right px-4 py-2">{fmtMoney(t.creditos)}</td>
                          <td className={`text-right px-4 py-2 font-medium ${t.saldo_final < 0 ? "text-red-600" : ""}`}>
                            {fmtMoney(t.saldo_final)}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}

                {/* TOTAL GENERAL */}
                {data.totales && (
                  <tr className="bg-gray-800 text-white font-bold border-t-2">
                    <td className="px-4 py-3" colSpan={2}>TOTAL GENERAL</td>
                    <td className="text-right px-4 py-3">{fmtMoney(data.totales.saldo_inicial)}</td>
                    <td className="text-right px-4 py-3">{fmtMoney(data.totales.total_debitos)}</td>
                    <td className="text-right px-4 py-3">{fmtMoney(data.totales.total_creditos)}</td>
                    <td className="text-right px-4 py-3">{fmtMoney(data.totales.saldo_final)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Resumen */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">Cuentas</p>
              <p className="text-lg font-bold text-gray-900">{detalleFiltrado.length}</p>
            </div>
            <div className="bg-white rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">Terceros</p>
              <p className="text-lg font-bold text-gray-900">
                {detalleFiltrado.reduce((s, g) => s + g.terceros.length, 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">Total Débitos</p>
              <p className="text-lg font-bold text-blue-600">{fmtMoney(data.totales?.total_debitos)}</p>
            </div>
            <div className="bg-white rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">Total Créditos</p>
              <p className="text-lg font-bold text-green-600">{fmtMoney(data.totales?.total_creditos)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
