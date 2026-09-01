# backend/import_puc.py
# Script para importar tu archivo PUC.xlsx al sistema
# Ejecutar con: python manage.py shell < import_puc.py

import pandas as pd
from contabilidad.models import Cuenta
import os

def analizar_estructura_excel(archivo):
    """Primero analiza la estructura de tu Excel para entender las columnas"""
    try:
        df = pd.read_excel(archivo)
        print("📋 Estructura del archivo Excel:")
        print(f"   Columnas encontradas: {list(df.columns)}")
        print(f"   Total de filas: {len(df)}")
        print("\n📝 Primeras 5 filas:")
        print(df.head())
        return df
    except Exception as e:
        print(f"❌ Error al leer el archivo: {e}")
        return None

def cargar_puc_desde_excel(archivo_excel):
    """
    Carga el PUC desde tu archivo Excel
    Adaptable a diferentes estructuras de columnas
    """
    
    # Instalar pandas si no está instalado
    try:
        import pandas as pd
    except ImportError:
        print("❌ Necesitas instalar pandas: pip install pandas openpyxl")
        return
    
    # Verificar que el archivo existe
    if not os.path.exists(archivo_excel):
        print(f"❌ No se encuentra el archivo: {archivo_excel}")
        print(f"   Ruta actual: {os.getcwd()}")
        return
    
    # Leer el archivo
    df = analizar_estructura_excel(archivo_excel)
    if df is None:
        return
    
    # Identificar las columnas (ajusta según tu estructura)
    # Posibles nombres de columnas comunes:
    columnas_codigo = ['codigo', 'Codigo', 'CODIGO', 'Cuenta', 'CUENTA', 'Código']
    columnas_nombre = ['nombre', 'Nombre', 'NOMBRE', 'Descripcion', 'DESCRIPCION', 'Descripción']
    columnas_padre = ['padre', 'Padre', 'PADRE', 'codigo_padre', 'Codigo_Padre']
    
    # Encontrar la columna de código
    col_codigo = None
    for col in columnas_codigo:
        if col in df.columns:
            col_codigo = col
            break
    
    # Encontrar la columna de nombre
    col_nombre = None
    for col in columnas_nombre:
        if col in df.columns:
            col_nombre = col
            break
    
    # Encontrar la columna de padre (opcional)
    col_padre = None
    for col in columnas_padre:
        if col in df.columns:
            col_padre = col
            break
    
    if not col_codigo or not col_nombre:
        print("❌ No se encontraron las columnas necesarias (código y nombre)")
        print(f"   Columnas disponibles: {list(df.columns)}")
        return
    
    print(f"\n✅ Columnas identificadas:")
    print(f"   Código: {col_codigo}")
    print(f"   Nombre: {col_nombre}")
    print(f"   Padre: {col_padre if col_padre else 'No encontrada (se calculará automáticamente)'}")
    
    # Limpiar datos existentes (opcional)
    respuesta = input("\n¿Deseas borrar las cuentas existentes? (s/n): ")
    if respuesta.lower() == 's':
        Cuenta.objects.all().delete()
        print("   Cuentas existentes eliminadas")
    
    # Cargar las cuentas
    print("\n📊 Cargando Plan de Cuentas...")
    cuentas_creadas = 0
    cuentas_actualizadas = 0
    errores = []
    
    for index, row in df.iterrows():
        try:
            codigo = str(row[col_codigo]).strip()
            nombre = str(row[col_nombre]).strip() if pd.notna(row[col_nombre]) else ''
            
            # Saltar filas vacías
            if pd.isna(row[col_codigo]) or codigo == 'nan':
                continue
            
            # Limpiar el código (remover .0 si es número)
            if '.' in codigo and codigo.split('.')[1] == '0':
                codigo = codigo.split('.')[0]
            
            # Crear o actualizar la cuenta
            cuenta, created = Cuenta.objects.get_or_create(
                codigo=codigo,
                defaults={'nombre': nombre}
            )
            
            if created:
                cuentas_creadas += 1
                print(f"  ✅ Creada: {codigo} - {nombre}")
            else:
                if cuenta.nombre != nombre and nombre:
                    cuenta.nombre = nombre
                    cuenta.save()
                    cuentas_actualizadas += 1
                    print(f"  📝 Actualizada: {codigo} - {nombre}")
                    
        except Exception as e:
            errores.append(f"Fila {index + 2}: {e}")
            continue
    
    # Establecer jerarquías automáticamente si no hay columna padre
    if not col_padre:
        print("\n🔗 Estableciendo jerarquías automáticamente...")
        establecer_jerarquias_automaticas()
    else:
        print("\n🔗 Estableciendo jerarquías desde el archivo...")
        for index, row in df.iterrows():
            if pd.notna(row[col_codigo]) and pd.notna(row[col_padre]):
                try:
                    codigo = str(row[col_codigo]).strip()
                    codigo_padre = str(row[col_padre]).strip()
                    
                    cuenta = Cuenta.objects.filter(codigo=codigo).first()
                    padre = Cuenta.objects.filter(codigo=codigo_padre).first()
                    
                    if cuenta and padre:
                        cuenta.padre = padre
                        cuenta.save()
                        print(f"  └─ {cuenta.codigo} → {padre.codigo}")
                except:
                    pass
    
    # Resumen
    print(f"\n✨ Importación completada:")
    print(f"  - Cuentas creadas: {cuentas_creadas}")
    print(f"  - Cuentas actualizadas: {cuentas_actualizadas}")
    print(f"  - Total cuentas en el sistema: {Cuenta.objects.count()}")
    
    if errores:
        print(f"\n⚠️ Errores encontrados: {len(errores)}")
        for error in errores[:5]:  # Mostrar solo los primeros 5 errores
            print(f"  - {error}")

