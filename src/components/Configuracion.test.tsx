import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import Configuracion from './Configuracion'

// Rates UX: one tab per billing kind (default shown on the tab), the default
// always leads its group, marking the default asks first, and a zeroed table can
// never become the default (informational modal instead of a request).

const CARDS = vi.hoisted(() => [
  {
    id: 'w-default', organizationId: 'hit', name: 'Estándar', structure: 'simple_pair',
    pricingKind: 'weight', isDefault: true, active: true, createdAt: '', updatedAt: '',
    currentVersion: { id: 'v1', version: 1, priceModel: 'weight', currency: 'USD', status: 'published', entries: [
      { id: 'e1', serviceType: 'AIR', name: 'Regular', unit: 'lb', price: 7, cost: 4.5 },
      { id: 'e2', serviceType: 'MAR', name: 'Regular', unit: 'lb', price: 2.8, cost: 1.2 },
    ] },
  },
  {
    id: 'w-zero', organizationId: 'hit', name: 'Vacía', structure: 'simple_pair',
    pricingKind: 'weight', isDefault: false, active: true, createdAt: '', updatedAt: '',
    currentVersion: { id: 'v2', version: 1, priceModel: 'weight', currency: 'USD', status: 'published', entries: [
      { id: 'e3', serviceType: 'AIR', name: 'Regular', unit: 'lb', price: 0, cost: 0 },
      { id: 'e4', serviceType: 'MAR', name: 'Regular', unit: 'lb', price: 0, cost: 0 },
    ] },
  },
  {
    id: 'w-premium', organizationId: 'hit', name: 'Premium', structure: 'simple_pair',
    pricingKind: 'weight', isDefault: false, active: true, createdAt: '', updatedAt: '',
    currentVersion: { id: 'v3', version: 1, priceModel: 'weight', currency: 'USD', status: 'published', entries: [
      { id: 'e5', serviceType: 'AIR', name: 'Regular', unit: 'lb', price: 9, cost: 5 },
      { id: 'e6', serviceType: 'MAR', name: 'Regular', unit: 'lb', price: 3.5, cost: 1.5 },
    ] },
  },
  {
    id: 'f-default', organizationId: 'hit', name: 'Documentos', structure: 'simple_pair',
    pricingKind: 'fixed', isDefault: true, active: true, createdAt: '', updatedAt: '',
    currentVersion: { id: 'v4', version: 1, priceModel: 'fixed', currency: 'USD', status: 'published', entries: [
      { id: 'e7', serviceType: 'AIR', name: 'Regular', unit: 'package', price: 25, cost: 8 },
      { id: 'e8', serviceType: 'MAR', name: 'Regular', unit: 'package', price: 18, cost: 6 },
    ] },
  },
])

const listRateCards = vi.hoisted(() => vi.fn())
const setRateCardDefault = vi.hoisted(() => vi.fn())
const createRateCard = vi.hoisted(() => vi.fn())

vi.mock('../lib/config', () => ({
  configApi: {
    info: vi.fn().mockResolvedValue({ name: 'HIT', ruc: null, address: null, phone: null, currency: 'USD', exchangeRateNioPerUsd: 36.5 }),
    features: vi.fn().mockResolvedValue({ flexiblePricing: true }),
    listRateCards,
    setRateCardDefault,
    createRateCard,
    renameRateCard: vi.fn(),
    deleteRateCard: vi.fn(),
    replaceCardEntries: vi.fn(),
    updateInfo: vi.fn(),
    paymentCatalogs: vi.fn().mockResolvedValue({ methods: [], banks: [] }),
  },
}))

const admin = { id: 'u1', email: 'admin@hit.test', role: 'admin' as const, name: 'Admin', agency: 'hit' }

