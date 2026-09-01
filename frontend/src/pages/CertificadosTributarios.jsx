// 🎩 Don Peppini Contadore - Certificados Tributarios
// frontend/src/pages/CertificadosTributarios.jsx

import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Building2, Calendar, Loader2, 
  AlertCircle, CheckCircle, Info, Search, User, Briefcase
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const TIPOS_CERTIFICADO = [
  { 
    id: 'retencion_fuente', 
    nombre: 'Retención en la Fuente', 
    descripcion: 'Certificado de retenciones practicadas a proveedores y contratistas',
    icon: Briefcase,
    color: 'indigo'
  },
  { 
    id: 'retencion_iva', 
    nombre: 'Retención de IVA', 
    descripcion: 'Certificado de retención de IVA practicado (15%)',
    icon: FileText,
    color: 'emerald'
  },
  { 
    id: 'ingresos_retenciones', 
    nombre: 'Ingresos y Retenciones (220)', 
    descripcion: 'Certificado para empleados - Declaración de renta',
    icon: User,
    color: 'amber'
  },
];

export default function CertificadosTributarios() {
  const { empresaActual, empresaId } = useEmpresa();
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [tipoSeleccionado, setTipoSeleccionado] = useState('retencion_fuente');
  const [terceros, setTerceros] = useState([]);
  const [terceroSeleccionado, setTerceroSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTerceros, setLoadingTerceros] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  // Cargar terceros cuando cambia el tipo o año
  useEffect(() => {
    if (empresaId && year && tipoSeleccionado) {
      cargarTerceros();
    }
  }, [empresaId, year, tipoSeleccionado]);

  const cargarTerceros = async () => {
    setLoadingTerceros(true);
    setTerceroSeleccionado(null);
    setError(null);
    
    try {
      const response = await api.get('/contabilidad/certificados/terceros/', {
        params: { empresa: empresaId, year, tipo: tipoSeleccionado }
      });
      setTerceros(response.data.terceros || []);
    } catch (err) {
      console.error(err);
      setTerceros([]);
    } finally {
      setLoadingTerceros(false);
    }
  };

  const descargarCertificado = async () => {
    if (!terceroSeleccionado) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const response = await api.get('/contabilidad/certificados/', {
        params: {
          empresa: empresaId,
          year,
          tercero: terceroSeleccionado.id,
          tipo: tipoSeleccionado
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const tipoNombre = TIPOS_CERTIFICADO.find(t => t.id === tipoSeleccionado)?.nombre || 'Certificado';
      link.setAttribute('download', `${tipoNombre.replace(/ /g, '_')}_${terceroSeleccionado.documento}_${year}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
    } catch (err) {
      setError('Error al generar el certificado');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar terceros por búsqueda
  const tercerosFiltrados = terceros.filter(t => 
    t.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    t.documento.includes(busqueda)
  );

  if (!empresaActual) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Building2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Selecciona una empresa para generar certificados</p>
        </div>
      </div>
    );
  }

  const tipoActual = TIPOS_CERTIFICADO.find(t => t.id === tipoSeleccionado);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Banner en construcción */}
      <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <span className="text-2xl">🚧</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Módulo en construcción</p>
          <p className="text-xs text-amber-600">Certificado de retención en la fuente (220), certificado de IVA, certificado de ingresos y retenciones (formato 2276), PDF descargable.</p>
        </div>
      </div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <span>🎩</span> Certificados Tributarios
        </h1>
        <p className="text-gray-600 mt-1">
          {empresaActual.razon_social} • NIT {empresaActual.nit}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo - Configuración */}
        <div className="lg:col-span-1 space-y-4">
          {/* Selector de año */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Año Gravable
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold focus:ring-2 focus:ring-indigo-500"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Tipos de certificado */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Certificado
            </label>
            <div className="space-y-2">
              {TIPOS_CERTIFICADO.map(tipo => (
                <button
                  key={tipo.id}
                  onClick={() => setTipoSeleccionado(tipo.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    tipoSeleccionado === tipo.id
                      ? `border-${tipo.color}-500 bg-${tipo.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <tipo.icon className={`h-5 w-5 ${
                      tipoSeleccionado === tipo.id ? `text-${tipo.color}-600` : 'text-gray-400'
                    }`} />
                    <div>
                      <div className={`font-medium ${
                        tipoSeleccionado === tipo.id ? `text-${tipo.color}-900` : 'text-gray-700'
                      }`}>
                        {tipo.nombre}
                      </div>
                      <div className="text-xs text-gray-500">{tipo.descripcion}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Artículos E.T.:</p>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Art. 381 - Retención en la fuente</li>
                  <li>• Art. 437-2 - Retención de IVA</li>
                  <li>• Art. 378 - Certificado empleados</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho - Selección de tercero */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-900">
                Seleccionar {tipoSeleccionado === 'ingresos_retenciones' ? 'Empleado' : 'Tercero'}
              </h2>
              <p className="text-sm text-gray-500">
                {terceros.length} {tipoSeleccionado === 'ingresos_retenciones' ? 'empleados' : 'terceros'} con movimientos en {year}
              </p>
            </div>

            {/* Buscador */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o documento..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Lista de terceros */}
            <div className="max-h-96 overflow-y-auto">
              {loadingTerceros ? (
                <div className="p-8 text-center text-gray-500">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Cargando...
                </div>
              ) : tercerosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  {busqueda ? 'No se encontraron resultados' : 'No hay terceros con movimientos para este tipo de certificado'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {tercerosFiltrados.map(tercero => (
                    <button
                      key={tercero.id}
                      onClick={() => setTerceroSeleccionado(tercero)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                        terceroSeleccionado?.id === tercero.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                      }`}
                    >
                      <div>
                        <div className="font-medium text-gray-900">{tercero.nombre}</div>
                        <div className="text-sm text-gray-500">{tercero.documento}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        tercero.tipo === 'Empresa' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {tercero.tipo}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer con botón de descarga */}
            <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
              {error && (
                <div className="mb-3 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-3 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  ¡Certificado descargado exitosamente!
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {terceroSeleccionado ? (
                    <span>
                      Seleccionado: <strong>{terceroSeleccionado.nombre}</strong>
                    </span>
                  ) : (
                    <span className="text-gray-400">Selecciona un tercero</span>
                  )}
                </div>
                
                <button
                  onClick={descargarCertificado}
                  disabled={!terceroSeleccionado || loading}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Descargar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
