import { useEffect, useState } from "react";
const empty = { numero: "", fecha: "", total: 0, tercero: null };

export default function InvoiceForm({ initial, onSubmit, submitting, onCancel }) {
  const [form, setForm] = useState(empty);
  useEffect(() => setForm(initial || empty), [initial]);

  const change = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.numero || !form.fecha) return;
    onSubmit({ ...form, total: Number(form.total) || 0 });
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
      <div>
        <label className="block text-sm mb-1">Número</label>
        <input className="border rounded px-3 py-2 w-full" placeholder="F0001" value={form.numero} onChange={change("numero")} required />
      </div>
      <div>
        <label className="block text-sm mb-1">Fecha</label>
        <input className="border rounded px-3 py-2 w-full" type="date" value={form.fecha} onChange={change("fecha")} required />
      </div>
      <div>
        <label className="block text-sm mb-1">Total</label>
        <input className="border rounded px-3 py-2 w-full" type="number" step="0.01" min="0" value={form.total} onChange={change("total")} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="px-3 py-2 rounded bg-indigo-600 text-white">
          {submitting ? "Guardando…" : "Guardar Cambios"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded border">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
