// frontend/src/components/facturacion/InvoiceTable.jsx
import { CheckCircle, Clock, Send, XCircle } from "lucide-react";

const fmtMoney = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(n ?? 0);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-CO") : "");

function EstadoBadge({ estado }) {
  const badges = {
    borrador: { color: "bg-gray-100 text-gray-800", Icon: Clock },
    emitida:  { color: "bg-blue-100 text-blue-800", Icon: Send },
    pagada:   { color: "bg-green-100 text-green-800", Icon: CheckCircle },
    anulada:  { color: "bg-red-100 text-red-800", Icon: XCircle },
  };
  const { color, Icon } = badges[estado] || badges.borrador;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3 mr-1" />
      {estado.charAt(0).toUpperCase() + estado.slice(1)}
    </span>
  );
}

export default function InvoiceTable({ data, onEdit, onDelete }) {
  if (!data?.length) return <p className="text-sm text-gray-500">No hay facturas.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b bg-gray-50">
          <tr className="text-left">
            <th className="p-2">#</th>
            <th className="p-2">Cliente</th>
            <th className="p-2">Fecha</th>
            <th className="p-2">Total</th>
            <th className="p-2">Estado</th>
            <th className="p-2 w-32">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((inv) => (
            <tr key={inv.id} className="border-b hover:bg-gray-50">
              <td className="p-2">#{String(inv.numero).padStart(4, "0")}</td>
              <td className="p-2">{inv.tercero_nombre}</td>
              <td className="p-2">{fmtDate(inv.fecha)}</td>
              <td className="p-2 font-medium">{fmtMoney(inv.total)}</td>
              <td className="p-2"><EstadoBadge estado={inv.estado} /></td>
              <td className="p-2 space-x-2">
                <button className="px-2 py-1 rounded bg-blue-600 text-white" onClick={() => onEdit?.(inv)}>Editar</button>
                <button className="px-2 py-1 rounded bg-red-600 text-white" onClick={() => onDelete?.(inv.id)}>Borrar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
