"""
Carga el PUC (Plan Único de Cuentas) de Colombia desde puc_colombia.csv
para TODAS las empresas registradas. Idempotente: no recarga si ya hay cuentas.
"""
import csv, os
from django.core.management.base import BaseCommand
from contabilidad.models import Cuenta
from empresas.models import Empresa


class Command(BaseCommand):
    help = "Carga el PUC Colombia para todas las empresas"

    def handle(self, *args, **options):
        if Cuenta.objects.count() > 0:
            self.stdout.write(self.style.WARNING(
                f"Ya existen {Cuenta.objects.count()} cuentas. Saltando carga."
            ))
            return

        csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "puc_colombia.csv")
        csv_path = os.path.abspath(csv_path)

        if not os.path.exists(csv_path):
            self.stdout.write(self.style.ERROR(f"No se encontró {csv_path}"))
            return

        # Leer CSV
        rows = []
        with open(csv_path, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                rows.append(r)

        empresas = Empresa.objects.all()
        if not empresas.exists():
            self.stdout.write(self.style.ERROR("No hay empresas registradas."))
            return

        total = 0
        for empresa in empresas:
            cuentas = []
            for r in rows:
                codigo = r["codigo"].strip()
                nombre = r["nombre"].strip()

                # Naturaleza por primer dígito
                first = codigo[0] if codigo else "1"
                naturaleza = "C" if first in ("2", "3", "4") else "D"

                # Tipo por longitud
                length = len(codigo)
                tipo_map = {1: "Clase", 2: "Grupo", 4: "Cuenta", 6: "Subcuenta"}
                tipo = tipo_map.get(length, "Auxiliar")

                nivel = min(length, 6)

                cuentas.append(Cuenta(
                    empresa=empresa,
                    codigo=codigo,
                    nombre=nombre,
                    naturaleza=naturaleza,
                    tipo=tipo,
                    nivel=nivel,
                ))

            Cuenta.objects.bulk_create(cuentas)

            # Resolver padres
            cuenta_map = {c.codigo: c for c in Cuenta.objects.filter(empresa=empresa)}
            updates = []
            for c in cuenta_map.values():
                if len(c.codigo) <= 1:
                    continue
                for end in range(len(c.codigo) - 1, 0, -1):
                    prefix = c.codigo[:end]
                    if prefix in cuenta_map:
                        c.padre = cuenta_map[prefix]
                        updates.append(c)
                        break

            if updates:
                Cuenta.objects.bulk_update(updates, ["padre"], batch_size=500)

            total += len(cuentas)
            self.stdout.write(f"  {empresa.razon_social}: {len(cuentas)} cuentas cargadas")

        self.stdout.write(self.style.SUCCESS(f"PUC cargado: {total} cuentas en total."))
