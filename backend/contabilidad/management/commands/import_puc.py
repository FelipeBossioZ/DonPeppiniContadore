import csv
from django.core.management.base import BaseCommand
from contabilidad.models import Cuenta

class Command(BaseCommand):
    help = 'Importa el Plan Único de Cuentas (PUC) desde un archivo CSV a la base de datos.'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='La ruta del archivo CSV a importar.')

    def handle(self, *args, **options):
        csv_file_path = options['csv_file']
        self.stdout.write(self.style.SUCCESS(f'Iniciando la importación desde "{csv_file_path}"...'))

        # Limpiar la tabla de Cuentas antes de importar para evitar duplicados
        Cuenta.objects.all().delete()
        self.stdout.write(self.style.WARNING('Se han eliminado todas las cuentas existentes.'))

        accounts_to_create = []
        parent_map = {}

        try:
            with open(csv_file_path, mode='r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    codigo = row['codigo']
                    nombre = row['nombre']

                    # Determinar el código del padre
                    parent_codigo = None
                    if len(codigo) == 4:
                        parent_codigo = codigo[:2]
                    elif len(codigo) == 6:
                        parent_codigo = codigo[:4]
                    elif len(codigo) > 6: # Para subcuentas de más de 6 dígitos
                        parent_codigo = codigo[:6]

                    accounts_to_create.append({
                        'codigo': codigo,
                        'nombre': nombre,
                        'parent_codigo': parent_codigo
                    })

            # Crear las cuentas en la base de datos
            created_accounts = {}
            for acc_data in sorted(accounts_to_create, key=lambda x: len(x['codigo'])):
                parent = None
                if acc_data['parent_codigo'] and acc_data['parent_codigo'] in created_accounts:
                    parent = created_accounts[acc_data['parent_codigo']]

                cuenta = Cuenta.objects.create(
                    codigo=acc_data['codigo'],
                    nombre=acc_data['nombre'],
                    padre=parent
                )
                created_accounts[acc_data['codigo']] = cuenta

            self.stdout.write(self.style.SUCCESS(f'¡Importación completada! Se han creado {len(created_accounts)} cuentas.'))

        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f'Error: El archivo "{csv_file_path}" no fue encontrado.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Ocurrió un error inesperado: {e}'))