import React, { useState, useEffect, useRef } from 'react';
import {
  Database, HardDriveDownload, HardDriveUpload, Upload, Download,
  Save, RefreshCw, FolderSync, ShieldAlert, CheckCircle2,
  AlertTriangle, Clock, FileDigit, MapPin,
} from 'lucide-react';
import { toast } from '../ui/ToastHost';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const getToken = () => localStorage.getItem('access_token');

async function apiGet(path) {
  const r = await fetch(`${API_URL}/api/dbadmin/${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || 'Error de comunicacion con el servidor');
  }
  return r.json();
}

async function apiPost(path, body = null) {
  const r = await fetch(`${API_URL}/api/dbadmin/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || 'Error de comunicacion con el servidor');
  }
  return r.json();
}

const Tarjeta = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 ${className}`}>{children}</div>
);

const Titulo = ({ icono: Icono, titulo, desc, color = 'text-indigo-600' }) => (
  <div className="flex items-start gap-3 mb-4">
    <div className={`p-2 rounded-lg bg-indigo-50 ${color}`}><Icono className="h-5 w-5" /></div>
    <div>
      <h3 className="font-semibold text-gray-800">{titulo}</h3>
      {desc && <p className="text-sm text-gray-500 mt-0.5">{desc}</p>}
    </div>
  </div>
);

const Btn = ({ onClick, children, primario, peligro, disabled, className = '' }) => (
  <button onClick={onClick} disabled={disabled}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
      disabled:opacity-50 disabled:cursor-not-allowed
      ${peligro ? 'bg-red-600 text-white hover:bg-red-700'
        : primario ? 'bg-indigo-600 text-white hover:bg-indigo-700'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} ${className}`}>
    {children}
  </button>
);

