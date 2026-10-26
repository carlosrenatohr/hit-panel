# 05 · Funcionalidades y uso

## Resumen (Overview)

- **KPIs**: total de paquetes, entregados (30 días) y conteo por proveedor, cada uno con su
  participación (porcentaje) sobre la suma de proveedores.
- **Requiere acción**: lo que pide movimiento ahora — excepciones a revisar (solo si hay) y
  paquetes listos para retiro. Cada tarjeta navega a Paquetería con ese estado ya aplicado.
- **Estados de los paquetes**: barras con el conteo de cada estado (`effective_status`) y su % sobre
  el total del rango. Clic en una barra → abre Paquetería con ese estado (query `?estado=`).
  El % se oculta mientras el selector de estado del Dashboard filtra: `dashboard_stats` acota `total`
  al estado elegido, y una razón sobre ese total siempre leería 100% (misma razón que el `Trend` de
  Reportes solo se dibuja con rango concreto).
- **Salud de la ingesta**: última vez que cada proveedor se actualizó, con semáforo
  (verde ≤6h · amarillo ≤24h · rojo >24h). Útil para detectar si el cron dejó de traer datos.

## Envíos (Shipments)

La tabla central de trabajo diario.

- **Buscar**: por guía (`almacen_id`), tracking del carrier o casillero — un solo cuadro, con debounce.
- **Filtros**: proveedor, estado, servicio (aéreo/marítimo), rango de fechas (recibido). El estado es
  **único (uno a la vez)** y comparte el mismo modelo en escritorio y móvil.
- **Móvil (chips + hoja `Filtrar`)**: por debajo de `lg` las tarjetas de estado se reemplazan por una
  fila compacta de chips con sus conteos (scroll horizontal) y un botón **Filtrar** que abre la hoja
  inferior «Filtrar órdenes» (Todos + los 7 estados con su conteo) y **Aplicar filtro**. La
  selección vive en un borrador hasta aplicar, así que nunca pisa transporte, proveedor ni periodo.
  En `lg+` siguen viéndose las tarjetas de estado, como hasta ahora.
- **Atajo «Listos para retiro»**: en móvil, tarjeta arriba de todo con los paquetes `en_destino`;
  clic = aplicar/quitar ese estado. No se renderiza si el conteo es 0.
- **Drilldown desde Resumen**: `?estado=` (mismo patrón que `?cliente=` / `?unassigned=1`) siembra
  el filtro de estado **una sola vez**, al montar Paquetería.
- **Orden**: por recibido / último evento / actualizado / guía.
- **Paginación**: 25 por página, con total de resultados.
- **Exportar CSV**: respeta los filtros actuales (hasta 2000 filas).
- **Indicador de "estancado"**: si un paquete lleva >10 días sin evento y no está entregado, muestra
  `⚠ Nd` para priorizar seguimiento.
- **Columna «Etiquetas»** (visible por defecto): hasta 3 chips + `+N`. Cada chip es un botón de
  filtro → filtra la tabla por esa etiqueta y deja un chip removible **Etiqueta** en la tarjeta de
  filtros (al quitarlo se apaga el filtro). Las etiquetas de la página se piden aparte
  (`package_tags` por `package_id`): un join en la lista repetiría cada paquete una vez por etiqueta.
- Clic en una fila → abre el **detalle**.

## Detalle del envío

Panel lateral con todo:

- **Datos**: proveedor, tracking, casillero, servicio, estado scrapeado vs efectivo, piezas, peso,
  volumen, dimensiones, origen/destino, remitente, referencia, valor declarado, fechas.
- **Orden de los paneles** (de arriba hacia abajo): Resumen → **Acciones** → Detalles internos →
  Etiquetas y notas internas → Historial de eventos → Notas del proveedor → **Zona de riesgo**
  (panel propio, siempre el último, con **Eliminar paquete**).
- **Historial de eventos** (timeline).
- **Notas del proveedor** (lo que viene de Cargotrack, incl. `RETIRADO`).
- **Etiquetas y notas internas** de HIT: cada etiqueta lleva su ✕ (**Quitar etiqueta**) →
  `delete_package_tag` la borra por (guía, label[, valor]) y lo audita. Solo `admin`/`staff`.
- **Acciones** (solo `admin`/`staff`):
  - **Peso (lb)**: se edita en el panel y guarda con `set_package_weight`. Sin columna override: un
    refresh del proveedor puede pisar el valor a mano; el cambio queda como nota en el paquete
    («Peso actualizado: X → Y lb») y en `audit_logs`.
  - **Cambiar estado** con nota opcional → escribe `manual_status` y queda registrado quién y cuándo.
    El estado efectivo del cliente pasa a ser este, y el panel lo rotula **«Estado fijado
    manualmente»** / **(fijado manualmente)**.
  - **Agregar etiqueta** (label + valor opcional).
  - **Agregar nota interna**.
  - **Datos de Cargotrack / Refrescar ahora**: solo si la agencia es `is_scrapable`. **Falla
    cerrada**: si `/api/config/info` no responde se asume scraping apagado — no aparecen ni el
    bloque de refresco ni las etiquetas scrapeadas (**Actualizado**, «Cargotrack no devolvió peso»).

## Reportes

- **Estado × proveedor**: matriz con totales.
- **Por servicio** y **recibidos por mes**.
- **Rango de fechas** (recibido) que recalcula todo.
- **Exportar**: "Estados" (la matriz) y "Detallado" (todas las columnas de los paquetes del rango).

## Facturación (billing)

La facturación vive en el Worker (`/api/billing/*`); el panel solo consume la API. Puntos clave
para el staff:

- **Vínculo activo**: un paquete facturado muestra el ícono de factura en la lista y en el detalle.
  El vínculo se lee de `invoice_packages` con `active` — al anular una factura el vínculo se libera
  y el paquete vuelve a verse como no facturado (los vínculos liberados no cuentan como facturado).
- **Banner de integridad** (InvoiceDetail): si una factura viva factura paquetes sin vínculo activo,
  el Worker marca `integrityWarning` y el panel muestra un banner ámbar persistente («Inconsistencia
  de facturación…») hasta que soporte lo resuelva. No se cobra de nuevo sin revisar: hay riesgo de
  doble cobro. Las facturas anuladas no lo muestran (liberar vínculos es el diseño).
- **Mensajes de error en español**: la API responde con mensajes listos para el staff («El paquete
  X ya está facturado (factura N)», «La factura está cerrada — la edición está bloqueada», etc.).
  Los códigos del envelope (`INVALID_REQUEST`, `PACKAGE_ALREADY_INVOICED`, `NOT_FOUND`,
  `INVOICE_CREATION_REVERTED`…) son el contrato estable; el texto puede ajustarse sin romper nada.
- **Reversión automática**: si la creación de una factura falla a mitad del camino (ej. presupuesto
  de subrequests), el Worker revierte todo (libera vínculos + archiva el encabezado) y responde
  422 `INVOICE_CREATION_REVERTED` con un código de soporte `F-XXXXXXXX`. El staff reintenta; si se
  repite, envía el código a soporte.

## Notas de uso

- Los datos los refresca el Worker (cron cada 2h por proveedor + email trigger). El panel siempre
  muestra lo último que hay en la base.
- Fijar el estado manualmente es la forma de corregir/forzar uno (p. ej. marcar `Entregado` cuando el
  proveedor no lo refleja por color).
