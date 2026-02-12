// 🎩 Don Peppini Contadore - Terceros (mejorado con ubicación)
import { useMemo, useState, useEffect } from "react";
import { Users, Plus, Search, Edit2, Trash2, MapPin, X } from "lucide-react";
import {
  useTerceros,
  useCreateTercero,
  useUpdateTercero,
  useDeleteTercero,
} from "../hooks/useTerceros";
import { calcularDV } from "../utils/calcularDV";
// Modal reutilizable
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-[95vw] max-w-2xl rounded-xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button className="p-1 hover:bg-gray-100 rounded text-gray-400" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-3 border-t bg-gray-50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

const TIPOS_DOC = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PA", label: "Pasaporte" },
  { value: "TI", label: "Tarjeta de Identidad" },
  { value: "RC", label: "Registro Civil" },
  { value: "DIE", label: "Doc. Identificación Extranjero" },
];

const TIPOS_TERCERO = [
  { value: "CLI", label: "Cliente" },
  { value: "PRO", label: "Proveedor" },
  { value: "EMP", label: "Empleado" },
  { value: "SOC", label: "Socio/Accionista" },
  { value: "OTR", label: "Otro" },
];

// Departamentos principales de Colombia (código DANE)
const DEPARTAMENTOS = [
  { cod: "05", nombre: "Antioquia" },
  { cod: "08", nombre: "Atlántico" },
  { cod: "11", nombre: "Bogotá D.C." },
  { cod: "13", nombre: "Bolívar" },
  { cod: "15", nombre: "Boyacá" },
  { cod: "17", nombre: "Caldas" },
  { cod: "18", nombre: "Caquetá" },
  { cod: "19", nombre: "Cauca" },
  { cod: "20", nombre: "Cesar" },
  { cod: "23", nombre: "Córdoba" },
  { cod: "25", nombre: "Cundinamarca" },
  { cod: "27", nombre: "Chocó" },
  { cod: "41", nombre: "Huila" },
  { cod: "44", nombre: "La Guajira" },
  { cod: "47", nombre: "Magdalena" },
  { cod: "50", nombre: "Meta" },
  { cod: "52", nombre: "Nariño" },
  { cod: "54", nombre: "Norte de Santander" },
  { cod: "63", nombre: "Quindío" },
  { cod: "66", nombre: "Risaralda" },
  { cod: "68", nombre: "Santander" },
  { cod: "70", nombre: "Sucre" },
  { cod: "73", nombre: "Tolima" },
  { cod: "76", nombre: "Valle del Cauca" },
];

const emptyForm = {
  tipo_documento: "CC",
  numero_documento: "",
  digito_verificacion: "",
  nombre_razon_social: "",
  primer_nombre: "",
  otros_nombres: "",
  primer_apellido: "",
  segundo_apellido: "",
  tipo_tercero: "OTR",
  direccion: "",
  telefono: "",
  email: "",
  ciudad: "Medellín",
  departamento: "Antioquia",
  codigo_departamento: "05",
  codigo_municipio: "001",
  codigo_pais: "169",
  es_autoretenedor: false,
  es_gran_contribuyente: false,
  es_declarante: true,
};

