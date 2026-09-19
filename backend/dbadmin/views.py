# -*- coding: utf-8 -*-
"""
Don Peppini Contadore - Administracion de base de datos
Panel para: ver estado, respaldar, restaurar, importar, exportar,
sincronizar con la boveda de OneDrive y cambiar la ruta de la DB.

Todos los endpoints requieren rol admin.
La DB local siempre se reemplaza de forma segura:
  respaldo previo -> validacion del archivo -> copia temporal -> rename atomico.
"""
import os
import re
import shutil
import hashlib
import sqlite3
from pathlib import Path
from datetime import datetime

from django.conf import settings
from django.db import connections
from django.http import FileResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from pyme_contable_backend.permissions import IsAdmin

PROJECT_ROOT = Path(settings.BASE_DIR).parent
LOCAL_DB = Path(settings.DATABASES["default"]["NAME"])
LOCAL_BACKUPS = settings.BASE_DIR / "db_backups"
CONFIG_LOCAL = PROJECT_ROOT / "CONFIG_LOCAL.txt"
ENV_FILE = settings.BASE_DIR / ".env"
VAULT_DB_NAME = "donpeppini_db.sqlite3"
MAX_IMPORT_BYTES = 200 * 1024 * 1024  # 200 MB
TABLAS_OBLIGATORIAS = ("django_migrations", "auth_user")


# ----------------------------------------------------------------- utilidades

def _md5(path, buf=1024 * 1024):
    h = hashlib.md5()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(buf)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _leer_boveda():
    """Path de la boveda configurada, o None si no existe/no esta disponible."""
    if not CONFIG_LOCAL.exists():
        return None
    try:
        for line in CONFIG_LOCAL.read_text(encoding="utf-8", errors="ignore").splitlines():
            m = re.match(r"^\s*BOVEDA\s*=\s*(.+?)\s*$", line)
            if m:
                p = Path(m.group(1).strip())
                return p if p.exists() else None
    except Exception:
        pass
    return None


def _meta(path):
    st = os.stat(path)
    return {
        "archivo": str(path),
        "tamano_bytes": st.st_size,
        "tamano_mb": round(st.st_size / (1024 * 1024), 2),
        "fecha": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        "md5": _md5(path),
    }


def _integridad(path):
    con = sqlite3.connect(str(path))
    try:
        row = con.execute("PRAGMA integrity_check").fetchone()
        return row[0] if row else "desconocido"
    finally:
        con.close()


def _validar_db(path):
    """(ok, mensaje) - valida cabecera SQLite, tablas del sistema e integridad."""
    try:
        with open(path, "rb") as f:
            header = f.read(16)
        if header != b"SQLite format 3\x00":
            return False, "El archivo no es una base de datos SQLite valida."
        con = sqlite3.connect(str(path))
        try:
            tablas = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        finally:
            con.close()
        faltantes = [t for t in TABLAS_OBLIGATORIAS if t not in tablas]
        if faltantes:
            return False, "No parece una base de este sistema (faltan tablas: {}).".format(", ".join(faltantes))
        integridad = _integridad(path)
        if integridad != "ok":
            return False, "La base esta danada (integrity_check: {}).".format(integridad)
        return True, "ok"
    except Exception as e:
        return False, "No se pudo leer la base: {}".format(e)


def _respaldo_local(prefix):
    """Respaldo fechado local (conserva los ultimos 10 de ese prefijo)."""
    if not LOCAL_DB.exists():
        return None
    LOCAL_BACKUPS.mkdir(parents=True, exist_ok=True)
    destino = LOCAL_BACKUPS / (prefix + datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + ".sqlite3")
    shutil.copy2(LOCAL_DB, destino)
    olds = sorted(LOCAL_BACKUPS.glob(prefix + "*.sqlite3"))
    if len(olds) > 10:
        for old in olds[: len(olds) - 10]:
            try:
                old.unlink()
            except OSError:
                pass
    return destino


def _reemplazar_db(origen):
    """Reemplaza la DB local: valida, cierra conexiones y renombra atomicamente."""
    ok, msg = _validar_db(origen)
    if not ok:
        raise ValueError(msg)
    tmp = LOCAL_DB.with_name(LOCAL_DB.name + ".tmp")
    shutil.copy2(origen, tmp)
    ok, msg = _validar_db(tmp)
    if not ok:
        tmp.unlink(missing_ok=True)
        raise ValueError(msg)
    for alias in connections:
        connections[alias].close()
    os.replace(tmp, LOCAL_DB)
    for suf in ("-journal", "-wal", "-shm"):
        side = Path(str(LOCAL_DB) + suf)
        if side.exists():
            try:
                side.unlink()
            except OSError:
                pass


def _migraciones_pendientes():
    import io
    from django.core.management import call_command
    try:
        out = io.StringIO()
        call_command("migrate", "--plan", stdout=out)
        lineas = [l for l in out.getvalue().splitlines() if re.match(r"^\s+\w+\.\d{4}", l)]
        return len(lineas)
    except Exception:
        return None