def establecer_jerarquias_automaticas():
    """
    Establece las relaciones padre-hijo basándose en la estructura del código
    Ej: 1 -> 11 -> 1105 -> 110505
    """
    for cuenta in Cuenta.objects.all().order_by('codigo'):
        codigo = cuenta.codigo
        
        # Buscar el padre más cercano
        for i in range(len(codigo)-1, 0, -1):
            codigo_padre = codigo[:i]
            padre = Cuenta.objects.filter(codigo=codigo_padre).first()
            if padre:
                cuenta.padre = padre
                cuenta.save()
                print(f"  └─ {cuenta.codigo} es hijo de {padre.codigo}")
                break

# Función principal para ejecutar
def importar_puc():
    """Función principal para importar el PUC"""
    
    # Primero verificar si pandas está instalado
    try:
        import pandas as pd
        import openpyxl
    except ImportError:
        print("❌ Necesitas instalar las dependencias:")
        print("   Ejecuta: pip install pandas openpyxl")
        return
    
    # Ruta al archivo - AJUSTA SEGÚN TU UBICACIÓN
    archivo = 'PUC.xlsx'  # Si está en la carpeta backend
    
    # Opciones alternativas de rutas
    rutas_posibles = [
        'PUC.xlsx',
        '../PUC.xlsx',
        '../../PUC.xlsx',
        'C:/Users/Usuario/Desktop/SISTEMA CONTABLE/PepponcioPilatus/PepponcioContable/backend/PUC.xlsx',
        'C:/Users/Usuario/Desktop/PUC.xlsx',
    ]
    
    archivo_encontrado = None
    for ruta in rutas_posibles:
        if os.path.exists(ruta):
            archivo_encontrado = ruta
            print(f"✅ Archivo encontrado en: {ruta}")
            break
    
    if archivo_encontrado:
        cargar_puc_desde_excel(archivo_encontrado)
    else:
        print("❌ No se encontró el archivo PUC.xlsx")
        print("   Coloca el archivo en la carpeta backend o especifica la ruta completa")
        ruta_manual = input("   Ingresa la ruta completa del archivo (o Enter para cancelar): ")
        if ruta_manual:
            cargar_puc_desde_excel(ruta_manual)

# Ejecutar la importación
if __name__ == "__main__":
    importar_puc()