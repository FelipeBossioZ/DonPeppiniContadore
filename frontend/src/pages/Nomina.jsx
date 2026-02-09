// 🎩 Don Peppini Contadore - Módulo de Nómina
import React, { useState, useMemo } from "react";
import {
  Users, Plus, Edit2, Trash2, DollarSign, CheckCircle, Eye, X,
  ChevronDown, ChevronUp, Calculator, Briefcase, AlertCircle
} from "lucide-react";
import { useEmpresa } from "../context/EmpresaContext";
import { useTerceros } from "../hooks/useTerceros";
import {
  useEmpleados, useCreateEmpleado, useUpdateEmpleado, useDeleteEmpleado,
  useNominas, useCreateNomina, useLiquidarNomina, usePagarNomina, useDeleteNomina,
  useParametrosNomina,
} from "../hooks/useNomina";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const peso = (v) => {
  const n = Number(v) || 0;
  return "$" + n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const Badge = ({ color, children }) => {
  const colors = {
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-800",
    red: "bg-red-100 text-red-800",
    gray: "bg-gray-100 text-gray-600",
    indigo: "bg-indigo-100 text-indigo-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
};

// ============================================================
// MODAL EMPLEADO
// ============================================================
function EmpleadoModal({ empleado, terceros, empresaId, onClose, onCreate, onUpdate }) {
  const isEdit = !!empleado;
  const [form, setForm] = useState({
    tercero: empleado?.tercero || "",
    tipo_contrato: empleado?.tipo_contrato || "IND",
    fecha_ingreso: empleado?.fecha_ingreso || new Date().toISOString().slice(0, 10),
    salario_base: empleado?.salario_base || "",
    salario_integral: empleado?.salario_integral || false,
    nivel_arl: empleado?.nivel_arl || 1,
    cargo: empleado?.cargo || "",
    eps: empleado?.eps || "",
    afp: empleado?.afp || "",
    caja_compensacion: empleado?.caja_compensacion || "",
    arl_nombre: empleado?.arl_nombre || "",
    centro_costo: empleado?.centro_costo || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        empresa: empresaId,
        salario_base: Number(form.salario_base),
        nivel_arl: Number(form.nivel_arl),
        tercero: Number(form.tercero),
      };
      if (isEdit) {
        await onUpdate({ id: empleado.id, ...payload });
      } else {
        await onCreate(payload);
      }
      onClose();
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, name, type = "text", children, ...props }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children || (
        <input type={type} value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none" {...props} />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? "Editar" : "Nuevo"} Empleado</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Tercero *" name="tercero">
            <select value={form.tercero} onChange={e => setForm(f => ({ ...f, tercero: e.target.value }))}
              required disabled={isEdit}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
              <option value="">-- Seleccionar --</option>
              {terceros?.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.numero_documento})</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cargo" name="cargo" placeholder="Ej: Auxiliar contable" />
            <Field label="Tipo contrato" name="tipo_contrato">
              <select value={form.tipo_contrato} onChange={e => setForm(f => ({ ...f, tipo_contrato: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="IND">Indefinido</option>
                <option value="FIJ">Fijo</option>
                <option value="OBR">Obra o labor</option>
                <option value="PRE">Prestación de servicios</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha ingreso *" name="fecha_ingreso" type="date" required />
            <Field label="Salario base mensual *" name="salario_base" type="number" required min="0" placeholder="1750905" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nivel ARL" name="nivel_arl">
              <select value={form.nivel_arl} onChange={e => setForm(f => ({ ...f, nivel_arl: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Nivel {n}</option>)}
              </select>
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.salario_integral}
                  onChange={e => setForm(f => ({ ...f, salario_integral: e.target.checked }))}
                  className="rounded border-gray-300" />
                Salario integral
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="EPS" name="eps" placeholder="Sura, Nueva EPS..." />
            <Field label="AFP (Pensiones)" name="afp" placeholder="Porvenir, Protección..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Caja compensación" name="caja_compensacion" placeholder="Comfama, Comfenalco..." />
            <Field label="ARL" name="arl_nombre" placeholder="Sura, Positiva..." />
          </div>

          <Field label="Centro de costo" name="centro_costo" placeholder="Ej: Administración" />

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50">
              {saving ? "Guardando..." : isEdit ? "Actualizar" : "Crear Empleado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// MODAL DETALLE LIQUIDACIÓN
// ============================================================
function LiquidacionDetailModal({ liquidacion: liq, onClose }) {
  if (!liq) return null;

  const Section = ({ title, children }) => (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );

  const Row = ({ label, value, bold }) => (
    <div className={`flex justify-between text-sm ${bold ? "font-semibold" : ""}`}>
      <span className="text-gray-600">{label}</span>
      <span>{peso(value)}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold">{liq.empleado_nombre}</h2>
            <p className="text-xs text-gray-500">{liq.empleado_cargo} • {liq.dias_trabajados} días</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>
        <div className="p-5">
          <Section title="Devengados">
            <Row label="Salario" value={liq.salario_devengado} />
            <Row label="Auxilio transporte" value={liq.auxilio_transporte} />
            {Number(liq.horas_extras) > 0 && <Row label="Horas extras" value={liq.horas_extras} />}
            {Number(liq.recargos) > 0 && <Row label="Recargos" value={liq.recargos} />}
            {Number(liq.comisiones) > 0 && <Row label="Comisiones" value={liq.comisiones} />}
            {Number(liq.bonificaciones) > 0 && <Row label="Bonificaciones" value={liq.bonificaciones} />}
            <div className="border-t pt-1 mt-1">
              <Row label="Total devengado" value={liq.total_devengado} bold />
            </div>
          </Section>

          <Section title="Deducciones empleado">
            <Row label="Salud (4%)" value={liq.salud_empleado} />
            <Row label="Pensión (4%)" value={liq.pension_empleado} />
            {Number(liq.fsp) > 0 && <Row label="Fondo solidaridad" value={liq.fsp} />}
            {Number(liq.retencion_fuente) > 0 && <Row label="Retención fuente" value={liq.retencion_fuente} />}
            {Number(liq.libranzas) > 0 && <Row label="Libranzas" value={liq.libranzas} />}
            {Number(liq.otros_descuentos) > 0 && <Row label="Otros descuentos" value={liq.otros_descuentos} />}
            <div className="border-t pt-1 mt-1">
              <Row label="Total deducciones" value={liq.total_deducciones} bold />
            </div>
          </Section>

          <div className="bg-indigo-50 rounded-lg p-3 mb-4">
            <Row label="NETO A PAGAR" value={liq.neto_pagar} bold />
          </div>

          <Section title="Aportes empleador">
            <Row label="Salud (8.5%)" value={liq.salud_empleador} />
            <Row label="Pensión (12%)" value={liq.pension_empleador} />
            <Row label="ARL" value={liq.arl} />
            <Row label="Caja compensación (4%)" value={liq.caja_compensacion} />
            <Row label="SENA (2%)" value={liq.sena} />
            <Row label="ICBF (3%)" value={liq.icbf} />
          </Section>

          <Section title="Provisiones prestaciones">
            <Row label="Prima" value={liq.provision_prima} />
            <Row label="Cesantías" value={liq.provision_cesantias} />
            <Row label="Int. cesantías" value={liq.provision_int_cesantias} />
            <Row label="Vacaciones" value={liq.provision_vacaciones} />
          </Section>

          <div className="bg-green-50 rounded-lg p-3">
            <Row label="COSTO TOTAL EMPRESA" value={liq.costo_empresa} bold />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL NOVEDADES (antes de liquidar)
// ============================================================
function NovedadesModal({ empleados, onClose, onLiquidar }) {
  const [novedades, setNovedades] = useState({});
  const [liquidando, setLiquidando] = useState(false);

  const setNov = (empId, field, value) => {
    setNovedades(prev => ({
      ...prev,
      [empId]: { ...(prev[empId] || {}), [field]: value }
    }));
  };

  const handleLiquidar = async () => {
    setLiquidando(true);
    try {
      await onLiquidar(novedades);
      onClose();
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setLiquidando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold">Novedades de Nómina</h2>
            <p className="text-xs text-gray-500">Ajuste días, horas extras, descuentos antes de liquidar. Déjelos en 0 si no aplica.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>
        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left py-2 pr-2">Empleado</th>
                  <th className="text-center px-1">Días</th>
                  <th className="text-right px-1">H. Extras</th>
                  <th className="text-right px-1">Comisiones</th>
                  <th className="text-right px-1">Bonificac.</th>
                  <th className="text-right px-1">Libranzas</th>
                  <th className="text-right px-1">Otros desc.</th>
                </tr>
              </thead>
              <tbody>
                {empleados?.map(emp => {
                  const nov = novedades[emp.id] || {};
                  return (
                    <tr key={emp.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{emp.tercero_nombre}</div>
                        <div className="text-xs text-gray-400">{emp.cargo} • {peso(emp.salario_base)}</div>
                      </td>
                      <td className="px-1">
                        <input type="number" min="0" max="30" value={nov.dias_trabajados ?? 30}
                          onChange={e => setNov(emp.id, "dias_trabajados", Number(e.target.value))}
                          className="w-14 border rounded px-1 py-1 text-center text-sm" />
                      </td>
                      {["horas_extras", "comisiones", "bonificaciones", "libranzas", "otros_descuentos"].map(field => (
                        <td key={field} className="px-1">
                          <input type="number" min="0" value={nov[field] ?? 0}
                            onChange={e => setNov(emp.id, field, Number(e.target.value))}
                            className="w-20 border rounded px-1 py-1 text-right text-sm" />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-sm">Cancelar</button>
            <button onClick={handleLiquidar} disabled={liquidando}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Calculator size={16} />
              {liquidando ? "Liquidando..." : "Liquidar Nómina"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PÁGINA PRINCIPAL NÓMINA
// ============================================================
export default function Nomina() {
  const { empresaId } = useEmpresa();
  const anio = new Date().getFullYear();

  // Data
  const { data: empleados = [], isLoading: loadEmp } = useEmpleados(empresaId);
  const { data: terceros = [] } = useTerceros();
  const { data: nominas = [], isLoading: loadNom } = useNominas(empresaId, anio);
  const { data: params } = useParametrosNomina(anio);

  // Mutations
  const createEmp = useCreateEmpleado(empresaId);
  const updateEmp = useUpdateEmpleado(empresaId);
  const deleteEmp = useDeleteEmpleado(empresaId);
  const createNom = useCreateNomina(empresaId);
  const liquidarNom = useLiquidarNomina();
  const pagarNom = usePagarNomina();
  const deleteNom = useDeleteNomina();

  // State
  const [tab, setTab] = useState("nominas"); // "empleados" | "nominas"
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [expandedNomina, setExpandedNomina] = useState(null);
  const [showNovedades, setShowNovedades] = useState(null); // nomina id
  const [showLiqDetail, setShowLiqDetail] = useState(null);
  const [newNomMes, setNewNomMes] = useState(new Date().getMonth() + 1);
  const [newNomTipo, setNewNomTipo] = useState("MEN");
  const [search, setSearch] = useState("");

  // Empleados filtrados
  const empFiltrados = useMemo(() => {
    if (!search) return empleados;
    const s = search.toLowerCase();
    return empleados.filter(e =>
      e.tercero_nombre?.toLowerCase().includes(s) ||
      e.cargo?.toLowerCase().includes(s) ||
      e.tercero_documento?.includes(s)
    );
  }, [empleados, search]);

  if (!empresaId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-gray-400">
          <AlertCircle size={48} className="mx-auto mb-3" />
          <p>Seleccione una empresa para ver la nómina</p>
        </div>
      </div>
    );
  }

  const handleCrearNomina = async () => {
    try {
      await createNom.mutateAsync({ empresa: empresaId, anio, mes: newNomMes, tipo: newNomTipo });
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
    }
  };

  const handleLiquidar = async (nominaId, novedades) => {
    await liquidarNom.mutateAsync({ id: nominaId, novedades });
  };

  const handlePagar = async (nominaId) => {
    if (!confirm("¿Marcar esta nómina como pagada?")) return;
    await pagarNom.mutateAsync(nominaId);
  };

  const handleDeleteNomina = async (nominaId) => {
    if (!confirm("¿Eliminar esta nómina?")) return;
    await deleteNom.mutateAsync(nominaId);
  };

  const handleDeleteEmpleado = async (id) => {
    if (!confirm("¿Eliminar este empleado?")) return;
    try {
      await deleteEmp.mutateAsync(id);
    } catch (err) {
      alert("No se puede eliminar: puede tener liquidaciones asociadas.");
    }
  };

  const estadoColor = { borrador: "yellow", liquidada: "blue", pagada: "green", anulada: "red" };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Briefcase className="text-indigo-600" size={28} />
            Nómina
          </h1>
          {params && (
            <p className="text-sm text-gray-500 mt-1">
              SMLV {anio}: {peso(params.smlv)} • Aux. transporte: {peso(params.auxilio_transporte)}
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          <button onClick={() => setTab("nominas")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "nominas" ? "bg-indigo-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-50"}`}>
            <DollarSign size={16} className="inline mr-1" /> Nóminas
          </button>
          <button onClick={() => setTab("empleados")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "empleados" ? "bg-indigo-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-50"}`}>
            <Users size={16} className="inline mr-1" /> Empleados ({empleados.length})
          </button>
        </div>
      </div>

      {/* ============ TAB EMPLEADOS ============ */}
      {tab === "empleados" && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="flex items-center justify-between p-4 border-b">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar empleado..." className="border rounded-lg px-3 py-2 text-sm w-64" />
            <button onClick={() => { setEditEmp(null); setShowEmpModal(true); }}
              className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              <Plus size={16} /> Nuevo Empleado
            </button>
          </div>
          {loadEmp ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : empFiltrados.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Users size={40} className="mx-auto mb-2" />
              No hay empleados registrados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 bg-gray-50 border-b">
                    <th className="text-left px-4 py-3">Empleado</th>
                    <th className="text-left px-4 py-3">Cargo</th>
                    <th className="text-left px-4 py-3">Contrato</th>
                    <th className="text-right px-4 py-3">Salario</th>
                    <th className="text-center px-4 py-3">ARL</th>
                    <th className="text-center px-4 py-3">Aux. trans.</th>
                    <th className="text-center px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {empFiltrados.map(emp => (
                    <tr key={emp.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{emp.tercero_nombre}</div>
                        <div className="text-xs text-gray-400">{emp.tercero_documento}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{emp.cargo || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge color="indigo">
                          {{ IND: "Indefinido", FIJ: "Fijo", OBR: "Obra/labor", PRE: "Prestación" }[emp.tipo_contrato]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{peso(emp.salario_base)}</td>
                      <td className="px-4 py-3 text-center">{emp.nivel_arl}</td>
                      <td className="px-4 py-3 text-center">
                        {emp.tiene_auxilio ? <Badge color="green">Sí</Badge> : <Badge color="gray">No</Badge>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditEmp(emp); setShowEmpModal(true); }}
                            className="p-1.5 hover:bg-indigo-50 rounded text-indigo-600" title="Editar">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleDeleteEmpleado(emp.id)}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ TAB NÓMINAS ============ */}
      {tab === "nominas" && (
        <>
          {/* Crear nómina */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
                <select value={newNomMes} onChange={e => setNewNomMes(Number(e.target.value))}
                  className="border rounded-lg px-3 py-2 text-sm">
                  {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select value={newNomTipo} onChange={e => setNewNomTipo(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm">
                  <option value="MEN">Mensual</option>
                  <option value="Q1">1ª Quincena</option>
                  <option value="Q2">2ª Quincena</option>
                </select>
              </div>
              <button onClick={handleCrearNomina} disabled={createNom.isPending || empleados.length === 0}
                className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                <Plus size={16} /> Crear Nómina {MESES[newNomMes]} {anio}
              </button>
              {empleados.length === 0 && (
                <span className="text-xs text-amber-600">⚠️ Primero registre empleados</span>
              )}
            </div>
          </div>

          {/* Lista de nóminas */}
          {loadNom ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : nominas.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
              <DollarSign size={48} className="mx-auto mb-3" />
              <p>No hay nóminas para {anio}</p>
              <p className="text-xs mt-1">Cree la primera nómina arriba</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nominas.map(nom => {
                const isExpanded = expandedNomina === nom.id;
                return (
                  <div key={nom.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {/* Header nómina */}
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedNomina(isExpanded ? null : nom.id)}>
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        <div>
                          <span className="font-semibold">
                            {MESES[nom.mes]} {nom.anio} — {nom.tipo_display}
                          </span>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {nom.num_empleados} empleado(s) • Neto: {peso(nom.total_neto)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={estadoColor[nom.estado]}>{nom.estado_display}</Badge>
                        {nom.estado === "borrador" && (
                          <>
                            <button onClick={e => { e.stopPropagation(); setShowNovedades(nom.id); }}
                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 flex items-center gap-1">
                              <Calculator size={14} /> Liquidar
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteNomina(nom.id); }}
                              className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Eliminar">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        {nom.estado === "liquidada" && (
                          <>
                            <button onClick={e => { e.stopPropagation(); setShowNovedades(nom.id); }}
                              className="px-3 py-1.5 border text-indigo-600 rounded-lg text-xs hover:bg-indigo-50 flex items-center gap-1">
                              <Calculator size={14} /> Reliquidar
                            </button>
                            <button onClick={e => { e.stopPropagation(); handlePagar(nom.id); }}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 flex items-center gap-1">
                              <CheckCircle size={14} /> Pagar
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Liquidaciones expandidas */}
                    {isExpanded && nom.liquidaciones?.length > 0 && (
                      <div className="border-t">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 bg-gray-50 border-b">
                              <th className="text-left px-4 py-2">Empleado</th>
                              <th className="text-center px-2 py-2">Días</th>
                              <th className="text-right px-2 py-2">Devengado</th>
                              <th className="text-right px-2 py-2">Deducciones</th>
                              <th className="text-right px-2 py-2 font-semibold">Neto</th>
                              <th className="text-right px-2 py-2">Costo emp.</th>
                              <th className="text-center px-2 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {nom.liquidaciones.map(liq => (
                              <tr key={liq.id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-2">
                                  <div className="font-medium">{liq.empleado_nombre}</div>
                                  <div className="text-xs text-gray-400">{liq.empleado_cargo}</div>
                                </td>
                                <td className="px-2 py-2 text-center">{liq.dias_trabajados}</td>
                                <td className="px-2 py-2 text-right font-mono">{peso(liq.total_devengado)}</td>
                                <td className="px-2 py-2 text-right font-mono text-red-600">{peso(liq.total_deducciones)}</td>
                                <td className="px-2 py-2 text-right font-mono font-semibold">{peso(liq.neto_pagar)}</td>
                                <td className="px-2 py-2 text-right font-mono text-gray-500">{peso(liq.costo_empresa)}</td>
                                <td className="px-2 py-2 text-center">
                                  <button onClick={() => setShowLiqDetail(liq)}
                                    className="p-1 hover:bg-indigo-50 rounded text-indigo-600" title="Ver detalle">
                                    <Eye size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 font-semibold text-sm">
                              <td className="px-4 py-2" colSpan={2}>Totales</td>
                              <td className="px-2 py-2 text-right font-mono">{peso(nom.total_devengado)}</td>
                              <td className="px-2 py-2 text-right font-mono text-red-600">{peso(nom.total_deducciones)}</td>
                              <td className="px-2 py-2 text-right font-mono">{peso(nom.total_neto)}</td>
                              <td className="px-2 py-2 text-right font-mono text-gray-500">{peso(nom.total_costo_empresa)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {isExpanded && (!nom.liquidaciones || nom.liquidaciones.length === 0) && (
                      <div className="border-t p-6 text-center text-gray-400 text-sm">
                        Sin liquidaciones — presione "Liquidar" para calcular la nómina
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* === MODALES === */}
      {showEmpModal && (
        <EmpleadoModal
          empleado={editEmp}
          terceros={terceros}
          empresaId={empresaId}
          onClose={() => { setShowEmpModal(false); setEditEmp(null); }}
          onCreate={d => createEmp.mutateAsync(d)}
          onUpdate={d => updateEmp.mutateAsync(d)}
        />
      )}

      {showNovedades && (
        <NovedadesModal
          empleados={empleados}
          onClose={() => setShowNovedades(null)}
          onLiquidar={novedades => handleLiquidar(showNovedades, novedades)}
        />
      )}

      {showLiqDetail && (
        <LiquidacionDetailModal
          liquidacion={showLiqDetail}
          onClose={() => setShowLiqDetail(null)}
        />
      )}
    </div>
  );
}
