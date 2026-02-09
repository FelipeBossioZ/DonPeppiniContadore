from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('terceros', '0002_terceros_globales'),
        ('contabilidad', '0004_cierrecontable'),
    ]

    operations = [
        migrations.AddField(
            model_name='movimientocontable',
            name='tercero',
            field=models.ForeignKey(
                blank=True,
                help_text='Si vacío, hereda el tercero del asiento.',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to='terceros.tercero',
                verbose_name='Tercero (línea)',
            ),
        ),
    ]