def _resumen_datos():
    try:
        con = sqlite3.connect(str(LOCAL_DB))

        def n(t):
            try:
                return con.execute("SELECT COUNT(*) FROM {}".format(t)).fetchone()[0]
            except Exception:
                return None
        r = {
            "empresas": n("empresas_empresa"),
            "terceros": n("terceros_tercero"),
            "cuentas": n("contabilidad_cuenta"),
            "asientos": n("contabilidad_asientocontable"),
            "usuarios": n("auth_user"),
        }
        con.close()
        return r
    except Exception:
        return {}


def _estado_boveda():
    boveda = _leer_boveda()
    if boveda is None:
        return {"configurada": CONFIG_LOCAL.exists(), "disponible": False}
    out = {"configurada": True, "disponible": True, "ruta": str(boveda)}
    vault_db = boveda / VAULT_DB_NAME
    if vault_db.exists():
        meta = _meta(vault_db)
        out.update(meta)
        if LOCAL_DB.exists():
            f_boveda = datetime.fromtimestamp(os.stat(vault_db).st_mtime)
            f_local = datetime.fromtimestamp(os.stat(LOCAL_DB).st_mtime)
            if f_boveda > f_local:
                out["comparacion"] = "boveda_mas_nueva"
            elif f_local > f_boveda:
                out["comparacion"] = "local_mas_nueva"
            else:
                out["comparacion"] = "sincronizadas"
    else:
        out["comparacion"] = "boveda_vacia"
    return out


def _estado_comun():
    return {
        "db": _meta(LOCAL_DB) if LOCAL_DB.exists() else None,
        "integridad": _integridad(LOCAL_DB) if LOCAL_DB.exists() else None,
        "pendientes_migraciones": _migraciones_pendientes(),
        "boveda": _estado_boveda(),
        "resumen": _resumen_datos(),
    }


def _accion_ok(request_data=None, mensaje="Operacion completada", **extra):
    data = {"mensaje": mensaje, "estado": _estado_comun()}
    data.update(extra)
    return Response(data)


def _accion_error(e, codigo=400):
    return Response({"detail": str(e)}, status=codigo)


