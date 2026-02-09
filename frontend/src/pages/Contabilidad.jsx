// frontend/src/pages/Contabilidad.jsx
import { useMemo, useState, useEffect } from "react";
import { BookOpen, Plus, Search, Calendar, FileText, DollarSign, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useCuentas, useCreateCuenta, useUpdateCuenta } from "../hooks/useCuentas";
import { useAsientos, useCreateAsiento, useAnularAsiento } from "../hooks/useAsientos";
import { useTerceros, useCreateTercero } from "../hooks/useTerceros";
import { exportBalancePrueba } from "../utils/exports";
import { toast } from "../ui/ToastHost";
import ImportarAsientosModal from '../components/ImportarAsientosModal';
import { FileSpreadsheet } from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';


// Modal simple reutilizable
function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`bg-white ${wide ? "w-[98vw] max-w-6xl" : "w-[95vw] max-w-4xl"} rounded-xl shadow-xl max-h-[90vh] flex flex-col`}>
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-gray-500" onClick={onClose}>×</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-4 py-3 border-t shrink-0">{footer}</div>}
      </div>
    </div>
  );
}


// helpers de fecha
function todayISO(){ const d=new Date(); return d.toISOString().slice(0,10); }
function monthBoundsISO(d=new Date()){ const f=new Date(d.getFullYear(),d.getMonth(),1);
  const l=new Date(d.getFullYear(),d.getMonth()+1,0); const fmt=x=>x.toISOString().slice(0,10);
  return {min:fmt(f), max:fmt(l)}; }

function parseYMD(ymd) {
  if (!ymd) return null;
  const [y,m,d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}
function firstDayOfMonth(ymd){
  const parts = parseYMD(ymd);
  if (!parts) return ymd;
  const { y, m } = parts;
  return new Date(y, m-1, 1).toISOString().slice(0,10);
}
function lastDayOfMonth(ymd){
  const parts = parseYMD(ymd);
  if (!parts) return ymd;
  const { y, m } = parts;
  return new Date(y, m, 0).toISOString().slice(0,10);
}

function naturalezaEsperada(codigo){ if(!codigo) return null; const s=String(codigo);
  if(s.startsWith("4")){ if(s.startsWith("4175")||s.startsWith("4195")) return null; return "C"; }
  if(s.startsWith("5")){ if(s.startsWith("5905")) return null; return "D"; }
  return null; }
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("es-CO") : "";
const fmtMoney = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:2}).format(n ?? 0);


