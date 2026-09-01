# backend/load_sample_data.py
# Script para cargar datos de prueba en el sistema
# Ejecutar con: python manage.py shell < load_sample_data.py

from datetime import datetime, date, timedelta
from decimal import Decimal
from terceros.models import Tercero
from contabilidad.models import Cuenta, AsientoContable, MovimientoContable
from facturacion.models import Factura, ItemFactura

print("🚀 Cargando datos de prueba...")

# 1. Crear Terceros de prueba
print("📝 Creando terceros...")
terceros_data = [
    {
        'tipo_documento': 'NIT',
        'numero_documento': '900123456-1',
        'nombre_razon_social': 'Empresa ABC S.A.S',
        'direccion': 'Calle 123 #45-67, Medellín',
        'telefono': '6043211234',
        'email': 'contacto@empresaabc.com'
    },
    {
        'tipo_documento': 'CC',
        'numero_documento': '1018456789',
        'nombre_razon_social': 'Juan Pérez García',
        'direccion': 'Carrera 50 #30-20, Medellín',
        'telefono': '3001234567',
        'email': 'juan.perez@email.com'
    },
    {
        'tipo_documento': 'NIT',
        'numero_documento': '900987654-3',
        'nombre_razon_social': 'Proveedores XYZ Ltda',
        'direccion': 'Avenida 80 #45-90, Bogotá',
        'telefono': '6017654321',
        'email': 'ventas@proveedoresxyz.com'
    },
    {
        'tipo_documento': 'CC',
        'numero_documento': '43876543',
        'nombre_razon_social': 'María Rodríguez López',
        'direccion': 'Calle 10 #20-30, Envigado',
        'telefono': '3109876543',
        'email': 'maria.rodriguez@email.com'
    }
]

for data in terceros_data:
    tercero, created = Tercero.objects.get_or_create(
        numero_documento=data['numero_documento'],
        defaults=data
    )
    if created:
        print(f"  ✅ Creado: {tercero.nombre_razon_social}")

# 2. Crear Plan de Cuentas básico
print("\n📊 Creando plan de cuentas...")
cuentas_data = [
    # Activos
    {'codigo': '1', 'nombre': 'ACTIVOS', 'padre': None},
    {'codigo': '11', 'nombre': 'DISPONIBLE', 'padre': '1'},
    {'codigo': '1105', 'nombre': 'CAJA', 'padre': '11'},
    {'codigo': '1110', 'nombre': 'BANCOS', 'padre': '11'},
    {'codigo': '13', 'nombre': 'DEUDORES', 'padre': '1'},
    {'codigo': '1305', 'nombre': 'CLIENTES', 'padre': '13'},
    
    # Pasivos
    {'codigo': '2', 'nombre': 'PASIVOS', 'padre': None},
    {'codigo': '22', 'nombre': 'PROVEEDORES', 'padre': '2'},
    {'codigo': '2205', 'nombre': 'NACIONALES', 'padre': '22'},
    {'codigo': '24', 'nombre': 'IMPUESTOS', 'padre': '2'},
    {'codigo': '2408', 'nombre': 'IVA POR PAGAR', 'padre': '24'},
    
    # Patrimonio
    {'codigo': '3', 'nombre': 'PATRIMONIO', 'padre': None},
    {'codigo': '31', 'nombre': 'CAPITAL SOCIAL', 'padre': '3'},
    {'codigo': '3105', 'nombre': 'CAPITAL SUSCRITO Y PAGADO', 'padre': '31'},
    
    # Ingresos
    {'codigo': '4', 'nombre': 'INGRESOS', 'padre': None},
    {'codigo': '41', 'nombre': 'OPERACIONALES', 'padre': '4'},
    {'codigo': '4135', 'nombre': 'COMERCIO AL POR MAYOR Y MENOR', 'padre': '41'},
    
    # Gastos
    {'codigo': '5', 'nombre': 'GASTOS', 'padre': None},
    {'codigo': '51', 'nombre': 'OPERACIONALES DE ADMINISTRACION', 'padre': '5'},
    {'codigo': '5105', 'nombre': 'GASTOS DE PERSONAL', 'padre': '51'},
    {'codigo': '5115', 'nombre': 'IMPUESTOS', 'padre': '51'},
]

