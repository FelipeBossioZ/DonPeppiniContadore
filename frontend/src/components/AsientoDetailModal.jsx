// 🎩 Don Peppini - Modal detalle de asiento contable
import Modal from "./Modal";
import { fmtMoney } from "../utils/contabilidad";
import api from "../services/api";

export default function AsientoDetailModal({
  asiento, onClose, empresaId,
  onDuplicate, onCorregir, canCorregir,
}) {
  if (!asiento) return null;

  const title = `${asiento.tipo_comprobante || "OT"}-${String(asiento.numero || asiento.id).padStart(4, '0')}`;

  return (
    <Modal open={!!asiento} onClose={onClose} title={title} footer={null}>
      <div className="overflow-x-auto">
        <div className="mb-3 text-sm">
          <span className="text-gray-500">Tercero principal:</span>{" "}
          <span className="font-medium">{asiento.tercero_nombre || "N/A"}</span>
        </div>
        <div className="mb-2 text-sm">
          <span className="text-gray-500">Concepto:</span>{" "}
          <span className="font-medium">{asiento.concepto || "—"}</span>
        </div>
        {asiento.descripcion_adicional && (
          <div className="mb-3 text-sm bg-blue-50 border border-blue-200 rounded p-2">
            <span className="text-gray-500">Notas adicionales:</span>{" "}
            <span>{asiento.descripcion_adicional}</span>
          </div>
        )}
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
            {asiento.movimientos?.map((m, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{m.cuenta_codigo_display ?? m.cuenta?.codigo ?? m.cuenta} — {m.cuenta_nombre ?? m.cuenta?.nombre ?? ""}</td>
                <td className="p-2 text-gray-500 text-xs">
                  {m.tercero_nombre || <span className="italic text-gray-400">— hereda —</span>}
                </td>
                <td className="p-2 text-right">{fmtMoney(m.debito)}</td>
                <td className="p-2 text-right">{fmtMoney(m.credito)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end gap-2">
          {canCorregir && (
            <button className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 text-sm"
              onClick={() => { onClose(); onCorregir(asiento); }}>
              Corregir
            </button>
          )}
          <button className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
            onClick={() => { onClose(); onDuplicate(asiento); }}>
            Duplicar este asiento
          </button>
          <button className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 text-sm"
            onClick={async () => {
              const nombre = prompt('Nombre para la plantilla:');
              if (!nombre) return;
              const dia = prompt('Programar mensual? Día del mes (1-28, vacío = no programar):');
              try {
                await api.post('/contabilidad/plantillas/crear/', {
                  empresa: empresaId,
                  nombre,
                  desde_asiento_id: asiento.id,
                  dia_del_mes: dia || undefined,
                });
                alert('✅ Plantilla creada: ' + nombre);
              } catch (err) {
                alert('Error: ' + (err.response?.data?.error || err.message));
              }
            }}>
            Guardar como plantilla
          </button>
        </div>
      </div>
    </Modal>
  );
}
