// 🎩 Don Peppini - Modal formulario de asiento contable
import { useState, useEffect, useMemo } from "react";
import Modal from "./Modal";
import PlantillaLoader from "./PlantillaLoader";
import TerceroQuickModal from "./TerceroQuickModal";
import CuentaFormModal from "./CuentaFormModal";
import {
  todayISO, monthBoundsISO, naturalezaEsperada,
  fmtMoney, evalExpr, TIPOS_COMPROBANTE, parseApiError
} from "../utils/contabilidad";

const emptyRow = { cuenta: "", tercero_id: "", debito: 0, credito: 0, enlazada: false };

export default function AsientoFormModal({
  open, onClose, empresaId,
  cuentas, cuentaCodes, terceros,
  initialForm, initialRows,
  onCreate, isPending,
}) {
  const [form, setForm] = useState({ fecha: todayISO(), tipo_comprobante: "OT", concepto: "", tercero_id: "", descripcion_adicional: "", es_ajuste: false });
  const [movRows, setMovRows] = useState([{ ...emptyRow }, { ...emptyRow }]);
  const [rowErrors, setRowErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [openTercero, setOpenTercero] = useState(false);
  const [openCuenta, setOpenCuenta] = useState(false);

  // Auto-fill fecha Jan 1 when switching to AP
  useEffect(() => {
    if (open && form.tipo_comprobante === "AP" && form.fecha) {
      const y = new Date(form.fecha + "T12:00:00").getFullYear();
      const jan1 = `${y}-01-01`;
      if (form.fecha !== jan1) setForm(f => ({ ...f, fecha: jan1 }));
    }
  }, [form.tipo_comprobante]);

  // Auto-fill fecha Jan 1 when switching to AP
  useEffect(() => {
    if (open && form.tipo_comprobante === "AP" && form.fecha) {
      const y = new Date(form.fecha + "T12:00:00").getFullYear();
      const jan1 = `${y}-01-01`;
      if (form.fecha !== jan1) setForm(f => ({ ...f, fecha: jan1 }));
    }
  }, [form.tipo_comprobante]);

  // Reset form when modal opens/closes or initial data changes
  useEffect(() => {
    if (open) {
      const sk = `asiento-draft-${empresaId}`;
      if (!initialForm) {
        try {
          const saved = sessionStorage.getItem(sk);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.form && parsed.rows && parsed.rows.length >= 2) {
              setForm(parsed.form);
              setMovRows(parsed.rows);
              setServerError(null);
              setRowErrors({});
              return;
            }
          }
        } catch(e) { /* ignore */ }
      }
      setForm(initialForm || { fecha: todayISO(), tipo_comprobante: "OT", concepto: "", tercero_id: "", descripcion_adicional: "", es_ajuste: false });
      setMovRows(initialRows && initialRows.length >= 2 ? initialRows : [{ ...emptyRow }, { ...emptyRow }]);
      setServerError(null);
      setRowErrors({});
    }
  }, [open, initialForm, initialRows]);

  // Save draft to sessionStorage (not for AP)
  useEffect(() => {
    if (open && empresaId && form.tipo_comprobante !== "AP") {
      try { sessionStorage.setItem(`asiento-draft-${empresaId}`, JSON.stringify({ form, rows: movRows })); } catch(e) {}
    }
  }, [form, movRows, open, empresaId]);

  // ---- Periodo label ----
  const textoPeriodo = useMemo(() => {
    const fechaSel = new Date(form.fecha || todayISO());
    const y = fechaSel.getFullYear();
    const today = new Date();
    const inJanMar = today.getFullYear() === y + 1 && today.getMonth() <= 2;
    return inJanMar
      ? `Periodo: ${y} — Ventana enero–marzo activa (requiere PINs).`
      : `Periodo: ${y} — Anulación según estado del periodo.`;
  }, [form.fecha]);

  // ---- Handlers ----
  const changeHdr = (k) => (e) => { setServerError(null); setForm(s => ({ ...s, [k]: e.target.value })); };

  const changeRow = (i, k) => (e) => {
    const v = e.target.value;
    setServerError(null);
    if ((k === "debito" || k === "credito") && i % 2 === 0 && movRows[i]?.enlazada) {
      changeRowLinked(i, k, v); return;
    }
    setMovRows(rows => rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
    if (k === "cuenta") {
      setRowErrors(prev => {
        const next = { ...prev };
        if (!v) next[i] = { ...(next[i] || {}), code: "Ingrese un código de cuenta." };
        else if (!cuentaCodes.has(String(v))) next[i] = { ...(next[i] || {}), code: `La cuenta '${v}' no existe.` };
        else { if (next[i]) { const { code, ...rest } = next[i]; next[i] = rest; if (!Object.keys(next[i]).length) delete next[i]; } }
        return next;
      });
    }
  };

  const matchCuentas = (q) => {
    const s = (q || "").toString().toLowerCase();
    return cuentas.filter(c => c.codigo?.toLowerCase().includes(s) || c.nombre?.toLowerCase().includes(s));
  };

  const changeRowLinked = (i, k, rawValue) => {
    setMovRows(rows => rows.map((r, idx) => {
      if (idx === i) return { ...r, [k]: rawValue };
      if (idx === i + 1 && rows[i] && rows[i].enlazada) {
        if (k === "debito") return { ...r, credito: rawValue, debito: 0 };
        if (k === "credito") return { ...r, debito: rawValue, credito: 0 };
      }
      return r;
    }));
  };

  const toggleLink = (i) => {
    setMovRows(rows => rows.map((r, idx) => {
      if (idx === i) return { ...r, enlazada: !r.enlazada };
      if (idx === i + 1 && rows[i].enlazada) return { ...r, debito: 0, credito: 0 };
      return r;
    }));
  };

  const addRow = () => setMovRows(rows => [...rows, { ...emptyRow, enlazada: false }]);
  const delRow = (i) => {
    setMovRows(rows => { const minRows = form.tipo_comprobante === "AP" ? 1 : 2; if (rows.length <= minRows) return rows; return rows.filter((_r, idx) => idx !== i); });
    setRowErrors(prev => { if (!prev[i]) return prev; const next = { ...prev }; delete next[i]; return next; });
  };

  const totalDeb = useMemo(() => movRows.reduce((s, r) => s + (Number(r.debito) || 0), 0), [movRows]);
  const totalCred = useMemo(() => movRows.reduce((s, r) => s + (Number(r.credito) || 0), 0), [movRows]);
  const balanceOk = Math.abs(totalDeb - totalCred) < 1e-6;

  const onSubmit = (e) => {
    e.preventDefault();
    if (form.tipo_comprobante !== "AP" && !balanceOk) { alert("El asiento no cuadra."); return; }
    if (Object.keys(rowErrors).length > 0) {
      const firstIdx = Math.min(...Object.keys(rowErrors).map(Number));
      const el = document.querySelector(`input[list="cuentas-sug-${firstIdx}"]`);
      if (el) el.focus();
      return;
    }
    const payload = {
      empresa: empresaId,
      fecha: form.fecha,
      tipo_comprobante: form.tipo_comprobante || "OT",
      concepto: form.concepto,
      tercero: form.tercero_id ? Number(form.tercero_id) : null,
      descripcion_adicional: form.descripcion_adicional || "",
      movimientos: movRows.map(r => ({
        cuenta_codigo: r.cuenta,
        tercero: r.tercero_id ? Number(r.tercero_id) : null,
        debito: Number(r.debito) || 0,
        credito: Number(r.credito) || 0,
      })),
    };
    if (form.es_ajuste) payload.fiscal_period = 13;

    onCreate(payload, {
      onSuccess: () => { sessionStorage.removeItem(`asiento-draft-${empresaId}`); onClose(); setServerError(null); },
      onError: (err) => setServerError(parseApiError(err)),
    });
  };

  // ---- Plantilla load handler ----
  const onLoadPlantilla = (p) => {
    setForm(f => ({
      ...f,
      tipo_comprobante: p.tipo_comprobante || f.tipo_comprobante,
      concepto: p.concepto || f.concepto,
    }));
    const rows = p.lineas.map(l => ({
      cuenta: l.cuenta_codigo,
      tercero_id: l.tercero_id || "",
      debito: l.tipo === "D" ? l.monto : 0,
      credito: l.tipo === "C" ? l.monto : 0,
    }));
    setMovRows(rows.length >= 2 ? rows : [...rows, { ...emptyRow }]);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={form.tipo_comprobante === "AP" ? "Asiento de Apertura" : "Nuevo asiento contable"} wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded border hover:bg-gray-50" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit" form="asiento-form"
              disabled={((form.tipo_comprobante !== "AP" && !balanceOk) || isPending)}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isPending ? "Creando…" : "Crear asiento"}
            </button>
          </div>
        }>

        {form.tipo_comprobante !== "AP" && <PlantillaLoader empresaId={empresaId} onLoad={onLoadPlantilla} />}

        <form id="asiento-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Tipo de Comprobante */}
            <div>
              <label className="block text-sm mb-1">Tipo Comprobante</label>
              <select className="border rounded px-3 py-2 w-full" value={form.tipo_comprobante}
                onChange={changeHdr("tipo_comprobante")} required>
                {TIPOS_COMPROBANTE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm mb-1">Fecha</label>
              {(() => {
                                return (
                  <input type="date" className="border rounded px-3 py-2 w-full"
                    value={form.fecha}
                    
                    onChange={changeHdr("fecha")} required
                  />
                );
              })()}
              {form.tipo_comprobante !== "AP" && <label className="flex items-center gap-2 mt-2 text-xs text-amber-700 cursor-pointer">
                <input type="checkbox" checked={form.es_ajuste}
                  onChange={e => setForm(f => ({ ...f, es_ajuste: e.target.checked }))}
                  className="rounded border-gray-300" />
                📋 Ajuste fiscal (Mes 13)
              </label>}
            </div>

            {/* Tercero principal */}
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Tercero principal</label>
              <div className="flex gap-2">
                <select className="border rounded px-3 py-2 w-full"
                  value={form.tercero_id || ""} onChange={changeHdr("tercero_id")} required={form.tipo_comprobante !== "AP"}>
                  <option value="">Seleccione…</option>
                  {terceros.map(t => <option key={t.id} value={t.id}>{t.numero_documento} — {t.nombre}</option>)}
                </select>
                <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpenTercero(true)}>+</button>
              </div>
            </div>

            {/* Concepto */}
            <div className="md:col-span-4">
              <label className="block text-sm mb-1">Concepto</label>
              <input className="border rounded px-3 py-2 w-full"
                value={form.concepto} onChange={changeHdr("concepto")}
                placeholder="Ej: Venta contado" required
              />
            </div>
          </div>

          {/* Descripción adicional */}
          <div className="md:col-span-4">
            <label className="block text-sm mb-1">Descripción adicional (opcional)</label>
            <textarea className="border rounded px-3 py-2 w-full" rows={2}
              value={form.descripcion_adicional || ""}
              onChange={changeHdr("descripcion_adicional")}
              placeholder="Notas, referencias, glosa..."
            />
          </div>

          {/* Movimientos */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Cuenta (código)</th>
                  <th className="p-2">Tercero (línea)</th>
                  <th className="p-2">Débito</th>
                  <th className="p-2">Crédito</th>
                  <th className="p-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {movRows.map((r, i) => {
                  const sugeridas = r.cuenta ? matchCuentas(r.cuenta).slice(0, 5) : [];
                  const nat = naturalezaEsperada(r.cuenta);
                  const debVal = Number(r.debito) || 0;
                  const creVal = Number(r.credito) || 0;
                  const codigoValido = cuentaCodes.has(String(r.cuenta));
                  const mostrarAviso = codigoValido && ((nat === "C" && debVal > 0) || (nat === "D" && creVal > 0));

                  return (
                    <tr key={i} className="border-t">
                      {/* Cuenta */}
                      <td className="p-2 align-top">
                        <div className="flex gap-1">
                          <input
                            className={`border rounded px-3 py-2 w-full ${rowErrors[i]?.code ? "border-red-400 focus:ring-red-300" : ""}`}
                            placeholder="110505, 1305…"
                            value={r.cuenta} onChange={changeRow(i, "cuenta")}
                            list={`cuentas-sug-${i}`} required
                          />
                          <button type="button"
                            className="px-2 py-1 rounded border text-xs text-indigo-600 hover:bg-indigo-50 shrink-0"
                            onClick={() => setOpenCuenta(true)} title="Crear nueva cuenta"
                          >+</button>
                        </div>
                        {codigoValido && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate"
                            title={cuentas.find(c => String(c.codigo) === String(r.cuenta))?.nombre}>
                            {cuentas.find(c => String(c.codigo) === String(r.cuenta))?.nombre}
                          </div>
                        )}
                        {rowErrors[i]?.code && (
                          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1">
                            {rowErrors[i].code}
                          </div>
                        )}
                        {mostrarAviso && (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1 inline-block">
                            {nat === "C"
                              ? "Cuenta de INGRESO (4): usualmente va en CRÉDITO."
                              : "Cuenta de GASTO (5): usualmente va en DÉBITO."
                            } (no bloquea)
                          </div>
                        )}
                        <datalist id={`cuentas-sug-${i}`}>
                          {sugeridas.map(c => (
                            <option key={c.id || c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                          ))}
                        </datalist>
                      </td>

                      {/* Tercero por línea */}
                      <td className="p-2 align-top">
                        <select className="border rounded px-2 py-2 w-full text-xs"
                          value={r.tercero_id || ""} onChange={changeRow(i, "tercero_id")}>
                          <option value="">— del asiento —</option>
                          {terceros.map(t => <option key={t.id} value={t.id}>{t.numero_documento} — {t.nombre}</option>)}
                        </select>
                      </td>

                      {/* Débito */}
                      <td className="p-2">
                        <input type="text" inputMode="decimal"
                          className="border rounded px-3 py-2 w-full text-right" placeholder="0"
                          value={r.debito}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (i % 2 === 0 && movRows[i]?.enlazada) {
                              setMovRows(rows => rows.map((x, idx) => {
                                if (idx === i) return { ...x, debito: v };
                                if (idx === i + 1) return { ...x, credito: v, debito: 0 };
                                return x;
                              }));
                            } else {
                              setMovRows(rows => rows.map((x, idx) => idx === i ? { ...x, debito: v } : x));
                            }
                          }}
                          onBlur={() => {
                            const v = evalExpr(r.debito);
                            if (i % 2 === 0 && movRows[i]?.enlazada) {
                              setMovRows(rows => rows.map((x, idx) => {
                                if (idx === i) return { ...x, debito: v };
                                if (idx === i + 1) return { ...x, credito: v, debito: 0 };
                                return x;
                              }));
                            } else {
                              setMovRows(rows => rows.map((x, idx) =>
                                idx === i ? { ...x, debito: v, credito: v > 0 ? 0 : x.credito } : x
                            ));
                            }
                          }}
                          disabled={Number(r.credito) > 0 || (i % 2 === 1 && movRows[i - 1]?.enlazada)}
                        />
                      </td>

                      {/* Crédito */}
                      <td className="p-2">
                        <input type="text" inputMode="decimal"
                          className="border rounded px-3 py-2 w-full text-right" placeholder="0"
                          value={r.credito}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (i % 2 === 0 && movRows[i]?.enlazada) {
                              setMovRows(rows => rows.map((x, idx) => {
                                if (idx === i) return { ...x, credito: v };
                                if (idx === i + 1) return { ...x, debito: v, credito: 0 };
                                return x;
                              }));
                            } else {
                              setMovRows(rows => rows.map((x, idx) => idx === i ? { ...x, credito: v } : x));
                            }
                          }}
                          onBlur={() => {
                            const v = evalExpr(r.credito);
                            if (i % 2 === 0 && movRows[i]?.enlazada) {
                              setMovRows(rows => rows.map((x, idx) => {
                                if (idx === i) return { ...x, credito: v };
                                if (idx === i + 1) return { ...x, debito: v, credito: 0 };
                                return x;
                              }));
                            } else {
                              setMovRows(rows => rows.map((x, idx) =>
                                idx === i ? { ...x, credito: v, debito: v > 0 ? 0 : x.debito } : x
                            ));
                            }
                          }}
                          disabled={Number(r.debito) > 0 || (i % 2 === 1 && movRows[i - 1]?.enlazada)}
                        />
                      </td>

                      {/* Eliminar */}
                      <td className="p-2 text-right">
                        <button type="button"
                            className={`px-1 py-1 rounded border text-xs ${i % 2 === 0 ? (r.enlazada ? "bg-emerald-100 border-emerald-400 text-emerald-700" : "text-gray-400 hover:text-gray-600") : "opacity-30 cursor-not-allowed"}`}
                            onClick={() => toggleLink(Math.floor(i / 2) * 2)}
                            disabled={i % 2 !== 0}
                            title={r.enlazada ? "Desenlazar par" : "Enlazar con fila siguiente (mirror)"}
                          >↔</button>
                        <button type="button"
                          className={`px-2 py-1 rounded border ${(form.tipo_comprobante === "AP" ? movRows.length <= 1 : movRows.length <= 2) ? "opacity-50 cursor-not-allowed" : ""}`}
                          onClick={() => delRow(i)} disabled={(form.tipo_comprobante === "AP" ? movRows.length <= 1 : movRows.length <= 2)}
                          title={(form.tipo_comprobante === "AP" ? movRows.length <= 1 : movRows.length <= 2) ? "Mínimo 1 fila" : "Eliminar fila"}
                        >×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={5}>
                  <p className="w-full mt-2 text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-3 py-2">
                    Cada línea puede tener su propio tercero. Si se deja vacío, hereda el tercero principal del asiento.
                  </p>
                </td></tr>
                <tr className="border-t bg-gray-50">
                  <td className="p-2">
                    {form.tipo_comprobante === "AP" && !balanceOk && movRows.length > 0 && (
                      <button type="button" onClick={() => {
                        const diff = totalDeb - totalCred;
                        if (diff === 0) return;
                        const codigo3705 = cuentaCodes.has("370505") ? "370505" : [...cuentaCodes].find(c => c.startsWith("3705")) || "";
                        if (!codigo3705) { alert("No se encontró cuenta 3705xx en el PUC"); return; }
                        if (diff > 0) {
                          setMovRows(rows => [...rows, { cuenta: codigo3705, tercero_id: "", debito: 0, credito: diff }]);
                        } else {
                          setMovRows(rows => [...rows, { cuenta: codigo3705, tercero_id: "", debito: Math.abs(diff), credito: 0 }]);
                        }
                      }} className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs mb-1" title="Lleva la diferencia a Resultado del ejercicio anterior (370505)">
                        Cuadrar → 370505 ({fmtMoney(totalDeb - totalCred)})
                      </button>
                    )}
                    <button type="button" onClick={addRow} className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">
                      Agregar fila
                    </button>
                  </td>
                  <td className="p-2"></td>
                  <td className="p-2 font-medium">{fmtMoney(totalDeb)}</td>
                  <td className="p-2 font-medium">{fmtMoney(totalCred)}</td>
                  <td className="p-2 text-right">
                    <span className={`text-xs ${balanceOk ? "text-green-700" : "text-red-700"}`}>
                      {balanceOk ? "Cuadra" : "No cuadra"}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {serverError && (
            <div className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 whitespace-pre-line">
              {serverError}
            </div>
          )}

          {form.tipo_comprobante !== "AP" && <div className="col-span-full w-full">
            <p className="mt-2 text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-3 py-2">
              {textoPeriodo}
            </p>
          </div>}
        </form>
      </Modal>

      {/* Sub-modals */}
      <TerceroQuickModal
        open={openTercero}
        onClose={() => setOpenTercero(false)}
        onCreated={(t) => setForm(s => ({ ...s, tercero_id: t.id }))}
        empresaId={empresaId}
      />
      <CuentaFormModal
        open={openCuenta}
        onClose={() => setOpenCuenta(false)}
        empresaId={empresaId}
        editingCuenta={null}
      />
    </>
  );
}
