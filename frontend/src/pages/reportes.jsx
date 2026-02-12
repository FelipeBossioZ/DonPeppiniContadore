// frontend/src/pages/reportes.jsx
import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "../ui/ToastHost";
import { useEmpresa } from "../context/EmpresaContext";
import {
  exportBalancePrueba,
  exportLibroDiario,
  exportLibroMayor,
} from "../utils/exports";

// Helpers de fecha
function todayISO(){ const d=new Date(); return d.toISOString().slice(0,10); }
function firstDayOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10); }
function lastDayOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10); }

export default function Reportes() {
  const { empresaId } = useEmpresa();
  // Filtros
  const [ini, setIni] = useState(firstDayOfMonth());
  const [fin, setFin] = useState(lastDayOfMonth());
  const [cuenta, setCuenta] = useState("");

  const onBalance = async () => {
    if (!ini && !fin) return toast("Selecciona rango de fechas", "error");
    try {
      await exportBalancePrueba({ inicio: ini, fin, empresa: empresaId });
      toast("Descarga iniciada");
    } catch (e) {
      console.error(e);
      toast("No se pudo exportar Balance de Prueba", "error");
    }
  };

  const onLibroDiario = async () => {
    if (!ini && !fin) return toast("Selecciona rango de fechas", "error");
    try {
      await exportLibroDiario({ inicio: ini, fin, empresa: empresaId });
      toast("Descarga iniciada");
    } catch (e) {
      console.error(e);
      toast("No se pudo exportar Libro Diario", "error");
    }
  };

  const onLibroMayor = async () => {
    if (!cuenta) return toast("Ingresa el código de cuenta", "error");
    try {
      await exportLibroMayor({ codigo: cuenta, inicio: ini, fin, empresa: empresaId });
      toast("Descarga iniciada");
    } catch (e) {
      console.error(e);
      toast("No se pudo exportar Libro Mayor", "error");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Reportes</h1>
        <p className="text-gray-600">Exporta balances y libros por periodo.</p>
      </div>

      {/* Filtros globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1">Fecha inicio</label>
          <input
            type="date"
            value={ini}
            onChange={(e)=>setIni(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            max={fin || undefined}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Fecha fin</label>
          <input
            type="date"
            value={fin}
            onChange={(e)=>setFin(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            min={ini || undefined}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Cuenta (Libro Mayor)</label>
          <input
            placeholder="110505 ..."
            value={cuenta}
            onChange={(e)=>setCuenta(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      </div>

      {/* Tarjetas de export */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">Balance de Prueba (XLSX)</h2>
          <p className="text-sm text-gray-600 mb-3">
            Incluye Saldo inicial, Débitos, Créditos y Saldo final.
          </p>
          <button
            onClick={onBalance}
            className="inline-flex items-center px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Exportar
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">Libro Diario (XLSX)</h2>
          <p className="text-sm text-gray-600 mb-3">
            Movimientos por día y asiento.
          </p>
          <button
            onClick={onLibroDiario}
            className="inline-flex items-center px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Exportar
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">Libro Mayor (XLSX)</h2>
          <p className="text-sm text-gray-600 mb-3">
            Movimientos y saldo por cuenta.
          </p>
          <div className="flex gap-2">
            <input
              placeholder="110505 ..."
              value={cuenta}
              onChange={(e)=>setCuenta(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
            <button
              onClick={onLibroMayor}
              className="inline-flex items-center px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Exportar
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">Estados Financieros</h2>
          <p>Situación Financiera-Resultados-Cambios Patrimonio-Flujo Efectivo</p>
          <Link
            to="/estados-financieros"
            className="inline-flex items-center px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Ir al módulo
          </Link>
        </div>
      </div>
    </div>
  );
}
