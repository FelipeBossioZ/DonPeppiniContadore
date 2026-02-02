// 🎩 Don Peppini Contadore - Estados Financieros NIIF
// frontend/src/pages/EstadosFinancieros.jsx

import React, { useState } from 'react';
import { 
  FileText, 
  TrendingUp, 
  Wallet, 
  ArrowRightLeft,
  Download,
  Calendar,
  Building2,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';
import api from '../services/api';
import DescargarPDF from '../components/DescargarPDF';
import DescargarExcel from '../components/DescargarExcel';

// Componente para secciones colapsables
const Seccion = ({ titulo, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-left font-medium text-gray-700 hover:text-gray-900"
      >
        {titulo}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
};

// Formato moneda
const formatMoney = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value || 0);
};

// Componente principal
export default function EstadosFinancieros() {
  const { empresaActual, empresaId } = useEmpresa();
  const [activeTab, setActiveTab] = useState('situacion');
  const [fechaInicio, setFechaInicio] = useState(`${new Date().getFullYear()}-01-01`);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const tabs = [
    { id: 'situacion', nombre: 'Situación Financiera', icon: FileText },
    { id: 'resultados', nombre: 'Resultados Integral', icon: TrendingUp },
    { id: 'patrimonio', nombre: 'Cambios Patrimonio', icon: Wallet },
    { id: 'flujos', nombre: 'Flujos de Efectivo', icon: ArrowRightLeft },
  ];

  const fetchData = async () => {
    if (!empresaId) return;
    
    setLoading(true);
    setError(null);
    
    const endpoints = {
      situacion: '/contabilidad/niif/situacion-financiera/',
      resultados: '/contabilidad/niif/resultados-integral/',
      patrimonio: '/contabilidad/niif/cambios-patrimonio/',
      flujos: '/contabilidad/niif/flujos-efectivo/',
    };
    
    const params = {
      empresa: empresaId,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      fecha_corte: fechaFin,
    };
    
    try {
      const response = await api.get(endpoints[activeTab], { params });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar datos');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Si no hay empresa
  if (!empresaActual) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Building2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Selecciona una empresa para ver los Estados Financieros</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <span>🎩</span> Estados Financieros NIIF
        </h1>
        <p className="text-gray-600 mt-1">{empresaActual.razon_social} • NIIF para Pymes</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline h-4 w-4 mr-1" />
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin / Corte
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
            Generar
          </button>
          {data && (
              <>
                <DescargarPDF 
                  nombreArchivo={`${activeTab}-${fechaFin}`}
                  titulo={data.titulo}
                  empresa={empresaActual?.razon_social}
                  fecha={empresaActual?.nit}
                />
                <DescargarExcel 
                  data={data}
                  tipo={activeTab}
                  nombreArchivo={`${empresaActual?.razon_social}-${data.titulo}-${fechaFin}`}
                />
              </>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setData(null); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.nombre}
              </button>
            ))}
          </nav>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          {!data && !loading && !error && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Selecciona las fechas y haz clic en "Generar"</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
              <p className="mt-2 text-gray-500">Generando estado financiero...</p>
            </div>
          )}

          {/* Estado de Situación Financiera */}
          <div id="reporte-contenido">
            {data && activeTab === 'situacion' && (
              <EstadoSituacion data={data} />
            )}

            {/* Estado de Resultados Integral */}
            {data && activeTab === 'resultados' && (
              <EstadoResultados data={data} />
            )}

            {/* Estado de Cambios en el Patrimonio */}
            {data && activeTab === 'patrimonio' && (
              <EstadoPatrimonio data={data} />
            )}

            {/* Estado de Flujos de Efectivo */}
            {data && activeTab === 'flujos' && (
              <EstadoFlujos data={data} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTES DE CADA ESTADO FINANCIERO
// ============================================================================

function EstadoSituacion({ data }) {
  return (
    <div className="space-y-6">
      {/* Header del reporte */}
      <div className="text-center border-b pb-4">
        <h2 className="text-xl font-bold text-gray-900">{data.titulo}</h2>
        <p className="text-sm text-gray-500">{data.norma}</p>
        <p className="text-sm text-gray-600 mt-1">Al {data.fecha_corte}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ACTIVOS */}
        <div>
          <h3 className="font-bold text-lg text-gray-900 mb-3 pb-2 border-b-2 border-indigo-600">
            ACTIVOS
          </h3>
          
          <Seccion titulo="Activos Corrientes">
            <table className="w-full text-sm">
              <tbody>
                {data.activos.corrientes.detalle.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1">{item.codigo} - {item.nombre}</td>
                    <td className="py-1 text-right">{formatMoney(item.saldo)}</td>
                  </tr>
                ))}
                <tr className="font-medium bg-gray-50">
                  <td className="py-2">Total Activos Corrientes</td>
                  <td className="py-2 text-right">{formatMoney(data.activos.corrientes.total)}</td>
                </tr>
              </tbody>
            </table>
          </Seccion>

          <Seccion titulo="Activos No Corrientes">
            <table className="w-full text-sm">
              <tbody>
                {data.activos.no_corrientes.detalle.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1">{item.codigo} - {item.nombre}</td>
                    <td className="py-1 text-right">{formatMoney(item.saldo)}</td>
                  </tr>
                ))}
                <tr className="font-medium bg-gray-50">
                  <td className="py-2">Total Activos No Corrientes</td>
                  <td className="py-2 text-right">{formatMoney(data.activos.no_corrientes.total)}</td>
                </tr>
              </tbody>
            </table>
          </Seccion>

          <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
            <div className="flex justify-between font-bold text-indigo-900">
              <span>TOTAL ACTIVOS</span>
              <span>{formatMoney(data.activos.total)}</span>
            </div>
          </div>
        </div>

        {/* PASIVOS Y PATRIMONIO */}
        <div>
          <h3 className="font-bold text-lg text-gray-900 mb-3 pb-2 border-b-2 border-green-600">
            PASIVOS Y PATRIMONIO
          </h3>
          
          <Seccion titulo="Pasivos Corrientes">
            <table className="w-full text-sm">
              <tbody>
                {data.pasivos.corrientes.detalle.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1">{item.codigo} - {item.nombre}</td>
                    <td className="py-1 text-right">{formatMoney(item.saldo)}</td>
                  </tr>
                ))}
                <tr className="font-medium bg-gray-50">
                  <td className="py-2">Total Pasivos Corrientes</td>
                  <td className="py-2 text-right">{formatMoney(data.pasivos.corrientes.total)}</td>
                </tr>
              </tbody>
            </table>
          </Seccion>

          <Seccion titulo="Pasivos No Corrientes">
            <table className="w-full text-sm">
              <tbody>
                {data.pasivos.no_corrientes.detalle.length === 0 ? (
                  <tr><td className="py-1 text-gray-400 italic">Sin movimientos</td></tr>
                ) : data.pasivos.no_corrientes.detalle.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1">{item.codigo} - {item.nombre}</td>
                    <td className="py-1 text-right">{formatMoney(item.saldo)}</td>
                  </tr>
                ))}
                <tr className="font-medium bg-gray-50">
                  <td className="py-2">Total Pasivos No Corrientes</td>
                  <td className="py-2 text-right">{formatMoney(data.pasivos.no_corrientes.total)}</td>
                </tr>
              </tbody>
            </table>
          </Seccion>

          <div className="my-3 p-2 bg-gray-100 rounded flex justify-between font-medium">
            <span>TOTAL PASIVOS</span>
            <span>{formatMoney(data.pasivos.total)}</span>
          </div>

          <Seccion titulo="Patrimonio">
            <table className="w-full text-sm">
              <tbody>
                {data.patrimonio.detalle.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1">{item.codigo} - {item.nombre}</td>
                    <td className="py-1 text-right">{formatMoney(item.saldo)}</td>
                  </tr>
                ))}
                <tr className="border-b border-gray-50">
                  <td className="py-1 italic">Resultado del Ejercicio</td>
                  <td className="py-1 text-right">{formatMoney(data.patrimonio.resultado_ejercicio)}</td>
                </tr>
                <tr className="font-medium bg-gray-50">
                  <td className="py-2">Total Patrimonio</td>
                  <td className="py-2 text-right">{formatMoney(data.patrimonio.total)}</td>
                </tr>
              </tbody>
            </table>
          </Seccion>

          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <div className="flex justify-between font-bold text-green-900">
              <span>TOTAL PASIVO + PATRIMONIO</span>
              <span>{formatMoney(data.verificacion.pasivos_patrimonio)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Verificación ecuación */}
      <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
        data.verificacion.ecuacion_ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
      }`}>
        {data.verificacion.ecuacion_ok ? (
          <CheckCircle className="h-5 w-5" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
        <span className="font-medium">
          Ecuación Contable: Activo = Pasivo + Patrimonio → 
          {data.verificacion.ecuacion_ok ? ' ✓ Cuadra correctamente' : ' ✗ Hay diferencia'}
        </span>
      </div>
    </div>
  );
}

function EstadoResultados({ data }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center border-b pb-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900">{data.titulo}</h2>
        <p className="text-sm text-gray-500">{data.norma}</p>
        <p className="text-sm text-gray-600 mt-1">
          Del {data.periodo.inicio} al {data.periodo.fin}
        </p>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {/* Ingresos */}
          <tr className="bg-green-50">
            <td colSpan="2" className="py-2 px-3 font-bold text-green-800">INGRESOS OPERACIONALES</td>
          </tr>
          {data.ingresos.operacionales.detalle.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 pl-6">{item.codigo} - {item.nombre}</td>
              <td className="py-2 text-right pr-3">{formatMoney(item.valor)}</td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="py-2 pl-3">Total Ingresos</td>
            <td className="py-2 text-right pr-3">{formatMoney(data.ingresos.total)}</td>
          </tr>

          {/* Costos */}
          <tr className="bg-red-50">
            <td colSpan="2" className="py-2 px-3 font-bold text-red-800">(-) COSTO DE VENTAS</td>
          </tr>
          {data.costos.detalle.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 pl-6">{item.codigo} - {item.nombre}</td>
              <td className="py-2 text-right pr-3">({formatMoney(item.valor)})</td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="py-2 pl-3">Total Costos</td>
            <td className="py-2 text-right pr-3">({formatMoney(data.costos.total)})</td>
          </tr>

          {/* Utilidad Bruta */}
          <tr className="bg-indigo-100 font-bold">
            <td className="py-3 px-3">= UTILIDAD BRUTA</td>
            <td className="py-3 text-right pr-3">{formatMoney(data.utilidad_bruta)}</td>
          </tr>

          {/* Gastos */}
          <tr className="bg-amber-50">
            <td colSpan="2" className="py-2 px-3 font-bold text-amber-800">(-) GASTOS OPERACIONALES</td>
          </tr>
          {data.gastos.administracion.detalle.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 pl-6">{item.codigo} - {item.nombre}</td>
              <td className="py-2 text-right pr-3">({formatMoney(item.valor)})</td>
            </tr>
          ))}
          {data.gastos.ventas.detalle.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 pl-6">{item.codigo} - {item.nombre}</td>
              <td className="py-2 text-right pr-3">({formatMoney(item.valor)})</td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="py-2 pl-3">Total Gastos Operacionales</td>
            <td className="py-2 text-right pr-3">({formatMoney(data.gastos.total_operacionales)})</td>
          </tr>

          {/* Utilidad Operacional */}
          <tr className="bg-indigo-100 font-bold">
            <td className="py-3 px-3">= UTILIDAD OPERACIONAL</td>
            <td className="py-3 text-right pr-3">{formatMoney(data.utilidad_operacional)}</td>
          </tr>

          {/* Impuestos */}
          <tr className="border-b border-gray-100">
            <td className="py-2 pl-3">(-) Impuesto de Renta (35%)</td>
            <td className="py-2 text-right pr-3">({formatMoney(data.impuesto_renta)})</td>
          </tr>

          {/* Utilidad Neta */}
          <tr className="bg-green-100 font-bold text-lg">
            <td className="py-4 px-3">= UTILIDAD NETA DEL EJERCICIO</td>
            <td className={`py-4 text-right pr-3 ${data.utilidad_neta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatMoney(data.utilidad_neta)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EstadoPatrimonio({ data }) {
  return (
    <div>
      <div className="text-center border-b pb-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900">{data.titulo}</h2>
        <p className="text-sm text-gray-500">{data.norma}</p>
        <p className="text-sm text-gray-600 mt-1">
          Del {data.periodo.inicio} al {data.periodo.fin}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-3 px-4 text-left font-medium">Concepto</th>
              <th className="py-3 px-4 text-right font-medium">Saldo Inicial</th>
              <th className="py-3 px-4 text-right font-medium">Aumentos</th>
              <th className="py-3 px-4 text-right font-medium">Disminuciones</th>
              <th className="py-3 px-4 text-right font-medium">Saldo Final</th>
            </tr>
          </thead>
          <tbody>
            {data.componentes.map((item, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">{item.concepto}</td>
                <td className="py-3 px-4 text-right">{formatMoney(item.saldo_inicial)}</td>
                <td className="py-3 px-4 text-right text-green-600">
                  {item.aumentos > 0 ? formatMoney(item.aumentos) : '-'}
                </td>
                <td className="py-3 px-4 text-right text-red-600">
                  {item.disminuciones > 0 ? `(${formatMoney(item.disminuciones)})` : '-'}
                </td>
                <td className="py-3 px-4 text-right font-medium">{formatMoney(item.saldo_final)}</td>
              </tr>
            ))}
            <tr className="bg-indigo-50 font-bold">
              <td className="py-3 px-4">TOTAL PATRIMONIO</td>
              <td className="py-3 px-4 text-right">{formatMoney(data.totales.saldo_inicial)}</td>
              <td className="py-3 px-4"></td>
              <td className="py-3 px-4"></td>
              <td className="py-3 px-4 text-right">{formatMoney(data.totales.saldo_final)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EstadoFlujos({ data }) {
  const FilaFlujo = ({ concepto, valor, indent = false, bold = false }) => (
    <tr className={`border-b border-gray-100 ${bold ? 'font-medium bg-gray-50' : ''}`}>
      <td className={`py-2 ${indent ? 'pl-8' : 'pl-4'}`}>{concepto}</td>
      <td className={`py-2 text-right pr-4 ${valor < 0 ? 'text-red-600' : ''}`}>
        {formatMoney(valor)}
      </td>
    </tr>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center border-b pb-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900">{data.titulo}</h2>
        <p className="text-sm text-indigo-600 font-medium">{data.subtitulo}</p>
        <p className="text-sm text-gray-500">{data.norma}</p>
        <p className="text-sm text-gray-600 mt-1">
          Del {data.periodo.inicio} al {data.periodo.fin}
        </p>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {/* Operación */}
          <tr className="bg-blue-50">
            <td colSpan="2" className="py-3 px-4 font-bold text-blue-800">
              ACTIVIDADES DE OPERACIÓN
            </td>
          </tr>
          <FilaFlujo concepto="Utilidad Neta del Ejercicio" valor={data.operacion.utilidad_neta} />
          <FilaFlujo concepto="(+) Depreciación" valor={data.operacion.ajustes.depreciacion} indent />
          <FilaFlujo concepto="Cambios en Deudores" valor={data.operacion.cambios_capital_trabajo.deudores} indent />
          <FilaFlujo concepto="Cambios en Inventarios" valor={data.operacion.cambios_capital_trabajo.inventarios} indent />
          <FilaFlujo concepto="Cambios en Proveedores" valor={data.operacion.cambios_capital_trabajo.proveedores} indent />
          <FilaFlujo concepto="Cambios en Cuentas por Pagar" valor={data.operacion.cambios_capital_trabajo.cuentas_por_pagar} indent />
          <FilaFlujo concepto="Cambios en Impuestos" valor={data.operacion.cambios_capital_trabajo.impuestos} indent />
          <FilaFlujo concepto="Cambios en Obligaciones Laborales" valor={data.operacion.cambios_capital_trabajo.obligaciones_laborales} indent />
          <FilaFlujo concepto="= Flujo Neto de Operación" valor={data.operacion.total} bold />

          {/* Inversión */}
          <tr className="bg-amber-50">
            <td colSpan="2" className="py-3 px-4 font-bold text-amber-800">
              ACTIVIDADES DE INVERSIÓN
            </td>
          </tr>
          <FilaFlujo concepto="Inversiones" valor={data.inversion.inversiones} indent />
          <FilaFlujo concepto="Propiedad, Planta y Equipo" valor={data.inversion.propiedad_planta_equipo} indent />
          <FilaFlujo concepto="Intangibles" valor={data.inversion.intangibles} indent />
          <FilaFlujo concepto="= Flujo Neto de Inversión" valor={data.inversion.total} bold />

          {/* Financiación */}
          <tr className="bg-green-50">
            <td colSpan="2" className="py-3 px-4 font-bold text-green-800">
              ACTIVIDADES DE FINANCIACIÓN
            </td>
          </tr>
          <FilaFlujo concepto="Obligaciones Financieras" valor={data.financiacion.obligaciones_financieras} indent />
          <FilaFlujo concepto="Aportes de Capital" valor={data.financiacion.aportes_capital} indent />
          <FilaFlujo concepto="= Flujo Neto de Financiación" valor={data.financiacion.total} bold />

          {/* Resumen */}
          <tr className="bg-indigo-100">
            <td colSpan="2" className="py-3 px-4 font-bold text-indigo-800">
              RESUMEN
            </td>
          </tr>
          <FilaFlujo concepto="Variación Neta del Efectivo" valor={data.resumen.variacion_efectivo} bold />
          <FilaFlujo concepto="Efectivo al Inicio del Periodo" valor={data.resumen.efectivo_inicial} />
          <tr className="bg-green-100 font-bold text-lg">
            <td className="py-3 px-4">EFECTIVO AL FINAL DEL PERIODO</td>
            <td className="py-3 text-right pr-4">{formatMoney(data.resumen.efectivo_final)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
