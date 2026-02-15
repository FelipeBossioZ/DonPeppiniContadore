// 🎩 Don Peppini - Modal crear/editar cuenta contable
import { useState, useEffect } from "react";
import { useCreateCuenta, useUpdateCuenta } from "../hooks/useCuentas";
import { toast } from "../ui/ToastHost";
import { parseApiError } from "../utils/contabilidad";
import Modal from "./Modal";

export default function CuentaFormModal({ open, onClose, empresaId, editingCuenta }) {
  const [form, setForm] = useState({ codigo: "", nombre: "", naturaleza: "D" });
  const createCta = useCreateCuenta({});
  const updateCta = useUpdateCuenta({});

  useEffect(() => {
    if (editingCuenta) {
      setForm({ codigo: editingCuenta.codigo, nombre: editingCuenta.nombre, naturaleza: editingCuenta.naturaleza || "D" });
    } else {
      setForm({ codigo: "", nombre: "", naturaleza: "D" });
    }
  }, [editingCuenta, open]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (editingCuenta) {
      updateCta.mutate(
        { id: editingCuenta.id, nombre: form.nombre, naturaleza: form.naturaleza },
        {
          onSuccess: () => { onClose(); toast("Cuenta actualizada"); },
          onError: (err) => toast(parseApiError(err), "error"),
        }
      );
    } else {
      createCta.mutate(
        { codigo: form.codigo, nombre: form.nombre, naturaleza: form.naturaleza, empresa: empresaId },
        {
          onSuccess: () => { onClose(); toast("Cuenta creada"); },
          onError: (err) => toast(parseApiError(err), "error"),
        }
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingCuenta ? `Editar cuenta: ${editingCuenta.codigo}` : "Nueva cuenta contable"}
      footer={null}
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Código</label>
          <input
            className="border rounded px-3 py-2 w-full font-mono"
            value={form.codigo}
            onChange={(e) => setForm(s => ({ ...s, codigo: e.target.value }))}
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
            value={form.naturaleza}
            onChange={(e) => setForm(s => ({ ...s, naturaleza: e.target.value }))}
          >
            <option value="D">Débito</option>
            <option value="C">Crédito</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Nombre</label>
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.nombre}
            onChange={(e) => setForm(s => ({ ...s, nombre: e.target.value }))}
            placeholder="Ej: Caja menor oficina Medellín"
            required
          />
        </div>
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" className="px-3 py-2 rounded border" onClick={onClose}>Cancelar</button>
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
  );
}
