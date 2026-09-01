# 🎩 Don Peppini Contadore - Configurar Roles
# backend/empresas/management/commands/setup_roles.py
#
# Uso: python manage.py setup_roles
# Crea los 3 grupos (admin, contador, consulta)
# Asigna 'admin' a todos los superusuarios existentes
# Opcional: python manage.py setup_roles --assign usuario1=contador usuario2=consulta

from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, User


ROLES = ['admin', 'contador', 'consulta']


class Command(BaseCommand):
    help = 'Crea los grupos de roles y asigna admin a superusuarios existentes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--assign', nargs='*', default=[],
            help='Asignar roles: usuario=rol (ej: maria=contador juan=consulta)'
        )

    def handle(self, *args, **options):
        # 1) Crear grupos
        for role in ROLES:
            group, created = Group.objects.get_or_create(name=role)
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✅ Grupo "{role}" creado'))
            else:
                self.stdout.write(f'  ℹ️  Grupo "{role}" ya existía')

        # 2) Asignar admin a superusuarios sin grupo
        admin_group = Group.objects.get(name='admin')
        superusers = User.objects.filter(is_superuser=True)
        for su in superusers:
            if not su.groups.filter(name__in=ROLES).exists():
                su.groups.add(admin_group)
                self.stdout.write(self.style.SUCCESS(f'  ✅ Superusuario "{su.username}" → admin'))

        # 3) Asignaciones manuales
        for assignment in options['assign']:
            if '=' not in assignment:
                self.stdout.write(self.style.ERROR(f'  ❌ Formato inválido: {assignment} (usar usuario=rol)'))
                continue
            username, role = assignment.split('=', 1)
            if role not in ROLES:
                self.stdout.write(self.style.ERROR(f'  ❌ Rol inválido: {role} (opciones: {", ".join(ROLES)})'))
                continue
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'  ❌ Usuario no encontrado: {username}'))
                continue
            # Quitar roles anteriores, asignar nuevo
            user.groups.remove(*Group.objects.filter(name__in=ROLES))
            user.groups.add(Group.objects.get(name=role))
            self.stdout.write(self.style.SUCCESS(f'  ✅ "{username}" → {role}'))

        # 4) Resumen
        self.stdout.write('')
        self.stdout.write('📋 Usuarios y roles:')
        for user in User.objects.all():
            role_groups = user.groups.filter(name__in=ROLES).values_list('name', flat=True)
            role = list(role_groups)[0] if role_groups else '(sin rol → consulta por defecto)'
            prefix = '👑' if user.is_superuser else '  '
            self.stdout.write(f'{prefix} {user.username}: {role}')
