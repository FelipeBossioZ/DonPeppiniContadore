# Don Peppini Contadore - Setup inicial completo
from django.contrib.auth.models import User, Group
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.management import call_command
import json


@require_http_methods(["GET"])
def setup_status(request):
    """Devuelve si ya hay usuarios registrados y si ya hay empresas."""
    return JsonResponse({
        "has_users": User.objects.exists(),
        "has_empresa": False  # Se puede consultar si se necesita
    })


@csrf_exempt
@require_http_methods(["POST"])
def setup_user(request):
    """Configuracion inicial completa:
    1. Crear superusuario admin
    2. Crear grupos de roles
    3. Crear empresa
    4. Cargar PUC colombiano
    Solo funciona si no hay usuarios.
    """
    if User.objects.exists():
        return JsonResponse(
            {"error": "Ya existe al menos un usuario. Use el login normal."},
            status=400,
        )

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "JSON invalido"}, status=400)

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    email = data.get("email", "").strip()

    # Datos de la empresa
    empresa_nit = data.get("empresa_nit", "").strip()
    empresa_razon = data.get("empresa_razon", "").strip()
    empresa_nombre = data.get("empresa_nombre", "").strip()
    empresa_dv = data.get("empresa_dv", "").strip()

    # Validaciones de usuario
    if not username or not password:
        return JsonResponse(
            {"error": "Usuario y contrasena son obligatorios"}, status=400
        )
    if len(password) < 6:
        return JsonResponse(
            {"error": "La contrasena debe tener al menos 6 caracteres"}, status=400
        )

    # Validaciones de empresa
    if not empresa_nit or not empresa_razon:
        return JsonResponse(
            {"error": "NIT y Razon Social de la empresa son obligatorios"}, status=400
        )

    # 1) Crear superusuario
    user = User.objects.create_superuser(
        username=username,
        email=email or "",
        password=password,
    )

    # 2) Crear roles y asignar admin
    for role_name in ['admin', 'contador', 'consulta']:
        Group.objects.get_or_create(name=role_name)
    user.groups.add(Group.objects.get(name='admin'))

    # 3) Crear empresa
    from empresas.models import Empresa
    nit_completo = f"{empresa_nit}-{empresa_dv}" if empresa_dv else empresa_nit
    Empresa.objects.create(
        nit=nit_completo,
        razon_social=empresa_razon,
        nombre_comercial=empresa_nombre or empresa_razon,
        grupo_niif='2',  # NIIF para Pymes por defecto
    )

    # 4) Cargar PUC
    try:
        call_command('cargar_puc')
    except Exception as e:
        # No es fatal — se puede cargar despues manualmente
        pass

    return JsonResponse(
        {
            "message": f"Configuracion completada. Usuario '{username}' creado como administrador.",
            "empresa": empresa_razon,
        },
        status=201,
    )
