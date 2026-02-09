# Generated migration
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('contabilidad', '0005_movimientocontable_tercero'),
        ('nomina', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='nomina',
            name='asiento_contable',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='nomina_origen',
                to='contabilidad.asientocontable',
                verbose_name='Asiento contable',
            ),
        ),
    ]
