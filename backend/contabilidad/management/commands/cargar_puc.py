# 🎩 Don Peppini Contadore - Cargar PUC para todas las empresas
# backend/contabilidad/management/commands/cargar_puc.py

import csv
import os
from django.core.management.base import BaseCommand
from contabilidad.models import Cuenta
from empresas.models import Empresa


class Command(BaseCommand):
    help = '🎩 Carga el PUC colombiano para todas las empresas (idempotente)'

    def handle(self, *args, **options):
        empresas = list(Empresa.objects.all())
        if not empresas:
            self.stdout.write(self.style.WARNING('   No hay empresas registradas, saltando carga de PUC'))
            return

        # Verificar si ya hay cuentas
        total_existentes = Cuenta.objects.count()
        if total_existentes > 0:
            self.stdout.write(self.style.SUCCESS(
                f'🎩 PUC ya cargado ({total_existentes} cuentas). Nada que hacer.'
            ))
            return

        # Buscar el archivo CSV
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        csv_path = os.path.join(base_dir, 'puc_colombia.csv')

        if not os.path.exists(csv_path):
            self.stdout.write(self.style.ERROR(f'   No se encontró: {csv_path}'))
            return

        # Leer CSV
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            filas = list(reader)

        self.stdout.write(f'🎩 Cargando {len(filas)} cuentas PUC para {len(empresas)} empresa(s)...')

        creadas = 0
        for empresa in empresas:
            cuentas_batch = []
            for fila in filas:
                codigo = fila['codigo'].strip()
                nombre = fila['nombre'].strip()

                # Determinar naturaleza por primer dígito
                naturaleza = 'D'
                if codigo and codigo[0] in ['2', '3', '4']:
                    naturaleza = 'C'

                # Determinar nivel y tipo por longitud del código
                nivel = len(codigo)
                tipo_map = {1: 'Clase', 2: 'Grupo', 3: 'Cuenta', 4: 'Subcuenta'}
                tipo = tipo_map.get(nivel, 'Auxiliar')

                cuentas_batch.append(Cuenta(
                    empresa=empresa,
                    codigo=codigo,
                    nombre=nombre,
                    nivel=nivel,
                    naturaleza=naturaleza,
                    tipo=tipo,
                    activa=True,
                ))

            Cuenta.objects.bulk_create(cuentas_batch, ignore_conflicts=True)
            creadas += len(cuentas_batch)
            self.stdout.write(f'   ✅ {empresa.razon_social}: {len(cuentas_batch)} cuentas')

        # Establecer jerarquías padre-hijo
        self.stdout.write('   🔗 Estableciendo jerarquías...')
        for empresa in empresas:
            cuentas = {c.codigo: c for c in Cuenta.objects.filter(empresa=empresa)}
            updates = []
            for cuenta in cuentas.values():
                codigo = cuenta.codigo
                for i in range(len(codigo) - 1, 0, -1):
                    padre_codigo = codigo[:i]
                    if padre_codigo in cuentas:
                        cuenta.padre = cuentas[padre_codigo]
                        updates.append(cuenta)
                        break
            if updates:
                Cuenta.objects.bulk_update(updates, ['padre'], batch_size=500)

        self.stdout.write(self.style.SUCCESS(
            f'🎩 PUC cargado: {creadas} cuentas en total'
        ))
