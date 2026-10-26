---
title: Seguridad
description: Medidas técnicas y organizativas que protegen la plataforma y los datos.
slug: seguridad
updatedAt: 2026-10-26
status: draft
navOrder: 3
---

> **Estado: borrador.** Describe controles implementados y verificables en el repositorio.
> Antes de publicarse debe pasar revisión técnica de verificación y revisión jurídica.

## 1. Autenticación

- Acceso al panel mediante **correo y contraseña** con autenticación gestionada por
  InsForge Auth. La autenticación por email está activa.
- El token de sesión de vida corta vive **en memoria** del navegador. La renovación usa
  una cookie `httpOnly` protegida contra CSRF.
- Cada persona usa una cuenta individual. El acceso se revoca de inmediato desactivando la
  cuenta, sin borrar el histórico.

## 2. Autorización por rol y por registro

La seguridad no depende solo del frontend: se aplica en la base de datos.

- **RLS por defecto denegada.** Sin un token de un usuario activo no se lee ningún dato.
- **Lectura condicionada al rol:** el personal autenticado solo ve los registros permitidos.
- **Escrituras controladas.** El personal no tiene permisos directos de escritura sobre las
  tablas; las modificaciones pasan por funciones verificadas que validan el rol y tocan solo
  los campos previstos. Esto impide alterar columnas que no corresponde.
- **Organización aislada.** Las consultas se acotan a la organización del usuario.

## 3. Secretos y claves

- La clave de acceso anónima a la base de datos es **pública por diseño** y no autoriza nada
  por sí sola; la autorización real es el token del usuario más las políticas de fila.
- La clave administrativa de base de datos existe **solo en el servidor de ingesta**, nunca
  se incluye en el código del panel ni en el navegador.
- Ningún secreto se versiona en el repositorio. Las credenciales se gestionan por variables
  de entorno y claves del proveedor.

## 4. Superficies separadas

La superficie pública y la aplicación autenticada están separadas: el sitio público no expone
la base de datos de clientes, y el panel exige login para cualquier dato operativo.

## 5. Registro de auditoría

Las acciones de escritura relevantes quedan registradas con autor, acción, entidad y fecha,
para poder reconstruir qué cambió y quién lo hizo.

## 6. Reporte de vulnerabilidades

Si detecta una vulnerabilidad, escríbanos a **orbit.system.ni@gmail.com** con el asunto
`[SEGURIDAD]` y una descripción clara. No incluya en el correo datos de clientes ni
credenciales. Le confirmaremos la recepción y le informaremos los próximos pasos.

## 7. Compromisos

- Reportar incidentes de seguridad que afecten datos personales a las autoridades y a los
  usuarios correspondientes.
- Revisar periódicamente los permisos de acceso y mantener las cuentas inactivas retiradas.
