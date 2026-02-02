// 🎩 Don Peppini Contadore - Medios Magnéticos DIAN
// frontend/src/pages/MediosMagneticos.jsx

import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Building2,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileText,
  Info
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const FORMATOS = [
  { codigo: '1001', nombre: 'Pagos y retenciones practicadas', version: 10, descripcion: 'Pagos a terceros y retenciones que practicó la empresa' },
  { codigo: '1003', nombre: 'Retenciones que le practicaron', version: 7, descripcion: 'Retenciones que otros le practicaron a la empresa' },
  { codigo: '1005', nombre: 'IVA Descontable', version: 8, descripcion: 'IVA pagado en compras' },
  { codigo: '1006', nombre: 'IVA Generado', version: 8, descripcion: 'IVA cobrado en ventas' },
  { codigo: '1007', nombre: 'Ingresos Recibidos', version: 9, descripcion: 'Ingresos por tercero' },
  { codigo: '1008', nombre: 'Cuentas por Cobrar', version: 7, descripcion: 'Saldo de deudores al 31/12' },
  { codigo: '1009', nombre: 'Cuentas por Pagar', version: 7, descripcion: 'Saldo de acreedores al 31/12' },
  { codigo: '1012', nombre: 'Inversiones y Cuentas', version: 7, descripcion: 'Cuentas de ahorro, inversiones' },
  { codigo: '2276', nombre: 'Rentas de Trabajo', version: 2, descripcion: 'Información de nómina (empleados)' },
];

export default function MediosMagneticos() {
  const { empresaActual, empresaId } = useEmpresa();
  const [año, setAño] = useState(new Date().getFullYear() - 1); // Año anterior por defecto
  const [loading, setLoading] = useState(false);
  const [loadingFormato, setLoadingFormato] = useState(null);
  const [error, setError] = useState(null);
  const [previews, setPreviews] = useState({});

  const años = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  // Descargar todos los formatos en Excel
  const descargarTodos = async () => {
    if (!empresaId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/contabilidad/medios-magneticos/', {
        params: {
          empresa: empresaId,
          year: año,
          
        },
        responseType: 'blob'
      });
      
      // Crear link de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `MediosMagneticos_${empresaActual?.nit}_${año}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError('Error al descargar los medios magnéticos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Ver preview de un formato
  const verPreview = async (formato) => {
    if (!empresaId) return;
    
    setLoadingFormato(formato);
    
    try {
      const response = await api.get('/contabilidad/medios-magneticos/', {
        params: {
          empresa: empresaId,
          year: año,
          formato: formato
        }
      });
      
      setPreviews(prev => ({
        ...prev,
        [formato]: response.data
      }));
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFormato(null);
    }
  };

  // Si no hay empresa seleccionada
  if (!empresaActual) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Building2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Selecciona una empresa para generar Medios Magnéticos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <span>🎩</span> Medios Magnéticos DIAN
        </h1>
        <p className="text-gray-600 mt-1">
          {empresaActual.razon_social} • NIT {empresaActual.nit}
        </p>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline h-4 w-4 mr-1" />
              Año Gravable
            </label>
            <select
              value={año}
              onChange={(e) => {
                setAño(parseInt(e.target.value));
                setPreviews({});
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              {años.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={descargarTodos}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Descargar Todo en Excel
          </button>
        </div>
        
        {error && (
          <div className="mt-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Instrucciones:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Descarga el archivo Excel con todos los formatos</li>
              <li>Revisa cada hoja y completa los datos faltantes si es necesario</li>
              <li>Copia los datos al prevalidador de la DIAN</li>
              <li>Valida y genera el archivo XML para presentar</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Lista de Formatos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Formatos Disponibles</h2>
        </div>
        
        <div className="divide-y divide-gray-100">
          {FORMATOS.map(formato => (
            <div key={formato.codigo} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {formato.codigo}
                    </span>
                    <span className="font-medium text-gray-900">{formato.nombre}</span>
                    <span className="text-xs text-gray-500">v{formato.version}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{formato.descripcion}</p>
                  
                  {/* Preview */}
                  {previews[formato.codigo] && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {previews[formato.codigo].total_registros > 0 ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-sm font-medium">
                          {previews[formato.codigo].total_registros} registros encontrados
                        </span>
                      </div>
                      
                      {previews[formato.codigo].total_registros > 0 && (
                        <div className="overflow-x-auto">
                          <table className="text-xs w-full">
                            <thead>
                              <tr className="text-left text-gray-500">
                                {previews[formato.codigo].columnas.slice(0, 5).map((col, i) => (
                                  <th key={i} className="pr-3 pb-1 font-medium">{col}</th>
                                ))}
                                <th className="pb-1">...</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previews[formato.codigo].registros.slice(0, 3).map((reg, i) => (
                                <tr key={i} className="text-gray-700">
                                  {Object.values(reg).slice(0, 5).map((val, j) => (
                                    <td key={j} className="pr-3 py-1 truncate max-w-[120px]">
                                      {typeof val === 'number' ? val.toLocaleString() : val || '-'}
                                    </td>
                                  ))}
                                  <td className="py-1 text-gray-400">...</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {previews[formato.codigo].total_registros > 3 && (
                            <p className="text-xs text-gray-500 mt-1">
                              + {previews[formato.codigo].total_registros - 3} registros más...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => verPreview(formato.codigo)}
                  disabled={loadingFormato === formato.codigo}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  {loadingFormato === formato.codigo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {previews[formato.codigo] ? 'Actualizar' : 'Ver datos'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nota sobre terceros */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Importante:</p>
            <p>
              Para que los formatos queden completos, asegúrate de que los Terceros tengan 
              registrados: <strong>Primer apellido, Segundo apellido, Primer nombre, Otros nombres</strong> (para personas naturales), 
              <strong>Código de departamento y municipio DANE</strong>, y <strong>Dirección</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
