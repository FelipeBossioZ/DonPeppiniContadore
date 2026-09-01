# Don Peppini Contadore

Sistema contable NIIF para Pymes en Colombia. Backend (Django) + Frontend (React/Vite).

---

## Requisitos

- **Python 3.10+** (con "Add Python to PATH" marcado en el instalador)
- **Node.js 18 o 20** (con npm)
- **Git** (para recibir actualizaciones)
- Windows

---

## Instalacion (por primera vez)

### Opcion A: Descargar con Git (recomendado)

Permite recibir actualizaciones facilmente con un solo comando.

1. Abre CMD o PowerShell
2. Ejecuta:

```
git clone https://github.com/FelipeBossioZ/DonPeppiniContadore.git
```

3. Entra a la carpeta:

```
cd DonPeppiniContadore
```

4. Ejecuta **`INSTALAR_DonPeppini.bat`** (doble clic o desde la terminal)
5. Al terminar, ejecuta **`INICIAR_DonPeppini.bat`**
6. Se abre el navegador en `http://localhost:5173`
7. El primer acceso muestra un formulario donde creas tu usuario, registras tu empresa y se carga el PUC automaticamente

### Opcion B: Descargar ZIP

Si prefieres no usar Git:

1. Entra a [github.com/FelipeBossioZ/DonPeppiniContadore](https://github.com/FelipeBossioZ/DonPeppiniContadore)
2. Da clic en el boton verde **"Code"** y luego en **"Download ZIP"**
3. Descomprime el ZIP
4. Renombra la carpeta resultante a `DonPeppiniContadore`
5. Ejecuta **`INSTALAR_DonPeppini.bat`** (doble clic)
6. Al terminar, ejecuta **`INICIAR_DonPeppini.bat`**
7. Se abre el navegador en `http://localhost:5173`
8. El primer acceso muestra un formulario donde creas tu usuario, registras tu empresa y se carga el PUC automaticamente

> **Nota:** Si descargaste por ZIP y despues quieres recibir actualizaciones por Git, sigue los pasos de ["Enlazar carpeta a Git"](#enlazar-carpeta-a-git).

---

## Primer uso

1. Ejecuta `INSTALAR_DonPeppini.bat`
2. Ejecuta `INICIAR_DonPeppini.bat`
3. Abre http://localhost:5173
4. El sistema detecta que es la primera vez y muestra un formulario con dos secciones:
   - **Cuenta de Administrador:** usuario, correo (opcional) y contrasena
   - **Datos de la Empresa:** NIT (sin DV), digito de verificacion, razon social y nombre comercial
5. Al enviar, el sistema crea todo automaticamente: usuario admin, roles, empresa y PUC colombiano
6. Listo. Ya puedes empezar a trabajar.

> **Importante:** Despues de crear la empresa, si hay actualizaciones en el repositorio, ejecute `ACTUALIZAR_DonPeppini.bat` para mantener el sistema al dia. No es necesario cerrar el backend ni el frontend para ejecutarlo.

---

## Actualizar el sistema

Cuando se publique una nueva version:

### Si clonaste con Git

Ejecuta **`ACTUALIZAR_DonPeppini.bat`** (doble clic). Eso es todo.

### Si descargaste por ZIP

Descarga el ZIP de nuevo, descomprime, y copia las carpetas `backend` y `frontend` sobre tu instalacion existente (reemplaza archivos). Tu base de datos (`backend/db.sqlite3`) no se toca porque no viene en el ZIP.

---

## Enlazar carpeta a Git

Si descargaste por ZIP y despues quieres recibir actualizaciones con `ACTUALIZAR_DonPeppini.bat`, ejecuta estos comandos **una sola vez** dentro de tu carpeta de DonPeppiniContadore:

```
git init
git remote add origin https://github.com/FelipeBossioZ/DonPeppiniContadore.git
git fetch origin
git reset --mixed origin/main
```

Esto enlaza tu carpeta local con el repositorio de GitHub. Despues de esto, cada actualizacion es solo ejecutar `ACTUALIZAR_DonPeppini.bat`. Tu base de datos y tu usuario **no se ven afectados**.

---

## Estructura

```
DonPeppiniContadore/
  backend/
    manage.py
    requirements.txt
    puc_colombia.csv
    pyme_contable_backend/    # Configuracion Django
    contabilidad/             # Plan de cuentas, asientos, cierres
    empresas/                 # Gestion de empresas
    terceros/                 # Terceros (globales)
    facturacion/              # Facturacion
    nomina/                   # Nomina, PILA, prestaciones
    static/logos/
  frontend/
    src/
      pages/                # 22+ paginas
      components/
      services/
      hooks/
    public/logos/
    package.json
  INSTALAR_DonPeppini.bat
  INICIAR_DonPeppini.bat
  ACTUALIZAR_DonPeppini.bat
  README.md
```

---

## Roles del sistema

| Rol | Permisos |
|-----|----------|
| **admin** | Todo (crear, editar, eliminar, cerrar periodos, anular asientos) |
| **contador** | Crear asientos, liquidar nomina, editar PUC. NO puede cerrar periodos ni anular |
| **consulta** | Solo lectura (ver reportes, dashboard, exportar) |

Ver [Guia_Roles_DonPeppini.md](Guia_Roles_DonPeppini.md) para instrucciones detalladas.

---

## Comandos utiles

```
# Dentro de backend/ (con .venv activado)
python manage.py migrate                  # Crear/actualizar BD
python manage.py setup_roles              # Crear roles (admin, contador, consulta)
python manage.py setup_roles --assign maria=contador  # Asignar rol
python manage.py cargar_puc               # Cargar PUC colombiano
python manage.py runserver                # Iniciar backend
```

---

## Licencia
MIT

---

## Creditos
Autor: @FelipeBossioZ
