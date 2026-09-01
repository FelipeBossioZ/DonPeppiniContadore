# 🎩 Don Peppini Contadore - Comando para crear empresa inicial
# empresas/management/commands/crear_empresa_nfdc.py

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from empresas.models import Empresa, ConfiguracionEmpresa
from contabilidad.models import Cuenta
from terceros.models import Tercero
from datetime import date


class Command(BaseCommand):
    help = '🎩 Crea la empresa Neurofisiología de Colombia con datos iniciales'

    def add_arguments(self, parser):
        parser.add_argument(
            '--crear-usuario',
            action='store_true',
            help='Crear usuario admin si no existe'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('🎩 Creando empresa Neurofisiología de Colombia...'))
        
        # Crear o actualizar la empresa
        empresa, created = Empresa.objects.update_or_create(
            nit='902015968-1',
            defaults={
                'razon_social': 'Neurofisiología de Colombia S.A.S.',
                'nombre_comercial': 'NFDC',
                'tipo_persona': 'J',
                'regimen': 'RC',
                'grupo_niif': '2',
                'tipo_contribuyente': 'AR',
                'actividad_principal': '8621',
                'descripcion_actividad': 'Actividades de la práctica médica, sin internación',
                'direccion': 'Medellín, Antioquia',
                'ciudad': 'Medellín',
                'departamento': 'Antioquia',
                'codigo_municipio': '05001',
                'codigo_departamento': '05',
                'fecha_inicio_actividades': date(2025, 11, 28),
                'periodo_contable_actual': 2025,
                'activa': True,
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('   ✅ Empresa creada'))
        else:
            self.stdout.write(self.style.WARNING('   ⚠️ Empresa actualizada'))
        
        # Crear configuración si no existe
        ConfiguracionEmpresa.objects.get_or_create(empresa=empresa)
        
        # Crear Plan de Cuentas personalizado para NFDC
        self.crear_cuentas_nfdc(empresa)
        
        # Crear terceros básicos
        self.crear_terceros_nfdc(empresa)
        
        # Crear usuario admin si se solicita
        if options['crear_usuario']:
            self.crear_usuario_admin()
        
        self.stdout.write(self.style.SUCCESS('🎩 ¡Empresa NFDC configurada exitosamente!'))

    def crear_cuentas_nfdc(self, empresa):
        """Crea las cuentas contables personalizadas de NFDC"""
        self.stdout.write(self.style.NOTICE('   Creando plan de cuentas NFDC...'))
        
        cuentas_nfdc = [
            # Activos
            ('1', 'ACTIVO', 1, 'D', 'Clase'),
            ('11', 'DISPONIBLE', 2, 'D', 'Grupo'),
            ('1105', 'Caja', 3, 'D', 'Cuenta'),
            ('110505', 'Caja general', 4, 'D', 'Subcuenta'),
            ('1110', 'Bancos', 3, 'D', 'Cuenta'),
            ('111005', 'Cuenta corriente', 4, 'D', 'Subcuenta'),
            ('13', 'DEUDORES', 2, 'D', 'Grupo'),
            ('1305', 'Clientes', 3, 'D', 'Cuenta'),
            ('130505', 'Clientes nacionales', 4, 'D', 'Subcuenta'),
            ('1355', 'Anticipos y avances', 3, 'D', 'Cuenta'),
            ('135515', 'Anticipo de impuestos - Autorretención', 4, 'D', 'Subcuenta'),
            ('1365', 'Cuentas por cobrar a socios', 3, 'D', 'Cuenta'),
            ('136505', 'Aportes por cobrar', 4, 'D', 'Subcuenta'),
            ('15', 'PROPIEDADES, PLANTA Y EQUIPO', 2, 'D', 'Grupo'),
            ('1524', 'Equipo de oficina', 3, 'D', 'Cuenta'),
            ('1528', 'Equipo de computación', 3, 'D', 'Cuenta'),
            ('1532', 'Equipo médico-científico', 3, 'D', 'Cuenta'),
            
            # Pasivos
            ('2', 'PASIVO', 1, 'C', 'Clase'),
            ('23', 'CUENTAS POR PAGAR', 2, 'C', 'Grupo'),
            ('2335', 'Costos y gastos por pagar', 3, 'C', 'Cuenta'),
            ('2365', 'Retención en la fuente', 3, 'C', 'Cuenta'),
            ('236575', 'Autorretención por pagar', 4, 'C', 'Subcuenta'),
            ('2370', 'Retenciones y aportes de nómina', 3, 'C', 'Cuenta'),
            ('24', 'IMPUESTOS, GRAVÁMENES Y TASAS', 2, 'C', 'Grupo'),
            ('2404', 'Renta y complementarios', 3, 'C', 'Cuenta'),
            ('2408', 'IVA por pagar', 3, 'C', 'Cuenta'),
            ('25', 'OBLIGACIONES LABORALES', 2, 'C', 'Grupo'),
            ('2505', 'Salarios por pagar', 3, 'C', 'Cuenta'),
            
            # Patrimonio
            ('3', 'PATRIMONIO', 1, 'C', 'Clase'),
            ('31', 'CAPITAL SOCIAL', 2, 'C', 'Grupo'),
            ('3105', 'Capital suscrito y pagado', 3, 'C', 'Cuenta'),
            ('310505', 'Capital autorizado', 4, 'C', 'Subcuenta'),
            ('33', 'RESERVAS', 2, 'C', 'Grupo'),
            ('3305', 'Reserva legal', 3, 'C', 'Cuenta'),
            ('36', 'RESULTADOS DEL EJERCICIO', 2, 'C', 'Grupo'),
            ('3605', 'Utilidad del ejercicio', 3, 'C', 'Cuenta'),
            ('3610', 'Pérdida del ejercicio', 3, 'D', 'Cuenta'),
            
            # Ingresos
            ('4', 'INGRESOS', 1, 'C', 'Clase'),
            ('41', 'OPERACIONALES', 2, 'C', 'Grupo'),
            ('4105', 'Servicios de salud', 3, 'C', 'Cuenta'),
            ('410505', 'Servicios de neurofisiología', 4, 'C', 'Subcuenta'),
            
            # Gastos
            ('5', 'GASTOS', 1, 'D', 'Clase'),
            ('51', 'OPERACIONALES DE ADMINISTRACIÓN', 2, 'D', 'Grupo'),
            ('5110', 'Honorarios', 3, 'D', 'Cuenta'),
            ('511005', 'Honorarios administración', 4, 'D', 'Subcuenta'),
            ('5195', 'Gastos diversos', 3, 'D', 'Cuenta'),
            ('519595', 'Otros gastos diversos', 4, 'D', 'Subcuenta'),
        ]
        
        creadas = 0
        for codigo, nombre, nivel, naturaleza, tipo in cuentas_nfdc:
            # Buscar padre
            padre = None
            if len(codigo) > 1:
                for i in range(len(codigo) - 1, 0, -1):
                    try:
                        padre = Cuenta.objects.get(empresa=empresa, codigo=codigo[:i])
                        break
                    except Cuenta.DoesNotExist:
                        continue
            
            cuenta, created = Cuenta.objects.update_or_create(
                empresa=empresa,
                codigo=codigo,
                defaults={
                    'nombre': nombre,
                    'nivel': nivel,
                    'naturaleza': naturaleza,
                    'tipo': tipo,
                    'padre': padre,
                    'activa': True,
                }
            )
            if created:
                creadas += 1
        
        self.stdout.write(self.style.SUCCESS(f'   ✅ {creadas} cuentas creadas'))

    def crear_terceros_nfdc(self, empresa):
        """Crea los terceros básicos para NFDC"""
        self.stdout.write(self.style.NOTICE('   Creando terceros básicos...'))
        
        terceros_nfdc = [
            {
                'tipo_documento': 'NIT',
                'numero_documento': '902015968',
                'digito_verificacion': '1',
                'nombre_razon_social': 'Neurofisiología de Colombia S.A.S.',
                'tipo_tercero': 'OTR',
            },
            {
                'tipo_documento': 'CC',
                'numero_documento': '00000001',
                'nombre_razon_social': 'Socios Fundadores',
                'tipo_tercero': 'SOC',
            },
            {
                'tipo_documento': 'NIT',
                'numero_documento': '900000001',
                'digito_verificacion': '0',
                'nombre_razon_social': 'Clientes Varios',
                'tipo_tercero': 'CLI',
            },
        ]
        
        creados = 0
        for datos in terceros_nfdc:
            tercero, created = Tercero.objects.update_or_create(
                empresa=empresa,
                numero_documento=datos['numero_documento'],
                defaults={**datos, 'empresa': empresa}
            )
            if created:
                creados += 1
        
        self.stdout.write(self.style.SUCCESS(f'   ✅ {creados} terceros creados'))

    def crear_usuario_admin(self):
        """Crea el usuario administrador"""
        self.stdout.write(self.style.NOTICE('   Creando usuario administrador...'))
        
        if User.objects.filter(username='admin').exists():
            self.stdout.write(self.style.WARNING('   ⚠️ Usuario admin ya existe'))
            return
        
        user = User.objects.create_superuser(
            username='admin',
            email='admin@donpeppini.com',
            password='admin123',
            first_name='Administrador',
            last_name='Don Peppini'
        )
        
        self.stdout.write(self.style.SUCCESS('   ✅ Usuario admin creado'))
        self.stdout.write(self.style.WARNING('   ⚠️ Credenciales: admin / admin123'))
        self.stdout.write(self.style.WARNING('   ⚠️ ¡Cambia la contraseña después de iniciar sesión!'))
