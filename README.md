# Don Peppini Contadore

Sistema contable NIIF para Pymes en Colombia. Backend (Django) + Frontend (React/Vite).

---

## Requisitos

- **Python 3.10+**
- **Node.js 18 o 20** (con npm)
- Windows (el instalador es .bat; para Linux/Mac se ejecutan los comandos manualmente)

---

## Instalación automática (Windows)

1. Descarga el repositorio como ZIP o clona con `git clone`
2. Ejecuta **`INSTALAR_DonPeppini.bat`** (doble clic)
3. Al terminar, ejecuta **`INICIAR_DonPeppini.bat`**
4. Se abre el navegador en `http://localhost:5173`

El instalador crea el entorno virtual, instala dependencias, y ejecuta las migraciones automáticamente.

---

## Instalación manual

### 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py setup_roles
python manage.py cargar_puc
```

### 2) Frontend

```powershell
cd frontend
npm install
```

### 3) Iniciar

```powershell
# Terminal 1 - Backend
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py runserver

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Abrir http://localhost:5173

---

## Estructura

```
DonPeppiniContadore/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── puc_colombia.csv          # PUC de referencia para carga
│   ├── pyme_contable_backend/    # Configuración Django
│   ├── contabilidad/             # Plan de cuentas, asientos, cierres
│   ├── empresas/                 # Gestión de empresas
│   ├── terceros/                 # Terceros (globales)
│   ├── facturacion/              # Facturación
│   ├── nomina/                   # Nómina, PILA, prestaciones
│   └── static/logos/             # Logos del sistema
├── frontend/
│   ├── src/
│   │   ├── pages/                # 22+ páginas del sistema
│   │   ├── components/           # Componentes reutilizables
│   │   ├── services/             # Conexión al API
│   │   └── hooks/                # Hooks de React Query
│   └── package.json
├── INSTALAR_DonPeppini.bat       # Instalador automático
├── INICIAR_DonPeppini.bat        # Iniciar sistema
└── README.md
```

---

## Roles del sistema

| Rol | Permisos |
|-----|----------|
| **admin** | Todo (crear, editar, eliminar, cerrar periodos, anular asientos) |
| **contador** | Crear asientos, liquidar nómina, editar PUC. NO puede cerrar periodos ni anular |
| **consulta** | Solo lectura (ver reportes, dashboard, exportar) |

Ver [Guia_Roles_DonPeppini.md](Guia_Roles_DonPeppini.md) para instrucciones detalladas.

---

## Primer uso

1. Ejecuta `INSTALAR_DonPeppini.bat`
2. Ejecuta `INICIAR_DonPeppini.bat`
3. Crea tu usuario con `python manage.py createsuperuser` (dentro de backend, con el .venv activado)
4. Asigna roles: `python manage.py setup_roles`
5. Carga el PUC: `python manage.py cargar_puc`
6. Entra a http://localhost:5173, crea una empresa, y listo

---

## Comandos útiles

```powershell
# Dentro de backend/ (con .venv activado)
python manage.py migrate                  # Crear/actualizar BD
python manage.py createsuperuser          # Crear usuario admin
python manage.py setup_roles              # Crear roles (admin, contador, consulta)
python manage.py setup_roles --assign maria=contador  # Asignar rol
python manage.py cargar_puc               # Cargar PUC colombiano
python manage.py runserver                # Iniciar backend
```

---

## Licencia
MIT

---

## Créditos
Autor: @FelipeBossioZ