export default function Contabilidad() {
  const { empresaId } = useEmpresa();

  // ---- filtros y paginación ----
  const [search, setSearch] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [gravYear, setGravYear] = useState(new Date().getFullYear());
  const years = useMemo(() => Array.from({length:6},(_,i)=> new Date().getFullYear()-i), []);
  const [page, setPage] = useState(1);

  // ---- errores por fila y form ----
  const [rowErrors, setRowErrors] = useState({});
  const [openForm, setOpenForm] = useState(false);
  const [serverError, setServerError] = useState(null);
  const emptyRow = { cuenta:"", tercero_id:"", debito:0, credito:0 };
  const [form, setForm] = useState({ fecha: todayISO(), concepto:"", tercero_id:"", descripcion_adicional:"" });
  const [movRows, setMovRows] = useState([{...emptyRow},{...emptyRow}]);

  const [openImportar, setOpenImportar] = useState(false);

  // ---- modales varios ----
  const [openDet, setOpenDet] = useState(null);
  const [openAnular, setOpenAnular] = useState(null);
  const [pins, setPins] = useState({ motivo:"", contador_pin:"", gerente_pin:"" });
  const [openTercero, setOpenTercero] = useState(false);
  const [nuevoTer, setNuevoTer] = useState({ tipo_documento:"CC", numero_documento:"", nombre_razon_social:"", direccion:"", telefono:"", email:"" });
  const [exportMsg, setExportMsg] = useState("");

  // ---- modal cuenta (crear/editar) ----
  const [openCuenta, setOpenCuenta] = useState(false);
  const [cuentaForm, setCuentaForm] = useState({ codigo:"", nombre:"", naturaleza:"D" });
  const [editingCuenta, setEditingCuenta] = useState(null); // null = crear, obj = editar

  // ---- sección PUC ----
  const [showPUC, setShowPUC] = useState(false);
  const [pucSearch, setPucSearch] = useState("");

  // ---- datos (React Query) ----
  const { data: cuentasAll = [], isLoading: lCuentas, isError: eCuentas, error: errCuentas } = useCuentas({ search });
  const cuentas = useMemo(() => empresaId ? cuentasAll.filter(c => c.empresa === empresaId || !c.empresa) : cuentasAll, [cuentasAll, empresaId]);
  const cuentaCodes = useMemo(()=> new Set(cuentas.map(c => String(c.codigo))) ,[cuentas]);
  const { data: asientosData = {}, isLoading: lAsientos, isError: eAsientos, error: errAsientos } =
    useAsientos({ fecha_inicio: fechaInicio || undefined, fecha_fin: fechaFin || undefined, page });

  const asientos = asientosData.items ?? asientosData ?? [];
  const total    = asientosData.count ?? (Array.isArray(asientosData) ? asientosData.length : 0);
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // mutaciones
  const create  = useCreateAsiento({ fecha_inicio: fechaInicio || undefined, fecha_fin: fechaFin || undefined });
  const anularM = useAnularAsiento({});
  const { data: terceros = [] } = useTerceros({});
  const createTer = useCreateTercero({});
  const createCta = useCreateCuenta({});
  const updateCta = useUpdateCuenta({});

  // ---- mensaje dinámico del periodo ----
  const textoPeriodo = useMemo(() => {
    const fechaSel = new Date(form.fecha || todayISO());
    const y = fechaSel.getFullYear();
    const today = new Date();
    const inJanMar = today.getFullYear() === y + 1 && today.getMonth() <= 2;
    return inJanMar
      ? `Periodo: ${y} — Ventana enero–marzo activa (requiere PINs).`
      : `Periodo: ${y} — Anulación según estado del periodo.`;
  }, [form.fecha]);

  // ====== HANDLERS ======
  const onChangeIni = (e) => { const v=e.target.value; setFechaInicio(v); if(!fechaFin && v) setFechaFin(lastDayOfMonth(v)); setPage(1); };
  const onChangeFin = (e) => { const v=e.target.value; setFechaFin(v);   if(!fechaInicio && v) setFechaInicio(firstDayOfMonth(v)); setPage(1); };
  const addRow = () => setMovRows((rows) => [...rows, { ...emptyRow }]);

  function setYearRange(y){ setGravYear(y); setFechaInicio(`${y}-01-01`); setFechaFin(`${y}-12-31`); setPage(1); }

  function openNewAsiento() {
    setServerError(null);
    setRowErrors({});
    setForm({ fecha: todayISO(), concepto: "", tercero_id: "", descripcion_adicional: "" });
    setMovRows([ { ...emptyRow }, { ...emptyRow } ]);
    setOpenForm(true);
  }

  useEffect(() => {
    if (!openForm) {
      setForm({ fecha: todayISO(), concepto: "", tercero_id: "", descripcion_adicional: "" });
      setMovRows([ { ...emptyRow }, { ...emptyRow } ]);
      setServerError(null);
      setRowErrors({});
    }
  }, [openForm]);

  const changeHdr = (k)=> (e)=> { setServerError(null); setForm(s=>({ ...s, [k]: e.target.value })); };
  const changeRow = (i,k)=> (e)=> {
    const v = e.target.value; setServerError(null);
    setMovRows(rows => rows.map((r,idx)=> idx===i ? { ...r, [k]: v } : r ));
    if(k==="cuenta"){
      setRowErrors(prev=>{
        const next = {...prev};
        if(!v) next[i] = { ...(next[i]||{}), code:"Ingrese un código de cuenta." };
        else if(!cuentaCodes.has(String(v))) next[i] = { ...(next[i]||{}), code:`La cuenta '${v}' no existe.` };
        else { if(next[i]){ const {code,...rest}=next[i]; next[i]=rest; if(!Object.keys(next[i]).length) delete next[i]; } }
        return next;
      });
    }
  };

  const matchCuentas = (q) => {
    const s = (q || "").toString().toLowerCase();
    return cuentas.filter(
      (c) => c.codigo?.toLowerCase().includes(s) || c.nombre?.toLowerCase().includes(s)
    );
  };

  const delRow = (i)=>{ setMovRows(rows=>{ if(rows.length<=2) return rows; return rows.filter((_r,idx)=> idx!==i); });
    setRowErrors(prev=>{ if(!prev[i]) return prev; const next={...prev}; delete next[i]; return next; }); };

  // totales + validación
  const totalDeb = useMemo(()=> movRows.reduce((s,r)=> s + (Number(r.debito)||0), 0), [movRows]);
  const totalCred= useMemo(()=> movRows.reduce((s,r)=> s + (Number(r.credito)||0), 0), [movRows]);
  const balanceOk = Math.abs(totalDeb - totalCred) < 1e-6;

  // payload por CÓDIGO — ahora con tercero por línea
  const buildPayloadByCuentaCodigo = () => ({
    fecha: form.fecha,
    concepto: form.concepto,
    tercero: form.tercero_id ? Number(form.tercero_id) : null,
    descripcion_adicional: form.descripcion_adicional || "",
    movimientos: movRows.map((r) => ({
      cuenta_codigo: r.cuenta,
      tercero: r.tercero_id ? Number(r.tercero_id) : null,
      debito: Number(r.debito) || 0,
      credito: Number(r.credito) || 0,
    })),
  });

  const onSubmitAsiento = (e) => {
    e.preventDefault();
    if (!balanceOk) {
      alert("El asiento no cuadra: Débitos y Créditos deben ser iguales.");
      return;
    }
    if (Object.keys(rowErrors).length > 0) {
      const firstIdx = Math.min(...Object.keys(rowErrors).map(Number));
      const el = document.querySelector(`input[list="cuentas-sug-${firstIdx}"]`);
      if (el) el.focus();
      return;
    }
    const payload = buildPayloadByCuentaCodigo();
    create.mutate(payload, {
      onSuccess: () => { setOpenForm(false); setServerError(null); },
      onError: (err) => setServerError(parseApiError(err)),
    });
  };

  function parseApiError(err) {
    const data = err?.response?.data;
    if (!data) return "Error desconocido.";
    const lines = [];
    const walk = (prefix, val) => {
      if (Array.isArray(val)) {
        val.forEach(v => walk(prefix, v));
      } else if (val && typeof val === "object") {
        Object.entries(val).forEach(([k, v]) => {
          walk(prefix ? `${prefix}.${k}` : k, v);
        });
      } else {
        lines.push(`${prefix}: ${String(val)}`);
      }
    };
    walk("", data);
    return lines.join("\n");
  }

  // ---- Cuenta handlers ----
  function openNewCuenta() {
    setEditingCuenta(null);
    setCuentaForm({ codigo: "", nombre: "", naturaleza: "D" });
    setOpenCuenta(true);
  }

  function openEditCuenta(c) {
    setEditingCuenta(c);
    setCuentaForm({ codigo: c.codigo, nombre: c.nombre, naturaleza: c.naturaleza || "D" });
    setOpenCuenta(true);
  }

  function onSubmitCuenta(e) {
    e.preventDefault();
    if (editingCuenta) {
      updateCta.mutate(
        { id: editingCuenta.id, nombre: cuentaForm.nombre, naturaleza: cuentaForm.naturaleza },
        {
          onSuccess: () => { setOpenCuenta(false); toast("Cuenta actualizada"); },
          onError: (err) => toast(parseApiError(err), "error"),
        }
      );
    } else {
      createCta.mutate(
        { codigo: cuentaForm.codigo, nombre: cuentaForm.nombre, naturaleza: cuentaForm.naturaleza, empresa: empresaId },
        {
          onSuccess: () => { setOpenCuenta(false); toast("Cuenta creada"); },
          onError: (err) => toast(parseApiError(err), "error"),
        }
      );
    }
  }

  // PUC filtradas
  const pucFiltered = useMemo(() => {
    if (!pucSearch) return cuentas.slice(0, 100);
    const s = pucSearch.toLowerCase();
    return cuentas.filter(c =>
      c.codigo?.toLowerCase().includes(s) || c.nombre?.toLowerCase().includes(s)
    ).slice(0, 100);
  }, [cuentas, pucSearch]);

  // loading / error global
  if (lCuentas || lAsientos) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando datos contables...</p>
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
            <button
              onClick={() => setOpenImportar(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importar Excel
            </button>
            <button
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              onClick={openNewAsiento}
            >
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Asiento
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
        <label className="block text-sm mb-2">Año gravable</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={gravYear}
          onChange={(e)=> setYearRange(Number(e.target.value))}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <label className="block text-sm mb-2">Buscar cuentas</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder="Código o nombre…"
              className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">{cuentas.length} cuentas</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 lg:col-span-2">
          <label className="block text-sm mb-2">Rango de fechas (asientos)</label>
          <div className="flex gap-3">
            <input type="date" value={fechaInicio} onChange={onChangeIni} className="border rounded px-3 py-2" />
            <input type="date" value={fechaFin} onChange={onChangeFin} className="border rounded px-3 py-2" />
          </div>
          <p className="text-xs text-gray-500 mt-2">{total} asientos</p>
        </div>
      </div>

      <button
        onClick={async () => {
          if (!fechaInicio && !fechaFin) return toast("Selecciona rango de fechas", "error");
          try {
            await exportBalancePrueba({ inicio: fechaInicio, fin: fechaFin });
            toast("Export listo");
          } catch (e) {
            toast("No se pudo exportar", "error");
            console.error(e);
          }
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
                <button
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  onClick={openNewAsiento}
                >
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tercero</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {asientos.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{a.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {fmtDate(a.fecha)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{a.concepto}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {a.tercero_nombre || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900 mr-3" onClick={()=>setOpenDet(a)}>Ver detalle</button>
                        <button className="text-red-600 hover:text-red-900" onClick={()=>setOpenAnular(a)}>Anular</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    disabled={page<=1}
                    onClick={()=> setPage(p => Math.max(1, p-1))}
                  >Anterior</button>
                  <span className="text-sm">Página {page} de {totalPages}</span>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    disabled={page>=totalPages}
                    onClick={()=> setPage(p => Math.min(totalPages, p+1))}
                  >Siguiente</button>
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
              <p className="text-2xl font-bold text-green-600">
                {todosCuadran ? "Cuadrado" : "—"}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* ====== SECCIÓN: Plan de Cuentas (PUC) ====== */}
      <div className="mt-6 bg-white shadow-sm rounded-lg border border-gray-200">
        <button
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
          onClick={() => setShowPUC(!showPUC)}
        >
          <span className="font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Plan de Cuentas (PUC)
          </span>
          {showPUC ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {showPUC && (
          <div className="px-4 pb-4">
            <div className="flex gap-3 items-center mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={pucSearch}
                  onChange={(e) => setPucSearch(e.target.value)}
                  placeholder="Buscar por código o nombre…"
                  className="pl-10 pr-4 py-2 border rounded-lg w-full text-sm"
                />
              </div>
              <button
                onClick={openNewCuenta}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                <Plus className="h-4 w-4" />
                Nueva Cuenta
              </button>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Nat.</th>
                    <th className="px-3 py-2 text-center w-20">Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {pucFiltered.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono">{c.codigo}</td>
                      <td className="px-3 py-1.5">{c.nombre}</td>
                      <td className="px-3 py-1.5 text-gray-500">{c.tipo}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${c.naturaleza === "D" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {c.naturaleza === "D" ? "Débito" : "Crédito"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          onClick={() => openEditCuenta(c)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Editar cuenta"
                        >
                          <Pencil className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pucFiltered.length >= 100 && (
                <p className="text-xs text-gray-500 mt-2 px-3">Mostrando primeras 100 cuentas. Use el buscador para filtrar.</p>
              )}
            </div>
          </div>
        )}
      </div>


      {/* ====== MODAL: Nuevo Asiento ====== */}
      <Modal open={openForm} onClose={() => setOpenForm(false)} title="Nuevo asiento contable" footer={null} wide>
        <form onSubmit={onSubmitAsiento} className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Fecha */}
            <div>
              <label className="block text-sm mb-1">Fecha</label>
              {(() => {
                const { min, max } = monthBoundsISO();
                return (
                  <input
                    type="date"
                    className="border rounded px-3 py-2 w-full"
                    value={form.fecha}
                    min={min} max={max}
                    onChange={changeHdr("fecha")}
                    required
                  />
                );
              })()}
            </div>

            {/* Tercero principal */}
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Tercero principal</label>
              <div className="flex gap-2">
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={form.tercero_id || ""}
                  onChange={changeHdr("tercero_id")}
                  required
                >
                  <option value="">Seleccione…</option>
                  {terceros.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.numero_documento} — {t.nombre}
                    </option>
                  ))}
                </select>
                <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpenTercero(true)}>+</button>
              </div>
            </div>

            {/* Concepto */}
            <div className="md:col-span-3">
              <label className="block text-sm mb-1">Concepto</label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={form.concepto}
                onChange={changeHdr("concepto")}
                placeholder="Ej: Venta contado"
                required
              />
            </div>
          </div>

          {/* Descripción adicional */}
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Descripción adicional (opcional)</label>
            <textarea
              className="border rounded px-3 py-2 w-full"
              rows={2}
              value={form.descripcion_adicional || ""}
              onChange={changeHdr("descripcion_adicional")}
              placeholder="Notas, referencias, glosa..."
            />
          </div>

          {/* Movimientos — ahora con tercero por línea */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Cuenta (código)</th>
                  <th className="p-2">Tercero (línea)</th>
                  <th className="p-2">Débito</th>
                  <th className="p-2">Crédito</th>
                  <th className="p-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {movRows.map((r, i) => {
                  const sugeridas = r.cuenta ? matchCuentas(r.cuenta).slice(0, 5) : [];
                  const nat = naturalezaEsperada(r.cuenta);
                  const debVal = Number(r.debito) || 0;
                  const creVal = Number(r.credito) || 0;
                  const codigoValido = cuentaCodes.has(String(r.cuenta));
                  const mostrarAviso = codigoValido && ((nat === "C" && debVal > 0) || (nat === "D" && creVal > 0));

                  return (
                    <tr key={i} className="border-t">
                      {/* Cuenta */}
                      <td className="p-2 align-top">
                        <div className="flex gap-1">
                          <input
                            className={`border rounded px-3 py-2 w-full ${rowErrors[i]?.code ? "border-red-400 focus:ring-red-300" : ""}`}
                            placeholder="110505, 1305…"
                            value={r.cuenta}
                            onChange={changeRow(i, "cuenta")}
                            list={`cuentas-sug-${i}`}
                            required
                          />
                          <button
                            type="button"
                            className="px-2 py-1 rounded border text-xs text-indigo-600 hover:bg-indigo-50 shrink-0"
                            onClick={openNewCuenta}
                            title="Crear nueva cuenta"
                          >+</button>
                        </div>
                        {rowErrors[i]?.code && (
                          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1">
                            {rowErrors[i].code}
                          </div>
                        )}
                        {mostrarAviso && (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1 inline-block">
                            {nat === "C"
                              ? "Cuenta de INGRESO (4): usualmente va en CRÉDITO."
                              : "Cuenta de GASTO (5): usualmente va en DÉBITO."
                            } (no bloquea)
                          </div>
                        )}
                        <datalist id={`cuentas-sug-${i}`}>
                          {sugeridas.map((c) => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} — {c.nombre}
                            </option>
                          ))}
                        </datalist>
                      </td>

                      {/* Tercero por línea */}
                      <td className="p-2 align-top">
                        <select
                          className="border rounded px-2 py-2 w-full text-xs"
                          value={r.tercero_id || ""}
                          onChange={changeRow(i, "tercero_id")}
                        >
                          <option value="">— del asiento —</option>
                          {terceros.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.numero_documento} — {t.nombre}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Débito */}
                      <td className="p-2">
                        <input
                          type="number" min="0" step="0.01"
                          className="border rounded px-3 py-2 w-full"
                          value={r.debito}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMovRows(rows => rows.map((x, idx) =>
                              idx === i ? { ...x, debito: v, credito: v && Number(v) > 0 ? 0 : x.credito } : x
                            ));
                          }}
                          disabled={Number(r.credito) > 0}
                        />
                      </td>

                      {/* Crédito */}
                      <td className="p-2">
                        <input
                          type="number" min="0" step="0.01"
                          className="border rounded px-3 py-2 w-full"
                          value={r.credito}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMovRows(rows => rows.map((x, idx) =>
                              idx === i ? { ...x, credito: v, debito: v && Number(v) > 0 ? 0 : x.debito } : x
                            ));
                          }}
                          disabled={Number(r.debito) > 0}
                        />
                      </td>

                      {/* Eliminar */}
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          className={`px-2 py-1 rounded border ${movRows.length <= 2 ? "opacity-50 cursor-not-allowed" : ""}`}
                          onClick={() => delRow(i)}
                          disabled={movRows.length <= 2}
                          title={movRows.length <= 2 ? "Mínimo 2 filas para la doble partida" : "Eliminar fila"}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={5}>
                  <p className="w-full mt-2 text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-3 py-2">
                    Cada línea puede tener su propio tercero. Si se deja vacío, hereda el tercero principal del asiento.
                  </p>
                </td></tr>

                <tr className="border-t bg-gray-50">
                  <td className="p-2">
                    <button type="button" onClick={addRow} className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">
                      Agregar fila
                    </button>
                  </td>
                  <td className="p-2"></td>
                  <td className="p-2 font-medium">{fmtMoney(totalDeb)}</td>
                  <td className="p-2 font-medium">{fmtMoney(totalCred)}</td>
                  <td className="p-2 text-right">
                    <span className={`text-xs ${balanceOk ? "text-green-700" : "text-red-700"}`}>
                      {balanceOk ? "Cuadra" : "No cuadra"}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* errores del backend */}
          {serverError && (
            <div className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 whitespace-pre-line">
              {serverError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpenForm(false)}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!balanceOk || create.isPending}
              className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {create.isPending ? "Creando…" : "Crear asiento"}
            </button>
          </div>

          {/* RÓTULO DEL PERIODO */}
          <div className="col-span-full w-full">
            <p className="mt-2 text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-3 py-2">
              {textoPeriodo}
            </p>
          </div>
        </form>
      </Modal>

      {/* ====== MODAL: Crear tercero rápido ====== */}
      <Modal open={openTercero} onClose={() => setOpenTercero(false)} title="Nuevo tercero" footer={null}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTer.mutate(nuevoTer, {
              onSuccess: (t) => {
                setForm(s => ({ ...s, tercero_id: t.id }));
                setOpenTercero(false);
                setNuevoTer({ tipo_documento:"CC", numero_documento:"", nombre_razon_social:"", direccion:"", telefono:"", email:"" });
              },
            });
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-sm mb-1">Tipo documento</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={nuevoTer.tipo_documento}
              onChange={(e)=>setNuevoTer(s=>({...s, tipo_documento:e.target.value}))}
            >
              <option>CC</option><option>NIT</option><option>CE</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Número documento</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={nuevoTer.numero_documento}
              onChange={(e)=>setNuevoTer(s=>({...s, numero_documento:e.target.value}))}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Nombre / Razón social</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={nuevoTer.nombre_razon_social}
              onChange={(e)=>setNuevoTer(s=>({...s, nombre_razon_social:e.target.value}))}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Dirección</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={nuevoTer.direccion}
              onChange={(e)=>setNuevoTer(s=>({...s, direccion:e.target.value}))}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Teléfono</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={nuevoTer.telefono}
              onChange={(e)=>setNuevoTer(s=>({...s, telefono:e.target.value}))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="border rounded px-3 py-2 w-full"
              value={nuevoTer.email}
              onChange={(e)=>setNuevoTer(s=>({...s, email:e.target.value}))}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" className="px-3 py-2 rounded border" onClick={()=>setOpenTercero(false)}>Cancelar</button>
            <button type="submit" className="px-3 py-2 rounded bg-indigo-600 text-white">Crear</button>
          </div>
        </form>
      </Modal>

      {/* ====== MODAL: Crear/Editar cuenta ====== */}
      <Modal
        open={openCuenta}
        onClose={() => setOpenCuenta(false)}
        title={editingCuenta ? `Editar cuenta: ${editingCuenta.codigo}` : "Nueva cuenta contable"}
        footer={null}
      >
        <form onSubmit={onSubmitCuenta} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Código</label>
            <input
              className="border rounded px-3 py-2 w-full font-mono"
              value={cuentaForm.codigo}
              onChange={(e) => setCuentaForm(s => ({ ...s, codigo: e.target.value }))}
              disabled={!!editingCuenta}
              placeholder="Ej: 11050501"
              required
            />
            {!editingCuenta && (
              <p className="text-xs text-gray-500 mt-1">
                La naturaleza, tipo y padre se determinan automáticamente por el código.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1">Naturaleza</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={cuentaForm.naturaleza}
              onChange={(e) => setCuentaForm(s => ({ ...s, naturaleza: e.target.value }))}
            >
              <option value="D">Débito</option>
              <option value="C">Crédito</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Nombre</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={cuentaForm.nombre}
              onChange={(e) => setCuentaForm(s => ({ ...s, nombre: e.target.value }))}
              placeholder="Ej: Caja menor oficina Medellín"
              required
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpenCuenta(false)}>Cancelar</button>
            <button
              type="submit"
              className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
              disabled={createCta.isPending || updateCta.isPending}
            >
              {editingCuenta ? "Guardar cambios" : "Crear cuenta"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ====== MODAL: Ver detalle (con tercero por línea) ====== */}
      <Modal open={!!openDet} onClose={()=>setOpenDet(null)} title={`Asiento #${openDet?.id}`} footer={null}>
        {openDet ? (
          <div className="overflow-x-auto">
            <div className="mb-3 text-sm">
              <span className="text-gray-500">Tercero principal:</span>{" "}
              <span className="font-medium">{openDet.tercero_nombre || "N/A"}</span>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">Cuenta</th>
                  <th className="p-2 text-left">Tercero (línea)</th>
                  <th className="p-2 text-right">Débito</th>
                  <th className="p-2 text-right">Crédito</th>
                </tr>
              </thead>
              <tbody>
                {openDet.movimientos?.map((m,i)=>(
                  <tr key={i} className="border-t">
                    <td className="p-2">{m.cuenta?.codigo ?? m.cuenta} — {m.cuenta?.nombre ?? ""}</td>
                    <td className="p-2 text-gray-500 text-xs">
                      {m.tercero_nombre || <span className="italic text-gray-400">— hereda —</span>}
                    </td>
                    <td className="p-2 text-right">{fmtMoney(m.debito)}</td>
                    <td className="p-2 text-right">{fmtMoney(m.credito)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>

      {/* ====== MODAL: Anular ====== */}
      <Modal
        open={!!openAnular}
        onClose={()=>setOpenAnular(null)}
        title={`Anular asiento #${openAnular?.id}`}
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 rounded border" onClick={()=>setOpenAnular(null)}>Cancelar</button>
            <button
              className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-60"
              disabled={anularM.isPending}
              onClick={()=>{
                anularM.mutate(
                  { id: openAnular.id, ...pins },
                  { onSuccess: ()=>{ setOpenAnular(null); setPins({ motivo:"", contador_pin:"", gerente_pin:"" }); } }
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
              value={pins.motivo} onChange={(e)=>setPins(s=>({...s, motivo:e.target.value}))}/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">PIN Contador (enero–marzo)</label>
              <input className="border rounded px-3 py-2 w-full"
                value={pins.contador_pin} onChange={(e)=>setPins(s=>({...s, contador_pin:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-sm mb-1">PIN Gerente (enero–marzo)</label>
              <input className="border rounded px-3 py-2 w-full"
                value={pins.gerente_pin} onChange={(e)=>setPins(s=>({...s, gerente_pin:e.target.value}))}/>
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

      <ImportarAsientosModal
        isOpen={openImportar}
        onClose={() => setOpenImportar(false)}
        onSuccess={() => {
          window.location.reload();
        }}
      />

    </div>
  );
}