# ------------------------------------------------------------------ endpoints

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def estado(request):
    return Response(_estado_comun())


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def respaldos(request):
    def listar(carpeta, filtro):
        carpeta = Path(carpeta)
        if not carpeta.exists():
            return []
        items = []
        for f in carpeta.glob(filtro):
            if f.is_file():
                st = f.stat()
                items.append({
                    "nombre": f.name,
                    "tamano_mb": round(st.st_size / (1024 * 1024), 2),
                    "fecha": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                })
        items.sort(key=lambda x: x["fecha"], reverse=True)
        return items

    boveda = _leer_boveda()
    return Response({
        "locales": listar(LOCAL_BACKUPS, "*.sqlite3"),
        "boveda": listar(boveda / "backups", "*.sqlite3") if boveda else [],
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def respaldar(request):
    bk_local = _respaldo_local("manual_")
    boveda = _leer_boveda()
    bk_boveda = None
    if boveda:
        carpeta = boveda / "backups"
        carpeta.mkdir(parents=True, exist_ok=True)
        bk_boveda = carpeta / ("donpeppini_db_" + datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + ".sqlite3")
        shutil.copy2(LOCAL_DB, bk_boveda)
        olds = sorted(carpeta.glob("donpeppini_db_*.sqlite3"))
        if len(olds) > 10:
            for old in olds[: len(olds) - 10]:
                try:
                    old.unlink()
                except OSError:
                    pass
    return _accion_ok(mensaje="Respaldo creado con exito", respaldo_local=str(bk_local) if bk_local else None,
                      respaldo_boveda=str(bk_boveda) if bk_boveda else None)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def restaurar(request):
    origen = (request.data or {}).get("origen", "")
    nombre = Path((request.data or {}).get("archivo", "")).name
    if origen not in ("local", "boveda") or not nombre:
        return Response({"detail": "Parametros invalidos (origen, archivo)."}, status=400)

    if origen == "local":
        ruta = LOCAL_BACKUPS / nombre
    else:
        boveda = _leer_boveda()
        if not boveda:
            return Response({"detail": "La boveda no esta disponible."}, status=400)
        ruta = boveda / "backups" / nombre
    if not ruta.exists():
        return Response({"detail": "No se encontro el respaldo indicado."}, status=404)

    _respaldo_local("pre_restore_")
    try:
        _reemplazar_db(ruta)
    except ValueError as e:
        return _accion_error(e)
    return _accion_ok(mensaje="Base restaurada desde {}".format(nombre))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def importar_db(request):
    archivo = request.FILES.get("archivo")
    if archivo is None:
        return Response({"detail": "No se recibio ningun archivo."}, status=400)
    if archivo.size > MAX_IMPORT_BYTES:
        return Response({"detail": "El archivo supera el limite de 200 MB."}, status=400)

    tmp = LOCAL_DB.with_name("importacion_tmp.sqlite3")
    with open(tmp, "wb") as f:
        for chunk in archivo.chunks():
            f.write(chunk)
    try:
        ok, msg = _validar_db(tmp)
        if not ok:
            tmp.unlink(missing_ok=True)
            return Response({"detail": msg}, status=400)
        _respaldo_local("pre_import_")
        _reemplazar_db(tmp)
    finally:
        tmp.unlink(missing_ok=True)
    return _accion_ok(mensaje="Base importada con exito: {}".format(archivo.name))


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def exportar(request):
    if not LOCAL_DB.exists():
        return Response({"detail": "No existe base de datos local."}, status=404)
    nombre = "donpeppini_copia_{}.sqlite3".format(datetime.now().strftime("%Y-%m-%d_%H-%M-%S"))
    respuesta = FileResponse(LOCAL_DB.open("rb"), as_attachment=True, filename=nombre)
    respuesta["Content-Length"] = LOCAL_DB.stat().st_size
    return respuesta


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def boveda_pull(request):
    boveda = _leer_boveda()
    if not boveda:
        return Response({"detail": "La boveda no esta configurada o no esta disponible."}, status=400)
    vault_db = boveda / VAULT_DB_NAME
    if not vault_db.exists():
        return Response({"detail": "La boveda no contiene una base de datos principal."}, status=400)
    _respaldo_local("pre_pull_")
    try:
        _reemplazar_db(vault_db)
    except ValueError as e:
        return _accion_error(e)
    return _accion_ok(mensaje="Base traida desde la boveda de OneDrive")


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def boveda_push(request):
    if not LOCAL_DB.exists():
        return Response({"detail": "No existe base de datos local que subir."}, status=404)
    boveda = _leer_boveda()
    if not boveda:
        return Response({"detail": "La boveda no esta configurada o no esta disponible."}, status=400)

    ok, msg = _validar_db(LOCAL_DB)
    if not ok:
        return Response({"detail": "La base local no pasa la validacion: " + msg}, status=400)

    tmp = boveda / (VAULT_DB_NAME + ".tmp")
    shutil.copy2(LOCAL_DB, tmp)
    if _md5(tmp) != _md5(LOCAL_DB):
        tmp.unlink(missing_ok=True)
        return Response({"detail": "La verificacion de la copia fallo. La boveda NO fue modificada."}, status=500)
    os.replace(tmp, boveda / VAULT_DB_NAME)

    carpeta = boveda / "backups"
    carpeta.mkdir(parents=True, exist_ok=True)
    shutil.copy2(LOCAL_DB, carpeta / ("donpeppini_db_" + datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + ".sqlite3"))
    olds = sorted(carpeta.glob("donpeppini_db_*.sqlite3"))
    if len(olds) > 10:
        for old in olds[: len(olds) - 10]:
            try:
                old.unlink()
            except OSError:
                pass
    return _accion_ok(mensaje="Base subida a la boveda de OneDrive con verificacion de integridad")


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def cambiar_ruta(request):
    nueva = str((request.data or {}).get("db_path", "")).strip().strip('"')
    copiar = bool((request.data or {}).get("copiar_actual", True))
    if not nueva:
        return Response({"detail": "Indica la nueva ruta de la base de datos."}, status=400)
    ruta = Path(nueva)
    if not ruta.is_absolute():
        return Response({"detail": "La ruta debe ser absoluta (ej: D:\\Datos\\donpeppini.sqlite3)."}, status=400)
    if ruta.suffix.lower() != ".sqlite3":
        return Response({"detail": "El archivo debe tener extension .sqlite3."}, status=400)
    if not ruta.parent.exists():
        return Response({"detail": "La carpeta destino no existe: {}".format(ruta.parent)}, status=400)
    if ruta.exists() and ruta.resolve() == LOCAL_DB.resolve():
        return Response({"detail": "Esa ya es la ruta actual de la base."}, status=400)

    # escribir .env: reemplazar DB_PATH o agregarlo
    lineas = []
    if ENV_FILE.exists():
        lineas = ENV_FILE.read_text(encoding="utf-8", errors="ignore").splitlines()
    lineas = [l for l in lineas if not l.strip().startswith("DB_PATH=")]
    lineas.append("DB_PATH={}".format(nueva))
    ENV_FILE.write_text("\n".join(lineas) + "\n", encoding="utf-8")

    copiado = False
    if copiar and LOCAL_DB.exists() and not ruta.exists():
        shutil.copy2(LOCAL_DB, ruta)
        copiado = True
    return _accion_ok(
        mensaje="Ruta guardada en .env. Reinicia el sistema para usar la nueva base.",
        nueva_ruta=nueva, copio_actual=copiado, requiere_reiniciar=True,
    )
