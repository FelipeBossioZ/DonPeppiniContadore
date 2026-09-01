// 🎩 Don Peppini Contadore - Indicadores Financieros
// frontend/src/pages/IndicadoresFinancieros.jsx

import React, { useState, useEffect } from 'react';
import { 
  Building2, TrendingUp, Loader2, AlertCircle, Calendar, Download,
  Wallet, CreditCard, Target, Clock, PieChart, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, XCircle, Info, RefreshCw
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

const GRUPOS = {
  liquidez: { nombre: 'Liquidez', icon: Wallet, color: 'blue', descripcion: 'Capacidad de pago a corto plazo' },
  endeudamiento: { nombre: 'Endeudamiento', icon: CreditCard, color: 'amber', descripcion: 'Nivel de deuda y apalancamiento' },
  rentabilidad: { nombre: 'Rentabilidad', icon: TrendingUp, color: 'green', descripcion: 'Capacidad de generar utilidades' },
  actividad: { nombre: 'Actividad', icon: Clock, color: 'purple', descripcion: 'Eficiencia en uso de recursos' },
  ebitda: { nombre: 'EBITDA', icon: Target, color: 'indigo', descripcion: 'Generación de caja operativa' },
};

const COLORES = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', accent: 'bg-blue-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', accent: 'bg-amber-500' },
  green: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', accent: 'bg-green-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', accent: 'bg-purple-500' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', accent: 'bg-indigo-500' },
};

