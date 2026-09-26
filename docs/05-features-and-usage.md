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
- Clic en una fila → abre el **detalle**.

## Detalle del envío

Panel lateral con todo:

- **Datos**: proveedor, tracking, casillero, servicio, estado scrapeado vs efectivo, piezas, peso,
  volumen, dimensiones, origen/destino, remitente, referencia, valor declarado, fechas.
- **Historial de eventos** (timeline).
- **Notas del proveedor** (lo que viene de Cargotrack, incl. `RETIRADO`).
- **Etiquetas y notas internas** de HIT.
- **Acciones** (solo `admin`/`staff`):
  - **Cambiar estado** (override manual) con nota opcional → escribe `manual_status` y queda registrado
    quién y cuándo. El estado efectivo del cliente pasa a ser este.
  - **Agregar etiqueta** (label + valor opcional).
  - **Agregar nota interna**.

## Reportes

- **Estado × proveedor**: matriz con totales.
- **Por servicio** y **recibidos por mes**.
- **Rango de fechas** (recibido) que recalcula todo.
- **Exportar**: "Estados" (la matriz) y "Detallado" (todas las columnas de los paquetes del rango).

## Notas de uso

- Los datos los refresca el Worker (cron cada 2h por proveedor + email trigger). El panel siempre
  muestra lo último que hay en la base.
- El override manual es la forma de corregir/forzar un estado (p. ej. marcar `Entregado` cuando el
  proveedor no lo refleja por color).
