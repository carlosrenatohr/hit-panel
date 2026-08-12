import { Hammer } from 'lucide-preact'
import { Card } from './ui'

/** Placeholder for sections that exist in navigation but are not built yet. */
export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div class="space-y-4">
      <h1 class="text-lg font-bold text-secondary">{title}</h1>
      <Card class="flex flex-col items-center gap-3 p-10 text-center">
        <div class="rounded-full bg-primary/10 p-4">
          <Hammer class="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h2 class="text-xl font-bold text-secondary">Estamos construyendo esta sección</h2>
        <p class="max-w-md text-sm text-gray-500">{description}</p>
      </Card>
    </div>
  )
}
