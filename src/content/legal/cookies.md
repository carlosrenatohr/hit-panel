---
title: Política de cookies
description: Cookies técnicas utilizadas por el sitio y el panel de Orbit.
slug: cookies
updatedAt: 2026-10-26
status: draft
navOrder: 4
---

> **Estado: borrador.** Requiere verificación final del comportamiento real de las cookies de
> sesión antes de publicarse.

## 1. Qué son las cookies

Las cookies son pequeños archivos que un sitio guarda en su navegador para recordar
información entre visitas. Se dividen en técnicas necesarias para el funcionamiento y en
las demás (analítica, publicidad, personalización).

## 2. Cookies que utilizamos

Orbit utiliza **únicamente cookies técnicas**:

| Cookie | Finalidad | Duración |
|---|---|---|
| Cookie de renovación de sesión | Mantener la sesión del panel activa sin pedir la contraseña en cada carga | Sesión |

La cookie de renovación es `httpOnly`, lo que significa que el navegador no permite que
scripts la lean, y va acompañada de protección CSRF. **No contiene la contraseña.**

## 3. Cookies que NO utilizamos

- **Analítica:** no empleamos Google Analytics ni herramientas equivalentes.
- **Publicidad:** no usamos píxeles de redes sociales ni remarketing.
- **Personalización:** no guardamos preferencias de interfaz en cookies de terceros.

Las tipografías del sitio se cargan desde Google Fonts; esa petición puede generar una
conexión externa a Google, pero Orbit no instala cookies propias de analítica.

## 4. Gestión desde su navegador

Puede bloquear o eliminar las cookies desde la configuración de su navegador. Tenga en
cuenta que **bloquear la cookie de sesión impide el acceso al panel**, ya que la
autenticación depende de ella. La navegación por el sitio público no requiere cookies.

## 5. Cambios

Actualizaremos esta política si incorporamos nuevos tipos de cookies. La fecha de última
actualización aparece al inicio del documento. Cualquier cambio relevante se avisará aquí.
