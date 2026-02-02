# PepponcioContable

Proyecto monorepo con **Backend (Django)** y **Frontend (Vite/React)** para un sistema contable.

---

## 📦 Requisitos
- **Python 3.10+** (recomendado 3.10/3.11)
- **Node.js 18 o 20** y **npm**
- (Opcional) **PostgreSQL 14+** para ambiente productivo
- Windows PowerShell / Git Bash

---

## 🗂️ Estructura del proyecto
```
PepponcioContable/
├─ backend/
│  ├─ manage.py
│  ├─ PUC.xlsx
│  ├─ import_puc.py
│  ├─ load_sample_data.py
│  └─ pyme_contable_backend/
│     ├─ settings.py
│     └─ urls.py
└─ frontend/
   ├─ package.json
   ├─ vite.config.js
   └─ src/
      ├─ App.jsx
      ├─ components/
      ├─ pages/
      └─ services/
```

---

## 🚀 Arranque rápido (desarrollo)

### 1) Backend (Django)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt  # si existe; sino: pip install django djangorestframework django-cors-headers python-dotenv psycopg2-binary

# crea el .env local si aún no existe (ver ejemplos abajo)
python manage.py migrate
python manage.py runserver 8000
```
Backend en: http://127.0.0.1:8000/

> **CORS (dev):** en `settings.py` debe estar `corsheaders` en `INSTALLED_APPS` y el middleware en primer lugar. En dev puedes usar `CORS_ALLOW_ALL_ORIGINS = True`.

### 2) Frontend (Vite/React)
```powershell
cd ..\frontend
npm install
# crea .env.local (ver ejemplo abajo)
npm run dev
```
Frontend en: http://127.0.0.1:5173/ (o el puerto que indique Vite).

---

## 🔐 Variables de entorno

### backend/.env.example
```
# Django
DEBUG=True
SECRET_KEY=dev-secret-change-me
ALLOWED_HOSTS=127.0.0.1,localhost

# Base de datos (elige uno)
# Opción A: SQLite (desarrollo)
DB_ENGINE=sqlite3

# Opción B: PostgreSQL (prod/local avanzado)
# DB_ENGINE=postgres
# POSTGRES_DB=pepponcio
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=postgres
# POSTGRES_HOST=127.0.0.1
# POSTGRES_PORT=5432

# CORS (solo dev)
CORS_ALLOW_ALL_ORIGINS=True
```

> **Notas**: En `settings.py` lee `DB_ENGINE`. Si es `sqlite3`, usa `sqlite3` con `BASE_DIR / 'db.sqlite3'`. Si es `postgres`, arma el `DATABASES` con las variables `POSTGRES_*`.

### frontend/.env.example
```
# URL del backend en desarrollo
VITE_API_URL=http://127.0.0.1:8000
```

Copia estos archivos como `.env` (backend) y `.env.local` (frontend) y ajusta valores reales.

---

## 🛠️ Comandos útiles

### Backend
```powershell
# dentro de backend
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000

# carga de datos de ejemplo (si aplica)
python import_puc.py
python load_sample_data.py
```

### Frontend
```powershell
# dentro de frontend
npm install
npm run dev
npm run build
npm run preview
```

---

## 📑 .gitignore recomendado
```
# Python
backend/.venv/
**/__pycache__/
*.pyc
backend/.env

# Node / Vite
frontend/node_modules/
frontend/.vite/
frontend/dist/
frontend/.env*

# Sistema
.DS_Store
Thumbs.db
```

> Si usas diferentes EOL en Windows/Linux, añade `.gitattributes`:
```
* text=auto
*.py  text eol=lf
*.js  text eol=lf
*.jsx text eol=lf
*.ts  text eol=lf
*.tsx text eol=lf
```

---

## 🧪 Propuesta de endpoints (referencial)
- `GET /api/terceros/`
- `GET /api/facturacion/`
- `GET /api/contabilidad/plan-cuentas/`

> Ajustar según tus `urls.py` actuales.

---

## 🧭 Troubleshooting (errores comunes)
- **`ModuleNotFoundError`**: activa el venv y reinstala `requirements.txt`.
- **`psycopg2` en Windows**: usa `psycopg2-binary` para desarrollo.
- **`DisallowedHost`**: incluye `127.0.0.1` y `localhost` en `ALLOWED_HOSTS`.
- **CORS bloquea requests**: habilita `django-cors-headers` (en dev `CORS_ALLOW_ALL_ORIGINS=True`).
- **Puerto ocupado**: `runserver 8001` o `npm run dev -- --port 5174`.

---

## 🤝 Flujo de trabajo recomendado
1. Crea rama: `feat/...`, `fix/...`, `chore/...`.
2. Commit con convención: `tipo(scope): resumen`.
3. PR a `main` (Squash & merge).
4. (Opcional) Activa protección de `main`.

---

## 📜 Licencia
MIT (o la que definas).

---

## ✍️ Créditos
- Autor: @FelipeBossioZ

---

> **Nota:** Este README está pensado para desarrollo local en Windows; adapta rutas/comandos para Linux/Mac si es necesario.

