// 🎩 Don Peppini — Prestaciones Sociales (Prima, Cesantías, Vacaciones)
import { useState, useEffect } from "react";
import {
  Gift, Calendar, Landmark, Plus, X, BookOpen, Check, ChevronDown,
  ChevronRight, Users, Sun, FileText,
} from "lucide-react";
import { useEmpresa } from "../context/EmpresaContext";
import {
  getEmpleados, getPrimas, createPrima, liquidarPrima,
  getCesantias, createCesantias, liquidarCesantias,
  getVacaciones, createVacacion, updateVacacion, deleteVacacion,
  getSaldosVacaciones,
} from "../services/api";

const peso = (v) => Number(v || 0).toLocaleString("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
});

const Badge = ({ color = "gray", children }) => {
  const colors = {
    gray: "bg-gray-100 text-gray-700", blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700", amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700", purple: "bg-purple-100 text-purple-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>;
};

const estadoColor = { borrador: "amber", liquidada: "blue", pagada: "green", consignada: "green" };

export default function PrestacionesSociales() {
  const { empresaId } = useEmpresa();
  const [tab, setTab] = useState("prima");

  const tabs = [
    { id: "prima", label: "Prima Semestral", icon: Gift, color: "text-purple-600" },
    { id: "cesantias", label: "Cesantías Anuales", icon: Landmark, color: "text-blue-600" },
    { id: "vacaciones", label: "Vacaciones", icon: Sun, color: "text-amber-600" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-100 rounded-lg"><Gift className="text-purple-700" size={24} /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Prestaciones Sociales</h1>
          <p className="text-sm text-gray-500">Prima, Cesantías y Vacaciones — CST</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}>
            <t.icon size={16} className={tab === t.id ? t.color : ""} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "prima" && <PrimaTab empresaId={empresaId} />}
      {tab === "cesantias" && <CesantiasTab empresaId={empresaId} />}
      {tab === "vacaciones" && <VacacionesTab empresaId={empresaId} />}
    </div>
  );
}