export default function Terceros() {
  const [search, setSearch] = useState("");
  const { data: terceros = [], isLoading, isError, error } = useTerceros({ search });
  const createM = useCreateTercero({ search });
  const updateM = useUpdateTercero({ search });
  const deleteM = useDeleteTercero({ search });

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    if (editing) {
      const num = editing.numero_documento ?? "";
      setForm({
        tipo_documento: editing.tipo_documento ?? "CC",
        numero_documento: num,
        digito_verificacion: num ? calcularDV(num) : (editing.digito_verificacion ?? ""),
        nombre_razon_social: editing.nombre_razon_social ?? "",
        primer_nombre: editing.primer_nombre ?? "",
        otros_nombres: editing.otros_nombres ?? "",
        primer_apellido: editing.primer_apellido ?? "",
        segundo_apellido: editing.segundo_apellido ?? "",
        tipo_tercero: editing.tipo_tercero ?? "OTR",
        direccion: editing.direccion ?? "",
        telefono: editing.telefono ?? "",
        email: editing.email ?? "",
        ciudad: editing.ciudad ?? "Medellín",
        departamento: editing.departamento ?? "Antioquia",
        codigo_departamento: editing.codigo_departamento ?? "05",
        codigo_municipio: editing.codigo_municipio ?? "001",
        codigo_pais: editing.codigo_pais ?? "169",
        es_autoretenedor: editing.es_autoretenedor ?? false,
        es_gran_contribuyente: editing.es_gran_contribuyente ?? false,
        es_declarante: editing.es_declarante ?? true,
      });
    } else {
      setForm(emptyForm);
    }
  }, [editing]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return terceros;
    return terceros.filter((t) =>
      (t.nombre_razon_social ?? "").toLowerCase().includes(q) ||
      (t.numero_documento ?? "").includes(q)
    );
  }, [terceros, search]);

  const onNew = () => { setEditing(null); setOpenForm(true); };
  const onEdit = (t) => { setEditing(t); setOpenForm(true); };
  const onDelete = (t) => setConfirmDel(t);
  const change = (k) => (e) => {
    const val = e.target.value;
    setForm((s) => {
      const next = { ...s, [k]: val };
      // Auto-calcular DV cuando cambia número de documento o tipo de documento
      if (k === "numero_documento" || k === "tipo_documento") {
        const num = k === "numero_documento" ? val : s.numero_documento;
        next.digito_verificacion = num ? calcularDV(num) : "";
      }
      return next;
    });
  };

  const isPersonaNatural = form.tipo_documento !== "NIT";

  const handleDptoChange = (e) => {
    const cod = e.target.value;
    const dpto = DEPARTAMENTOS.find(d => d.cod === cod);
    setForm(f => ({
      ...f,
      codigo_departamento: cod,
      departamento: dpto?.nombre || "",
      codigo_municipio: "001", // Reset municipio
    }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // Construir payload
    const payload = { ...form };
    // Si es persona natural, construir nombre_razon_social a partir de nombres
    if (isPersonaNatural && form.primer_nombre && form.primer_apellido) {
      const partes = [form.primer_nombre, form.otros_nombres, form.primer_apellido, form.segundo_apellido];
      payload.nombre_razon_social = partes.filter(Boolean).join(" ");
    }

    if (editing) {
      updateM.mutate(
        { id: editing.id, ...payload },
        { onSuccess: () => setOpenForm(false) }
      );
    } else {
      createM.mutate(payload, { onSuccess: () => setOpenForm(false) });
    }
  };

  const confirmDelete = () => {
    if (!confirmDel) return;
    deleteM.mutate(confirmDel.id, { onSettled: () => setConfirmDel(null) });
  };

  if (isLoading) return <div className="p-6">Cargando terceros…</div>;
  if (isError) return <div className="p-6 text-red-700">Error: {error?.message || "No se pudo cargar"}</div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Terceros</h1>
            <p className="text-sm text-gray-500">Clientes, proveedores, empleados y socios</p>
          </div>
        </div>
        <button onClick={onNew}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus className="h-4 w-4 mr-2" /> Nuevo tercero
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white p-4 rounded-xl border mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} type="text"
            placeholder="Buscar por nombre o documento…"
            className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm" />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Nombre / Razón social</th>
                <th className="px-4 py-3">Tipo tercero</th>
                <th className="px-4 py-3">Ciudad</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 w-28">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td className="p-8 text-center text-gray-400" colSpan={8}>
                  <Users size={40} className="mx-auto mb-2" />
                  No hay terceros. ¡Crea el primero!
                </td></tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{t.tipo_documento}</td>
                    <td className="px-4 py-3 font-mono">{t.numero_documento}{t.digito_verificacion ? `-${t.digito_verificacion}` : ""}</td>
                    <td className="px-4 py-3 font-medium">{t.nombre_razon_social}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                        {TIPOS_TERCERO.find(tt => tt.value === t.tipo_tercero)?.label || t.tipo_tercero}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.ciudad || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{t.telefono || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{t.email || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => onEdit(t)}
                          className="p-1.5 hover:bg-indigo-50 rounded text-indigo-600" title="Editar">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => onDelete(t)}
                          className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear / editar */}
      <Modal open={openForm} onClose={() => setOpenForm(false)}
        title={editing ? "Editar tercero" : "Nuevo tercero"}>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* --- IDENTIFICACIÓN --- */}
          <div className="border-b pb-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Identificación</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo documento *</label>
                <select className="border rounded-lg px-3 py-2 w-full text-sm" value={form.tipo_documento} onChange={change("tipo_documento")}>
                  {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número documento *</label>
                <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.numero_documento} onChange={change("numero_documento")} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">DV</label>
                <input className="border rounded-lg px-3 py-2 w-full text-sm bg-gray-50 font-mono text-center" value={form.digito_verificacion} readOnly tabIndex={-1} placeholder="—" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo tercero</label>
                <select className="border rounded-lg px-3 py-2 w-full text-sm" value={form.tipo_tercero} onChange={change("tipo_tercero")}>
                  {TIPOS_TERCERO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* --- NOMBRE --- */}
          <div className="border-b pb-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              {isPersonaNatural ? "Nombres" : "Razón social"}
            </h4>
            {isPersonaNatural ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Primer nombre *</label>
                  <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.primer_nombre} onChange={change("primer_nombre")} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Otros nombres</label>
                  <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.otros_nombres} onChange={change("otros_nombres")} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Primer apellido *</label>
                  <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.primer_apellido} onChange={change("primer_apellido")} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Segundo apellido</label>
                  <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.segundo_apellido} onChange={change("segundo_apellido")} />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Razón social *</label>
                <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.nombre_razon_social} onChange={change("nombre_razon_social")} required />
              </div>
            )}
          </div>

          {/* --- UBICACIÓN --- */}
          <div className="border-b pb-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1">
              <MapPin size={14} /> Ubicación
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">País (cód.)</label>
                <input className="border rounded-lg px-3 py-2 w-full text-sm bg-gray-50" value={form.codigo_pais} onChange={change("codigo_pais")} placeholder="169 = Colombia" />
                <p className="text-xs text-gray-400 mt-0.5">169 = Colombia</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Departamento</label>
                <select className="border rounded-lg px-3 py-2 w-full text-sm" value={form.codigo_departamento} onChange={handleDptoChange}>
                  <option value="">-- Seleccionar --</option>
                  {DEPARTAMENTOS.map(d => <option key={d.cod} value={d.cod}>{d.nombre} ({d.cod})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cód. Municipio</label>
                <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.codigo_municipio} onChange={change("codigo_municipio")} placeholder="001 = capital" />
                <p className="text-xs text-gray-400 mt-0.5">001 = Medellín, 001 = Bogotá, etc.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
                <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.ciudad} onChange={change("ciudad")} placeholder="Medellín" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.direccion} onChange={change("direccion")} placeholder="CR 80 53A 16" />
              </div>
            </div>
          </div>

          {/* --- CONTACTO --- */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Contacto</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                <input className="border rounded-lg px-3 py-2 w-full text-sm" value={form.telefono} onChange={change("telefono")} placeholder="319 3790165" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" className="border rounded-lg px-3 py-2 w-full text-sm" value={form.email} onChange={change("email")} />
              </div>
            </div>

            {/* Flags tributarios */}
            <div className="flex gap-6 mt-3 pt-3 border-t">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.es_autoretenedor}
                  onChange={(e) => setForm(f => ({ ...f, es_autoretenedor: e.target.checked }))} />
                <span>Autoretenedor</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.es_gran_contribuyente}
                  onChange={(e) => setForm(f => ({ ...f, es_gran_contribuyente: e.target.checked }))} />
                <span>Gran Contribuyente</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.es_declarante}
                  onChange={(e) => setForm(f => ({ ...f, es_declarante: e.target.checked }))} />
                <span>Declarante de Renta</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50" onClick={() => setOpenForm(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={createM.isPending || updateM.isPending}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
              {editing ? (updateM.isPending ? "Guardando…" : "Guardar cambios") : (createM.isPending ? "Creando…" : "Crear tercero")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmación de borrado */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Eliminar tercero"
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 rounded-lg border text-sm" onClick={() => setConfirmDel(null)}>Cancelar</button>
            <button className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm" onClick={confirmDelete}>Eliminar</button>
          </div>
        }>
        <p className="text-sm text-gray-700">
          ¿Seguro que deseas eliminar a <b>{confirmDel?.nombre_razon_social}</b>?
          Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  );
}
