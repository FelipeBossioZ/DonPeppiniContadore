// 🎩 Don Peppini — Liquidación de Contrato Laboral
import { useState, useEffect } from "react";
import {
  UserMinus, Plus, X, ChevronDown, ChevronRight,
  Calculator, BookOpen, CreditCard, AlertTriangle, Check, FileText,
  Pencil, Trash2, RefreshCcw, FileDown,
} from "lucide-react";
import { useEmpresa } from "../context/EmpresaContext";
import {
  getEmpleados, getLiquidacionesContrato, createLiquidacionContrato,
  updateLiquidacionContrato, deleteLiquidacionContrato,
  liquidarContrato, pagarLiquidacionContrato,
  descargarComprobanteContrato,
} from "../services/api";

const peso = (v) => Number(v || 0).toLocaleString("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
});

const MOTIVOS = [
  { value: "RENUNCIA", label: "Renuncia voluntaria", color: "blue" },
  { value: "DESPIDO_JUSTA", label: "Despido con justa causa", color: "orange" },
  { value: "DESPIDO_INJUSTA", label: "Despido sin justa causa", color: "red" },
  { value: "MUTUO", label: "Mutuo acuerdo", color: "purple" },
  { value: "TERMINACION_FIJO", label: "Terminación contrato fijo", color: "gray" },
  { value: "FIN_OBRA", label: "Finalización obra o labor", color: "gray" },
];

