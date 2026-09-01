# 🎩 Don Peppini Contadore - Permisos por Rol
# backend/pyme_contable_backend/permissions.py
#
# Roles basados en Django Groups:
#   - admin:    Todo (crear usuarios, cerrar periodos, anular, eliminar)
#   - contador: Crear/editar asientos, nómina, reportes. NO cerrar/reabrir/anular.
#   - consulta: Solo lectura. No puede crear ni modificar nada.
#
# Uso:
#   from pyme_contable_backend.permissions import IsAdmin, IsContadorOrAbove, IsReadOnly
#   permission_classes = [IsAuthenticated, IsContadorOrAbove]

from rest_framework.permissions import BasePermission

# Jerarquía: admin > contador > consulta
_ROLE_LEVEL = {
    'admin': 3,
    'contador': 2,
    'consulta': 1,
}


def get_user_role(user):
    """Devuelve el rol (string) del usuario basado en sus Groups."""
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return 'admin'
    groups = set(user.groups.values_list('name', flat=True))
    if 'admin' in groups:
        return 'admin'
    if 'contador' in groups:
        return 'contador'
    if 'consulta' in groups:
        return 'consulta'
    # Sin grupo asignado → consulta por defecto (principio de mínimo privilegio)
    return 'consulta'


def _has_min_role(user, min_role):
    role = get_user_role(user)
    if not role:
        return False
    return _ROLE_LEVEL.get(role, 0) >= _ROLE_LEVEL.get(min_role, 99)


class IsAdmin(BasePermission):
    """Solo admin puede acceder."""
    message = 'Se requiere rol de administrador.'

    def has_permission(self, request, view):
        return _has_min_role(request.user, 'admin')


class IsContadorOrAbove(BasePermission):
    """Contador o admin pueden acceder."""
    message = 'Se requiere rol de contador o administrador.'

    def has_permission(self, request, view):
        return _has_min_role(request.user, 'contador')


class IsReadOnly(BasePermission):
    """Cualquier rol autenticado puede leer. Escritura requiere contador+."""
    message = 'Solo lectura. Se requiere rol de contador para modificar.'

    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return _has_min_role(request.user, 'contador')
