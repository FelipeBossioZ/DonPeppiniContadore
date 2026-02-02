// 🎩 Don Peppini Contadore - Dashboard
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  BookOpen,
  DollarSign,
  Building2,
  RefreshCw,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import { getTerceros, getAsientos, getInvoices } from '../services/api';

const Dashboard = () => {
  const { empresaActual, empresaId, loading: loadingEmpresa } = useEmpresa();
  const [stats, setStats] = useState({
    terceros: 0,
    facturas: 0,
    ventas: 0,
    asientos: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (empresaId) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [empresaId]);

  const fetchStats = async () => {
    if (!empresaId) return;
    
    setLoading(true);
    try {
      const [tercerosRes, asientosRes, facturasRes] = await Promise.all([
        getTerceros({ empresa: empresaId }).catch(() => ({ results: [], count: 0 })),
        getAsientos({ empresa: empresaId }).catch(() => ({ results: [], count: 0 })),
        getInvoices({ empresa: empresaId }).catch(() => ({ results: [], count: 0 }))
      ]);
      
      const terceros = tercerosRes.results || tercerosRes || [];
      const asientos = asientosRes.results || asientosRes || [];
      const facturas = facturasRes.results || facturasRes || [];
      
      const ventasTotal = facturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0);
      
      setStats({
        terceros: tercerosRes.count ?? terceros.length,
        asientos: asientosRes.count ?? asientos.length,
        facturas: facturasRes.count ?? facturas.length,
        ventas: ventasTotal
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const cards = [
    { 
      title: 'Terceros', 
      value: stats.terceros, 
      icon: Users, 
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    { 
      title: 'Asientos Contables', 
      value: stats.asientos, 
      icon: BookOpen, 
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
    { 
      title: 'Facturas', 
      value: stats.facturas, 
      icon: FileText, 
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    { 
      title: 'Ventas Totales', 
      value: formatCurrency(stats.ventas), 
      icon: DollarSign, 
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
  ];

  if (loadingEmpresa) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!empresaActual) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Building2 className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No hay empresa seleccionada
          </h2>
          <p className="text-gray-600">
            Selecciona una empresa desde el menú lateral para comenzar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <span>🎩</span> Dashboard
            </h1>
            <p className="mt-2 text-gray-600">{empresaActual.razon_social}</p>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.textColor}`} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              {loading ? (
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
              ) : (
                card.value
              )}
            </h3>
            <p className="text-sm font-medium text-gray-600 mt-1">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Info de la empresa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Información de la Empresa</h2>
            <Building2 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">NIT</span>
              <span className="text-sm font-medium text-gray-900">{empresaActual.nit}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Razón Social</span>
              <span className="text-sm font-medium text-gray-900">{empresaActual.razon_social}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Grupo NIIF</span>
              <span className="text-sm font-medium text-indigo-600">Grupo 2 - NIIF Pymes</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-600">Tipo</span>
              <span className="text-sm font-medium text-gray-900">
                {empresaActual.tipo_persona === 'J' ? 'Persona Jurídica' : 'Persona Natural'}
              </span>
            </div>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Accesos Rápidos</h2>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <a href="/contabilidad" className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-700">Nuevo Asiento</span>
            </a>
            <a href="/terceros" className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Nuevo Tercero</span>
            </a>
            <a href="/facturacion" className="flex items-center gap-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
              <FileText className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">Nueva Factura</span>
            </a>
            <a href="/reportes" className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors">
              <Calendar className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">Ver Reportes</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
