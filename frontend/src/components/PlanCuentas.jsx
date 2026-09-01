// frontend/src/components/PlanCuentas.jsx
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, Download, FileText } from 'lucide-react';
import axios from 'axios';

const PlanCuentas = () => {
    const [cuentas, setCuentas] = useState([]);
    const [cuentasArbol, setCuentasArbol] = useState([]);
    const [expandidos, setExpandidos] = useState({});
    const [busqueda, setBusqueda] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cargarCuentas();
    }, []);

    const cargarCuentas = async () => {
        try {
            const response = await axios.get('http://localhost:8000/api/contabilidad/cuentas/');
            setCuentas(response.data);
            
            // Construir árbol
            const arbol = construirArbol(response.data);
            setCuentasArbol(arbol);
            
            // Expandir primeras cuentas por defecto
            const inicial = {};
            response.data.filter(c => !c.padre).forEach(c => {
                inicial[c.codigo] = true;
            });
            setExpandidos(inicial);
        } catch (error) {
            console.error('Error cargando cuentas:', error);
        } finally {
            setLoading(false);
        }
    };

    const construirArbol = (cuentasFlat) => {
        const mapa = {};
        const arbol = [];
        
        // Crear mapa
        cuentasFlat.forEach(cuenta => {
            mapa[cuenta.codigo] = { ...cuenta, hijos: [] };
        });
        
        // Construir jerarquía
        cuentasFlat.forEach(cuenta => {
            if (cuenta.padre) {
                if (mapa[cuenta.padre]) {
                    mapa[cuenta.padre].hijos.push(mapa[cuenta.codigo]);
                }
            } else {
                arbol.push(mapa[cuenta.codigo]);
            }
        });
        
        return arbol;
    };

    const toggleExpander = (codigo) => {
        setExpandidos(prev => ({
            ...prev,
            [codigo]: !prev[codigo]
        }));
    };

    const exportarExcel = async () => {
        try {
            const response = await axios.get(
                'http://localhost:8000/api/contabilidad/cuentas/exportar_excel/',
                { responseType: 'blob' }
            );
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plan_cuentas.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Error al exportar. Verifica que el endpoint esté configurado.');
        }
    };

    const CuentaNodo = ({ cuenta, nivel = 0 }) => {
        const tieneHijos = cuenta.hijos && cuenta.hijos.length > 0;
        const estaExpandido = expandidos[cuenta.codigo];
        const cumpleBusqueda = !busqueda || 
            cuenta.codigo.includes(busqueda) || 
            cuenta.nombre.toLowerCase().includes(busqueda.toLowerCase());
        
        if (busqueda && !cumpleBusqueda && !tieneHijosQueCumplen(cuenta)) {
            return null;
        }

        return (
            <div className="select-none">
                <div 
                    className={`
                        flex items-center py-2 px-3 hover:bg-gray-50 cursor-pointer
                        ${nivel === 0 ? 'font-bold bg-gray-100' : ''}
                        ${nivel === 1 ? 'font-semibold' : ''}
                    `}
                    style={{ paddingLeft: `${nivel * 24 + 12}px` }}
                    onClick={() => tieneHijos && toggleExpander(cuenta.codigo)}
                >
                    {tieneHijos ? (
                        estaExpandido ? 
                            <ChevronDown className="h-4 w-4 mr-2 text-gray-500" /> : 
                            <ChevronRight className="h-4 w-4 mr-2 text-gray-500" />
                    ) : (
                        <span className="w-6 inline-block" />
                    )}
                    
                    <span className={`
                        ${nivel === 0 ? 'text-indigo-600' : ''}
                        ${nivel === 1 ? 'text-gray-800' : 'text-gray-700'}
                    `}>
                        <span className="font-mono mr-3">{cuenta.codigo}</span>
                        <span>{cuenta.nombre}</span>
                    </span>
                </div>
                
                {tieneHijos && estaExpandido && (
                    <div>
                        {cuenta.hijos.map(hijo => (
                            <CuentaNodo 
                                key={hijo.codigo} 
                                cuenta={hijo} 
                                nivel={nivel + 1} 
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const tieneHijosQueCumplen = (cuenta) => {
        if (!cuenta.hijos) return false;
        return cuenta.hijos.some(hijo => {
            const cumple = hijo.codigo.includes(busqueda) || 
                          hijo.nombre.toLowerCase().includes(busqueda.toLowerCase());
            return cumple || tieneHijosQueCumplen(hijo);
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Plan Único de Cuentas (PUC)
                    </h3>
                    <button
                        onClick={exportarExcel}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Excel
                    </button>
                </div>
                
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código o nombre..."
                        className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>
                
                <div className="mt-2 flex items-center text-sm text-gray-600">
                    <FileText className="h-4 w-4 mr-2" />
                    Total: {cuentas.length} cuentas
                </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
                {cuentasArbol.map(cuenta => (
                    <CuentaNodo key={cuenta.codigo} cuenta={cuenta} />
                ))}
            </div>
        </div>
    );
};

export default PlanCuentas;