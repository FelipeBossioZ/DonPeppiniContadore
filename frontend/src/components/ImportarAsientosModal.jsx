// 🎩 Don Peppini Contadore - Importador de Asientos Excel
// frontend/src/components/ImportarAsientosModal.jsx

import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const ImportarAsientosModal = ({ isOpen, onClose, onSuccess }) => {
  const { empresaActual, empresaId } = useEmpresa();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState('upload'); // upload, preview, result

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setPreview(null);
      setResult(null);
      setStep('upload');
    }
  };

  const handlePreview = async () => {
    if (!file || !empresaId) return;
    
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('empresa', empresaId);
    formData.append('preview', 'true');
    
    try {
      const response = await api.post('/contabilidad/importar-asientos/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.error) {
        setError(response.data.error);
      } else {
        setPreview(response.data);
        setStep('preview');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !empresaId) return;
    
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('empresa', empresaId);
    formData.append('preview', 'false');
    
    try {
      const response = await api.post('/contabilidad/importar-asientos/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.error) {
        setError(response.data.error);
      } else {
        setResult(response.data);
        setStep('result');
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al importar');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep('upload');
    onClose();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Importar Asientos desde Excel
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-sm text-gray-600">
                Empresa: <span className="font-medium text-gray-900">{empresaActual?.razon_social}</span>
              </div>
              
              {/* Drop zone */}
              <label className="block">
                <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  file ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                }`}>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {file ? (
                    <div className="space-y-2">
                      <FileSpreadsheet className="h-12 w-12 text-indigo-600 mx-auto" />
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                      <p className="font-medium text-gray-700">
                        Arrastra un archivo Excel aquí
                      </p>
                      <p className="text-sm text-gray-500">
                        o haz clic para seleccionar (.xlsx, .xls)
                      </p>
                    </div>
                  )}
                </div>
              </label>

              {/* Formato esperado */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">📋 Formato esperado:</h3>
                <div className="overflow-x-auto">
                  <table className="text-sm w-full">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="pr-4 pb-2">Fecha</th>
                        <th className="pr-4 pb-2">Código</th>
                        <th className="pr-4 pb-2">Concepto</th>
                        <th className="pr-4 pb-2">Débito</th>
                        <th className="pb-2">Crédito</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      <tr>
                        <td className="pr-4 py-1">2025-01-15</td>
                        <td className="pr-4 py-1">110505</td>
                        <td className="pr-4 py-1">Aporte capital</td>
                        <td className="pr-4 py-1">100,000,000</td>
                        <td className="py-1">0</td>
                      </tr>
                      <tr>
                        <td className="pr-4 py-1"></td>
                        <td className="pr-4 py-1">310505</td>
                        <td className="pr-4 py-1"></td>
                        <td className="pr-4 py-1">0</td>
                        <td className="py-1">100,000,000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Cada vez que aparece una fecha, se crea un nuevo asiento. Los movimientos sin fecha pertenecen al asiento anterior.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    Se encontraron <span className="font-bold text-indigo-600">{preview.total_asientos}</span> asientos 
                    con <span className="font-bold">{preview.total_movimientos}</span> movimientos
                  </p>
                </div>
              </div>

              {/* Lista de asientos */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {preview.asientos.map((asiento, idx) => (
                  <div key={idx} className={`border rounded-lg overflow-hidden ${
                    asiento.cuadra ? 'border-gray-200' : 'border-red-300 bg-red-50'
                  }`}>
                    <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">
                          {asiento.fecha}
                        </span>
                        <span className="text-sm text-gray-600">
                          {asiento.concepto}
                        </span>
                      </div>
                      {asiento.cuadra ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <span className="text-xs text-red-600 font-medium">No cuadra</span>
                      )}
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b">
                          <th className="text-left px-4 py-2">Cuenta</th>
                          <th className="text-right px-4 py-2">Débito</th>
                          <th className="text-right px-4 py-2">Crédito</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asiento.movimientos.map((mov, mIdx) => (
                          <tr key={mIdx} className={`border-b last:border-0 ${
                            mov.valido ? '' : 'bg-red-50'
                          }`}>
                            <td className="px-4 py-2">
                              <span className="font-mono text-xs">{mov.cuenta_codigo}</span>
                              <span className="ml-2 text-gray-600">{mov.cuenta_nombre}</span>
                            </td>
                            <td className="text-right px-4 py-2">
                              {mov.debito > 0 ? formatCurrency(mov.debito) : ''}
                            </td>
                            <td className="text-right px-4 py-2">
                              {mov.credito > 0 ? formatCurrency(mov.credito) : ''}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-medium">
                          <td className="px-4 py-2">TOTAL</td>
                          <td className="text-right px-4 py-2">{formatCurrency(asiento.total_debito)}</td>
                          <td className="text-right px-4 py-2">{formatCurrency(asiento.total_credito)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step: Result */}
          {step === 'result' && result && (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                ¡Importación exitosa!
              </h3>
              <p className="text-gray-600 mb-4">
                Se crearon <span className="font-bold text-indigo-600">{result.asientos_creados}</span> asientos 
                con <span className="font-bold">{result.movimientos_creados}</span> movimientos
              </p>
              {result.errores?.length > 0 && (
                <div className="bg-amber-50 text-amber-700 px-4 py-3 rounded-lg text-left mt-4">
                  <p className="font-medium mb-2">⚠️ Algunos registros no se importaron:</p>
                  <ul className="text-sm list-disc list-inside">
                    {result.errores.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          {step === 'upload' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Vista Previa
              </button>
            </>
          )}
          
          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar Asientos
              </button>
            </>
          )}
          
          {step === 'result' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportarAsientosModal;
