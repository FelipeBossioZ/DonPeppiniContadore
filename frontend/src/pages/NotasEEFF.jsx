// 🎩 Don Peppini Contadore - Notas a Estados Financieros
// frontend/src/pages/NotasEEFF.jsx

import React, { useState, useEffect } from 'react';
import { 
  Building2, FileText, Download, Loader2, AlertCircle, CheckCircle, 
  X, Calendar, Edit3, Eye, Save, RefreshCw, ChevronRight, Zap,
  FileSpreadsheet, BookOpen, Check, Trash2
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const TIPOS_NOTA = {
  general: { nombre: 'Información General', icon: '🏢', color: 'blue' },
  politicas: { nombre: 'Políticas Contables', icon: '📋', color: 'purple' },
  efectivo: { nombre: 'Efectivo y Equivalentes', icon: '💵', color: 'green' },
  cuentas_cobrar: { nombre: 'Cuentas por Cobrar', icon: '📥', color: 'cyan' },
  inventarios: { nombre: 'Inventarios', icon: '📦', color: 'orange' },
  propiedad_planta: { nombre: 'Propiedad, Planta y Equipo', icon: '🏭', color: 'slate' },
  intangibles: { nombre: 'Activos Intangibles', icon: '💡', color: 'violet' },
  cuentas_pagar: { nombre: 'Cuentas por Pagar', icon: '📤', color: 'red' },
  obligaciones: { nombre: 'Obligaciones Financieras', icon: '🏦', color: 'amber' },
  impuestos: { nombre: 'Impuestos', icon: '🧾', color: 'rose' },
  provisiones: { nombre: 'Provisiones y Contingencias', icon: '⚠️', color: 'yellow' },
  patrimonio: { nombre: 'Patrimonio', icon: '💎', color: 'emerald' },
  ingresos: { nombre: 'Ingresos Operacionales', icon: '📈', color: 'teal' },
  costos_gastos: { nombre: 'Costos y Gastos', icon: '📉', color: 'pink' },
  partes_relacionadas: { nombre: 'Partes Relacionadas', icon: '🤝', color: 'indigo' },
  hechos_posteriores: { nombre: 'Hechos Posteriores', icon: '📅', color: 'gray' },
  otras: { nombre: 'Otras Revelaciones', icon: '📝', color: 'zinc' },
};

export default function NotasEEFF() {
  const { empresaActual, empresaId } = useEmpresa();
  
  const [año, setAño] = useState(new Date().getFullYear() - 1);
  const [notas, setNotas] = useState([]);
  const [notaSeleccionada, setNotaSeleccionada] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [contenidoEditado, setContenidoEditado] = useState('');
  const [tituloEditado, setTituloEditado] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [loadingAccion, setLoadingAccion] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (empresaId && año) {
      cargarNotas();
    }
  }, [empresaId, año]);

  const cargarNotas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/contabilidad/notas-eeff/', {
        params: { empresa: empresaId, año }
      });
      setNotas(res.data.notas || []);
    } catch (err) {
      console.error(err);
      setNotas([]);
    } finally {
      setLoading(false);
    }
  };

  const generarNotas = async () => {
    setLoadingAccion(true);
    setError(null);
    try {
      const res = await api.post('/contabilidad/notas-eeff/generar/', {
        empresa: empresaId,
        año
      });
      setSuccess(res.data.mensaje);
      cargarNotas();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar notas');
    } finally {
      setLoadingAccion(false);
    }
  };

  const seleccionarNota = (nota) => {
    setNotaSeleccionada(nota);
    setContenidoEditado(nota.contenido || '');
    setTituloEditado(nota.titulo || '');
    setModoEdicion(false);
  };

  const guardarNota = async () => {
    if (!notaSeleccionada) return;
    
    setLoadingAccion(true);
    try {
      await api.put(`/contabilidad/notas-eeff/${notaSeleccionada.id}/`, {
        titulo: tituloEditado,
        contenido: contenidoEditado,
      });
      
      setSuccess('Nota guardada correctamente');
      setModoEdicion(false);
      
      // Actualizar en la lista local
      setNotas(prev => prev.map(n => 
        n.id === notaSeleccionada.id 
          ? { ...n, titulo: tituloEditado, contenido: contenidoEditado }
          : n
      ));
      setNotaSeleccionada(prev => ({ ...prev, titulo: tituloEditado, contenido: contenidoEditado }));
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Error al guardar');
    } finally {
      setLoadingAccion(false);
    }
  };

  const exportarWord = async () => {
    setLoadingAccion(true);
    try {
      const res = await api.get('/contabilidad/notas-eeff/exportar-word/', {
        params: { empresa: empresaId, año },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Notas_EEFF_${año}.docx`;
      link.click();
      link.remove();
      
      setSuccess('Documento Word descargado');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Error al exportar a Word');
    } finally {
      setLoadingAccion(false);
    }
  };

  const exportarPDF = async () => {
    setLoadingAccion(true);
    try {
      const res = await api.get('/contabilidad/notas-eeff/exportar-pdf/', {
        params: { empresa: empresaId, año },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Notas_EEFF_${año}.pdf`;
      link.click();
      link.remove();
      
      setSuccess('PDF descargado');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Error al exportar a PDF');
    } finally {
      setLoadingAccion(false);
    }
  };

  // Renderizar contenido con formato básico
  const renderContenido = (contenido) => {
    if (!contenido) return null;
    
    // Convertir markdown básico a HTML
    let html = contenido
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/### (.*?)$/gm, '<h4 class="font-semibold text-gray-800 mt-4 mb-2">$1</h4>')
      .replace(/## (.*?)$/gm, '<h3 class="font-bold text-gray-900 mt-4 mb-2">$1</h3>')
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, '<br/>');
    
    // Detectar tablas
    if (html.includes('|')) {
      const lineas = html.split('<br/>');
      let enTabla = false;
      let tablaHtml = '';
      let resultado = [];
      
      for (const linea of lineas) {
        if (linea.includes('|') && linea.trim().startsWith('|')) {
          if (!enTabla) {
            enTabla = true;
            tablaHtml = '<table class="w-full border-collapse my-4 text-sm">';
          }
          
          if (linea.includes('---')) continue; // Separador
          
          const celdas = linea.split('|').filter(c => c.trim());
          const esHeader = !tablaHtml.includes('<tbody>');
          
          if (esHeader) {
            tablaHtml += '<thead class="bg-gray-100"><tr>';
            celdas.forEach(c => {
              tablaHtml += `<th class="border px-3 py-2 text-left font-semibold">${c.trim()}</th>`;
            });
            tablaHtml += '</tr></thead><tbody>';
          } else {
            tablaHtml += '<tr>';
            celdas.forEach((c, i) => {
              const align = i > 0 ? 'text-right' : '';
              tablaHtml += `<td class="border px-3 py-2 ${align}">${c.trim()}</td>`;
            });
            tablaHtml += '</tr>';
          }
        } else {
          if (enTabla) {
            tablaHtml += '</tbody></table>';
            resultado.push(tablaHtml);
            enTabla = false;
            tablaHtml = '';
          }
          resultado.push(linea);
        }
      }
      
      if (enTabla) {
        tablaHtml += '</tbody></table>';
        resultado.push(tablaHtml);
      }
      
      html = resultado.join('<br/>');
    }
    
    return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (!empresaActual) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Building2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Selecciona una empresa para continuar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <span>🎩</span> Notas a los Estados Financieros
        </h1>
        <p className="text-gray-600 mt-1">{empresaActual.razon_social} • NIIF para Pymes</p>
      </div>

      {/* Alertas */}
      {error && (
        <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />{success}
        </div>
      )}

      {/* Barra de acciones */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                Año
              </label>
              <select
                value={año}
                onChange={(e) => setAño(parseInt(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 font-semibold"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            
            <div className="text-sm text-gray-500">
              {notas.length} notas para el año {año}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={generarNotas}
              disabled={loadingAccion}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loadingAccion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Generar Automático
            </button>
            
            <button
              onClick={exportarWord}
              disabled={loadingAccion || notas.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              title="Exportar a Word"
            >
              <FileText className="h-4 w-4" />
              Word
            </button>
            
            <button
              onClick={exportarPDF}
              disabled={loadingAccion || notas.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              title="Exportar a PDF"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de notas */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                Índice de Notas
              </h2>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
                </div>
              ) : notas.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay notas para este año</p>
                  <p className="text-sm mt-2">Usa "Generar Automático" para crearlas</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notas.map(nota => {
                    const tipoInfo = TIPOS_NOTA[nota.tipo_nota] || { nombre: nota.tipo_nota, icon: '📄', color: 'gray' };
                    const isSelected = notaSeleccionada?.id === nota.id;
                    
                    return (
                      <button
                        key={nota.id}
                        onClick={() => seleccionarNota(nota)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                          isSelected ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                        }`}
                      >
                        <span className="text-xl">{tipoInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            Nota {nota.numero}: {nota.titulo}
                          </div>
                          <div className="text-xs text-gray-500">
                            {tipoInfo.nombre}
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-gray-400 ${isSelected ? 'text-indigo-600' : ''}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editor/Visualizador de nota */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {notaSeleccionada ? (
              <>
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {modoEdicion ? (
                        <input
                          type="text"
                          value={tituloEditado}
                          onChange={(e) => setTituloEditado(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-full"
                        />
                      ) : (
                        `Nota ${notaSeleccionada.numero}: ${notaSeleccionada.titulo}`
                      )}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {modoEdicion ? (
                      <>
                        <button
                          onClick={guardarNota}
                          disabled={loadingAccion}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          {loadingAccion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Guardar
                        </button>
                        <button
                          onClick={() => {
                            setModoEdicion(false);
                            setContenidoEditado(notaSeleccionada.contenido);
                            setTituloEditado(notaSeleccionada.titulo);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                        >
                          <X className="h-4 w-4" />
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setModoEdicion(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                      >
                        <Edit3 className="h-4 w-4" />
                        Editar
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="p-6 max-h-[550px] overflow-y-auto">
                  {modoEdicion ? (
                    <textarea
                      value={contenidoEditado}
                      onChange={(e) => setContenidoEditado(e.target.value)}
                      className="w-full h-[450px] border border-gray-300 rounded-lg p-4 font-mono text-sm resize-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Escribe el contenido de la nota en formato Markdown..."
                    />
                  ) : (
                    <div className="text-gray-700">
                      {renderContenido(notaSeleccionada.contenido)}
                    </div>
                  )}
                </div>
                
                {modoEdicion && (
                  <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                    <div className="text-xs text-blue-800">
                      <strong>Formato:</strong> Usa **texto** para negrita, ### para subtítulos, 
                      y tablas con | columna1 | columna2 |
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <Eye className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Selecciona una nota del índice para ver o editar su contenido</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info NIIF */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <BookOpen className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Notas según NIIF para Pymes</p>
            <p className="mt-1">
              Las notas son parte integral de los estados financieros y deben incluir información sobre 
              las bases de preparación, políticas contables significativas, y revelaciones requeridas 
              por la Sección 8 de NIIF para Pymes. El sistema genera automáticamente las notas con los 
              saldos de tu contabilidad.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
