// 🎩 Don Peppini Contadore - Dashboard Mejorado
// frontend/src/pages/Dashboard.jsx
// REEMPLAZAR el archivo existente

import React, { useState, useEffect } from 'react';
import { 
  Building2, TrendingUp, TrendingDown, Loader2, AlertCircle,
  Wallet, CreditCard, PiggyBank, FileText, BarChart3, PieChart,
  Activity, Bell, Users, Clock, Calendar, CheckCircle, AlertTriangle,
  Info, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';

export default function Dashboard() {
  const { empresaActual, empresaId } = useEmpresa();
  
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (empresaId) {
      cargarDatos();
    } else {
      setLoading(false);
    }
  }, [empresaId]);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/contabilidad/dashboard/', {
        params: { empresa: empresaId }
      });
      setDatos(res.data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (val) => {
    if (val === undefined || val === null) return '$0';
    return `$${Math.abs(val).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
  };

  const formatPct = (val) => {
    if (!val) return '0%';
    return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
  };

  const getAlertIcon = (icono) => {
    switch (icono) {
      case 'check-circle': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'alert-triangle': return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      default: return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getAlertBg = (tipo) => {
    switch (tipo) {
      case 'success': return 'bg-green-50';
      case 'warning': return 'bg-amber-50';
      default: return 'bg-blue-50';
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'verde': return 'text-green-600';
      case 'amarillo': return 'text-amber-600';
      case 'rojo': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (!empresaActual) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Building2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Selecciona una empresa para ver el dashboard</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-indigo-600" />
          <p className="text-gray-500 mt-4">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700">{error}</p>
          <button 
            onClick={cargarDatos}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const d = datos || {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <span>🎩</span> Dashboard
          </h1>
          <p className="text-gray-600 mt-1">{empresaActual.razon_social}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="text-right text-sm text-gray-500">
            <div className="font-medium">{d.periodo}</div>
            <div>Actualizado: {d.fecha_actualizacion}</div>
          </div>
        </div>
      </div>

      {/* ========== FILA 1: Saldos Principales ========== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Efectivo */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Wallet className="h-8 w-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Disponible</span>
          </div>
          <div className="text-2xl font-bold">{formatMoney(d.saldos?.efectivo)}</div>
          <div className="text-sm opacity-80">Efectivo y bancos</div>
        </div>

        {/* Cuentas por Cobrar */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CreditCard className="h-8 w-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Por cobrar</span>
          </div>
          <div className="text-2xl font-bold">{formatMoney(d.saldos?.cuentas_cobrar)}</div>
          <div className="text-sm opacity-80">Cartera clientes</div>
        </div>

        {/* Cuentas por Pagar */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-8 w-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Por pagar</span>
          </div>
          <div className="text-2xl font-bold">{formatMoney(d.saldos?.cuentas_pagar)}</div>
          <div className="text-sm opacity-80">Proveedores</div>
        </div>

        {/* Patrimonio */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <PiggyBank className="h-8 w-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Capital</span>
          </div>
          <div className="text-2xl font-bold">{formatMoney(d.saldos?.patrimonio)}</div>
          <div className="text-sm opacity-80">Patrimonio total</div>
        </div>
      </div>

      {/* ========== FILA 2: Resultados del Mes + Indicadores ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Resultados del Mes */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Resultados del Mes
          </h2>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Ingresos */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700">Ingresos</span>
                {d.resultados_mes?.var_ingresos !== 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                    d.resultados_mes?.var_ingresos >= 0 
                      ? 'bg-green-200 text-green-800' 
                      : 'bg-red-200 text-red-800'
                  }`}>
                    {d.resultados_mes?.var_ingresos >= 0 
                      ? <ArrowUpRight className="h-3 w-3" /> 
                      : <ArrowDownRight className="h-3 w-3" />}
                    {formatPct(d.resultados_mes?.var_ingresos)}
                  </span>
                )}
              </div>
              <div className="text-xl font-bold text-green-700 mt-1">
                {formatMoney(d.resultados_mes?.ingresos)}
              </div>
            </div>
            
            {/* Gastos */}
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-700">Gastos</span>
                {d.resultados_mes?.var_gastos !== 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                    d.resultados_mes?.var_gastos <= 0 
                      ? 'bg-green-200 text-green-800' 
                      : 'bg-red-200 text-red-800'
                  }`}>
                    {d.resultados_mes?.var_gastos <= 0 
                      ? <ArrowDownRight className="h-3 w-3" /> 
                      : <ArrowUpRight className="h-3 w-3" />}
                    {formatPct(d.resultados_mes?.var_gastos)}
                  </span>
                )}
              </div>
              <div className="text-xl font-bold text-red-700 mt-1">
                {formatMoney(d.resultados_mes?.gastos)}
              </div>
            </div>
            
            {/* Utilidad */}
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-sm text-indigo-700">Utilidad</div>
              <div className={`text-xl font-bold mt-1 ${
                d.resultados_mes?.utilidad >= 0 ? 'text-indigo-700' : 'text-red-700'
              }`}>
                {formatMoney(d.resultados_mes?.utilidad)}
              </div>
              {d.resultados_mes?.ingresos > 0 && (
                <div className="text-xs text-indigo-600 mt-1">
                  Margen: {((d.resultados_mes?.utilidad / d.resultados_mes?.ingresos) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
          
          {/* Mini gráfico de tendencia */}
          {d.tendencia_ingresos && d.tendencia_ingresos.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-2">Tendencia de ingresos (últimos 6 meses)</div>
              <div className="flex items-end gap-2 h-20">
                {d.tendencia_ingresos.map((m, i) => {
                  const max = Math.max(...d.tendencia_ingresos.map(x => x.valor || 1));
                  const height = max > 0 ? ((m.valor || 0) / max) * 100 : 0;
                  const isLast = i === d.tendencia_ingresos.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div 
                        className={`w-full rounded-t transition-all ${isLast ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={formatMoney(m.valor)}
                      />
                      <span className="text-[10px] text-gray-500 mt-1">{m.mes}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Mini Indicadores */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-indigo-600" />
            Indicadores Clave
          </h2>
          
          <div className="space-y-4">
            {/* Razón Corriente */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">Razón Corriente</div>
                <div className="text-xs text-gray-500">Meta: ≥ {d.indicadores?.razon_corriente?.meta}</div>
              </div>
              <div className={`text-xl font-bold ${getEstadoColor(d.indicadores?.razon_corriente?.estado)}`}>
                {d.indicadores?.razon_corriente?.valor?.toFixed(2) || '0.00'}
              </div>
            </div>
            
            {/* Endeudamiento */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">Endeudamiento</div>
                <div className="text-xs text-gray-500">Meta: ≤ {d.indicadores?.endeudamiento?.meta}%</div>
              </div>
              <div className={`text-xl font-bold ${getEstadoColor(d.indicadores?.endeudamiento?.estado)}`}>
                {d.indicadores?.endeudamiento?.valor?.toFixed(1) || '0'}%
              </div>
            </div>
            
            {/* ROE */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">ROE</div>
                <div className="text-xs text-gray-500">Rentabilidad patrimonio</div>
              </div>
              <div className={`text-xl font-bold ${getEstadoColor(d.indicadores?.roe?.estado)}`}>
                {d.indicadores?.roe?.valor?.toFixed(1) || '0'}%
              </div>
            </div>
            
            {/* Margen Neto */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">Margen Neto</div>
                <div className="text-xs text-gray-500">Utilidad / Ingresos</div>
              </div>
              <div className={`text-xl font-bold ${getEstadoColor(d.indicadores?.margen_neto?.estado)}`}>
                {d.indicadores?.margen_neto?.valor?.toFixed(1) || '0'}%
              </div>
            </div>
          </div>
          
          <a 
            href="/indicadores" 
            className="block w-full mt-4 text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Ver todos los indicadores →
          </a>
        </div>
      </div>

      {/* ========== FILA 3: Alertas + Cartera + Movimientos ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alertas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            Alertas
          </h2>
          <div className="space-y-3">
            {(d.alertas || []).map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${getAlertBg(a.tipo)}`}>
                {getAlertIcon(a.icono)}
                <span className="text-sm text-gray-700">{a.mensaje}</span>
              </div>
            ))}
            {(!d.alertas || d.alertas.length === 0) && (
              <div className="text-sm text-gray-500 text-center py-4">
                Sin alertas pendientes
              </div>
            )}
          </div>
        </div>

        {/* Top Cartera */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Cartera Principal
          </h2>
          <div className="space-y-3">
            {(d.top_cartera || []).map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{c.cliente}</div>
                  <div className={`text-xs ${c.dias > 30 ? 'text-red-600' : 'text-gray-500'}`}>
                    {c.dias} días
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900">{formatMoney(c.valor)}</div>
              </div>
            ))}
            {(!d.top_cartera || d.top_cartera.length === 0) && (
              <div className="text-sm text-gray-500 text-center py-4">
                Sin cartera pendiente
              </div>
            )}
          </div>
        </div>

        {/* Movimientos Recientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            Últimos Movimientos
          </h2>
          <div className="space-y-3">
            {(d.ultimos_movimientos || []).map((m, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">{m.concepto}</div>
                  <div className="text-xs text-gray-500">{m.fecha}</div>
                </div>
                <div className={`text-sm font-semibold ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                  {m.tipo === 'ingreso' ? '+' : '-'}{formatMoney(m.valor)}
                </div>
              </div>
            ))}
            {(!d.ultimos_movimientos || d.ultimos_movimientos.length === 0) && (
              <div className="text-sm text-gray-500 text-center py-4">
                Sin movimientos recientes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
