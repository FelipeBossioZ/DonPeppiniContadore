// Don Peppini Contadore - Login / Setup Inicial
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { Lock, User, AlertCircle, UserPlus, CheckCircle, Building2, Mail } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(null);
  const [setupData, setSetupData] = useState({
    username: '', password: '', confirm: '', email: '',
    empresa_nit: '', empresa_dv: '', empresa_razon: '', empresa_nombre: '',
  });
  const [setupError, setSetupError] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/api/setup-status/`)
      .then((r) => r.json())
      .then((data) => setNeedsSetup(!data.has_users))
      .catch(() => setNeedsSetup(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login(credentials.username, credentials.password);
      navigate('/dashboard');
    } catch {
      setError('Credenciales invalidas. Por favor intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setSetupError('');

    if (setupData.password !== setupData.confirm) {
      setSetupError('Las contrasenas no coinciden');
      return;
    }
    if (setupData.password.length < 6) {
      setSetupError('La contrasena debe tener al menos 6 caracteres');
      return;
    }
    if (!setupData.empresa_nit || !setupData.empresa_razon) {
      setSetupError('NIT y Razon Social son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/setup-user/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: setupData.username,
          password: setupData.password,
          email: setupData.email,
          empresa_nit: setupData.empresa_nit,
          empresa_dv: setupData.empresa_dv,
          empresa_razon: setupData.empresa_razon,
          empresa_nombre: setupData.empresa_nombre,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSetupError(data.error || 'Error al crear la configuracion');
        return;
      }
      setSetupSuccess(true);
      await authService.login(setupData.username, setupData.password);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch {
      setSetupError('Error de conexion con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Cargando
  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const inputClass = "appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const inputClassNoIcon = "appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";

  // Setup formulario
  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 py-8">
        <div className="max-w-lg w-full bg-white rounded-xl shadow-2xl overflow-hidden">
          {setupSuccess ? (
            <div className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900">Configuracion completada</h2>
              <p className="mt-2 text-sm text-gray-500">Redirigiendo al sistema...</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-indigo-600 px-8 py-5 text-white">
                <div className="flex justify-center text-5xl mb-2">
                  <img src="/logos/Logof1.png" alt="Logo" className="h-12 w-auto" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <h2 className="text-center text-xl font-bold">Configuracion Inicial</h2>
                <p className="text-center text-indigo-200 text-sm mt-1">
                  Cree su usuario y registre su empresa para comenzar
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSetup} className="p-8 space-y-5">
                {/* Seccion: Usuario */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Cuenta de Administrador</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Usuario *</label>
                      <div className="mt-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                        <input type="text" required autoFocus className={inputClass} placeholder="Ej: felipe"
                          value={setupData.username} onChange={(e) => setSetupData({ ...setupData, username: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Correo (opcional)</label>
                      <div className="mt-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-4 w-4 text-gray-400" />
                        </div>
                        <input type="email" className={inputClass} placeholder="felipe@ejemplo.com"
                          value={setupData.email} onChange={(e) => setSetupData({ ...setupData, email: e.target.value })} />
                      </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contrasena *</label>
                        <div className="mt-1 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-4 w-4 text-gray-400" />
                          </div>
                          <input type="password" required className={inputClass} placeholder="Min. 6 caracteres"
                            value={setupData.password} onChange={(e) => setSetupData({ ...setupData, password: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Confirmar *</label>
                        <div className="mt-1 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-4 w-4 text-gray-400" />
                          </div>
                          <input type="password" required className={inputClass} placeholder="Repita"
                            value={setupData.confirm} onChange={(e) => setSetupData({ ...setupData, confirm: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-200" />

                {/* Seccion: Empresa */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Datos de la Empresa</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">NIT (sin DV) *</label>
                        <input type="text" required maxLength={13} className={inputClassNoIcon} placeholder="900123456"
                          value={setupData.empresa_nit} onChange={(e) => setSetupData({ ...setupData, empresa_nit: e.target.value.replace(/[^0-9]/g, '') })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">DV</label>
                        <input type="text" maxLength={1} className={inputClassNoIcon} placeholder="0"
                          value={setupData.empresa_dv} onChange={(e) => setSetupData({ ...setupData, empresa_dv: e.target.value.replace(/[^0-9]/g, '') })} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Razon Social *</label>
                      <input type="text" required className={inputClassNoIcon} placeholder="Empresa S.A.S."
                        value={setupData.empresa_razon} onChange={(e) => setSetupData({ ...setupData, empresa_razon: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nombre Comercial (opcional)</label>
                      <input type="text" className={inputClassNoIcon} placeholder="Si es diferente a la razon social"
                        value={setupData.empresa_nombre} onChange={(e) => setSetupData({ ...setupData, empresa_nombre: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Error */}
                {setupError && (
                  <div className="rounded-md bg-red-50 p-3">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                      <p className="ml-2 text-sm text-red-800">{setupError}</p>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button type="submit" disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50">
                  <UserPlus className="h-4 w-4" />
                  {loading ? 'Configurando...' : 'Crear usuario y empresa'}
                </button>
              </form>
            </>
          )}

          <div className="text-center text-xs text-gray-400 pb-4 px-8">
            Colombia - NIIF para Pymes - Grupo 2
          </div>
        </div>
      </div>
    );
  }

  // Login normal
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-2xl">
        <div>
          <div className="flex justify-center">
            <div className="text-6xl">
              <img src="/logos/Logof1.png" alt="Logo" className="h-16 w-auto" onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          </div>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">Don Peppini</h2>
          <p className="text-center text-lg font-medium text-indigo-600">Contadore</p>
          <p className="mt-2 text-center text-sm text-gray-500">Sistema Contable NIIF para Pymes</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">Usuario</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input id="username" type="text" required autoFocus
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Ingrese su usuario" value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contrasena</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input id="password" type="password" required
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Ingrese su contrasena" value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0"><AlertCircle className="h-5 w-5 text-red-400" /></div>
                <div className="ml-3"><p className="text-sm text-red-800">{error}</p></div>
              </div>
            </div>
          )}

          <div>
            <button type="submit" disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : 'Ingresar'}
            </button>
          </div>
        </form>

        <div className="text-center text-xs text-gray-400 mt-6">Colombia  NIIF para Pymes  Grupo 2</div>
      </div>
    </div>
  );
};

export default Login;