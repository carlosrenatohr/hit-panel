import { Chart, type ChartConfiguration } from 'chart.js/auto'
import { useEffect, useRef } from 'preact/hooks'

/**
 * Thin wrapper around vanilla Chart.js — no React-specific chart library needed, so it works
 * identically in Preact. Re-creates the chart whenever `config` changes (cheap at report-sized
 * data volumes, and keeps this wrapper trivial to read/extend).
 */
export default function ChartCanvas({
  config,
  class: cls = '',
  height = 240,
}: {
  config: ChartConfiguration
  class?: string
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const configKey = JSON.stringify(config)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current = new Chart(canvasRef.current, config)
    // -- Chrome's print preview re-layouts the page at print width; Chart.js would resize the
    // canvas asynchronously and the print snapshot catches it blank/clipped. Resize synchronously
    // on beforeprint (and back on afterprint) so the printed PDF always matches the layout. --
    const onBeforePrint = () => chartRef.current?.resize()
    const onAfterPrint = () => chartRef.current?.resize()
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
      chartRef.current?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey])

  return (
    <div class={cls} style={`height:${height}px`}>
      <canvas ref={canvasRef} />
    </div>
  )
}
