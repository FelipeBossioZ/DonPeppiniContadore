// frontend/src/components/TercerosTabla.jsx
import React, { useState } from 'react';
import { Edit2, Trash2, X } from 'lucide-react';
import axios from 'axios';

const TercerosTabla = ({ data, onRefresh }) => {
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedTercero, setSelectedTercero] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    const COLUMNS = [
        { header: 'ID', accessor: 'id' },
        { header: 'DOCUMENTO', accessor: 'documento' },
        { header: 'RAZÓN SOCIAL', accessor: 'nombre_razon_social' },
        { header: 'TELÉFONO', accessor: 'telefono' },
        { header: 'EMAIL', accessor: 'email' },
        { header: 'ACCIONES', accessor: 'actions' },
    ];

    const handleEdit = (tercero) => {
        setSelectedTercero(tercero);
        setEditFormData({
            tipo_documento: tercero.tipo_documento,
            numero_documento: tercero.numero_documento,
            nombre_razon_social: tercero.nombre_razon_social,
            direccion: tercero.direccion || '',
            telefono: tercero.telefono || '',
            email: tercero.email || ''
        });
        setShowEditModal(true);
    };

    const handleDelete = (tercero) => {
        setSelectedTercero(tercero);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            await axios.delete(`http://localhost:8000/api/terceros/terceros/${selectedTercero.id}/`);
            setShowDeleteModal(false);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error al eliminar:', error);
            alert('Error al eliminar el tercero');
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await axios.put(
                `http://localhost:8000/api/terceros/terceros/${selectedTercero.id}/`,
                editFormData
            );
            setShowEditModal(false);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error al actualizar:', error);
            alert('Error al actualizar el tercero');
        }
    };

    return (
        <>
            <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-100">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {COLUMNS.map((col, index) => (
                                <th
                                    key={index}
                                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((tercero) => (
                            <tr key={tercero.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {tercero.id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {tercero.tipo_documento} {tercero.numero_documento}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {tercero.nombre_razon_social}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {tercero.telefono || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {tercero.email || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        onClick={() => handleEdit(tercero)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                                    >
                                        Editar
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(tercero)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        Eliminar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de Edición */}
            {showEditModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Editar Tercero</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUpdate}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tipo de Documento
                                </label>
                                <select 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={editFormData.tipo_documento}
                                    onChange={(e) => setEditFormData({...editFormData, tipo_documento: e.target.value})}
                                    required
                                >
                                    <option value="CC">Cédula de Ciudadanía</option>
                                    <option value="NIT">NIT</option>
                                    <option value="CE">Cédula de Extranjería</option>
                                </select>
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Número de Documento
                                </label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={editFormData.numero_documento}
                                    onChange={(e) => setEditFormData({...editFormData, numero_documento: e.target.value})}
                                    required 
                                />
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nombre/Razón Social
                                </label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={editFormData.nombre_razon_social}
                                    onChange={(e) => setEditFormData({...editFormData, nombre_razon_social: e.target.value})}
                                    required 
                                />
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Dirección
                                </label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={editFormData.direccion}
                                    onChange={(e) => setEditFormData({...editFormData, direccion: e.target.value})}
                                />
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Teléfono
                                </label>
                                <input 
                                    type="tel" 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={editFormData.telefono}
                                    onChange={(e) => setEditFormData({...editFormData, telefono: e.target.value})}
                                />
                            </div>
                            
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email
                                </label>
                                <input 
                                    type="email" 
                                    className="w-full p-2 border border-gray-300 rounded"
                                    value={editFormData.email}
                                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                                />
                            </div>
                            
                            <div className="flex justify-end space-x-2">
                                <button 
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                <Trash2 className="h-6 w-6 text-red-600" />
                            </div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">
                                Eliminar Tercero
                            </h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-gray-500">
                                    ¿Está seguro que desea eliminar a <strong>{selectedTercero?.nombre_razon_social}</strong>?
                                    Esta acción no se puede deshacer.
                                </p>
                            </div>
                            <div className="items-center px-4 py-3">
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                    Eliminar
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="mt-3 px-4 py-2 bg-white text-gray-700 text-base font-medium rounded-md w-full shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TercerosTabla;