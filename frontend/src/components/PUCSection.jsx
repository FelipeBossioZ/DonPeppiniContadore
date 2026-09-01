// 🎩 Don Peppini - Sección Plan de Cuentas (PUC)
import { useState, useMemo } from "react";
import { BookOpen, Plus, Search, ChevronDown, ChevronUp, Pencil } from "lucide-react";

export default function PUCSection({ cuentas, onNewCuenta, onEditCuenta }) {
  const [showPUC, setShowPUC] = useState(false);
  const [pucSearch, setPucSearch] = useState("");

  const pucFiltered = useMemo(() => {
    if (!pucSearch) return cuentas.slice(0, 100);
    const s = pucSearch.toLowerCase();
    return cuentas.filter(c =>
      c.codigo?.toLowerCase().includes(s) || c.nombre?.toLowerCase().includes(s)
    ).slice(0, 100);
  }, [cuentas, pucSearch]);

  return (
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
              onClick={onNewCuenta}
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
                      <button onClick={() => onEditCuenta(c)}
                        className="text-indigo-600 hover:text-indigo-900" title="Editar cuenta">
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
  );
}
