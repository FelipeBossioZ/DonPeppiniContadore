# Don Peppini Contadore - Primer usuario setup
from django.contrib.auth.models import User, Group
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json


@require_http_methods(["GET"])
def setup_status(request):
    """Devuelve si ya hay usuarios registrados."""
    has_users = User.objects.exists()
    return JsonResponse({"has_users": has_users})


@csrf_exempt
@require_http_methods(["POST"])
def setup_user(request):
    """Crea el primer superusuario admin.
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

    if not username or not password:
        return JsonResponse(
            {"error": "Usuario y contraseña son obligatorios"}, status=400
        )

    if len(password) < 6:
        return JsonResponse(
            {"error": "La contraseña debe tener al menos 6 caracteres"}, status=400
        )

    if User.objects.filter(username=username).exists():
        return JsonResponse(
            {"error": "Ese nombre de usuario ya existe"}, status=400
        )

    user = User.objects.create_superuser(
        username=username,
        email=email or "",
        password=password,
    )

    # Asignar al grupo admin
    admin_group, _ = Group.objects.get_or_create(name="admin")
    user.groups.add(admin_group)

    return JsonResponse(
        {"message": f"Usuario '{username}' creado como administrador"},
        status=201,
    )