export default function IndicadoresFinancieros() {
  const { empresaActual, empresaId } = useEmpresa();
  
  const [año, setAño] = useState(new Date().getFullYear());
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [grupoExpandido, setGrupoExpandido] = useState('liquidez');

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (empresaId) cargarIndicadores();
  }, [empresaId, año]);

  const cargarIndicadores = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/contabilidad/indicadores/', {
        params: { empresa: empresaId, año }
      });
      setDatos(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar indicadores');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (val) => `$${Math.abs(val || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
  
  const formatValor = (val, unidad) => {
    if (unidad === '$') return formatMoney(val);
    if (unidad === '%') return `${val?.toFixed(1) || 0}%`;
    if (unidad === 'veces' || unidad === 'veces/año') return `${val?.toFixed(2) || 0}`;
    if (unidad === 'días') return `${Math.round(val || 0)} días`;
    return val;
  };

  const getSemaforoIcon = (semaforo) => {
    switch (semaforo) {
      case 'verde': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'amarillo': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'rojo': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const getSemaforoColor = (semaforo) => {
    switch (semaforo) {
      case 'verde': return 'bg-green-100 text-green-800 border-green-200';
      case 'amarillo': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'rojo': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!empresaActual) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Building2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Selecciona una empresa para ver indicadores</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <span>🎩</span> Indicadores Financieros
        </h1>
        <p className="text-gray-600 mt-1">{empresaActual.razon_social}</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <select
              value={año}
              onChange={(e) => setAño(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 font-semibold"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          
          <button
            onClick={cargarIndicadores}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </button>
          
          <span className="ml-auto text-sm text-gray-500">
            Corte: {datos?.fecha_corte || '-'}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />{error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
          <p className="text-gray-500 mt-2">Calculando indicadores...</p>
        </div>
      )}

      {/* Contenido */}
      {datos && !loading && (
        <>
          {/* Tarjetas resumen de grupos */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {Object.entries(GRUPOS).map(([key, grupo]) => {
              const Icono = grupo.icon;
              const colores = COLORES[grupo.color];
              const indicadores = datos.indicadores[key];
              const primerIndicador = indicadores ? Object.values(indicadores)[0] : null;
              
              return (
                <button
                  key={key}
                  onClick={() => setGrupoExpandido(grupoExpandido === key ? null : key)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    grupoExpandido === key 
                      ? `${colores.bg} ${colores.border}` 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icono className={`h-6 w-6 mb-2 ${colores.text}`} />
                  <div className="text-sm font-semibold text-gray-900">{grupo.nombre}</div>
                  {primerIndicador && (
                    <div className={`text-lg font-bold ${colores.text}`}>
                      {formatValor(primerIndicador.valor, primerIndicador.unidad)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detalle del grupo seleccionado */}
          {grupoExpandido && datos.indicadores[grupoExpandido] && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className={`px-6 py-4 ${COLORES[GRUPOS[grupoExpandido].color].bg} border-b`}>
                <h2 className={`text-lg font-semibold ${COLORES[GRUPOS[grupoExpandido].color].text} flex items-center gap-2`}>
                  {React.createElement(GRUPOS[grupoExpandido].icon, { className: 'h-5 w-5' })}
                  Indicadores de {GRUPOS[grupoExpandido].nombre}
                </h2>
                <p className="text-sm text-gray-600 mt-1">{GRUPOS[grupoExpandido].descripcion}</p>
              </div>
              
              <div className="divide-y divide-gray-100">
                {Object.entries(datos.indicadores[grupoExpandido]).map(([key, ind]) => (
                  <div key={key} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{ind.nombre}</span>
                          {ind.semaforo && getSemaforoIcon(ind.semaforo)}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{ind.formula}</p>
                        <p className="text-xs text-gray-400 mt-1">{ind.interpretacion}</p>
                      </div>
                      <div className="text-right ml-4">
                        <div className={`text-2xl font-bold px-3 py-1 rounded-lg border ${ind.semaforo ? getSemaforoColor(ind.semaforo) : 'bg-gray-100'}`}>
                          {formatValor(ind.valor, ind.unidad)}
                        </div>
                        {ind.dias !== undefined && (
                          <div className="text-sm text-gray-500 mt-1">{ind.dias} días</div>
                        )}
                        {ind.meta && (
                          <div className="text-xs text-gray-500 mt-1">Meta: {ind.meta}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumen de saldos base */}
          <details className="bg-white rounded-xl shadow-sm border border-gray-200">
            <summary className="px-6 py-4 cursor-pointer hover:bg-gray-50 font-medium text-gray-900 flex items-center justify-between">
              Ver saldos base del cálculo
              <ChevronDown className="h-5 w-5 text-gray-400" />
            </summary>
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Balance */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 border-b pb-2">Balance General</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Efectivo</span>
                    <span className="font-medium">{formatMoney(datos.saldos?.efectivo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cuentas por Cobrar</span>
                    <span className="font-medium">{formatMoney(datos.saldos?.cuentas_cobrar)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Inventarios</span>
                    <span className="font-medium">{formatMoney(datos.saldos?.inventarios)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Activo Total</span>
                    <span className="text-blue-600">{formatMoney(datos.saldos?.activo_total)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-gray-600">Pasivo Corriente</span>
                    <span className="font-medium">{formatMoney(datos.saldos?.pasivo_corriente)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Pasivo Total</span>
                    <span className="text-amber-600">{formatMoney(datos.saldos?.pasivo_total)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Patrimonio</span>
                    <span className="text-green-600">{formatMoney(datos.saldos?.patrimonio)}</span>
                  </div>
                </div>
              </div>

              {/* Resultados */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 border-b pb-2">Estado de Resultados</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ingresos</span>
                    <span className="font-medium">{formatMoney(datos.resultados?.ingresos)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">(-) Costos</span>
                    <span className="font-medium text-red-600">{formatMoney(datos.resultados?.costos)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Utilidad Bruta</span>
                    <span>{formatMoney(datos.resultados?.utilidad_bruta)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-gray-600">(-) Gastos Operacionales</span>
                    <span className="font-medium text-red-600">{formatMoney(datos.resultados?.gastos_operacionales)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Utilidad Operacional</span>
                    <span>{formatMoney(datos.resultados?.utilidad_operacional)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Utilidad Neta</span>
                    <span className={datos.resultados?.utilidad_neta >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatMoney(datos.resultados?.utilidad_neta)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Otros */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 border-b pb-2">Otros Datos</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cuentas por Pagar</span>
                    <span className="font-medium">{formatMoney(datos.saldos?.cuentas_pagar)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Obligaciones Financieras</span>
                    <span className="font-medium">{formatMoney(datos.saldos?.obligaciones_financieras)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gastos Financieros</span>
                    <span className="font-medium">{formatMoney(datos.resultados?.gastos_financieros)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Depreciación</span>
                    <span className="font-medium">{formatMoney(datos.resultados?.depreciacion)}</span>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </>
      )}

      {/* Leyenda de semáforos */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Info className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Interpretación de semáforos</p>
            <div className="mt-2 flex flex-wrap gap-4">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" /> Dentro del rango óptimo
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Requiere atención
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-500" /> Fuera del rango recomendado
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
