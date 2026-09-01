// Don Peppini - Modal Saldos Iniciales
import { useState, useRef } from "react";
import { Database, AlertCircle, CheckCircle, Upload, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "../ui/ToastHost";
import Modal from "./Modal";

export default function SaldosInicialesModal({ isOpen, onClose, empresaId, onSuccess }) {
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState('upload'); // upload | preview | result
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    }).format(value);
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setStep('upload');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handlePreview = async () => {
    if (!file || !empresaId || !anio) {
      setError('Seleccione empresa, ano y archivo');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { api } = await import("../services/api");
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('empresa_id', empresaId);
      formData.append('anio', parseInt(anio));
      formData.append('preview', 'true');
      const { data } = await api.post('/contabilidad/saldos-iniciales/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !empresaId || !anio) return;
    setLoading(true);
    setError(null);
    try {
      const { api } = await import("../services/api");
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('empresa_id', empresaId);
      formData.append('anio', parseInt(anio));
      formData.append('preview', 'false');
      const { data } = await api.post('/contabilidad/saldos-iniciales/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast(data.mensaje || 'Saldos iniciales generados');
      setStep('result');
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar saldos');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPlantilla = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['codigo', 'nombre_cuenta', 'valor']]);
      ws['!cols'] = [{wch: 15}, {wch: 50}, {wch: 20}];
      XLSX.utils.book_append_sheet(wb, ws, 'Saldos Iniciales');
      XLSX.writeFile(wb, 'plantilla_saldos_iniciales.xlsx');
    } catch (err) {
      console.error('Error descargando plantilla:', err);
      toast('Error al descargar plantilla', 'error');
    }
  };

  if (!isOpen) return null;

  const renderUpload = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
        <p className="font-medium mb-1">Formato requerido: Excel con columnas</p>
        <code className="text-xs">codigo | nombre_cuenta (opcional) | valor</code>
        <p className="text-xs mt-1">Ejemplo: <code>110505 | Caja general | 1500000</code></p>
        <p className="text-xs mt-1">Naturaleza: digito 1 o 5 = Debito, 2/3/4 = Credito. Diferencia a 370505.</p>
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Ano del asiento de apertura</label>
        <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)}
          className="border rounded px-3 py-2 w-32 font-mono" min="2020" max="2099" />
        <span className="text-xs text-gray-500 ml-2">Fecha: 01/01/{anio}</span>
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Archivo Excel</label>
        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-indigo-400 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}>
          <input type="file" ref={fileRef} accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setError(null); }} />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700">{file.name}</span>
              <span className="text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
            </div>
          ) : (
            <div className="text-gray-400 text-sm">
              <Upload className="h-8 w-8 mx-auto mb-2" />
              <p>Click para seleccionar o arrastrar archivo Excel</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={handleDownloadPlantilla}
          className="flex items-center px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-600">
          <Download className="h-4 w-4 mr-2" /> Descargar plantilla
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> {error}
        </div>
      )}
    </div>
  );

  const renderPreview = () => {
    if (!preview) return null;
    const { movimientos = [], total_debito, total_credito, diferencia, anio, empresa } = preview;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              <span className="font-bold text-indigo-600">{preview.total_cuentas}</span> cuentas con saldo inicial para <span className="font-bold">{empresa}</span> ({anio})
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left px-3 py-2">Cuenta</th>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-right px-3 py-2">Debito</th>
                <th className="text-right px-3 py-2">Credito</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m, i) => (
                <tr key={i} className={`border-b last:border-0 ${m.es_diferencia ? 'bg-amber-50 italic' : ''}`}>
                  <td className="px-3 py-1.5 font-mono text-xs">{m.codigo}</td>
                  <td className="px-3 py-1.5 text-gray-600">{m.nombre}</td>
                  <td className="px-3 py-1.5 text-right">{m.debito > 0 ? formatCurrency(m.debito) : ''}</td>
                  <td className="px-3 py-1.5 text-right">{m.credito > 0 ? formatCurrency(m.credito) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-medium border-t-2">
                <td colSpan={2} className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{formatCurrency(total_debito)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(total_credito)}</td>
              </tr>
              {Math.abs(diferencia) > 0.01 && (
                <tr className="bg-amber-50 text-sm">
                  <td colSpan={2} className="px-3 py-2">Diferencia a 370505</td>
                  <td className="px-3 py-2 text-right">{diferencia > 0 ? formatCurrency(diferencia) : ''}</td>
                  <td className="px-3 py-2 text-right">{diferencia < 0 ? formatCurrency(Math.abs(diferencia)) : ''}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {preview.errores?.length > 0 && (
          <div className="bg-amber-50 text-amber-700 px-4 py-3 rounded-lg text-sm">
            {preview.errores.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}
      </div>
    );
  };

  const renderResult = () => (
    <div className="text-center py-8">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Saldos iniciales generados</h3>
      <p className="text-gray-600 mb-4">
        El asiento de apertura AP fue creado para el ano {anio}
      </p>
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Saldos Iniciales"
      footer={
        <div className="flex justify-end gap-2">
          {step === 'upload' && (
            <>
              <button className="px-3 py-2 rounded border" onClick={handleClose}>Cancelar</button>
              <button className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
                disabled={loading || !file} onClick={handlePreview}>
                {loading ? 'Procesando...' : 'Vista previa'}
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button className="px-3 py-2 rounded border" onClick={() => setStep('upload')}>Volver</button>
              <button className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
                disabled={loading} onClick={handleImport}>
                {loading ? 'Generando...' : 'Generar asiento AP'}
              </button>
            </>
          )}
          {step === 'result' && (
            <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={handleClose}>Cerrar</button>
          )}
        </div>
      }
    >
      {step === 'upload' && renderUpload()}
      {step === 'preview' && renderPreview()}
      {step === 'result' && renderResult()}
    </Modal>
  );
}
