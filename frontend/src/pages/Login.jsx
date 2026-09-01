// Don Peppini Contadore - Login / Primer Usuario
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { Lock, User, AlertCircle, UserPlus, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(null);
  const [setupData, setSetupData] = useState({ username: '', password: '', confirm: '', email: '' });
  const [setupError, setSetupError] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Consultar si hay usuarios registrados
    fetch(`${API_URL}/api/setup-status/`)
      .then((r) => r.json())
      .then((data) => setNeedsSetup(!data.has_users))
      .catch(() => setNeedsSetup(false)); // si falla, asumir que ya hay usuarios
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login(credentials.username, credentials.password);
      navigate('/dashboard');
    } catch {
      setError('Credenciales inválidas. Por favor intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setSetupError('');

    if (setupData.password !== setupData.confirm) {
      setSetupError('Las contraseñas no coinciden');
      return;
    }
    if (setupData.password.length < 6) {
      setSetupError('La contraseña debe tener al menos 6 caracteres');
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
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSetupError(data.error || 'Error al crear usuario');
        return;
      }
      setSetupSuccess(true);
      // Auto-login con el usuario recien creado
      await authService.login(setupData.username, setupData.password);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch {
      setSetupError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Cargando estado
  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Formulario de primer usuario
  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-2xl">
          <div className="text-center">
            <div className="flex justify-center text-6xl">🧙</div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Primer Acceso</h2>
            <p className="mt-1 text-sm text-gray-500">
              Cree su usuario administrador para comenzar a usar el sistema.
            </p>
          </div>

          {setupSuccess ? (
            <div className="rounded-md bg-green-50 p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-green-800 font-medium">
                Usuario creado correctamente. Redirigiendo...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Usuario</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text" required autoFocus
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Ej: felipe"
                    value={setupData.username}
                    onChange={(e) => setSetupData({ ...setupData, username: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Correo (opcional)</label>
                <input
                  type="email"
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="felipe@ejemplo.com"
                  value={setupData.email}
                  onChange={(e) => setSetupData({ ...setupData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password" required
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Mínimo 6 caracteres"
                    value={setupData.password}
                    onChange={(e) => setSetupData({ ...setupData, password: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Confirmar contraseña</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password" required
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Repita la contraseña"
                    value={setupData.confirm}
                    onChange={(e) => setSetupData({ ...setupData, confirm: e.target.value })}
                  />
                </div>
              </div>

              {setupError && (
                <div className="rounded-md bg-red-50 p-3">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                    <p className="ml-2 text-sm text-red-800">{setupError}</p>
                  </div>
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {loading ? 'Creando...' : 'Crear usuario administrador'}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-400">
            Colombia · NIIF para Pymes · Grupo 2
          </p>
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
            <div className="text-6xl">🧙</div>
          </div>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">
            Don Peppini
          </h2>
          <p className="text-center text-lg font-medium text-indigo-600">
            Contadore
          </p>
          <p className="mt-2 text-center text-sm text-gray-500">
            Sistema Contable NIIF para Pymes
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Usuario
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required autoFocus
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Ingrese su usuario"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Ingrese su contraseña"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Ingresar'
              )}
            </button>
          </div>
        </form>

        <div className="text-center text-xs text-gray-400 mt-6">
          Colombia  NIIF para Pymes  Grupo 2
        </div>
      </div>
    </div>
  );
};

export default Login;