export default function AdminBD() {
  const [estado, setEstado] = useState(null);
  const [respaldos, setRespaldos] = useState({ locales: [], boveda: [] });
  const [ocupado, setOcupado] = useState(false);
  const [tab, setTab] = useState('respaldos');
  const fileRef = useRef(null);
  const [nuevaRuta, setNuevaRuta] = useState('');
  const [copiarActual, setCopiarActual] = useState(true);

  const refrescar = async () => {
    try {
      const [e, r] = await Promise.all([apiGet('estado/'), apiGet('respaldos/')]);
      setEstado(e);
      setRespaldos(r);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  useEffect(() => { refrescar(); }, []);

  const accion = async (fn, okMsg) => {
    setOcupado(true);
    try {
      await fn();
      toast(okMsg);
      await refrescar();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setOcupado(false);
    }
  };

  const respaldar = () => accion(() => apiPost('respaldar/'), 'Respaldo creado con exito');
  const pull = () => accion(() => apiPost('boveda/pull/'), 'Base traida desde OneDrive');
  const push = () => accion(() => apiPost('boveda/push/'), 'Base subida a OneDrive');

  const restaurar = (origen, r) => accion(
    () => apiPost('restaurar/', { origen, archivo: r.nombre }),
    `Base restaurada desde ${r.nombre}. Reinicia el sistema si esta abierto.`
  );

  const importar = (file) => accion(async () => {
    const fd = new FormData();
    fd.append('archivo', file);
    const r = await fetch(`${API_URL}/api/dbadmin/importar/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || 'La importacion fallo');
    }
  }, 'Base importada con exito');

  const cambiarRuta = () => accion(async () => {
    const r = await apiPost('cambiar-ruta/', { db_path: nuevaRuta, copiar_actual: copiarActual });
    setNuevaRuta('');
    toast(r.mensaje);
  }, 'Ruta actualizada');

  const db = estado?.db;
  const boveda = estado?.boveda;
  const resumen = estado?.resumen || {};

  const COLOR_COMP = {
    boveda_mas_nueva: { txt: 'OneDrive tiene la version mas nueva', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    local_mas_nueva: { txt: 'Esta PC tiene la version mas nueva', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    sincronizadas: { txt: 'Local y OneDrive estan sincronizadas', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    boveda_vacia: { txt: 'OneDrive no tiene base principal', cls: 'bg-red-50 text-red-700 border-red-200' },
  };
  const comp = COLOR_COMP[boveda?.comparacion];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-indigo-600 text-white"><Database className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Base de datos</h1>
          <p className="text-sm text-gray-500">Respaldos, restauracion, importacion y sincronizacion con OneDrive</p>
        </div>
        <Btn onClick={refrescar} disabled={ocupado} className="ml-auto">
          <RefreshCw className={`h-4 w-4 ${ocupado ? 'animate-spin' : ''}`} /> Actualizar
        </Btn>
      </div>

      {!estado ? (
        <Tarjeta><p className="text-gray-500 text-sm">Cargando estado de la base de datos...</p></Tarjeta>
      ) : (
        <>
          {/* ESTADO */}
          <Tarjeta>
            <Titulo icono={FileDigit} titulo="Estado actual" desc="Informacion de la base que esta usando el sistema" />
            {!db ? (
              <div className="flex items-center gap-2 text-red-600 text-sm"><AlertTriangle className="h-4 w-4" /> No hay base de datos local</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-gray-400 text-xs mb-1">Tamano</p><p className="font-semibold text-gray-800">{db.tamano_mb} MB</p></div>
                <div><p className="text-gray-400 text-xs mb-1">Ultima escritura</p><p className="font-semibold text-gray-800">{db.fecha}</p></div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Integridad</p>
                  {estado.integridad === 'ok'
                    ? <p className="font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> OK</p>
                    : <p className="font-semibold text-red-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {estado.integridad}</p>}
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Migraciones pendientes</p>
                  {estado.pendientes_migraciones > 0
                    ? <p className="font-semibold text-amber-600">{estado.pendientes_migraciones} (se aplican al iniciar)</p>
                    : <p className="font-semibold text-gray-800">Ninguna</p>}
                </div>
              </div>
            )}
            {Object.keys(resumen).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                <span><b className="text-gray-800">{resumen.empresas ?? '—'}</b> empresas</span>
                <span><b className="text-gray-800">{resumen.terceros ?? '—'}</b> terceros</span>
                <span><b className="text-gray-800">{resumen.cuentas ?? '—'}</b> cuentas</span>
                <span><b className="text-gray-800">{resumen.asientos ?? '—'}</b> asientos</span>
                <span><b className="text-gray-800">{resumen.usuarios ?? '—'}</b> usuarios</span>
              </div>
            )}
          </Tarjeta>

          {/* ACCIONES PRINCIPALES */}
          <div className="grid md:grid-cols-2 gap-6">
            <Tarjeta>
              <Titulo icono={FolderSync} titulo="Sincronizacion con OneDrive" desc="Boveda compartida entre tus PCs" />
              {boveda?.disponible ? (
                <div className="space-y-3 text-sm">
                  <div className={`border rounded-lg px-3 py-2 ${comp.cls}`}>{comp.txt}</div>
                  <div className="text-gray-600 space-y-1">
                    <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {boveda.ruta}</p>
                    {boveda.fecha && <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Copia de OneDrive: {boveda.fecha} ({boveda.tamano_mb} MB)</p>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Btn onClick={pull} primario disabled={ocupado}><HardDriveDownload className="h-4 w-4" /> Traer de OneDrive</Btn>
                    <Btn onClick={push} disabled={ocupado}><HardDriveUpload className="h-4 w-4" /> Subir a OneDrive</Btn>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {boveda?.configurada
                    ? 'La boveda esta configurada pero no se encuentra (revisa OneDrive/internet).'
                    : 'No configurada: crea CONFIG_LOCAL.txt en la carpeta del sistema (ver CONFIG_LOCAL.ejemplo.txt).'}
                </p>
              )}
            </Tarjeta>

            <Tarjeta>
              <Titulo icono={ShieldAlert} titulo="Respaldo manual" desc="Copia de seguridad inmediata aqui y en OneDrive" />
              <p className="text-sm text-gray-500 mb-3">
                Crea una copia fechada en esta PC y en la boveda (conserva las ultimas 10 de cada una).
              </p>
              <Btn onClick={respaldar} primario disabled={ocupado}><Save className="h-4 w-4" /> Respaldar ahora</Btn>
            </Tarjeta>
          </div>

          {/* RESPALDOS / IMPORTAR */}
          <Tarjeta>
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              {[['respaldos', 'Respaldos guardados'], ['importar', 'Importar / Restaurar'], ['ruta', 'Ubicacion de la base']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'respaldos' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">En esta PC (backend/db_backups)</h4>
                  {respaldos.locales.length === 0
                    ? <p className="text-sm text-gray-400">Todavia no hay respaldos locales.</p>
                    : <ul className="divide-y divide-gray-100">
                        {respaldos.locales.map(r => (
                          <li key={r.nombre} className="flex items-center justify-between py-2 text-sm">
                            <div><p className="text-gray-800 font-medium">{r.nombre}</p><p className="text-xs text-gray-400">{r.fecha} - {r.tamano_mb} MB</p></div>
                            <Btn onClick={() => restaurar('local', r)} peligro disabled={ocupado} className="!px-3 !py-1.5">Restaurar</Btn>
                          </li>
                        ))}
                      </ul>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">En la boveda (OneDrive/backups)</h4>
                  {respaldos.boveda.length === 0
                    ? <p className="text-sm text-gray-400">Todavia no hay respaldos en la boveda.</p>
                    : <ul className="divide-y divide-gray-100">
                        {respaldos.boveda.map(r => (
                          <li key={r.nombre} className="flex items-center justify-between py-2 text-sm">
                            <div><p className="text-gray-800 font-medium">{r.nombre}</p><p className="text-xs text-gray-400">{r.fecha} - {r.tamano_mb} MB</p></div>
                            <Btn onClick={() => restaurar('boveda', r)} peligro disabled={ocupado} className="!px-3 !py-1.5">Restaurar</Btn>
                          </li>
                        ))}
                      </ul>}
                </div>
              </div>
            )}

            {tab === 'importar' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors">
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-1">Importar una base de datos externa (.sqlite3)</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Reemplaza la base actual. Se exige que sea una base valida del sistema y se respalda la actual automaticamente.
                  </p>
                  <input ref={fileRef} type="file" accept=".sqlite3,.db,.sqlite" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
                  <Btn onClick={() => fileRef.current?.click()} primario disabled={ocupado}>
                    <Upload className="h-4 w-4" /> Elegir archivo...
                  </Btn>
                </div>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Descargar copia de la base actual</p>
                    <p className="text-xs text-gray-400">Archivo .sqlite3 listo para guardar o llevar a otra PC</p>
                  </div>
                  <a href={`${API_URL}/api/dbadmin/exportar/`} download
                    onClick={async (e) => {
                      e.preventDefault();
                      const r = await fetch(`${API_URL}/api/dbadmin/exportar/`, { headers: { Authorization: `Bearer ${getToken()}` } });
                      if (!r.ok) { toast('No se pudo exportar', 'error'); return; }
                      const blob = await r.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = (r.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || 'donpeppini_copia.sqlite3';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                    <Download className="h-4 w-4" /> Exportar
                  </a>
                </div>
              </div>
            )}

            {tab === 'ruta' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
                  <p className="text-gray-500 text-xs mb-1">Ruta actual de la base</p>
                  <p className="font-mono text-gray-800 break-all">{db?.archivo}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nueva ruta absoluta (debe terminar en .sqlite3)</label>
                  <input value={nuevaRuta} onChange={(e) => setNuevaRuta(e.target.value)}
                    placeholder="Ej: D:\\Contabilidad\\donpeppini.sqlite3"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <input type="checkbox" checked={copiarActual} onChange={(e) => setCopiarActual(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600" />
                    Copiar la base actual a la nueva ubicacion (recomendado)
                  </label>
                </div>
                <Btn onClick={cambiarRuta} primario disabled={ocupado || !nuevaRuta.trim()}>
                  <Save className="h-4 w-4" /> Guardar ruta
                </Btn>
                <p className="text-xs text-gray-400">
                  El cambio se hace efectivo al reiniciar el sistema. Queda guardado en backend/.env de esta PC (no se comparte por GitHub).
                </p>
              </div>
            )}
          </Tarjeta>
        </>
      )}
    </div>
  );
}