const Badge = ({ color = "gray", children }) => {
  const colors = {
    gray: "bg-gray-100 text-gray-700", blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700", red: "bg-red-100 text-red-700",
    orange: "bg-orange-100 text-orange-700", purple: "bg-purple-100 text-purple-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>;
};

const estadoColor = { borrador: "amber", liquidada: "blue", pagada: "green", anulada: "red" };

export default function LiquidacionContratoPage() {
  const { empresaId } = useEmpresa();
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [liqs, emps] = await Promise.all([
        getLiquidacionesContrato({ empresa: empresaId }),
        getEmpleados({ empresa: empresaId }),
      ]);
      setLiquidaciones(Array.isArray(liqs) ? liqs : liqs.results || []);
      setEmpleados(Array.isArray(emps) ? emps : emps.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [empresaId]);

  const handleCreated = (liq) => {
    setShowModal(false);
    setSelected(liq);
    loadData();
  };

  const handleEdited = (liq) => {
    setEditModal(null);
    setSelected(liq);
    loadData();
  };

  const handleDelete = async (liq) => {
    if (!confirm(`¿Eliminar la liquidación de ${liq.empleado_nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteLiquidacionContrato(liq.id);
      setSelected(null);
      loadData();
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.response?.data?.[0] || err.message));
    }
  };

  const handleLiquidar = async (liq) => {
    if (!confirm("¿Liquidar definitivamente? Esto genera el asiento contable y desactiva al empleado.")) return;
    try {
      const updated = await liquidarContrato(liq.id);
      setSelected(updated);
      loadData();
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const handlePagar = async (liq) => {
    if (!confirm("¿Marcar como pagada?")) return;
    try {
      const updated = await pagarLiquidacionContrato(liq.id);
      setSelected(updated);
      loadData();
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const empActivos = empleados.filter(e => e.activo);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg"><UserMinus className="text-red-700" size={24} /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Liquidación de Contrato</h1>
            <p className="text-sm text-gray-500">Art. 64, 186, 249, 306 CST — Ley 52/1975</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
          <Plus size={16} /> Nueva Liquidación
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Liquidaciones ({liquidaciones.length})</h3>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
          ) : liquidaciones.length === 0 ? (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed p-8 text-center">
              <UserMinus size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No hay liquidaciones</p>
            </div>
          ) : (
            liquidaciones.map(liq => (
              <button key={liq.id} onClick={() => setSelected(liq)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selected?.id === liq.id ? "border-red-300 bg-red-50 shadow-sm" : "bg-white hover:bg-gray-50"
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 truncate">{liq.empleado_nombre}</span>
                  <Badge color={estadoColor[liq.estado]}>{liq.estado_display}</Badge>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{liq.motivo_display}</span>
                  <span className="text-xs font-mono text-gray-600">{peso(liq.neto_pagar)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Retiro: {liq.fecha_retiro}</div>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <DetailView liq={selected}
              onLiquidar={handleLiquidar}
              onPagar={handlePagar}
              onEdit={() => setEditModal(selected)}
              onDelete={() => handleDelete(selected)}
            />
          ) : (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed p-16 text-center">
              <FileText size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">Seleccione una liquidación o cree una nueva</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <LiquidacionModal
          empleados={empActivos} empresaId={empresaId}
          onClose={() => setShowModal(false)} onSaved={handleCreated}
        />
      )}
      {editModal && (
        <LiquidacionModal
          empleados={empActivos} empresaId={empresaId} liquidacion={editModal}
          onClose={() => setEditModal(null)} onSaved={handleEdited}
        />
      )}
    </div>
  );
}

function DetailView({ liq, onLiquidar, onPagar, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const Row = ({ label, value, bold, sub, highlight }) => (
    <div className={`flex justify-between py-1.5 ${bold ? "font-semibold" : ""} ${sub ? "pl-4 text-gray-500" : ""} ${highlight ? "bg-amber-50 px-3 -mx-3 rounded" : ""}`}>
      <span className={`text-sm ${highlight ? "text-amber-800" : ""}`}>{label}</span>
      <span className={`text-sm font-mono ${highlight ? "text-amber-900 font-bold" : ""}`}>{peso(value)}</span>
    </div>
  );
  const motivo = MOTIVOS.find(m => m.value === liq.motivo);
  const isBorrador = liq.estado === "borrador";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{liq.empleado_nombre}</h2>
            <p className="text-sm text-gray-500">{liq.empleado_cargo} • {liq.empleado_documento}</p>
          </div>
          <div className="flex items-center gap-2">
            {isBorrador && (
              <button onClick={onEdit} title="Editar"
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Pencil size={16} />
              </button>
            )}
            <button onClick={onDelete} title="Eliminar"
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={16} />
            </button>
            <Badge color={estadoColor[liq.estado]}>{liq.estado_display}</Badge>
            {liq.asiento_numero && <span className="text-xs text-gray-400">Asiento {liq.asiento_numero}</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-gray-400">Ingreso</p><p className="font-medium">{liq.fecha_ingreso}</p></div>
          <div><p className="text-xs text-gray-400">Retiro</p><p className="font-medium">{liq.fecha_retiro}</p></div>
          <div><p className="text-xs text-gray-400">Salario</p><p className="font-medium">{peso(liq.salario_base)}</p></div>
          <div><p className="text-xs text-gray-400">Motivo</p><Badge color={motivo?.color || "gray"}>{liq.motivo_display}</Badge></div>
        </div>
        {(liq.salario_integral || liq.trabajo_remoto) && (
          <div className="flex gap-2 mt-2">
            {liq.salario_integral && <Badge color="purple">Salario integral</Badge>}
            {liq.trabajo_remoto && <Badge color="blue">Trabajo remoto</Badge>}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border-2 border-red-200 p-5 text-center">
        <p className="text-sm text-red-600 font-medium">Neto a Pagar</p>
        <p className="text-3xl font-bold text-red-900">{peso(liq.neto_pagar)}</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
          <span className="text-sm font-semibold text-gray-800">📋 Desglose de la Liquidación</span>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {expanded && (
          <div className="px-5 pb-5 space-y-1 divide-y divide-gray-100">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Devengados</p>
              {Number(liq.salario_proporcional) > 0 && <Row label={`Salario proporcional (${liq.dias_ultimo_mes} días)`} value={liq.salario_proporcional} />}
              {Number(liq.auxilio_transporte_prop) > 0 && <Row label="Auxilio transporte proporcional" value={liq.auxilio_transporte_prop} />}
              <Row label={`Vacaciones (${Number(liq.dias_vacaciones_pendientes).toFixed(1)} días)`} value={liq.vacaciones} />
              {Number(liq.prima_servicios) > 0 && <Row label={`Prima de servicios (${liq.dias_prima} días)`} value={liq.prima_servicios} />}
              {Number(liq.cesantias) > 0 && <Row label={`Cesantías (${liq.dias_cesantias} días)`} value={liq.cesantias} />}
              {Number(liq.intereses_cesantias) > 0 && <Row label="Intereses sobre cesantías (12%)" value={liq.intereses_cesantias} />}
              {Number(liq.indemnizacion) > 0 && <Row label="⚠️ Indemnización (Art. 64 CST)" value={liq.indemnizacion} highlight />}
              <Row label="TOTAL DEVENGADO" value={liq.total_devengado} bold />
            </div>
            <div className="pt-2">
              <p className="text-xs text-gray-500 font-medium mb-1">Deducciones</p>
              <Row label="Salud empleado (4%)" value={liq.deduccion_salud} sub />
              <Row label="Pensión empleado (4%)" value={liq.deduccion_pension} sub />
              {Number(liq.retencion_fuente) > 0 && <Row label="Retención en la fuente" value={liq.retencion_fuente} sub />}
              {Number(liq.otros_descuentos) > 0 && <Row label="Otros descuentos" value={liq.otros_descuentos} sub />}
              <Row label="TOTAL DEDUCCIONES" value={liq.total_deducciones} bold />
            </div>
            <div className="pt-3">
              <div className="flex justify-between py-2 bg-red-100 px-3 -mx-3 rounded-lg">
                <span className="text-sm font-bold text-red-900">NETO A PAGAR</span>
                <span className="text-sm font-bold font-mono text-red-900">{peso(liq.neto_pagar)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {liq.estado === "borrador" && (
          <button onClick={() => onLiquidar(liq)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <BookOpen size={16} /> Liquidar y Contabilizar
          </button>
        )}
        {liq.estado === "liquidada" && (
          <button onClick={() => onPagar(liq)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <CreditCard size={16} /> Marcar como Pagada
          </button>
        )}
        {liq.estado === "pagada" && (
          <div className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm">
            <Check size={16} /> Liquidación pagada
          </div>
        )}
        {liq.estado !== "borrador" && (
          <button onClick={() => descargarComprobanteContrato(liq.id)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 text-sm font-medium">
            <FileDown size={16} /> PDF
          </button>
        )}
      </div>
    </div>
  );
}

function LiquidacionModal({ empleados, empresaId, liquidacion, onClose, onSaved }) {
  const isEdit = !!liquidacion;
  const [form, setForm] = useState({
    empleado: liquidacion?.empleado?.toString() || "",
    motivo: liquidacion?.motivo || "RENUNCIA",
    fecha_retiro: liquidacion?.fecha_retiro || new Date().toISOString().slice(0, 10),
    dias_vacaciones_disfrutados: liquidacion?.dias_vacaciones_disfrutados?.toString() || "0",
    fecha_fin_contrato: liquidacion?.fecha_fin_contrato || "",
    notas: liquidacion?.notas || "",
  });
  const [saving, setSaving] = useState(false);
  const [empSelected, setEmpSelected] = useState(
    isEdit ? empleados.find(e => e.id === liquidacion.empleado) || null : null
  );

  const handleEmpChange = (id) => {
    setForm(f => ({ ...f, empleado: id }));
    setEmpSelected(empleados.find(e => e.id === Number(id)) || null);
  };

  const needsFechaFin = form.motivo === "DESPIDO_INJUSTA" &&
    ((empSelected?.tipo_contrato === "FIJ") || (isEdit && liquidacion?.tipo_contrato === "FIJ"));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let result;
      if (isEdit) {
        result = await updateLiquidacionContrato(liquidacion.id, {
          motivo: form.motivo,
          fecha_retiro: form.fecha_retiro,
          dias_vacaciones_disfrutados: Number(form.dias_vacaciones_disfrutados) || 0,
          fecha_fin_contrato: form.fecha_fin_contrato || null,
          notas: form.notas,
        });
      } else {
        result = await createLiquidacionContrato({
          empresa: empresaId,
          empleado: Number(form.empleado),
          motivo: form.motivo,
          fecha_retiro: form.fecha_retiro,
          dias_vacaciones_disfrutados: Number(form.dias_vacaciones_disfrutados) || 0,
          fecha_fin_contrato: form.fecha_fin_contrato || null,
          notas: form.notas,
        });
      }
      onSaved(result);
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {isEdit ? <Pencil size={20} className="text-blue-600" /> : <UserMinus size={20} className="text-red-600" />}
            {isEdit ? "Editar Liquidación" : "Nueva Liquidación de Contrato"}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isEdit ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Empleado *</label>
              <select value={form.empleado} onChange={e => handleEmpChange(e.target.value)} required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 outline-none">
                <option value="">-- Seleccionar empleado --</option>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>{e.tercero_nombre} — {peso(e.salario_base)}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold">{liquidacion.empleado_nombre}</p>
              <p className="text-gray-500">Salario: {peso(liquidacion.salario_base)} — Ingreso: {liquidacion.fecha_ingreso}</p>
            </div>
          )}

          {!isEdit && empSelected && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><strong>Ingreso:</strong> {empSelected.fecha_ingreso}</p>
              <p><strong>Salario:</strong> {peso(empSelected.salario_base)}
                {empSelected.salario_integral ? " (Integral)" : ""}
                {empSelected.trabajo_remoto ? " • Remoto" : ""}
              </p>
              <p><strong>Contrato:</strong> {
                {IND:"Indefinido", FIJ:"Fijo", OBR:"Obra o labor", PRE:"Prestación de servicios"}[empSelected.tipo_contrato] || empSelected.tipo_contrato
              }</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo *</label>
              <select value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha retiro *</label>
              <input type="date" value={form.fecha_retiro} required
                onChange={e => setForm(f => ({ ...f, fecha_retiro: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {form.motivo === "DESPIDO_INJUSTA" && (
            <div className="bg-red-50 rounded-lg p-3 flex gap-2">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">Se calculará <strong>indemnización</strong> según Art. 64 CST.</p>
            </div>
          )}

          {needsFechaFin && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin del contrato fijo</label>
              <input type="date" value={form.fecha_fin_contrato}
                onChange={e => setForm(f => ({ ...f, fecha_fin_contrato: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Días de vacaciones ya disfrutados (último periodo)</label>
            <input type="number" value={form.dias_vacaciones_disfrutados} min="0" step="0.5"
              onChange={e => setForm(f => ({ ...f, dias_vacaciones_disfrutados: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-0.5">Si el empleado ya tomó vacaciones parciales, ingrese los días.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Observaciones..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-sm">Cancelar</button>
            <button type="submit" disabled={saving || (!isEdit && !form.empleado)}
              className={`flex-1 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
                isEdit ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
              }`}>
              {isEdit ? <RefreshCcw size={16} /> : <Calculator size={16} />}
              {saving ? "Procesando..." : isEdit ? "Recalcular" : "Calcular Liquidación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