async function openRates() {
  render(<Configuracion user={admin} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Tarifas' }))
  await screen.findByText('Tablas de tarifas')
}

describe('Configuración › Tarifas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listRateCards.mockResolvedValue({ organizationId: 'hit', cards: CARDS })
    setRateCardDefault.mockImplementation(async (id: string) => ({ ...CARDS.find((c) => c.id === id), isDefault: true }))
    createRateCard.mockImplementation(async (input: Record<string, unknown>) => ({
      ...CARDS[0],
      id: 'w-new',
      name: input.name as string,
      pricingKind: input.priceModel as string,
      isDefault: !!input.isDefault,
      currentVersion: { ...CARDS[0].currentVersion, priceModel: input.priceModel as string, entries: input.entries },
    }))
  })

  it('groups tariffs in tabs and shows each kind default on its tab', async () => {
    await openRates()

    const weightTab = screen.getByRole('tab', { name: /Por peso/ })
    const fixedTab = screen.getByRole('tab', { name: /Cuota fija/ })
    expect(within(weightTab).getByText('Por defecto: Estándar')).toBeTruthy()
    expect(within(fixedTab).getByText('Por defecto: Documentos')).toBeTruthy()
    expect(weightTab.getAttribute('aria-selected')).toBe('true')

    // Only the active kind's cards render.
    expect(screen.queryByText('Documentos')).toBeNull()
    fireEvent.click(fixedTab)
    expect(await screen.findByText('Documentos')).toBeTruthy()
    expect(screen.queryByText('Premium')).toBeNull()
  })

  it('marks a default from the single edit modal, asks first and puts it on top', async () => {
    let current = CARDS
    listRateCards.mockImplementation(async () => ({ organizationId: 'hit', cards: current }))
    setRateCardDefault.mockImplementation(async (id: string) => {
      const target = current.find((c) => c.id === id)!
      current = current.map((c) => ((c.pricingKind ?? 'weight') === (target.pricingKind ?? 'weight') ? { ...c, isDefault: c.id === id } : c))
      return current.find((c) => c.id === id)
    })
    await openRates()

    const premium = screen.getByText('Premium').closest('.rounded-xl') as HTMLElement
    fireEvent.click(within(premium).getByRole('button', { name: 'Editar' }))

    const dialog = await screen.findByRole('dialog', { name: 'Editar tabla de tarifas' })
    fireEvent.click(within(dialog).getByLabelText(/Usar como tarifa por defecto/))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    expect(setRateCardDefault).not.toHaveBeenCalled()

    const confirm = await screen.findByRole('dialog', { name: 'Guardar cambios en la tarifa' })
    expect(within(confirm).getByText(/¿Aplicar los cambios de "Premium"/)).toBeTruthy()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(setRateCardDefault).toHaveBeenCalledWith('w-premium'))
    await waitFor(() => {
      const premiumCard = screen.getByText('Premium').closest('.rounded-xl') as HTMLElement
      expect(within(premiumCard).getByText('Por defecto')).toBeTruthy()
    })
    const names = screen.getAllByText(/^(Premium|Estándar|Vacía)$/).map((el) => el.textContent)
    expect(names[0]).toBe('Premium')
  })

  it('refuses to mark a zeroed table as default (informational modal, no request)', async () => {
    await openRates()

    const zero = screen.getByText('Vacía').closest('.rounded-xl') as HTMLElement
    fireEvent.click(within(zero).getByRole('button', { name: 'Editar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar tabla de tarifas' })
    fireEvent.click(within(dialog).getByLabelText(/Usar como tarifa por defecto/))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    const info = await screen.findByRole('dialog', { name: 'Tarifa en cero' })
    expect(within(info).getByText(/El precio y el costo de Aéreo y Marítimo deben ser mayores a 0/)).toBeTruthy()
    fireEvent.click(within(info).getByRole('button', { name: 'Entendido' }))
    expect(setRateCardDefault).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: 'Editar tabla de tarifas' })).toBeTruthy()
  })

  it('explains why Crear is disabled until the table has a name and its default prices', async () => {
    await openRates()

    fireEvent.click(screen.getByRole('button', { name: /Nueva tabla/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva tabla de tarifas' })
    expect(within(dialog).getAllByText('Poné un nombre para la tabla.').length).toBeGreaterThan(0)

    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Express' } })
    fireEvent.change(within(dialog).getByLabelText('Tipo de cobro'), { target: { value: 'fixed' } })
    fireEvent.click(within(dialog).getByLabelText(/Marcar como tarifa por defecto/))

    const create = within(dialog).getByRole('button', { name: /Crear/ }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    expect(within(dialog).getAllByText(/El precio de Aéreo debe ser mayor a 0/).length).toBeGreaterThan(0)
    // New tables start at 0: the empty state is explicit, never a silent blank.
    const startPrices = within(dialog).getAllByLabelText('Precio por carga (USD)') as HTMLInputElement[]
    expect(startPrices.every((i) => i.value === '0')).toBe(true)

    const priceFields = within(dialog).getAllByLabelText('Precio por carga (USD)')
    const costFields = within(dialog).getAllByLabelText('Costo por carga (USD)')
    fireEvent.input(priceFields[0], { target: { value: '30' } })
    fireEvent.input(priceFields[1], { target: { value: '22' } })
    // Price alone is not enough: the cost must be a real amount too.
    expect(create.disabled).toBe(true)
    fireEvent.input(costFields[0], { target: { value: '12' } })
    fireEvent.input(costFields[1], { target: { value: '9' } })
    expect(create.disabled).toBe(false)
    expect(within(dialog).queryByText(/debe ser mayor a 0/)).toBeNull()

    fireEvent.click(create)
    await waitFor(() =>
      expect(createRateCard).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Express',
          priceModel: 'fixed',
          isDefault: true,
          entries: [
            { serviceType: 'AIR', name: 'Express', price: 30, cost: 12 },
            { serviceType: 'MAR', name: 'Express', price: 22, cost: 9 },
          ],
        }),
      ),
    )
    // Prominent, self-dismissing confirmation instead of a bare green line.
    const toast = await screen.findByRole('status')
    expect(within(toast).getByText(/Tabla creada en Cuota fija/)).toBeTruthy()
  })

  it('saves name and prices from one modal and confirms the change', async () => {
    const replaceCardEntries = vi.fn().mockResolvedValue(undefined)
    const renameRateCard = vi.fn().mockResolvedValue(undefined)
    const cfg = await import('../lib/config')
    vi.mocked(cfg.configApi.replaceCardEntries).mockImplementation(replaceCardEntries)
    vi.mocked(cfg.configApi.renameRateCard).mockImplementation(renameRateCard)
    await openRates()
    fireEvent.click(screen.getByRole('tab', { name: /Cuota fija/ }))

    const docs = (await screen.findByText('Documentos')).closest('.rounded-xl') as HTMLElement
    fireEvent.click(within(docs).getByRole('button', { name: 'Editar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar tabla de tarifas' })
    // Fixed cards edit only price and cost per carga: no per-entry name field.
    expect(within(dialog).queryByLabelText('Categoría')).toBeNull()
    fireEvent.change(within(dialog).getByLabelText('Nombre de la tabla'), { target: { value: 'Documentos Plus' } })
    fireEvent.input(within(dialog).getAllByLabelText('Precio por carga (USD)')[0], { target: { value: '32' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    const confirm = await screen.findByRole('dialog', { name: 'Guardar cambios en la tarifa' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(replaceCardEntries).toHaveBeenCalledWith('f-default', [
      { serviceType: 'AIR', name: 'Documentos Plus', price: 32, cost: 8 },
      { serviceType: 'MAR', name: 'Documentos Plus', price: 18, cost: 6 },
    ]))
    expect(renameRateCard).toHaveBeenCalledWith('f-default', 'Documentos Plus')
    const toast = await screen.findByRole('status')
    expect(within(toast).getByText('Cambios guardados')).toBeTruthy()
  })
})
