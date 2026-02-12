// 🎩 Don Peppini Contadore - App Principal
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TercerosPage from './pages/Terceros';
import Contabilidad from './pages/Contabilidad';
import Facturacion from './pages/Facturacion';
import Reportes from './pages/reportes';
import { authService } from './services/auth';
import { EmpresaProvider } from './context/EmpresaContext';
import ToastHost from "./ui/ToastHost";
import EstadosFinancieros from './pages/EstadosFinancieros';
import MediosMagneticos from './pages/MediosMagneticos';
import CertificadosTributarios from './pages/CertificadosTributarios';
import ConciliacionBancaria from './pages/ConciliacionBancaria';
import NotasEEFF from './pages/NotasEEFF';
import IndicadoresFinancieros from './pages/IndicadoresFinancieros';
import CierreContable from './pages/CierreContable';
import Nomina from './pages/Nomina';
import BalanceTerceros from './pages/BalanceTerceros';
import SimuladorRetencion from './pages/SimuladorRetencion';
import LiquidacionContrato from './pages/LiquidacionContrato';
import PrestacionesSociales from './pages/PrestacionesSociales';
import ImportDIAN from './pages/ImportDIAN';
import AuditoriaInterna from './pages/AuditoriaInterna';

// Componente para rutas protegidas
const ProtectedRoute = ({ children }) => {
  const isAuth = authService.isAuthenticated();
  return isAuth ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <ToastHost /> 
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <EmpresaProvider>
              <Layout />
            </EmpresaProvider>
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="terceros" element={<TercerosPage />} />
          <Route path="contabilidad" element={<Contabilidad />} />
          <Route path="facturacion" element={<Facturacion />} />
          <Route path="importar-dian" element={<ImportDIAN />} />
          <Route path="nomina" element={<Nomina />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="balance-terceros" element={<BalanceTerceros />} />
          <Route path="simulador-retencion" element={<SimuladorRetencion />} />
          <Route path="liquidacion-contrato" element={<LiquidacionContrato />} />
          <Route path="prestaciones" element={<PrestacionesSociales />} />
          <Route path="estados-financieros" element={<EstadosFinancieros />} />
          <Route path="medios-magneticos" element={<MediosMagneticos />} />
          <Route path="certificados" element={<CertificadosTributarios />} />
          <Route path="conciliacion-bancaria" element={<ConciliacionBancaria />} />
          <Route path="notas-eeff" element={<NotasEEFF />} />
          <Route path="indicadores" element={<IndicadoresFinancieros />} />
          <Route path="cierre-contable" element={<CierreContable />} />
          <Route path="auditoria" element={<AuditoriaInterna />} />


        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;