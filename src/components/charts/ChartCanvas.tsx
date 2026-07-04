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
    return () => chartRef.current?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey])

  return (
    <div class={cls} style={`height:${height}px`}>
      <canvas ref={canvasRef} />
    </div>
  )
}
