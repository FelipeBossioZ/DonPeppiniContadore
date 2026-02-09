// 🎩 Don Peppini — Simulador de Retención en la Fuente (Art. 383 ET)
import { useState } from "react";
import { Calculator, ChevronDown, ChevronUp, Info, DollarSign } from "lucide-react";
import { simularRetencion } from "../services/api";

const peso = (v) => Number(v || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const UVT_2026 = 52374;

export default function SimuladorRetencion() {
  const [form, setForm] = useState({
    salario_devengado: "8000000",
    auxilio_transporte: "0",
    horas_extras: "0",
    comisiones: "0",
    bonificaciones: "0",
    otros_devengados: "0",
    aporte_salud_empleado: "320000",
    aporte_pension_empleado: "320000",
    aporte_fsp: "0",
    tiene_dependientes: false,
    deduccion_vivienda: "0",
    deduccion_medicina_prepagada: "0",
    aportes_voluntarios_pension: "0",
    aportes_afc: "0",
    salario_integral: false,
    salario_base_mensual: "8000000",
    uvt: String(UVT_2026),
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDesglose, setShowDesglose] = useState(true);

  const handleCalc = async () => {
    setLoading(true);
    try {
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        payload[k] = typeof v === "boolean" ? v : v;
      }
      const res = await simularRetencion(payload);
      setResult(res);
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate SS when salary changes
  const autoCalcSS = (salario) => {
    const sal = Number(salario) || 0;
    setForm(f => ({
      ...f,
      salario_devengado: salario,
      salario_base_mensual: salario,
      aporte_salud_empleado: String(Math.round(sal * 0.04)),
      aporte_pension_empleado: String(Math.round(sal * 0.04)),
      aporte_fsp: sal >= UVT_2026 * 4 ? String(Math.round(sal * 0.01)) : "0",
    }));
  };

  const Field = ({ label, name, type = "number", help, half }) => (
    <div className={half ? "" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
      />
      {help && <p className="text-xs text-gray-400 mt-0.5">{help}</p>}
    </div>
  );

  const Row = ({ label, value, bold, indent, highlight }) => (
    <div className={`flex justify-between py-1.5 ${bold ? "font-semibold" : ""} ${indent ? "pl-4" : ""} ${highlight ? "bg-amber-50 px-3 -mx-3 rounded" : ""}`}>
      <span className={`text-sm ${highlight ? "text-amber-800" : "text-gray-700"}`}>{label}</span>
      <span className={`text-sm font-mono ${highlight ? "text-amber-900 font-bold" : ""}`}>{peso(value)}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Calculator className="text-amber-700" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Simulador de Retención en la Fuente</h1>
          <p className="text-sm text-gray-500">Art. 383 / 388 Estatuto Tributario — Procedimiento 1 — UVT 2026: {peso(UVT_2026)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INPUTS */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <DollarSign size={16} /> Ingresos
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Salario mensual *</label>
              <input type="number" value={form.salario_devengado}
                onChange={e => autoCalcSS(e.target.value)}
                className="w-full border-2 border-indigo-200 rounded-lg px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-300 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Auxilio transporte" name="auxilio_transporte" />
              <Field label="Horas extras" name="horas_extras" />
              <Field label="Comisiones" name="comisiones" />
              <Field label="Bonificaciones" name="bonificaciones" />
            </div>

            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.salario_integral}
                  onChange={e => setForm(f => ({ ...f, salario_integral: e.target.checked }))}
                  className="rounded" />
                Salario integral
              </label>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">📋 Aportes obligatorios (calculados auto.)</h3>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Salud 4%" name="aporte_salud_empleado" />
              <Field label="Pensión 4%" name="aporte_pension_empleado" />
              <Field label="FSP" name="aporte_fsp" help="≥4 SMLV" />
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">🏠 Deducciones Art. 387 ET</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.tiene_dependientes}
                onChange={e => setForm(f => ({ ...f, tiene_dependientes: e.target.checked }))}
                className="rounded" />
              Tiene dependientes (10% ingreso, máx 32 UVT)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Intereses vivienda / mes" name="deduccion_vivienda" help="Máx 100 UVT" />
              <Field label="Medicina prepagada / mes" name="deduccion_medicina_prepagada" help="Máx 16 UVT" />
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">📊 Rentas exentas</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Aporte vol. pensiones / mes" name="aportes_voluntarios_pension" help="Art. 126-1 ET" />
              <Field label="Aporte AFC / mes" name="aportes_afc" help="Art. 126-4 ET" />
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-700 flex items-start gap-1">
                <Info size={14} className="mt-0.5 shrink-0" />
                La renta exenta del 25% (Art. 206 num. 10) se calcula automáticamente. El total de deducciones + rentas exentas no puede superar el 40% del ingreso neto ni 1.340 UVT anuales.
              </p>
            </div>
          </div>

          <button onClick={handleCalc} disabled={loading}
            className="w-full py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-200">
            <Calculator size={18} />
            {loading ? "Calculando..." : "Calcular Retención"}
          </button>
        </div>

        {/* RESULTS */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 p-6 text-center">
                <p className="text-sm text-amber-700 font-medium mb-1">Retención en la Fuente Mensual</p>
                <p className="text-4xl font-bold text-amber-900">{peso(result.retencion)}</p>
                <p className="text-xs text-amber-600 mt-2">
                  Base gravable: {peso(result.base_gravable)} ({result.base_gravable_uvt} UVT)
                </p>
                {result.base_gravable_uvt <= 95 && (
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    ✅ No aplica retención (base ≤ 95 UVT = {peso(95 * UVT_2026)})
                  </p>
                )}
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <button onClick={() => setShowDesglose(!showDesglose)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
                  <span className="text-sm font-semibold text-gray-800">📝 Desglose de la Depuración (Art. 388 ET)</span>
                  {showDesglose ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showDesglose && (
                  <div className="px-5 pb-5 space-y-1 divide-y divide-gray-100">
                    <Row label="(+) Ingreso laboral" value={result.ingreso_laboral} bold />

                    <div className="pt-2">
                      <p className="text-xs text-gray-500 font-medium mb-1">Ingresos No Constitutivos de Renta</p>
                      <Row label="(-) Aporte salud obligatorio" value={result.incr_salud} indent />
                      <Row label="(-) Aporte pensión obligatorio" value={result.incr_pension} indent />
                      {result.incr_fsp > 0 && <Row label="(-) Fondo Solidaridad Pensional" value={result.incr_fsp} indent />}
                      <Row label="= Total INCR" value={result.total_incr} bold />
                    </div>

                    <Row label="= Ingreso Neto" value={result.ingreso_neto} bold highlight />

                    <div className="pt-2">
                      <p className="text-xs text-gray-500 font-medium mb-1">Deducciones Art. 387</p>
                      {result.ded_vivienda > 0 && <Row label="(-) Intereses vivienda" value={result.ded_vivienda} indent />}
                      {result.ded_medicina > 0 && <Row label="(-) Medicina prepagada" value={result.ded_medicina} indent />}
                      {result.ded_dependientes > 0 && <Row label="(-) Dependientes" value={result.ded_dependientes} indent />}
                      <Row label="= Total deducciones" value={result.total_deducciones} bold />
                    </div>

                    <div className="pt-2">
                      <p className="text-xs text-gray-500 font-medium mb-1">Rentas Exentas</p>
                      {result.renta_exenta_vol_pension > 0 && <Row label="(-) Aportes vol. pensiones" value={result.renta_exenta_vol_pension} indent />}
                      {result.renta_exenta_afc > 0 && <Row label="(-) AFC" value={result.renta_exenta_afc} indent />}
                      <Row label="(-) Renta exenta 25% (Art. 206)" value={result.renta_exenta_25} indent />
                      <Row label="= Total rentas exentas" value={result.total_rentas_exentas} bold />
                    </div>

                    <div className="pt-2">
                      <Row label="Total beneficios (ded + exentas)" value={result.total_beneficios} />
                      <Row label="Tope (40% ingreso neto ó 1340 UVT/12)" value={result.tope_beneficios} />
                      {result.total_beneficios >= result.tope_beneficios * 0.98 && (
                        <p className="text-xs text-red-500 pl-4">⚠️ Se alcanzó el tope del 40%</p>
                      )}
                    </div>

                    <div className="pt-3">
                      <Row label="BASE GRAVABLE" value={result.base_gravable} bold highlight />
                      <div className="flex justify-between py-1.5 pl-4">
                        <span className="text-xs text-gray-500">En UVT</span>
                        <span className="text-xs font-mono text-gray-500">{result.base_gravable_uvt} UVT</span>
                      </div>
                      <div className="flex justify-between py-1.5 pl-4">
                        <span className="text-xs text-gray-500">Impuesto (tabla Art. 383)</span>
                        <span className="text-xs font-mono text-gray-500">{Number(result.impuesto_uvt).toFixed(2)} UVT</span>
                      </div>
                    </div>

                    <div className="pt-3">
                      <div className="flex justify-between py-2 bg-amber-100 px-3 -mx-3 rounded-lg">
                        <span className="text-sm font-bold text-amber-900">RETENCIÓN EN LA FUENTE</span>
                        <span className="text-sm font-bold font-mono text-amber-900">{peso(result.retencion)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabla Art. 383 referencia */}
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">📊 Tabla Art. 383 ET (Rangos en UVT)</h3>
                <div className="text-xs">
                  <div className="grid grid-cols-3 gap-1 font-semibold text-gray-600 border-b pb-1 mb-1">
                    <span>Rango UVT</span>
                    <span>Tarifa</span>
                    <span className="text-right">En pesos 2026</span>
                  </div>
                  {[
                    ["0 — 95", "0%", 95],
                    [">95 — 150", "19%", 150],
                    [">150 — 360", "28%", 360],
                    [">360 — 640", "33%", 640],
                    [">640 — 945", "35%", 945],
                    [">945 — 2300", "37%", 2300],
                    [">2300", "39%", null],
                  ].map(([rango, tarifa, tope], i) => (
                    <div key={i} className={`grid grid-cols-3 gap-1 py-0.5 ${
                      result && result.base_gravable_uvt > (i === 0 ? 0 : [0,95,150,360,640,945,2300][i]) &&
                      result.base_gravable_uvt <= (tope || 99999) ? "bg-amber-100 font-semibold rounded px-1 -mx-1" : ""
                    }`}>
                      <span>{rango}</span>
                      <span>{tarifa}</span>
                      <span className="text-right">{tope ? peso(tope * UVT_2026) : "∞"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <Calculator size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-sm">Ingrese los datos y presione "Calcular Retención" para ver el desglose completo de la depuración.</p>
              <p className="text-gray-400 text-xs mt-2">Procedimiento 1 — Art. 385 ET</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
