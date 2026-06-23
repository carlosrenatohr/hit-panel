# 05 · Funcionalidades y uso

## Resumen (Overview)

- **KPIs**: total de paquetes, entregados (30 días) y conteo por proveedor.
- **Pipeline por estado**: barras con el conteo de cada estado (`effective_status`).
- **Salud de la ingesta**: última vez que cada proveedor se actualizó, con semáforo
  (verde ≤6h · amarillo ≤24h · rojo >24h). Útil para detectar si el cron dejó de traer datos.

## Envíos (Shipments)

La tabla central de trabajo diario.

- **Buscar**: por guía (`almacen_id`), tracking del carrier o casillero — un solo cuadro, con debounce.
- **Filtros**: proveedor, estado, servicio (aéreo/marítimo), rango de fechas (recibido).
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
