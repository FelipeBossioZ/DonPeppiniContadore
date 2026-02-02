  //frontend/src/pages/facturacion.jsx


import { useMemo, useState } from "react";
import { Download, Plus, Search, Edit2, Trash2 } from "lucide-react";
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
} from "../hooks/useInvoices";
import InvoiceForm from "../components/facturacion/InvoiceForm";


const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const fmtMoney = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(n ?? 0);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-CO") : "");

function EstadoBadge({ estado }) {
  const map = {
    borrador: "bg-gray-100 text-gray-800",
    emitida: "bg-blue-100 text-blue-800",
    pagada: "bg-green-100 text-green-800",
    anulada: "bg-red-100 text-red-800",
  };
  const cls = map[estado] || map.borrador;
  const label = (estado || "borrador")[0].toUpperCase() + (estado || "borrador").slice(1);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// Modal simple reutilizable
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-[95vw] max-w-lg rounded-xl shadow-xl">
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

export default function Facturacion() {
  const [openPdf, setOpenPdf] = useState(null); // { id, numero } | null
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);          // objeto factura o null
  const [openForm, setOpenForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);    // { id, numero, estado } o null

  const { data = [], isLoading, isError, error } = useInvoices({});
  const createM = useCreateInvoice({});
  const updateM = useUpdateInvoice({});
  const deleteM = useDeleteInvoice({});

  // Filtrado por texto (número / cliente)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((f) =>
      String(f.numero).toLowerCase().includes(q) ||
      String(f.tercero_nombre ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const onNew = () => {
    setEditing(null);
    setOpenForm(true);
  };
  const onEdit = (inv) => {
    setEditing(inv);
    setOpenForm(true);
  };

  const onSubmit = (payload) => {
    if (editing) {
      updateM.mutate(
        { id: editing.id, ...payload },
        { onSuccess: () => setOpenForm(false) }
      );
    } else {
      createM.mutate(payload, { onSuccess: () => setOpenForm(false) });
    }
  };

  const onAskDelete = (inv) => {
    setConfirmDel(inv); // abre modal de confirmación
  };
  const onConfirmDelete = () => {
    if (!confirmDel) return;
    deleteM.mutate(confirmDel.id, {
      onSettled: () => setConfirmDel(null),
    });
  };

  const exportCSV = () => {
    const rows = [
      ["id", "numero", "cliente", "fecha", "total", "estado"],
      ...filtered.map((f) => [
        f.id,
        f.numero,
        f.tercero_nombre ?? "",
        f.fecha ?? "",
        f.total ?? 0,
        f.estado ?? "borrador",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "facturas.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="p-6">Cargando facturas…</div>;
  if (isError) return <div className="p-6 text-red-700">Error: {error?.message || "No se pudo cargar"}</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Facturación</h1>
          <p className="mt-1 text-gray-600">Gestiona tus facturas de venta</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCSV} className="flex items-center px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="h-4 w-4 mr-2" /> Exportar
          </button>
          <button onClick={onNew} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" /> Nuevo
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder="Buscar por número o cliente…"
            className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 w-40">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={6}>
                  No hay facturas. ¡Crea la primera!
                </td>
              </tr>
            ) : (
              filtered.map((f) => {
                const canDelete = (f.estado || "borrador") === "borrador";
                return (
                  <tr key={f.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">#{String(f.numero).padStart(4, "0")}</td>
                    <td className="px-4 py-3">{f.tercero_nombre ?? ""}</td>
                    <td className="px-4 py-3">{fmtDate(f.fecha)}</td>
                    <td className="px-4 py-3 font-medium">{fmtMoney(f.total)}</td>
                    <td className="px-4 py-3"><EstadoBadge estado={f.estado} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          className="inline-flex items-center px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => onEdit(f)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" /> Editar
                        </button>
                        <button
                          className={`inline-flex items-center px-2 py-1 rounded ${canDelete ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
                          onClick={() => canDelete && onAskDelete(f)}
                          disabled={!canDelete}
                          title={!canDelete ? "Solo se pueden eliminar facturas en estado 'borrador'" : "Eliminar"}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                        </button>
                        <button
                          className="inline-flex items-center px-2 py-1 rounded border-0
                                      bg-[#fbcfe8] text-[#3b0764] hover:bg-[#e5bdfb]"
                          onClick={() => setOpenPdf({ id: f.id, numero: f.numero })}
                          title="Ver PDF"
                        >
                          Ver PDF
                        </button>



                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal editar/crear */}
      <Modal
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={editing ? "Editar Factura" : "Nueva Factura"}
        footer={null}
      >
        <InvoiceForm
          initial={editing}
          onSubmit={onSubmit}
          submitting={createM.isPending || updateM.isPending}
          onCancel={() => setOpenForm(false)}
        />
      </Modal>

      {/* Confirmación de borrado */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Eliminar Factura"
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 rounded border" onClick={() => setConfirmDel(null)}>Cancelar</button>
            <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={onConfirmDelete}>
              Eliminar
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-700">
          ¿Está seguro que desea eliminar la factura <b>#{String(confirmDel?.numero ?? confirmDel?.id ?? "").padStart(4, "0")}</b>?
          Esta acción no se puede deshacer.
        </p>
      </Modal>

      <Modal
          open={!!openPdf}
          onClose={() => setOpenPdf(null)}
          title={`Factura #${String(openPdf?.numero ?? openPdf?.id ?? "").padStart(4, "0")}`}
          footer={
            <div className="flex justify-end gap-2">
              <a
                className="px-3 py-2 rounded bg-indigo-600 text-white"
                href={`${BASE}/api/facturacion/facturas/${openPdf?.id}/pdf/?download=1`}
                target="_blank" rel="noreferrer"
              >
                Descargar
              </a>
              <button className="px-3 py-2 rounded border" onClick={() => setOpenPdf(null)}>Cerrar</button>
            </div>
          }
         >
          <div className="h-[80vh]">
            <iframe
              title="Factura PDF"
              src={`${BASE}/api/facturacion/facturas/${openPdf?.id}/pdf/`}
              className="w-full h-full rounded"
            />
          </div>
       </Modal>







    </div>
  );
}