for data in cuentas_data:
    padre = None
    if data['padre']:
        padre = Cuenta.objects.filter(codigo=data['padre']).first()
    
    cuenta, created = Cuenta.objects.get_or_create(
        codigo=data['codigo'],
        defaults={'nombre': data['nombre'], 'padre': padre}
    )
    if created:
        print(f"  ✅ Cuenta creada: {cuenta.codigo} - {cuenta.nombre}")

# 3. Crear Asientos Contables de ejemplo
print("\n📖 Creando asientos contables...")
tercero1 = Tercero.objects.first()
if tercero1 and Cuenta.objects.exists():
    # Asiento 1: Venta de contado
    asiento1 = AsientoContable.objects.create(
        fecha=date.today() - timedelta(days=5),
        tercero=tercero1,
        concepto="Venta de mercancía al contado",
        descripcion="Factura de venta #001"
    )
    
    # Movimientos del asiento 1
    MovimientoContable.objects.create(
        asiento=asiento1,
        cuenta=Cuenta.objects.get(codigo='1105'),  # Caja
        debito=Decimal('1000000'),
        credito=Decimal('0')
    )
    MovimientoContable.objects.create(
        asiento=asiento1,
        cuenta=Cuenta.objects.get(codigo='4135'),  # Ventas
        debito=Decimal('0'),
        credito=Decimal('1000000')
    )
    print(f"  ✅ Asiento creado: {asiento1.concepto}")
    
    # Asiento 2: Compra a crédito
    asiento2 = AsientoContable.objects.create(
        fecha=date.today() - timedelta(days=3),
        tercero=Tercero.objects.all()[2] if Tercero.objects.count() > 2 else tercero1,
        concepto="Compra de mercancía a crédito",
        descripcion="Factura de compra #100"
    )
    
    MovimientoContable.objects.create(
        asiento=asiento2,
        cuenta=Cuenta.objects.get(codigo='1305'),  # Clientes
        debito=Decimal('500000'),
        credito=Decimal('0')
    )
    MovimientoContable.objects.create(
        asiento=asiento2,
        cuenta=Cuenta.objects.get(codigo='2205'),  # Proveedores
        debito=Decimal('0'),
        credito=Decimal('500000')
    )
    print(f"  ✅ Asiento creado: {asiento2.concepto}")

# 4. Crear Facturas de ejemplo
print("\n💰 Creando facturas...")
clientes = Tercero.objects.all()[:2]
for i, cliente in enumerate(clientes, 1):
    factura = Factura.objects.create(
        cliente=cliente,
        fecha_emision=date.today() - timedelta(days=10-i*2),
        fecha_vencimiento=date.today() + timedelta(days=20+i*5),
        estado='emitida' if i == 1 else 'borrador'
    )
    
    # Agregar items a la factura
    items_data = [
        {
            'descripcion': f'Producto A{i}',
            'cantidad': Decimal('10'),
            'precio_unitario': Decimal('50000'),
            'lleva_iva': True
        },
        {
            'descripcion': f'Servicio B{i}',
            'cantidad': Decimal('5'),
            'precio_unitario': Decimal('100000'),
            'lleva_iva': True
        }
    ]
    
    subtotal = Decimal('0')
    iva = Decimal('0')
    
    for item_data in items_data:
        item = ItemFactura.objects.create(
            factura=factura,
            **item_data
        )
        subtotal_item = item.cantidad * item.precio_unitario
        subtotal += subtotal_item
        if item.lleva_iva:
            iva += subtotal_item * Decimal('0.19')
    
    # Actualizar totales de la factura
    factura.subtotal = subtotal
    factura.impuestos = iva
    factura.total = subtotal + iva
    factura.save()
    
    print(f"  ✅ Factura #{factura.id} creada para {cliente.nombre_razon_social}")

print("\n✨ ¡Datos de prueba cargados exitosamente!")
print("📊 Resumen:")
print(f"  - Terceros: {Tercero.objects.count()}")
print(f"  - Cuentas contables: {Cuenta.objects.count()}")
print(f"  - Asientos contables: {AsientoContable.objects.count()}")
print(f"  - Facturas: {Factura.objects.count()}")
print("\nVe a http://localhost:8000/admin/ para ver los datos")