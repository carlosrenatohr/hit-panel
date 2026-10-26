---
title: Aviso de privacidad
description: Cómo Orbit recopila, usa, almacena y protege los datos personales en la plataforma.
slug: privacidad
updatedAt: 2026-10-26
status: draft
navOrder: 1
---

> **Estado: borrador.** Este documento requiere revisión jurídica nicaragüense antes de
> publicarse. Describe únicamente lo que la plataforma hace hoy, según la arquitectura
> documentada en el repositorio.

## 1. Responsable

Orbit es la plataforma de operación logística que gestiona el seguimiento de paquetes y la
facturación asociada. Para consultas sobre este aviso o sobre el tratamiento de sus datos,
escríbanos a **orbit.system.ni@gmail.com**.

## 2. Datos que tratamos

El tipo de datos depende del rol de la persona:

### Clientes finales (consulta de paquetes)

Cuando usted consulta el estado de un paquete, la plataforma muestra información operativa
relacionada con su guía o número de rastreo: estado del paquete, oficinas, peso, piezas,
servicio, fechas de movimiento y notas del proveedor. La consulta se realiza contra la
base de datos mediante filtros por guía/tracking.

### Usuarios del panel (personal autorizado)

El acceso al panel exige autenticación con **correo electrónico y contraseña**. La
plataforma almacena el correo, el nombre a mostrar, el rol (`admin`, `staff` o `viewer`) y
el estado de la cuenta. El acceso se revoca desactivando la cuenta, sin borrar el
histórico.

### Datos de terceros involucrados en el envío

En el tratamiento de una guía pueden registrarse datos de remitente, destinatario y
contacto, así como el casillero y la referencia asociados al paquete, cuando estos vienen
del proveedor de rastreo o son capturados por el personal en el curso de la operación.

## 3. Finalidad

- **Seguimiento de paquetes:** mostrar el estado y el historial de una guía.
- **Operación y soporte:** atender consultas, corregir estados y registrar notas internas.
- **Facturación:** generar comprobantes y reportes de las operaciones realizadas.
- **Seguridad de la cuenta:** autenticar a los usuarios del panel y controlar permisos por rol.

No utilizamos los datos personales para elaborar perfiles publicitarios ni para tomar
decisiones automatizadas con efectos jurídicos.

## 4. Base del tratamiento y conservación

Los datos se tratan para la prestación del servicio solicitado y para el cumplimiento de
las obligaciones contables y de soporte. El historial de paquetes y de facturación se
conserva mientras la cuenta esté activa y durante el plazo que las obligaciones fiscales
aplicables exijan. Los datos de contacto enviados a través del formulario de soporte se
usan exclusivamente para responder la consulta.

## 5. Encargados y transferencias

La plataforma se apoya en los siguientes proveedores tecnológicos, cada uno bajo su
propio contrato:

- **InsForge** — base de datos (Postgres) y autenticación.
- **Cloudflare** — alojamiento del panel (Cloudflare Pages) y del servicio de ingesta.

La lista detallada, con la función de cada proveedor y el alcance de sus obligaciones de
confidencialidad, está disponible en el documento de [Proveedores](/proveedores).

## 6. Derechos

Puede solicitar el acceso, la corrección o la supresión de sus datos personales, así como
la limitación de su tratamiento, escribiendo a **orbit.system.ni@gmail.com**. Responderemos
a cada solicitud en un plazo razonable. Cuando la supresión afecte registros que deban
conservarse por obligación fiscal, indicaremos el alcance de la limitación.

## 7. Cookies

Este sitio utiliza únicamente las cookies técnicas necesarias para mantener la sesión del
panel. No empleamos cookies de publicidad ni de analítica de terceros. Detalle completo en
[Cookies](/cookies).

## 8. Cambios

Actualizaremos este aviso cuando cambie el tratamiento de datos o la plataforma. La fecha
de la última actualización aparece al inicio del documento. Los cambios sustanciales se
comunicarán por un aviso visible en el sitio o por correo a los usuarios del panel.
