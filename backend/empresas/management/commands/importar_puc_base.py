# 🎩 Don Peppini Contadore - Importar PUC Base
import pandas as pd
from django.core.management.base import BaseCommand
from contabilidad.models import CuentaBase


class Command(BaseCommand):
    help = '🎩 Importa el Plan Único de Cuentas base desde Excel'

    def add_arguments(self, parser):
        parser.add_argument('--archivo', type=str, default='PUC.xlsx')
        parser.add_argument('--limpiar', action='store_true')

    def handle(self, *args, **options):
        archivo = options['archivo']
        self.stdout.write(f'🎩 Importando PUC desde: {archivo}')
        
        if options['limpiar']:
            CuentaBase.objects.all().delete()
            self.stdout.write(self.style.WARNING('   Cuentas existentes eliminadas'))
        
        try:
            df = pd.read_excel(archivo, header=None)
            
            # Buscar fila de encabezados
            header_row = None
            for i, row in df.iterrows():
                if 'Código' in str(row[0]) or 'codigo' in str(row[0]).lower():
                    header_row = i
                    break
            
            if header_row is not None:
                df.columns = df.iloc[header_row]
                df = df.iloc[header_row + 1:]
            
            df.columns = [str(c).strip().lower() for c in df.columns]
            
            # Mapear columnas
            col_codigo = next((c for c in df.columns if 'codigo' in c or 'código' in c), df.columns[0])
            col_nombre = next((c for c in df.columns if 'cuenta' in c or 'nombre' in c), df.columns[1])
            col_nivel = next((c for c in df.columns if 'nivel' in c), None)
            col_naturaleza = next((c for c in df.columns if 'naturaleza' in c), None)
            
            creadas = 0
            for _, row in df.iterrows():
                codigo = str(row[col_codigo]).strip() if pd.notna(row[col_codigo]) else None
                nombre = str(row[col_nombre]).strip() if pd.notna(row[col_nombre]) else None
                
                if not codigo or not nombre or codigo == 'nan':
                    continue
                
                codigo = codigo.replace('.0', '').replace('.', '')
                
                # Nivel por longitud
                nivel = len(codigo)
                if col_nivel and pd.notna(row.get(col_nivel)):
                    try:
                        nivel = int(float(row[col_nivel]))
                    except:
                        pass
                
                # Naturaleza
                naturaleza = 'D'
                if col_naturaleza and pd.notna(row.get(col_naturaleza)):
                    nat = str(row[col_naturaleza]).strip().upper()
                    if nat in ['C', 'CRÉDITO', 'CREDITO']:
                        naturaleza = 'C'
                else:
                    if codigo[0] in ['2', '3', '4']:
                        naturaleza = 'C'
                
                # Tipo
                tipo_map = {1: 'Clase', 2: 'Grupo', 3: 'Cuenta', 4: 'Subcuenta'}
                tipo = tipo_map.get(nivel, 'Auxiliar')
                
                # Padre
                padre = None
                if len(codigo) > 1:
                    for i in range(len(codigo) - 1, 0, -1):
                        try:
                            padre = CuentaBase.objects.get(codigo=codigo[:i])
                            break
                        except CuentaBase.DoesNotExist:
                            continue
                
                try:
                    cuenta, created = CuentaBase.objects.update_or_create(
                        codigo=codigo,
                        defaults={
                            'nombre': nombre,
                            'nivel': nivel,
                            'naturaleza': naturaleza,
                            'tipo': tipo,
                            'padre': padre,
                        }
                    )
                    if created:
                        creadas += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'   Error en {codigo}: {e}'))
            
            self.stdout.write(self.style.SUCCESS(f'🎩 PUC importado: {creadas} cuentas'))
            
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f'   Archivo no encontrado: {archivo}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   Error: {e}'))
