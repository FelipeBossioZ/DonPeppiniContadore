# Generated migration for BitacoraAuditoria
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('empresas', '0001_initial'),
        ('contabilidad', '0005_movimientocontable_tercero'),
    ]

    operations = [
        migrations.CreateModel(
            name='BitacoraAuditoria',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('accion', models.CharField(choices=[
                    ('crear_asiento', 'Crear asiento'),
                    ('anular_asiento', 'Anular asiento'),
                    ('corregir_asiento', 'Corrección rápida'),
                    ('crear_tercero', 'Crear tercero'),
                    ('editar_tercero', 'Editar tercero'),
                    ('cierre_mensual', 'Cierre mensual'),
                    ('cierre_anual', 'Cierre anual'),
                    ('reapertura', 'Reapertura de período'),
                    ('importar_asientos', 'Importar asientos'),
                    ('otro', 'Otro'),
                ], max_length=30)),
                ('detalle', models.TextField(blank=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('fecha', models.DateTimeField(auto_now_add=True)),
                ('asiento', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bitacora', to='contabilidad.asientocontable')),
                ('asiento_relacionado', models.ForeignKey(blank=True, help_text='Asiento de ajuste o corrección vinculado', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bitacora_relacionada', to='contabilidad.asientocontable')),
                ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bitacora_auditoria', to='empresas.empresa')),
                ('usuario', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Registro de Auditoría',
                'verbose_name_plural': 'Registros de Auditoría',
                'ordering': ['-fecha'],
            },
        ),
    ]
