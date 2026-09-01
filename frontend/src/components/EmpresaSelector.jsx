// 🎩 Don Peppini Contadore - Selector de Empresa
import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';

const EmpresaSelector = ({ onNuevaEmpresa }) => {
  const { empresas, empresaActual, seleccionarEmpresa, loading } = useEmpresa();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center px-3 py-2 text-sm text-gray-500">
        <div className="animate-pulse flex items-center">
          <div className="h-4 w-4 bg-gray-300 rounded mr-2"></div>
          <div className="h-4 w-32 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (empresas.length === 0) {
    return (
      <button
        onClick={onNuevaEmpresa}
        className="flex items-center px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
      >
        <Plus className="h-4 w-4 mr-2" />
        Crear empresa
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
      >
        <Building2 className="h-4 w-4 mr-2 text-indigo-600" />
        <span className="truncate max-w-[140px]">
          {empresaActual?.nombre_comercial || empresaActual?.razon_social || 'Seleccionar'}
        </span>
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          <div className="p-1">
            {empresas.map((empresa) => (
              <button
                key={empresa.id}
                onClick={() => {
                  seleccionarEmpresa(empresa);
                  setOpen(false);
                }}
                className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                  empresaActual?.id === empresa.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 text-left">
                  <div className="font-medium truncate">
                    {empresa.nombre_comercial || empresa.razon_social}
                  </div>
                  <div className="text-xs text-gray-500">
                    NIT: {empresa.nit}
                  </div>
                </div>
                {empresaActual?.id === empresa.id && (
                  <Check className="h-4 w-4 text-indigo-600 ml-2" />
                )}
              </button>
            ))}
          </div>
          
          {onNuevaEmpresa && (
            <>
              <div className="border-t border-gray-100"></div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setOpen(false);
                    onNuevaEmpresa();
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva empresa
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EmpresaSelector;
