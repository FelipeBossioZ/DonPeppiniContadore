// frontend/src/pages/Terceros.jsx
import { useMemo, useState, useEffect } from "react";
import { Users, Plus, Search, Edit2, Trash2 } from "lucide-react";
import {
  useTerceros,
  useCreateTercero,
  useUpdateTercero,
  useDeleteTercero,
} from "../hooks/useTerceros";

// Modal simple
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-[95vw] max-w-2xl rounded-xl shadow-xl">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-gray-500" onClick={onClose}>×</button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="px-4 py-3 border-t">{footer}</div>}
      </div>
    </div>
  );
}

const emptyForm = {
  tipo_documento: "CC",
  numero_documento: "",
  nombre_razon_social: "",
  direccion: "",
  telefono: "",
  email: "",
};

export default function Terceros() {
  // filtros y datos
  const [search, setSearch] = useState("");
  const { data: terceros = [], isLoading, isError, error } = useTerceros({ search });

  // mutaciones
  const createM = useCreateTercero({ search });
  const updateM = useUpdateTercero({ search });
  const deleteM = useDeleteTercero({ search });

  // UI estado
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null); // objeto tercero o null
  const [form, setForm] = useState(emptyForm);
  const [confirmDel, setConfirmDel] = useState(null); // {id, nombre_razon_social}

  useEffect(() => {
    if (editing) {
      // precarga el formulario con el tercero a editar
      setForm({
        tipo_documento: editing.tipo_documento ?? "CC",
        numero_documento: editing.numero_documento ?? "",
        nombre_razon_social: editing.nombre_razon_social ?? "",
        direccion: editing.direccion ?? "",
        telefono: editing.telefono ?? "",
        email: editing.email ?? "",
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
      (t.numero_documento ?? "").toLowerCase().includes(q)
    );
  }, [terceros, search]);

  // handlers
  const onNew = () => { setEditing(null); setOpenForm(true); };
  const onEdit = (t) => { setEditing(t); setOpenForm(true); };
  const onDelete = (t) => setConfirmDel(t);

  const change = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    if (editing) {
      updateM.mutate(
        { id: editing.id, ...form },
        { onSuccess: () => setOpenForm(false) }
      );
    } else {
      createM.mutate(form, { onSuccess: () => setOpenForm(false) });
    }
  };

  const confirmDelete = () => {
    if (!confirmDel) return;
    deleteM.mutate(confirmDel.id, { onSettled: () => setConfirmDel(null) });
  };

  // render
  if (isLoading) return <div className="p-6">Cargando terceros…</div>;
  if (isError) return <div className="p-6 text-red-700">Error: {error?.message || "No se pudo cargar"}</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-7 w-7 text-gray-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Terceros</h1>
            <p className="mt-1 text-gray-600">Clientes y proveedores</p>
          </div>
        </div>
        <button
          onClick={onNew}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" /> Nuevo tercero
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder="Buscar por nombre o documento…"
            className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Nombre / Razón social</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 w-40">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={6}>
                  No hay terceros. ¡Crea el primero!
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{t.tipo_documento}</td>
                  <td className="px-4 py-3">{t.numero_documento}</td>
                  <td className="px-4 py-3">{t.nombre_razon_social}</td>
                  <td className="px-4 py-3">{t.telefono ?? ""}</td>
                  <td className="px-4 py-3">{t.email ?? ""}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => onEdit(t)}
                      >
                        <Edit2 className="h-4 w-4 mr-1" /> Editar
                      </button>
                      <button
                        className="inline-flex items-center px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        onClick={() => onDelete(t)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear / editar */}
      <Modal
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={editing ? "Editar tercero" : "Nuevo tercero"}
        footer={null}
      >
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Tipo documento</label>
            <select className="border rounded px-3 py-2 w-full" value={form.tipo_documento} onChange={change("tipo_documento")}>
              <option value="CC">CC</option>
              <option value="NIT">NIT</option>
              <option value="CE">CE</option>
              <option value="PA">PA</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Número documento</label>
            <input className="border rounded px-3 py-2 w-full" value={form.numero_documento} onChange={change("numero_documento")} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Nombre / Razón social</label>
            <input className="border rounded px-3 py-2 w-full" value={form.nombre_razon_social} onChange={change("nombre_razon_social")} required />
          </div>
          <div>
            <label className="block text-sm mb-1">Dirección</label>
            <input className="border rounded px-3 py-2 w-full" value={form.direccion} onChange={change("direccion")} />
          </div>
          <div>
            <label className="block text-sm mb-1">Teléfono</label>
            <input className="border rounded px-3 py-2 w-full" value={form.telefono} onChange={change("telefono")} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Email</label>
            <input type="email" className="border rounded px-3 py-2 w-full" value={form.email} onChange={change("email")} />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpenForm(false)}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createM.isPending || updateM.isPending}
              className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {editing ? (updateM.isPending ? "Guardando…" : "Guardar cambios") : (createM.isPending ? "Creando…" : "Crear")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmación de borrado */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar tercero"
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 rounded border" onClick={() => setConfirmDel(null)}>Cancelar</button>
            <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={confirmDelete}>
              Eliminar
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-700">
          ¿Seguro que deseas eliminar a <b>{confirmDel?.nombre_razon_social}</b>?
        </p>
      </Modal>
    </div>
  );
}
