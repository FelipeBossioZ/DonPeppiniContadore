// 🎩 Don Peppini Contadore - Contexto de Empresa
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getEmpresas } from '../services/api';

const EmpresaContext = createContext(null);

export const EmpresaProvider = ({ children }) => {
  const [empresas, setEmpresas] = useState([]);
  const [empresaActual, setEmpresaActual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar empresas al iniciar
  useEffect(() => {
    const cargarEmpresas = async () => {
      try {
        setLoading(true);
        const data = await getEmpresas();
        const lista = data.results || data;
        setEmpresas(lista);
        
        // Recuperar empresa guardada o usar la primera
        const guardada = localStorage.getItem('empresaActualId');
        if (guardada) {
          const encontrada = lista.find(e => e.id === parseInt(guardada));
          if (encontrada) {
            setEmpresaActual(encontrada);
          } else if (lista.length > 0) {
            setEmpresaActual(lista[0]);
          }
        } else if (lista.length > 0) {
          setEmpresaActual(lista[0]);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error cargando empresas:', err);
        setError('No se pudieron cargar las empresas');
      } finally {
        setLoading(false);
      }
    };

    cargarEmpresas();
  }, []);

  // Guardar empresa seleccionada en localStorage
  const seleccionarEmpresa = (empresa) => {
    setEmpresaActual(empresa);
    if (empresa) {
      localStorage.setItem('empresaActualId', empresa.id.toString());
    } else {
      localStorage.removeItem('empresaActualId');
    }
  };

  // Recargar lista de empresas
  const recargarEmpresas = async () => {
    try {
      const data = await getEmpresas();
      const lista = data.results || data;
      setEmpresas(lista);
      return lista;
    } catch (err) {
      console.error('Error recargando empresas:', err);
      throw err;
    }
  };

  const value = {
    empresas,
    empresaActual,
    empresaId: empresaActual?.id || null,
    loading,
    error,
    seleccionarEmpresa,
    recargarEmpresas,
  };

  return (
    <EmpresaContext.Provider value={value}>
      {children}
    </EmpresaContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useEmpresa = () => {
  const context = useContext(EmpresaContext);
  if (!context) {
    throw new Error('useEmpresa debe usarse dentro de un EmpresaProvider');
  }
  return context;
};

export default EmpresaContext;
