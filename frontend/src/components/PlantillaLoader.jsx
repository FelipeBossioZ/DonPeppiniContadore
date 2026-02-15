// 🎩 Don Peppini - Cargador de plantillas contables
import { useState } from "react";
import api from "../services/api";

export default function PlantillaLoader({ empresaId, onLoad }) {
  const [lista, setLista] = useState(null);

  const cargar = async () => {
    try {
      const res = await api.get('/contabilidad/plantillas/', { params: { empresa: empresaId } });
      setLista(res.data);
    } catch { setLista([]); }
  };

  if (!lista) {
    return (
      <button type="button" onClick={cargar}
        className="mb-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 hover:bg-amber-100">
        📋 <span className="font-medium">Plantilla:</span> Cargar plantillas guardadas
      </button>
    );
  }

  if (lista.length === 0) {
    return <p className="text-xs text-gray-400 mb-3">No hay plantillas guardadas.</p>;
  }

  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-sm text-amber-700 font-medium">📋 Plantilla:</span>
      <select
        className="border rounded px-3 py-2 flex-1 text-sm"
        defaultValue=""
        onChange={(e) => {
          const p = lista.find(x => x.id === parseInt(e.target.value));
          if (p && onLoad) onLoad(p);
        }}
      >
        <option value="">— Seleccionar —</option>
        {lista.map(p => (
          <option key={p.id} value={p.id}>
            {p.nombre} ({p.lineas?.length || 0} líneas)
          </option>
        ))}
      </select>
    </div>
  );
}
