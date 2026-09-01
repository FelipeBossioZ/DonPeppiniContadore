// 🎩 Don Peppini Contadore - Layout Principal
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Users, BookOpen, FileText, LogOut, Menu, X,
  ChevronRight, ChevronDown, BarChart3, FileSpreadsheet,
  Landmark, TrendingUp, Lock, Briefcase, Calculator,
  UserMinus, Gift, Upload, Shield, CreditCard, Bookmark,
  Settings, Receipt,
} from 'lucide-react';
import { authService } from '../services/auth';
import EmpresaSelector from './EmpresaSelector';
import { useEmpresa } from '../context/EmpresaContext';

// ─── Estructura del sidebar: 7 grupos ───
const NAV_GROUPS = [
  { type: 'link', name: 'Dashboard', href: '/dashboard', icon: Home },
  { type: 'link', name: 'Terceros', href: '/terceros', icon: Users },
  {
    type: 'group', name: 'Contabilidad', icon: BookOpen,
    children: [
      { name: 'Asientos', href: '/contabilidad' },
      { name: 'CxP / CxC', href: '/cxp-cxc' },
      { name: 'Plantillas', href: '/plantillas' },
      { name: 'Importar DIAN', href: '/importar-dian' },
    ],
  },
  {
    type: 'group', name: 'Nómina', icon: Briefcase,
    children: [
      { name: 'Nóminas', href: '/nomina' },
      { name: 'Liquidación Contrato', href: '/liquidacion-contrato' },
      { name: 'Prestaciones', href: '/prestaciones' },
      { name: 'Simulador Retención', href: '/simulador-retencion' },
    ],
  },
  {
    type: 'group', name: 'Reportes', icon: BarChart3,
    children: [
      { name: 'Libros Contables', href: '/reportes' },
      { name: 'Balance Terceros', href: '/balance-terceros' },
      { name: 'Estados Financieros', href: '/estados-financieros' },
      { name: 'Indicadores', href: '/indicadores' },
      { name: 'Notas EEFF', href: '/notas-eeff' },
      { name: 'Medios Magnéticos', href: '/medios-magneticos' },
      { name: 'Certificados', href: '/certificados', wip: true },
    ],
  },
  {
    type: 'group', name: 'Operaciones', icon: Receipt,
    children: [
      { name: 'Facturación', href: '/facturacion', wip: true },
      { name: 'Conciliación Bancaria', href: '/conciliacion-bancaria', wip: true },
    ],
  },
  {
    type: 'group', name: 'Administración', icon: Settings,
    children: [
      { name: 'Cierre Contable', href: '/cierre-contable' },
      { name: 'Auditoría Interna', href: '/auditoria' },
    ],
  },
];

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNuevaEmpresa, setShowNuevaEmpresa] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { empresaActual } = useEmpresa();

  // User info + role
  const [userInfo, setUserInfo] = useState(() => authService.getUser());
  const userRole = userInfo?.role || 'consulta';
  const ROLE_LABEL = { admin: 'Administrador', contador: 'Contador', consulta: 'Consulta' };
  const ROLE_COLOR = { admin: 'bg-red-100 text-red-700', contador: 'bg-indigo-100 text-indigo-700', consulta: 'bg-gray-100 text-gray-600' };

  useEffect(() => {
    if (!userInfo && authService.isAuthenticated()) {
      authService.fetchMe().then(u => { if (u) setUserInfo(u); });
    }
  }, []);

  const handleLogout = () => { authService.logout(); navigate('/login'); };
  const isActive = (path) => location.pathname === path;
  const isGroupActive = (g) => g.children?.some((c) => location.pathname === c.href);
  const toggleGroup = (name) => setOpenGroups((p) => ({ ...p, [name]: !p[name] }));
  const isGroupOpen = (g) => openGroups[g.name] !== undefined ? openGroups[g.name] : isGroupActive(g);

  const Logo = ({ size = 'normal' }) => (
    <div className="flex items-center">
      <span className={`${size === 'small' ? 'text-xl' : 'text-2xl'}`}>🎩</span>
      <div className="ml-2">
        <span className={`font-bold text-gray-800 ${size === 'small' ? 'text-sm' : 'text-base'}`}>Don Peppini</span>
        <span className={`block text-indigo-600 font-medium text-xs`}>Contadore</span>
      </div>
    </div>
  );

  const NavItem = ({ item, onNav }) => {
    if (item.type === 'link') {
      return (
        <Link to={item.href} onClick={onNav}
          className={`flex items-center px-3 py-2 mb-0.5 text-sm font-medium rounded-lg transition-colors ${
            isActive(item.href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
          }`}>
          <item.icon className="mr-3 h-5 w-5 shrink-0" />
          {item.name}
        </Link>
      );
    }
    const open = isGroupOpen(item);
    const active = isGroupActive(item);
    return (
      <div className="mb-0.5">
        <button onClick={() => toggleGroup(item.name)}
          className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            active ? 'bg-indigo-50/60 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
          }`}>
          <item.icon className="mr-3 h-5 w-5 shrink-0" />
          <span className="flex-1 text-left">{item.name}</span>
          {open
            ? <ChevronDown className="h-4 w-4 text-gray-400" />
            : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </button>
        {open && (
          <div className="ml-5 pl-3 border-l border-gray-200 mt-0.5 mb-1">
            {item.children.map((child) => (
              <Link key={child.href} to={child.href} onClick={onNav}
                className={`flex items-center justify-between px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  isActive(child.href)
                    ? 'text-indigo-700 font-medium bg-indigo-50'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}>
                {child.name}
                {child.wip && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium leading-none">WIP</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const SidebarNav = ({ onNav }) => (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {NAV_GROUPS.map((item) => <NavItem key={item.name} item={item} onNav={onNav} />)}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar móvil */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Logo size="small" />
          <button onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="px-3 py-3 border-b border-gray-100">
          <EmpresaSelector onNuevaEmpresa={() => setShowNuevaEmpresa(true)} />
        </div>
        <SidebarNav onNav={() => setSidebarOpen(false)} />
        <div className="p-4 border-t border-gray-200">
          {userInfo && (
            <div className="flex items-center justify-between mb-2 px-3">
              <span className="text-sm text-gray-700 font-medium truncate">{userInfo.username}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[userRole]}`}>{ROLE_LABEL[userRole]}</span>
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <LogOut className="mr-3 h-5 w-5" />Cerrar sesión
          </button>
        </div>
      </div>

      {/* Sidebar desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-10 lg:w-64 lg:block">
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-4 border-b border-gray-200"><Logo /></div>
          <div className="px-3 py-3 border-b border-gray-100">
            <EmpresaSelector onNuevaEmpresa={() => setShowNuevaEmpresa(true)} />
          </div>
          <SidebarNav onNav={() => {}} />
          <div className="p-4 border-t border-gray-200">
            {userInfo && (
              <div className="flex items-center justify-between mb-2 px-3">
                <span className="text-sm text-gray-700 font-medium truncate">{userInfo.username}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[userRole]}`}>{ROLE_LABEL[userRole]}</span>
              </div>
            )}
            <button onClick={handleLogout}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <LogOut className="mr-3 h-5 w-5" />Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
            <Menu className="h-6 w-6" />
          </button>
          <Logo size="small" />
          <div className="w-10"></div>
        </div>
        <div className="hidden lg:flex items-center justify-between h-12 px-6 bg-white border-b border-gray-100">
          <div className="text-sm text-gray-500">
            {empresaActual ? (
              <span>
                <span className="font-medium text-gray-700">{empresaActual.razon_social}</span>
                <span className="mx-2">•</span>
                <span>NIT: {empresaActual.nit}</span>
                <span className="mx-2">•</span>
                <span className="text-indigo-600">NIIF Pymes</span>
              </span>
            ) : (
              <span className="text-amber-600">⚠️ Seleccione una empresa</span>
            )}
          </div>
          <div className="text-xs text-gray-400">Periodo: {new Date().getFullYear()}</div>
        </div>
        <main className="min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-3rem)]"><Outlet /></main>
      </div>

      {/* Modal Nueva Empresa */}
      {showNuevaEmpresa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-4">Nueva Empresa</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              try {
                const response = await fetch('http://127.0.0.1:8000/api/empresas/', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                  },
                  body: JSON.stringify({
                    nit: formData.get('nit'),
                    razon_social: formData.get('razon_social'),
                    nombre_comercial: formData.get('nombre_comercial'),
                    direccion: formData.get('direccion') || '',
                    telefono: formData.get('telefono') || '',
                    email: formData.get('email') || '',
                  })
                });
                if (response.ok) { setShowNuevaEmpresa(false); window.location.reload(); }
                else { alert('Error al crear empresa'); }
              } catch (err) { alert('Error de conexión'); }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIT *</label>
                  <input name="nit" required className="w-full border rounded-lg px-3 py-2" placeholder="900123456-7" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
                  <input name="razon_social" required className="w-full border rounded-lg px-3 py-2" placeholder="Empresa S.A.S." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                  <input name="nombre_comercial" className="w-full border rounded-lg px-3 py-2" placeholder="Mi Empresa" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input name="email" type="email" className="w-full border rounded-lg px-3 py-2" placeholder="correo@empresa.com" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowNuevaEmpresa(false)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Crear Empresa</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
