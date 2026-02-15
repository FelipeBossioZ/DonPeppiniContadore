// 🎩 Don Peppini - Modal rápido para crear tercero
import { useState } from "react";
import { useCreateTercero } from "../hooks/useTerceros";
import { calcularDV } from "../utils/calcularDV";
import Modal from "./Modal";

export default function TerceroQuickModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    tipo_documento: "CC", numero_documento: "", digito_verificacion: "",
    nombre_razon_social: "", direccion: "", telefono: "", email: ""
  });
  const createTer = useCreateTercero({});

  const reset = () => setForm({
    tipo_documento: "CC", numero_documento: "", digito_verificacion: "",
    nombre_razon_social: "", direccion: "", telefono: "", email: ""
  });

  return (
    <Modal open={open} onClose={onClose} title="Nuevo tercero" footer={null}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createTer.mutate(form, {
            onSuccess: (t) => {
              if (onCreated) onCreated(t);
              onClose();
              reset();
            },
          });
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <div>
          <label className="block text-sm mb-1">Tipo documento</label>
          <select className="border rounded px-3 py-2 w-full"
            value={form.tipo_documento}
            onChange={(e) => setForm(s => ({ ...s, tipo_documento: e.target.value }))}
          >
            <option>CC</option><option>NIT</option><option>CE</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Número documento</label>
          <div className="flex gap-2">
            <input className="border rounded px-3 py-2 flex-1"
              value={form.numero_documento}
              onChange={(e) => {
                const v = e.target.value;
                setForm(s => ({ ...s, numero_documento: v, digito_verificacion: v ? calcularDV(v) : "" }));
              }}
              required
            />
            <input className="border rounded px-3 py-2 w-12 text-center bg-gray-50 font-mono"
              value={form.digito_verificacion} readOnly tabIndex={-1} placeholder="DV" title="Dígito de verificación"
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Nombre / Razón social</label>
          <input className="border rounded px-3 py-2 w-full"
            value={form.nombre_razon_social}
            onChange={(e) => setForm(s => ({ ...s, nombre_razon_social: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Dirección</label>
          <input className="border rounded px-3 py-2 w-full"
            value={form.direccion}
            onChange={(e) => setForm(s => ({ ...s, direccion: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Teléfono</label>
          <input className="border rounded px-3 py-2 w-full"
            value={form.telefono}
            onChange={(e) => setForm(s => ({ ...s, telefono: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Email</label>
          <input type="email" className="border rounded px-3 py-2 w-full"
            value={form.email}
            onChange={(e) => setForm(s => ({ ...s, email: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" className="px-3 py-2 rounded border" onClick={onClose}>Cancelar</button>
          <button type="submit" className="px-3 py-2 rounded bg-indigo-600 text-white">Crear</button>
        </div>
      </form>
    </Modal>
  );
}
