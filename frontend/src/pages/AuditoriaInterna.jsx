// frontend/src/pages/AuditoriaInterna.jsx
import { useState, useEffect, useMemo } from "react";
import { useEmpresa } from "../context/EmpresaContext";
import api from "../services/api";
import { toast } from "../ui/ToastHost";

const fmtMoney = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n ?? 0);
const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString("es-CO") : "—";
const fmtDateTime = d => d ? new Date(d).toLocaleString("es-CO") : "—";

function todayISO(){ return new Date().toISOString().slice(0,10); }
function firstDayOfYear(){ return `${new Date().getFullYear()}-01-01`; }

const TABS = [
  { id: "resumen", label: "📊 Resumen" },
  { id: "bitacora", label: "📋 Bitácora" },
  { id: "anulaciones", label: "🚫 Anulaciones" },
  { id: "numeracion", label: "🔢 Numeración" },
  { id: "saldos", label: "⚖️ Saldos Contrarios" },
  { id: "duplicados", label: "👥 Duplicados" },
  { id: "montos", label: "📈 Montos Inusuales" },
  { id: "soporte", label: "📎 Sin Soporte" },
  { id: "terceros", label: "🏢 Concentración" },
  { id: "comparativo", label: "📅 Comparativo" },
];

function Badge({ color, children }) {
  const colors = {
    red: "bg-red-100 text-red-800",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
    gray: "bg-gray-100 text-gray-800",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>{children}</span>;
}

function Card({ title, value, sub, color = "indigo" }) {
  const bg = { indigo: "bg-indigo-50 border-indigo-200", red: "bg-red-50 border-red-200", green: "bg-green-50 border-green-200", amber: "bg-amber-50 border-amber-200" };
  return (
    <div className={`border rounded-lg p-4 ${bg[color] || bg.indigo}`}>
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AuditoriaInterna() {
  const { empresaId, empresaActual } = useEmpresa();
  const [tab, setTab] = useState("resumen");
  const [fi, setFi] = useState(firstDayOfYear());
  const [ff, setFf] = useState(todayISO());
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchReport = async (endpoint, params = {}) => {
    if (!empresaId) return;
    setLoading(true);
    setData(null);
    try {
      const { data: res } = await api.get(`/contabilidad/auditoria/${endpoint}/`, {
        params: { empresa: empresaId, ...params },
      });
      setData(res);
    } catch (e) {
      console.error(e);
      toast("Error cargando reporte", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!empresaId) return;
    switch (tab) {
      case "resumen": fetchReport("resumen"); break;
      case "bitacora": fetchReport("bitacora", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "anulaciones": fetchReport("anulaciones", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "numeracion": fetchReport("numeracion", { anio }); break;
      case "saldos": fetchReport("saldos-contrarios", { fecha_fin: ff }); break;
      case "duplicados": fetchReport("duplicados", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "montos": fetchReport("montos-inusuales", { umbral: 3 }); break;
      case "soporte": fetchReport("sin-soporte", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "terceros": fetchReport("concentracion-terceros", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "comparativo": fetchReport("comparativo-mensual", { anio }); break;
    }
  }, [tab, empresaId]);

  const reload = () => {
    switch (tab) {
      case "resumen": fetchReport("resumen"); break;
      case "bitacora": fetchReport("bitacora", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "anulaciones": fetchReport("anulaciones", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "numeracion": fetchReport("numeracion", { anio }); break;
      case "saldos": fetchReport("saldos-contrarios", { fecha_fin: ff }); break;
      case "duplicados": fetchReport("duplicados", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "montos": fetchReport("montos-inusuales", { umbral: 3 }); break;
      case "soporte": fetchReport("sin-soporte", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "terceros": fetchReport("concentracion-terceros", { fecha_inicio: fi, fecha_fin: ff }); break;
      case "comparativo": fetchReport("comparativo-mensual", { anio }); break;
    }
  };

  if (!empresaActual) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Selecciona una empresa para auditar</p>
      </div>
    );
  }

  const needsDates = ["bitacora","anulaciones","duplicados","soporte","terceros"].includes(tab);
  const needsYear = ["numeracion","comparativo"].includes(tab);
  const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🔍 Auditoría Interna</h1>
        <p className="text-sm text-gray-500 mt-1">{empresaActual.razon_social} • Control interno contable</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b pb-2">
        {TABS.map(t => (
          <button key={t.id}
            className={`px-3 py-1.5 rounded-t text-sm transition-colors ${
              tab === t.id ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      {(needsDates || needsYear) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 bg-gray-50 rounded p-3">
          {needsDates && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Desde</label>
                <input type="date" className="border rounded px-2 py-1 text-sm" value={fi} onChange={e => setFi(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                <input type="date" className="border rounded px-2 py-1 text-sm" value={ff} onChange={e => setFf(e.target.value)} />
              </div>
            </>
          )}
          {needsYear && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Año</label>
              <input type="number" className="border rounded px-2 py-1 text-sm w-24" value={anio} onChange={e => setAnio(e.target.value)} />
            </div>
          )}
          <button className="px-3 py-1 bg-indigo-600 text-white rounded text-sm" onClick={reload}>Consultar</button>
        </div>
      )}

      {/* Content */}
      {loading && <div className="text-center py-12 text-gray-500">Cargando reporte...</div>}
      {!loading && data && (
        <div>
          {/* ====== RESUMEN ====== */}
          {tab === "resumen" && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card title="Asientos Vigentes" value={data.vigentes} color="green" />
                <Card title="Anulados" value={data.anulados} sub={`${data.correcciones_rapidas} correcciones`} color="red" />
                <Card title="Sin Soporte" value={data.sin_soporte} sub={`${data.porcentaje_sin_soporte}% del total`} color="amber" />
                <Card title="Saldos Contrarios" value={data.saldos_contrarios} sub="Cuentas con saldo anormal" color={data.saldos_contrarios > 0 ? "red" : "green"} />
              </div>
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-medium mb-3">Últimas Acciones</h3>
                {data.ultimas_acciones?.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2">Fecha</th>
                        <th className="pb-2">Acción</th>
                        <th className="pb-2">Detalle</th>
                        <th className="pb-2">Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ultimas_acciones.map((a, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 text-gray-500">{fmtDateTime(a.fecha)}</td>
                          <td className="py-2"><Badge color="blue">{a.accion}</Badge></td>
                          <td className="py-2 text-xs">{a.detalle}</td>
                          <td className="py-2 text-gray-500">{a.usuario}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-gray-400 text-sm">Sin registros aún. Los nuevos asientos y anulaciones se registrarán automáticamente.</p>}
              </div>
            </div>
          )}

          {/* ====== BITÁCORA ====== */}
          {tab === "bitacora" && Array.isArray(data) && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="p-3 bg-gray-50 border-b text-sm text-gray-600">{data.length} registros encontrados</div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-gray-500 border-b">
                      <th className="p-2">Fecha</th>
                      <th className="p-2">Acción</th>
                      <th className="p-2">Detalle</th>
                      <th className="p-2">Asiento</th>
                      <th className="p-2">Usuario</th>
                      <th className="p-2">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(b => (
                      <tr key={b.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 whitespace-nowrap text-xs text-gray-500">{fmtDateTime(b.fecha)}</td>
                        <td className="p-2">
                          <Badge color={b.accion.includes('anular') ? 'red' : b.accion.includes('corregir') ? 'amber' : 'green'}>
                            {b.accion_display}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs max-w-md truncate">{b.detalle}</td>
                        <td className="p-2 text-xs">
                          {b.asiento_numero && `#${b.asiento_numero}`}
                          {b.asiento_relacionado_numero && ` → #${b.asiento_relacionado_numero}`}
                        </td>
                        <td className="p-2 text-xs">{b.usuario}</td>
                        <td className="p-2 text-xs text-gray-400">{b.ip_address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ====== ANULACIONES ====== */}
          {tab === "anulaciones" && data?.registros && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <Card title="Total Anulaciones" value={data.total_anulaciones} color="red" />
                <Card title="Correcciones Rápidas" value={data.total_correcciones} color="amber" />
                <Card title="Anulaciones Puras" value={data.total_anulaciones - data.total_correcciones} color="gray" />
              </div>
              <div className="bg-white border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b bg-gray-50">
                      <th className="p-2">#</th>
                      <th className="p-2">Fecha Asiento</th>
                      <th className="p-2">Concepto</th>
                      <th className="p-2">Tercero</th>
                      <th className="p-2">Monto</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Anulado por</th>
                      <th className="p-2">Fecha Anulación</th>
                      <th className="p-2">Motivo</th>
                      <th className="p-2">Ajuste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.registros.map(a => (
                      <tr key={a.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">#{a.numero}</td>
                        <td className="p-2">{fmtDate(a.fecha_asiento)}</td>
                        <td className="p-2 text-xs max-w-xs truncate">{a.concepto}</td>
                        <td className="p-2 text-xs">{a.tercero}</td>
                        <td className="p-2 text-right">{fmtMoney(a.total_debito)}</td>
                        <td className="p-2">
                          <Badge color={a.es_correccion ? "amber" : "red"}>
                            {a.es_correccion ? "Corrección" : "Anulación"}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs">{a.anulado_por}</td>
                        <td className="p-2 text-xs">{fmtDateTime(a.anulado_en)}</td>
                        <td className="p-2 text-xs max-w-xs truncate">{a.motivo}</td>
                        <td className="p-2 text-xs">{a.ajuste_numero && `#${a.ajuste_numero}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ====== NUMERACIÓN ====== */}
          {tab === "numeracion" && Array.isArray(data) && (
            <div className="space-y-4">
              {data.map((r, i) => (
                <div key={i} className={`border rounded-lg p-4 ${r.estado === 'OK' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">
                      <span className="font-mono bg-white px-2 py-0.5 rounded border mr-2">{r.tipo}</span>
                      {r.tipo_nombre} — Año {r.anio}
                    </h3>
                    <Badge color={r.estado === 'OK' ? "green" : "red"}>{r.estado}</Badge>
                  </div>
                  <p className="text-sm">Total: {r.total_asientos} • Rango: {r.rango}</p>
                  {r.total_gaps > 0 && (
                    <div className="mt-2 text-sm">
                      <p className="text-red-700 font-medium">⚠️ {r.total_gaps} número(s) faltante(s):</p>
                      <p className="text-red-600 text-xs mt-1">{r.gaps.join(', ')}{r.total_gaps > 50 ? '...' : ''}</p>
                    </div>
                  )}
                  {r.total_duplicados > 0 && (
                    <div className="mt-2 text-sm">
                      <p className="text-red-700 font-medium">⚠️ {r.total_duplicados} número(s) duplicado(s):</p>
                      <p className="text-red-600 text-xs mt-1">{r.duplicados.join(', ')}</p>
                    </div>
                  )}
                  {r.estado === 'OK' && <p className="text-green-700 text-sm mt-1">✅ Numeración consecutiva sin interrupciones</p>}
                </div>
              ))}
              {data.length === 0 && <p className="text-gray-400 text-center py-8">Sin asientos para este año</p>}
            </div>
          )}

          {/* ====== SALDOS CONTRARIOS ====== */}
          {tab === "saldos" && data?.alertas && (
            <div>
              <div className="mb-4">
                <Card title="Cuentas con Saldo Contrario" value={data.total_alertas}
                  color={data.total_alertas > 0 ? "red" : "green"}
                  sub={data.total_alertas === 0 ? "Todas las cuentas tienen saldo normal" : "Requieren revisión"} />
              </div>
              {data.alertas.length > 0 && (
                <div className="bg-white border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b bg-gray-50">
                        <th className="p-2">Cuenta</th>
                        <th className="p-2">Nombre</th>
                        <th className="p-2">Naturaleza</th>
                        <th className="p-2">Esperado</th>
                        <th className="p-2">Encontrado</th>
                        <th className="p-2 text-right">Saldo</th>
                        <th className="p-2">Severidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.alertas.map((a, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-mono font-medium">{a.cuenta_codigo}</td>
                          <td className="p-2">{a.cuenta_nombre}</td>
                          <td className="p-2"><Badge color="blue">{a.naturaleza}</Badge></td>
                          <td className="p-2 text-sm text-green-700">{a.esperado}</td>
                          <td className="p-2 text-sm text-red-700">{a.encontrado}</td>
                          <td className="p-2 text-right font-medium text-red-600">{fmtMoney(a.saldo)}</td>
                          <td className="p-2"><Badge color={a.severidad === 'alta' ? 'red' : 'amber'}>{a.severidad}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ====== DUPLICADOS ====== */}
          {tab === "duplicados" && data?.duplicados && (
            <div>
              <div className="mb-4">
                <Card title="Grupos de Posibles Duplicados" value={data.total_grupos}
                  color={data.total_grupos > 0 ? "amber" : "green"}
                  sub="Mismo tercero + fecha + monto" />
              </div>
              <div className="space-y-3">
                {data.duplicados.map((g, i) => (
                  <div key={i} className="border rounded-lg bg-amber-50 border-amber-200 p-3">
                    <p className="font-medium text-sm text-amber-800 mb-2">{g.clave}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {g.asientos.map(a => (
                        <div key={a.id} className="bg-white rounded p-2 text-xs border">
                          <span className="font-medium">#{a.numero}</span> — {a.concepto}
                          <span className="text-gray-400 ml-2">{fmtMoney(a.total_debito)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {data.total_grupos === 0 && <p className="text-green-600 text-center py-8">✅ No se detectaron asientos duplicados</p>}
              </div>
            </div>
          )}

          {/* ====== MONTOS INUSUALES ====== */}
          {tab === "montos" && data?.alertas && (
            <div>
              <div className="mb-4">
                <Card title="Movimientos Inusuales" value={data.total_alertas}
                  color={data.total_alertas > 0 ? "amber" : "green"}
                  sub={`Umbral: ${data.umbral_desviaciones} desviaciones estándar`} />
              </div>
              {data.alertas.length > 0 && (
                <div className="bg-white border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b bg-gray-50">
                        <th className="p-2">Cuenta</th>
                        <th className="p-2">Asiento</th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Tercero</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2 text-right">Monto</th>
                        <th className="p-2 text-right">Promedio</th>
                        <th className="p-2">Desviaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.alertas.map((a, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-mono text-xs">{a.cuenta} — {a.cuenta_nombre}</td>
                          <td className="p-2">#{a.asiento_numero}</td>
                          <td className="p-2">{fmtDate(a.fecha)}</td>
                          <td className="p-2 text-xs">{a.tercero}</td>
                          <td className="p-2"><Badge color={a.tipo === 'débito' ? 'blue' : 'amber'}>{a.tipo}</Badge></td>
                          <td className="p-2 text-right font-medium">{fmtMoney(a.monto)}</td>
                          <td className="p-2 text-right text-gray-500">{fmtMoney(a.promedio)}</td>
                          <td className="p-2"><Badge color="red">{a.desviaciones}σ</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ====== SIN SOPORTE ====== */}
          {tab === "soporte" && data?.registros && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Card title="Sin Soporte" value={data.total_sin_soporte} color="amber" />
                <Card title="Total Asientos" value={data.total_asientos} color="indigo" />
                <Card title="% Sin Soporte" value={`${data.porcentaje}%`} color={data.porcentaje > 20 ? "red" : "green"} />
              </div>
              {data.registros.length > 0 && (
                <div className="bg-white border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b bg-gray-50">
                        <th className="p-2">#</th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Concepto</th>
                        <th className="p-2">Tercero</th>
                        <th className="p-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.registros.map(a => (
                        <tr key={a.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">#{a.numero}</td>
                          <td className="p-2">{fmtDate(a.fecha)}</td>
                          <td className="p-2">{a.concepto}</td>
                          <td className="p-2 text-xs">{a.tercero}</td>
                          <td className="p-2 text-right">{fmtMoney(a.total_debito)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ====== CONCENTRACIÓN TERCEROS ====== */}
          {tab === "terceros" && data?.top_terceros && (
            <div>
              <div className="mb-4">
                <Card title="Total Asientos en Periodo" value={data.total_asientos_periodo} color="indigo" />
              </div>
              <div className="bg-white border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b bg-gray-50">
                      <th className="p-2">#</th>
                      <th className="p-2">NIT</th>
                      <th className="p-2">Nombre</th>
                      <th className="p-2 text-right">Asientos</th>
                      <th className="p-2 text-right">% del Total</th>
                      <th className="p-2 text-right">Total Movido</th>
                      <th className="p-2">Concentración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_terceros.map((t, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-gray-400">{i+1}</td>
                        <td className="p-2 font-mono text-xs">{t.nit}</td>
                        <td className="p-2">{t.nombre}</td>
                        <td className="p-2 text-right font-medium">{t.cantidad_asientos}</td>
                        <td className="p-2 text-right">{t.porcentaje}%</td>
                        <td className="p-2 text-right">{fmtMoney(t.total_movido)}</td>
                        <td className="p-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className={`h-2 rounded-full ${t.porcentaje > 30 ? 'bg-red-500' : t.porcentaje > 15 ? 'bg-amber-500' : 'bg-green-500'}`}
                              style={{width: `${Math.min(t.porcentaje, 100)}%`}} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ====== COMPARATIVO MENSUAL ====== */}
          {tab === "comparativo" && data?.cuentas && (
            <div className="bg-white border rounded-lg overflow-x-auto">
              <div className="p-3 bg-gray-50 border-b text-sm">
                Año {data.anio} • {data.cuentas.length} cuentas con movimiento
              </div>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b">
                    <th className="p-1.5 text-left min-w-[180px]">Cuenta</th>
                    {MESES.slice(1).map((m,i) => <th key={i} className="p-1.5 text-right min-w-[80px]">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.cuentas.map((c, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="p-1.5 font-mono whitespace-nowrap">
                        {c.cuenta} <span className="text-gray-400">— {c.nombre}</span>
                      </td>
                      {c.meses.map((m, mi) => (
                        <td key={mi} className={`p-1.5 text-right ${
                          c.alertas_mes.includes(m.mes) ? 'bg-red-100 font-bold text-red-700' :
                          m.neto === 0 ? 'text-gray-300' : ''
                        }`}>
                          {m.neto !== 0 ? fmtMoney(m.neto) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.cuentas.length === 0 && <p className="text-gray-400 text-center py-8">Sin movimientos para este año</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