// ============================================================
// TAB: PRIMA SEMESTRAL
// ============================================================
function PrimaTab({ empresaId }) {
  const [primas, setPrimas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const data = await getPrimas({ empresa: empresaId });
      setPrimas(Array.isArray(data) ? data : data.results || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [empresaId]);

  const handleCreate = async (anio, semestre) => {
    try {
      const p = await createPrima({ empresa: empresaId, anio, semestre });
      setShowModal(false);
      setSelected(p);
      load();
    } catch (e) {
      alert("Error: " + (e.response?.data?.detail || JSON.stringify(e.response?.data) || e.message));
    }
  };

  const handleLiquidar = async (p) => {
    if (!confirm("¿Liquidar y contabilizar la prima?")) return;
    try {
      const updated = await liquidarPrima(p.id);
      setSelected(updated);
      load();
    } catch (e) { alert("Error: " + (e.response?.data?.error || e.message)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-600">Primas ({primas.length})</h3>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700">
            <Plus size={14} /> Nueva
          </button>
        </div>
        {loading ? <p className="text-sm text-gray-400 text-center py-8">Cargando...</p> :
          primas.length === 0 ? (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed p-8 text-center">
              <Gift size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No hay primas calculadas</p>
            </div>
          ) : primas.map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selected?.id === p.id ? "border-purple-300 bg-purple-50 shadow-sm" : "bg-white hover:bg-gray-50"
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Prima S{p.semestre} — {p.anio}</span>
                <Badge color={estadoColor[p.estado]}>{p.estado_display}</Badge>
              </div>
              <div className="text-xs font-mono text-gray-600 mt-1">{peso(p.total)}</div>
            </button>
          ))
        }
      </div>

      <div className="lg:col-span-2">
        {selected ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Prima S{selected.semestre} — {selected.anio}</h2>
                <Badge color={estadoColor[selected.estado]}>{selected.estado_display}</Badge>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center mb-4">
                <p className="text-sm text-purple-600">Total Prima</p>
                <p className="text-2xl font-bold text-purple-900">{peso(selected.total)}</p>
              </div>

              {selected.detalles?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2">Empleado</th>
                        <th className="text-right px-3 py-2">Salario</th>
                        <th className="text-right px-3 py-2">Días</th>
                        <th className="text-right px-3 py-2">Valor Prima</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.detalles.map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{d.empleado_nombre}</td>
                          <td className="px-3 py-2 text-right font-mono">{peso(d.salario_base)}</td>
                          <td className="px-3 py-2 text-right">{d.dias_trabajados}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">{peso(d.valor_prima)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {selected.estado === "borrador" && (
              <button onClick={() => handleLiquidar(selected)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                <BookOpen size={16} /> Liquidar y Contabilizar
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border-2 border-dashed p-16 text-center">
            <Gift size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">Seleccione una prima o cree una nueva</p>
          </div>
        )}
      </div>

      {showModal && (
        <PrimaModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}

function PrimaModal({ onClose, onCreate }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [semestre, setSemestre] = useState(new Date().getMonth() < 6 ? 1 : 2);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-96 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Calcular Prima Semestral</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
            <input type="number" value={anio} onChange={e => setAnio(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Semestre</label>
            <select value={semestre} onChange={e => setSemestre(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value={1}>1er semestre (Ene-Jun)</option>
              <option value={2}>2do semestre (Jul-Dic)</option>
            </select>
          </div>
        </div>
        <button onClick={() => onCreate(anio, semestre)}
          className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
          Calcular Prima
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TAB: CESANTÍAS ANUALES
// ============================================================
function CesantiasTab({ empresaId }) {
  const [cesantias, setCesantias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const data = await getCesantias({ empresa: empresaId });
      setCesantias(Array.isArray(data) ? data : data.results || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [empresaId]);

  const handleCreate = async (anio) => {
    try {
      const c = await createCesantias({ empresa: empresaId, anio });
      setShowModal(false);
      setSelected(c);
      load();
    } catch (e) {
      alert("Error: " + (e.response?.data?.detail || JSON.stringify(e.response?.data) || e.message));
    }
  };

  const handleLiquidar = async (c) => {
    if (!confirm("¿Liquidar y contabilizar cesantías + intereses?")) return;
    try {
      const updated = await liquidarCesantias(c.id);
      setSelected(updated);
      load();
    } catch (e) { alert("Error: " + (e.response?.data?.error || e.message)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-600">Cesantías ({cesantias.length})</h3>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
            <Plus size={14} /> Nueva
          </button>
        </div>
        {loading ? <p className="text-sm text-gray-400 text-center py-8">Cargando...</p> :
          cesantias.length === 0 ? (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed p-8 text-center">
              <Landmark size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No hay cesantías calculadas</p>
            </div>
          ) : cesantias.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selected?.id === c.id ? "border-blue-300 bg-blue-50 shadow-sm" : "bg-white hover:bg-gray-50"
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Cesantías {c.anio}</span>
                <Badge color={estadoColor[c.estado]}>{c.estado_display}</Badge>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Ces: {peso(c.total_cesantias)} | Int: {peso(c.total_intereses)}
              </div>
            </button>
          ))
        }
      </div>

      <div className="lg:col-span-2">
        {selected ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Cesantías {selected.anio}</h2>
                <Badge color={estadoColor[selected.estado]}>{selected.estado_display}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600">Cesantías</p>
                  <p className="text-xl font-bold text-blue-900">{peso(selected.total_cesantias)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-600">Intereses (12%)</p>
                  <p className="text-xl font-bold text-green-900">{peso(selected.total_intereses)}</p>
                </div>
              </div>

              {selected.detalles?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2">Empleado</th>
                        <th className="text-right px-3 py-2">Días</th>
                        <th className="text-right px-3 py-2">Cesantías</th>
                        <th className="text-right px-3 py-2">Intereses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.detalles.map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{d.empleado_nombre}</td>
                          <td className="px-3 py-2 text-right">{d.dias_trabajados}</td>
                          <td className="px-3 py-2 text-right font-mono">{peso(d.valor_cesantias)}</td>
                          <td className="px-3 py-2 text-right font-mono">{peso(d.valor_intereses)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {selected.estado === "borrador" && (
              <button onClick={() => handleLiquidar(selected)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                <BookOpen size={16} /> Liquidar y Contabilizar
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border-2 border-dashed p-16 text-center">
            <Landmark size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">Seleccione un período o cree uno nuevo</p>
          </div>
        )}
      </div>

      {showModal && (
        <CesantiasModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}

function CesantiasModal({ onClose, onCreate }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-80 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Calcular Cesantías Anuales</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
          <input type="number" value={anio} onChange={e => setAnio(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Se calcularán cesantías (Art. 249 CST) e intereses del 12% (Ley 52/1975)
          para todos los empleados activos con contrato laboral.
        </p>
        <button onClick={() => onCreate(anio)}
          className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Calcular Cesantías + Intereses
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TAB: VACACIONES
// ============================================================
function VacacionesTab({ empresaId }) {
  const [saldos, setSaldos] = useState([]);
  const [vacaciones, setVacaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState("saldos"); // saldos | historial

  const load = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [s, v, e] = await Promise.all([
        getSaldosVacaciones({ empresa: empresaId }),
        getVacaciones({ empresa: empresaId }),
        getEmpleados({ empresa: empresaId }),
      ]);
      setSaldos(s);
      setVacaciones(Array.isArray(v) ? v : v.results || []);
      setEmpleados(Array.isArray(e) ? e : e.results || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [empresaId]);

  const handleCreate = async (data) => {
    try {
      await createVacacion({ ...data, empresa: empresaId });
      setShowModal(false);
      load();
    } catch (e) {
      alert("Error: " + (e.response?.data?.detail || JSON.stringify(e.response?.data) || e.message));
    }
  };

  const handleEstado = async (id, estado) => {
    try {
      await updateVacacion(id, { estado });
      load();
    } catch (e) { alert("Error: " + e.message); }
  };

  const estadoVacColor = {
    solicitada: "amber", aprobada: "blue", disfrutada: "green", rechazada: "red",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setView("saldos")}
            className={`px-3 py-1 rounded-md text-xs font-medium ${view === "saldos" ? "bg-white shadow-sm" : ""}`}>
            Saldos
          </button>
          <button onClick={() => setView("historial")}
            className={`px-3 py-1 rounded-md text-xs font-medium ${view === "historial" ? "bg-white shadow-sm" : ""}`}>
            Historial
          </button>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">
          <Plus size={14} /> Registrar Vacaciones
        </button>
      </div>

      {loading ? <p className="text-center text-gray-400 py-8">Cargando...</p> :
        view === "saldos" ? (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3">Empleado</th>
                  <th className="text-left px-4 py-3">Cargo</th>
                  <th className="text-right px-4 py-3">Causados</th>
                  <th className="text-right px-4 py-3">Tomados</th>
                  <th className="text-right px-4 py-3">Pendientes</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map((s, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{s.empleado_nombre}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.cargo}</td>
                    <td className="px-4 py-2.5 text-right">{s.dias_causados}</td>
                    <td className="px-4 py-2.5 text-right">{s.dias_tomados}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${
                      s.dias_pendientes > 15 ? "text-red-600" : s.dias_pendientes > 0 ? "text-amber-600" : "text-green-600"
                    }`}>{s.dias_pendientes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2">
            {vacaciones.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No hay vacaciones registradas</p>
            ) : vacaciones.map(v => (
              <div key={v.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{v.empleado_nombre}</p>
                  <p className="text-xs text-gray-500">
                    {v.fecha_inicio} → {v.fecha_fin} • {v.dias_habiles} días
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={estadoVacColor[v.estado]}>{v.estado_display}</Badge>
                  {v.estado === "solicitada" && (
                    <div className="flex gap-1">
                      <button onClick={() => handleEstado(v.id, "aprobada")}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">Aprobar</button>
                      <button onClick={() => handleEstado(v.id, "rechazada")}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Rechazar</button>
                    </div>
                  )}
                  {v.estado === "aprobada" && (
                    <button onClick={() => handleEstado(v.id, "disfrutada")}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                      Marcar disfrutada
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      }

      {showModal && (
        <VacacionesModal
          empleados={empleados.filter(e => e.activo)}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function VacacionesModal({ empleados, onClose, onCreate }) {
  const [form, setForm] = useState({
    empleado: "", fecha_inicio: "", fecha_fin: "", dias_habiles: "", notas: "",
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[28rem] p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Sun size={18} className="text-amber-600" /> Registrar Vacaciones</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Empleado</label>
            <select value={form.empleado} onChange={e => setForm(f => ({ ...f, empleado: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" required>
              <option value="">-- Seleccionar --</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.tercero_nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio}
                onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
              <input type="date" value={form.fecha_fin}
                onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Días hábiles</label>
            <input type="number" value={form.dias_habiles} min="0.5" step="0.5"
              onChange={e => setForm(f => ({ ...f, dias_habiles: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="15" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={() => onCreate({
            empleado: Number(form.empleado),
            fecha_inicio: form.fecha_inicio,
            fecha_fin: form.fecha_fin,
            dias_habiles: Number(form.dias_habiles),
            notas: form.notas,
          })} disabled={!form.empleado || !form.fecha_inicio}
            className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
