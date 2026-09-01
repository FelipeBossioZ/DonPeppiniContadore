# 🎩 Don Peppini Contadore - Migración: Terceros Globales
# backend/terceros/migrations/0002_terceros_globales.py

from django.db import migrations, models


def merge_duplicate_terceros(apps, schema_editor):
    """
    Fusionar terceros duplicados antes de hacer numero_documento unique global.
    Si un mismo documento existe en varias empresas, mantener uno y reasignar asientos.
    """
    Tercero = apps.get_model('terceros', 'Tercero')
    from django.db.models import Count, Min

    duplicados = (
        Tercero.objects.values('numero_documento')
        .annotate(count=Count('id'), min_id=Min('id'))
        .filter(count__gt=1)
    )

    for dup in duplicados:
        keep_id = dup['min_id']
        numero = dup['numero_documento']

        to_delete = Tercero.objects.filter(
            numero_documento=numero
        ).exclude(id=keep_id)

        # Intentar reasignar asientos contables
        try:
            AsientoContable = apps.get_model('contabilidad', 'AsientoContable')
            for old_tercero in to_delete:
                AsientoContable.objects.filter(tercero=old_tercero).update(tercero_id=keep_id)
        except LookupError:
            pass  # Si no existe el modelo de contabilidad, seguir

        deleted_count = to_delete.count()
        to_delete.delete()
        if deleted_count > 0:
            print(f"   Fusionado: {numero} ({deleted_count} duplicados eliminados)")


class Migration(migrations.Migration):

    dependencies = [
        ('terceros', '0001_initial'),
    ]

    operations = [
        # Paso 1: Fusionar duplicados
        migrations.RunPython(merge_duplicate_terceros, migrations.RunPython.noop),

        # Paso 2: Quitar unique_together (empresa + numero_documento)
        migrations.AlterUniqueTogether(
            name='tercero',
            unique_together=set(),
        ),

        # Paso 3: Quitar campo empresa
        migrations.RemoveField(
            model_name='tercero',
            name='empresa',
        ),

        # Paso 4: Hacer numero_documento único globalmente
        migrations.AlterField(
            model_name='tercero',
            name='numero_documento',
            field=models.CharField(max_length=20, unique=True, verbose_name='Número Doc.'),
        ),
    ]
