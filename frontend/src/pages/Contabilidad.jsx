// 🎩 Don Peppini - Contabilidad (orquestador)
import { useMemo, useState } from "react";
import { BookOpen, Plus, Search, Calendar, FileText, DollarSign } from "lucide-react";
import { FileSpreadsheet } from "lucide-react";
import { useCuentas } from "../hooks/useCuentas";
import { useAsientos, useCreateAsiento, useAnularAsiento } from "../hooks/useAsientos";
import { useTerceros } from "../hooks/useTerceros";
import { exportBalancePrueba } from "../utils/exports";
import { toast } from "../ui/ToastHost";
import { useEmpresa } from "../context/EmpresaContext";
import ImportarAsientosModal from "../components/ImportarAsientosModal";

// Componentes extraídos
import Modal from "../components/Modal";
import AsientoFormModal from "../components/AsientoFormModal";
import AsientoDetailModal from "../components/AsientoDetailModal";
import CuentaFormModal from "../components/CuentaFormModal";
import PUCSection from "../components/PUCSection";

// Utilidades compartidas
import {
  todayISO, firstDayOfMonth, lastDayOfMonth,
  fmtDate, fmtMoney, TIPOS_COMPROBANTE
} from "../utils/contabilidad";

export default function Contabilidad() {
  const { empresaId } = useEmpresa();

  // ---- Filtros ----
  const [search, setSearch] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [gravYear, setGravYear] = useState(new Date().getFullYear());
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i), []);
  const [page, setPage] = useState(1);

  // ---- Modal states ----
  const [openForm, setOpenForm] = useState(false);
  const [formInit, setFormInit] = useState(null);   // { form, rows } para nuevo/duplicar
  const [openDet, setOpenDet] = useState(null);
  const [openAnular, setOpenAnular] = useState(null);
  const [openCorregir, setOpenCorregir] = useState(null);
  const [pins, setPins] = useState({ motivo: "", contador_pin: "", gerente_pin: "" });
  const [openImportar, setOpenImportar] = useState(false);
  const [openCuenta, setOpenCuenta] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState(null);

  // ---- Data queries ----
  const { data: cuentas = [], isLoading: lCuentas, isError: eCuentas, error: errCuentas } = useCuentas({ search, empresa: empresaId });
  const cuentaCodes = useMemo(() => new Set(cuentas.map(c => String(c.codigo))), [cuentas]);
  const { data: asientosData = {}, isLoading: lAsientos, isError: eAsientos, error: errAsientos } =
    useAsientos({ empresa: empresaId, fecha_inicio: fechaInicio, fecha_fin: fechaFin, tipo_comprobante: tipoFilter, page, page_size: 20 });
  const asientos = asientosData.items ?? asientosData ?? [];
  const total = asientosData.count ?? (Array.isArray(asientosData) ? asientosData.length : 0);
  const totalPages = Math.ceil(total / 20);
  const create = useCreateAsiento({});
  const anularM = useAnularAsiento({});
  const { data: terceros = [] } = useTerceros({});

  // ---- Handlers: filtros ----
  const onChangeIni = (e) => { const v = e.target.value; setFechaInicio(v); if (!fechaFin && v) setFechaFin(lastDayOfMonth(v)); setPage(1); };
  const onChangeFin = (e) => { const v = e.target.value; setFechaFin(v); if (!fechaInicio && v) setFechaInicio(firstDayOfMonth(v)); setPage(1); };
  function setYearRange(y) { setGravYear(y); setFechaInicio(`${y}-01-01`); setFechaFin(`${y}-12-31`); setPage(1); }

  // ---- Handlers: asientos ----
  function openNewAsiento() {
    setFormInit(null);
    setOpenForm(true);
  }

  function duplicateAsiento(a) {
    const rows = (a.movimientos || []).map(m => ({
      cuenta: m.cuenta_codigo_display ?? m.cuenta?.codigo ?? String(m.cuenta ?? ""),
      tercero_id: m.tercero ? String(m.tercero) : "",
      debito: Number(m.debito) || 0,
      credito: Number(m.credito) || 0,
    }));
    setFormInit({
      form: {
        fecha: todayISO(),
        tipo_comprobante: a.tipo_comprobante || "OT",
        concepto: a.concepto || "",
        tercero_id: a.tercero ? String(a.tercero) : "",
        descripcion_adicional: a.descripcion_adicional || "",
        es_ajuste: false,
      },
      rows: rows.length >= 2 ? rows : [...rows, { cuenta: "", tercero_id: "", debito: 0, credito: 0 }, { cuenta: "", tercero_id: "", debito: 0, credito: 0 }].slice(0, Math.max(2, rows.length)),
    });
    setOpenForm(true);
  }

  function canCorregir(a) {
    if (a.estado === "anulado") return false;
    const hoy = new Date();
    const fechaAsiento = new Date(a.fecha + "T12:00:00");
    return hoy.getFullYear() === fechaAsiento.getFullYear() && hoy.getMonth() === fechaAsiento.getMonth();
  }

  function onCorregirConfirm() {
    const a = openCorregir;
    if (!a) return;
    anularM.mutate(
      { id: a.id, motivo: `Corrección rápida → se creará asiento corregido` },
      { onSuccess: () => { setOpenCorregir(null); duplicateAsiento(a); } }
    );
  }

  // ---- Cuenta handlers ----
  function openNewCuenta() { setEditingCuenta(null); setOpenCuenta(true); }
  function openEditCuenta(c) { setEditingCuenta(c); setOpenCuenta(true); }

  // ---- Loading / Error ----
  if (lCuentas || lAsientos) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando datos contables…</p>
        </div>
      </div>
    );
  }
  if (eCuentas || eAsientos) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {errCuentas?.message || errAsientos?.message || "Error al cargar datos contables."}
        </div>
      </div>
    );
  }

  const todosCuadran = asientos.every((a) => {
    const d = a.movimientos?.reduce((s, m) => s + (Number(m.debito) || 0), 0) ?? 0;
    const c = a.movimientos?.reduce((s, m) => s + (Number(m.credito) || 0), 0) ?? 0;
    return Math.abs(d - c) < 1e-6;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-gray-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Contabilidad</h1>
              <p className="mt-1 text-gray-600">Gestión de asientos contables y plan de cuentas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOpenImportar(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <FileSpreadsheet className="h-4 w-4" />
              Importar Excel
            </button>
            <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              onClick={openNewAsiento}>
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Asiento
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
        <label className="block text-sm mb-2">Año gravable</label>
        <select className="border rounded px-3 py-2 w-full" value={gravYear}
          onChange={(e) => setYearRange(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <label className="block text-sm mb-2">Buscar cuentas</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} type="text"
              placeholder="Código o nombre…"
              className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <p className="text-xs text-gray-500 mt-2">{cuentas.length} cuentas</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 lg:col-span-2">
          <label className="block text-sm mb-2">Rango de fechas (asientos)</label>
          <div className="flex gap-3 flex-wrap">
            <input type="date" value={fechaInicio} onChange={onChangeIni} className="border rounded px-3 py-2" />
            <input type="date" value={fechaFin} onChange={onChangeFin} className="border rounded px-3 py-2" />
            <select value={tipoFilter} onChange={e => { setTipoFilter(e.target.value); setPage(1); }}
              className="border rounded px-3 py-2">
              <option value="">Todos los tipos</option>
              {TIPOS_COMPROBANTE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500 mt-2">{total} asientos</p>
        </div>
      </div>

      <button
        onClick={async () => {
          if (!fechaInicio && !fechaFin) return toast("Selecciona rango de fechas", "error");
          try { await exportBalancePrueba({ inicio: fechaInicio, fin: fechaFin, empresa: empresaId }); toast("Export listo"); }
          catch { toast("No se pudo exportar", "error"); }
        }}
        className="inline-flex items-center px-2 py-1 rounded border-0 bg-[#fbcfe8] text-[#3b0764] hover:bg-[#e5bdfb] mb-4"
      >
        Exportar Balance Prueba
      </button>

      {/* Lista de Asientos */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:p-6">
          {asientos.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay asientos contables</h3>
              <p className="mt-1 text-sm text-gray-500">Comienza creando tu primer asiento contable.</p>
              <div className="mt-6">
                <button className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  onClick={openNewAsiento}>
                  <Plus className="h-5 w-5 mr-2" />
                  Crear Asiento
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comprobante</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tercero</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {asientos.map((a) => (
                    <tr key={a.id} className={`hover:bg-gray-50 ${a.estado === "anulado" ? "opacity-50" : ""}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <span className="font-mono">{a.tipo_comprobante || "OT"}-{String(a.numero || a.id).padStart(4, '0')}</span>
                        {a.estado === "anulado" && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">Anulado</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {fmtDate(a.fecha)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{a.concepto}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.tercero_nombre || "N/A"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900 mr-3" onClick={() => setOpenDet(a)}>Ver detalle</button>
                        <button className="text-emerald-600 hover:text-emerald-900 mr-3" onClick={() => duplicateAsiento(a)}>Duplicar</button>
                        {canCorregir(a) && (
                          <button className="text-amber-600 hover:text-amber-900 mr-3" onClick={() => setOpenCorregir(a)}>Corregir</button>
                        )}
                        {a.estado !== "anulado" && (
                          <button className="text-red-600 hover:text-red-900" onClick={() => setOpenAnular(a)}>Anular</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
                  <span className="text-sm">Página {page} de {totalPages}</span>
                  <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Asientos</p>
              <p className="text-2xl font-bold text-gray-900">{asientos.length}</p>
            </div>
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cuentas Activas</p>
              <p className="text-2xl font-bold text-gray-900">{cuentas.length}</p>
            </div>
            <BookOpen className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Balance</p>
              <p className="text-2xl font-bold text-green-600">{todosCuadran ? "Cuadrado" : "—"}</p>
            </div>
            <DollarSign className="h-8 w-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Plan de Cuentas */}
      <PUCSection cuentas={cuentas} onNewCuenta={openNewCuenta} onEditCuenta={openEditCuenta} />

      {/* ====== MODALES ====== */}

      {/* Nuevo / Duplicar Asiento */}
      <AsientoFormModal
        open={openForm}
        onClose={() => setOpenForm(false)}
        empresaId={empresaId}
        cuentas={cuentas}
        cuentaCodes={cuentaCodes}
        terceros={terceros}
        initialForm={formInit?.form}
        initialRows={formInit?.rows}
        onCreate={(payload, opts) => create.mutate(payload, { ...opts, onSuccess: () => { setOpenForm(false); opts?.onSuccess?.(); } })}
        isPending={create.isPending}
      />

      {/* Detalle */}
      <AsientoDetailModal
        asiento={openDet}
        onClose={() => setOpenDet(null)}
        empresaId={empresaId}
        onDuplicate={duplicateAsiento}
        onCorregir={(a) => setOpenCorregir(a)}
        canCorregir={openDet ? canCorregir(openDet) : false}
      />

      {/* Anular */}
      <Modal
        open={!!openAnular}
        onClose={() => setOpenAnular(null)}
        title={`Anular ${openAnular?.tipo_comprobante || "OT"}-${String(openAnular?.numero || openAnular?.id).padStart(4, '0')}`}
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 rounded border" onClick={() => setOpenAnular(null)}>Cancelar</button>
            <button
              className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-60"
              disabled={anularM.isPending}
              onClick={() => {
                anularM.mutate(
                  { id: openAnular.id, ...pins },
                  { onSuccess: () => { setOpenAnular(null); setPins({ motivo: "", contador_pin: "", gerente_pin: "" }); } }
                );
              }}>
              {anularM.isPending ? "Anulando…" : "Confirmar"}
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <label className="block text-sm mb-1">Motivo</label>
            <textarea className="border rounded px-3 py-2 w-full"
              value={pins.motivo} onChange={(e) => setPins(s => ({ ...s, motivo: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">PIN Contador (enero–marzo)</label>
              <input className="border rounded px-3 py-2 w-full"
                value={pins.contador_pin} onChange={(e) => setPins(s => ({ ...s, contador_pin: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm mb-1">PIN Gerente (enero–marzo)</label>
              <input className="border rounded px-3 py-2 w-full"
                value={pins.gerente_pin} onChange={(e) => setPins(s => ({ ...s, gerente_pin: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Reglas: hasta 31/12 del mismo año anula sin PIN; 01/01–31/03 siguiente requiere ambos PIN; después de 31/03 prohibido.
          </p>
          {anularM.isError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {anularM.error?.response?.data?.detail || "No se pudo anular"}
            </div>
          )}
        </div>
      </Modal>

      {/* Corrección Rápida */}
      <Modal
        open={!!openCorregir}
        onClose={() => setOpenCorregir(null)}
        title={`Corregir ${openCorregir?.tipo_comprobante || "OT"}-${String(openCorregir?.numero || openCorregir?.id).padStart(4, '0')}`}
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 rounded border" onClick={() => setOpenCorregir(null)}>Cancelar</button>
            <button className="px-3 py-2 rounded bg-amber-600 text-white disabled:opacity-60"
              disabled={anularM.isPending} onClick={onCorregirConfirm}>
              {anularM.isPending ? "Procesando…" : "Anular y corregir"}
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
            <p className="font-medium text-amber-800 mb-1">¿Cómo funciona?</p>
            <p className="text-amber-700">
              Se anulará el comprobante {openCorregir?.tipo_comprobante || "OT"}-{String(openCorregir?.numero || openCorregir?.id).padStart(4, '0')} y se abrirá un formulario
              con los mismos datos para que hagás las correcciones necesarias.
              La pista de auditoría queda intacta.
            </p>
          </div>
          <div className="text-sm text-gray-600">
            <p><strong>Concepto:</strong> {openCorregir?.concepto}</p>
            <p><strong>Tercero:</strong> {openCorregir?.tercero_nombre}</p>
            <p><strong>Movimientos:</strong> {openCorregir?.movimientos?.length || 0} líneas</p>
          </div>
          {anularM.isError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {anularM.error?.response?.data?.detail || "No se pudo corregir"}
            </div>
          )}
        </div>
      </Modal>

      {/* Crear/Editar Cuenta */}
      <CuentaFormModal
        open={openCuenta}
        onClose={() => setOpenCuenta(false)}
        empresaId={empresaId}
        editingCuenta={editingCuenta}
      />

      {/* Importar Excel */}
      <ImportarAsientosModal
        isOpen={openImportar}
        onClose={() => setOpenImportar(false)}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
}
