---
title: Proveedores
description: Encargados del tratamiento de datos que soportan la plataforma Orbit.
slug: proveedores
updatedAt: 2026-10-26
status: draft
navOrder: 5
---

> **Estado: borrador.** Requiere verificación contractual y jurídica antes de publicarse.
> La función de cada proveedor se describe según la configuración real del sistema.

## 1. Por qué tratamos datos con terceros

Orbit opera con proveedores tecnológicos que alojan la base de datos, la autenticación, el
sitio y el servicio de ingesta. Cada uno recibe solo los datos necesarios para su función y
está sujeto a sus propias obligaciones de confidencialidad y seguridad.

## 2. Lista de encargados

| Proveedor | Servicio | Función | Datos que puede tratar |
|---|---|---|---|
| **InsForge** | Base de datos Postgres y autenticación | Almacenamiento de la información operativa y gestión de cuentas | Registros de operación, usuarios del panel y credenciales de acceso |
| **Cloudflare** | Cloudflare Pages y Workers | Alojamiento del panel y ejecución del servicio de ingesta | Tráfico del sitio y datos procesados por el servicio de ingesta |

## 3. Proveedor de rastreo

La información de seguimiento de los paquetes proviene de un **proveedor externo de
rastreo** cuyo servicio Orbit consulta para mantener actualizado el estado de cada guía. El
alcance de esa consulta se limita a las guías gestionadas por Orbit.

## 4. Transferencias internacionales

Los proveedores anteriores operan en infraestructura cloud internacional. Al contratarlos,
Orbit se apoya en las medidas de seguridad que cada uno publica y en las cláusulas
contractuales aplicables a sus servicios.

## 5. Confidencialidad

Cada proveedor recibe instrucciones de tratar los datos únicamente conforme a la finalidad
descrita. Orbit no autoriza a ninguno a utilizar los datos para sus propios fines.

## 6. Contacto

Para consultas sobre este documento o sobre los encargados del tratamiento, escriba a
**orbit.system.ni@gmail.com**.
