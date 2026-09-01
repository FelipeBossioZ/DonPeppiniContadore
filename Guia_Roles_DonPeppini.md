# 🎩 Don Peppini Contadore — Guía de Roles y Permisos

## Resumen

El sistema tiene 3 roles:

| Rol | Qué puede hacer | Qué NO puede hacer |
|-----|-----------------|---------------------|
| **admin** | Todo | Nada restringido |
| **contador** | Crear asientos, liquidar nómina, pagar, editar PUC, eliminar plantillas | Anular asientos, cerrar periodos, reabrir periodos, trasladar resultados |
| **consulta** | Ver todo (reportes, datos, dashboard) | No puede crear, editar ni eliminar nada |

Un usuario sin grupo asignado queda como **consulta** por defecto.

---

## Paso 1 — Crear los grupos (una sola vez)

Abrir terminal en la carpeta `backend/` y ejecutar:

```
python manage.py setup_roles
```

Esto hace:
- Crea 3 grupos en Django: `admin`, `contador`, `consulta`
- Asigna automáticamente `admin` a todos los superusuarios existentes
- Muestra un resumen de usuarios y roles

Salida esperada:
```
  ✅ Grupo "admin" creado
  ✅ Grupo "contador" creado
  ✅ Grupo "consulta" creado
  ✅ Superusuario "felipe" → admin

📋 Usuarios y roles:
👑 felipe: admin
```

---

## Paso 2 — Crear usuarios de prueba

Para probar los 3 roles, crear 2 usuarios adicionales:

```
python manage.py createsuperuser
```
(Pero NO queremos superusuarios, queremos usuarios normales)

Mejor usar el shell:
```
python manage.py shell
```

Y dentro del shell:
```python
from django.contrib.auth.models import User

# Crear usuario contador
User.objects.create_user('maria', password='test1234', first_name='María')

# Crear usuario consulta
User.objects.create_user('juan', password='test1234', first_name='Juan')

exit()
```

---

## Paso 3 — Asignar roles a los usuarios

```
python manage.py setup_roles --assign maria=contador juan=consulta
```

Salida esperada:
```
  ℹ️  Grupo "admin" ya existía
  ℹ️  Grupo "contador" ya existía
  ℹ️  Grupo "consulta" ya existía
  ✅ "maria" → contador
  ✅ "juan" → consulta

📋 Usuarios y roles:
👑 felipe: admin
   maria: contador
   juan: consulta
```

---

## Paso 4 — Verificar en el navegador

### 4.1 Login como admin (felipe)

1. Ir a http://localhost:5173/login
2. Login con tu usuario superadmin
3. En el sidebar abajo debe aparecer: `felipe` con badge rojo **Administrador**
4. Verificar que puedés:
   - Crear asientos ✅
   - Anular asientos ✅
   - Cerrar periodo ✅
   - Liquidar nómina ✅
   - Todo lo demás ✅

### 4.2 Login como contador (maria)

1. Cerrar sesión
2. Login con `maria` / `test1234`
3. Badge indigo **Contador**
4. Verificar que puede:
   - Crear asientos ✅
   - Liquidar nómina ✅
   - Pagar nómina ✅
   - Crear cuentas PUC ✅
5. Verificar que NO puede:
   - Anular asiento → debe dar error 403 "Solo un administrador puede anular asientos"
   - Cerrar periodo → error 403 "Se requiere rol de administrador"
   - Reabrir periodo → error 403
   - Trasladar resultados → error 403

### 4.3 Login como consulta (juan)

1. Cerrar sesión
2. Login con `juan` / `test1234`
3. Badge gris **Consulta**
4. Verificar que puede:
   - Ver dashboard ✅
   - Ver asientos ✅
   - Ver reportes ✅
   - Exportar Excel ✅
5. Verificar que NO puede:
   - Crear asiento → error 403 "Solo lectura. Se requiere rol de contador para modificar"
   - Crear cuenta PUC → error 403
   - Liquidar nómina → error 403

---

## Paso 5 — Verificar endpoint /api/me/

Desde el navegador o Postman:

```
GET http://localhost:8000/api/me/
Authorization: Bearer <tu_token>
```

Respuesta esperada:
```json
{
  "id": 1,
  "username": "felipe",
  "email": "",
  "first_name": "Felipe",
  "last_name": "",
  "role": "admin",
  "is_superuser": true
}
```

---

## Cambiar rol de un usuario después

Si necesitás cambiar el rol de alguien:

```
python manage.py setup_roles --assign maria=admin
```

Esto le quita el rol anterior y le pone el nuevo.

---

## También desde Django Admin

1. Ir a http://localhost:8000/admin/
2. Login con superusuario
3. Ir a "Users" → seleccionar usuario
4. En la sección "Groups", agregar/quitar grupos: admin, contador, consulta
5. Guardar

---

## Operaciones protegidas (resumen técnico)

| Endpoint | Método | Rol mínimo |
|----------|--------|------------|
| `/api/contabilidad/asientos/{id}/anular/` | POST | admin |
| `/api/contabilidad/cierres/ejecutar/` | POST | admin |
| `/api/contabilidad/cierres/trasladar-resultados/` | POST | admin |
| `/api/contabilidad/cierres/reabrir/` | POST | admin |
| `/api/contabilidad/plantillas/{id}/` | DELETE | contador |
| `/api/contabilidad/cuentas/` | POST/PATCH | contador |
| `/api/contabilidad/asientos/` | POST | contador |
| `/api/nomina/nominas/{id}/liquidar/` | POST | contador |
| `/api/nomina/nominas/{id}/pagar/` | POST | contador |
| Todo lo demás (GET) | GET | cualquier autenticado |

---

## Notas importantes

- Si un usuario no tiene ningún grupo asignado, se trata como **consulta** (solo lectura). Esto es por seguridad: mejor restringir de más que de menos.
- Los superusuarios siempre son **admin**, sin importar sus grupos.
- El badge de rol se muestra en el sidebar abajo a la izquierda, junto al botón de cerrar sesión.
- Si creás un usuario nuevo y no le asignás grupo, va a poder ver todo pero no modificar nada.
