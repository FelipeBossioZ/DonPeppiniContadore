"""
Script para corregir asientos de ajuste huérfanos (sin empresa).
Ejecutar una sola vez: python manage.py shell < fix_orphan_asientos.py
"""
from contabilidad.models import AsientoContable

# Buscar asientos sin empresa
huerfanos = AsientoContable.objects.filter(empresa__isnull=True)
count = huerfanos.count()
print(f"Encontrados {count} asientos sin empresa")

fixed = 0
for a in huerfanos:
    # Intentar inferir empresa del asiento que ajusta
    referencia = AsientoContable.objects.filter(ajusta_a=a).first()
    if referencia and referencia.empresa:
        a.empresa = referencia.empresa
        a.fiscal_year = referencia.fiscal_year or a.fecha.year
        a.save()
        fixed += 1
        print(f"  → Asiento #{a.id} asignado a empresa {referencia.empresa}")
    else:
        # Intentar por concepto (contiene "asiento #X")
        import re
        match = re.search(r'asiento #(\d+)', a.concepto, re.IGNORECASE)
        if match:
            orig_id = int(match.group(1))
            try:
                orig = AsientoContable.objects.get(id=orig_id)
                if orig.empresa:
                    a.empresa = orig.empresa
                    a.fiscal_year = orig.fiscal_year or a.fecha.year
                    a.save()
                    fixed += 1
                    print(f"  → Asiento #{a.id} asignado a empresa {orig.empresa} (por referencia en concepto)")
            except AsientoContable.DoesNotExist:
                print(f"  ⚠ Asiento #{a.id} no se pudo vincular (original #{orig_id} no existe)")
        else:
            print(f"  ⚠ Asiento #{a.id} no se pudo vincular automáticamente")

print(f"\nResumen: {fixed}/{count} corregidos")
if count - fixed > 0:
    print(f"⚠ {count - fixed} asientos requieren corrección manual")
