import { useCallback, useEffect, useState } from 'preact/hooks'
import { currentUser, signOut } from '../lib/insforge'
import type { SessionUser } from '../lib/types'
import ComingSoon from './ComingSoon'
import Facturacion from './billing/Facturacion'
import Customers from './Customers'
import Login from './Login'
import Overview from './Overview'
import Reports from './Reports'
import Shell from './Shell'
import ShipmentDetail from './ShipmentDetail'
import Shipments from './Shipments'
import { Spinner } from './ui'

export type View = 'overview' | 'shipments' | 'reports' | 'facturacion' | 'customers' | 'integraciones' | 'configuracion'

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('overview')
  const [detail, setDetail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setUser(await currentUser())
    } catch {
      setUser(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading) {
    return (
      <div class="flex min-h-screen items-center justify-center bg-neutral-bg">
        <Spinner label="Verificando sesión…" />
      </div>
    )
  }

  if (!user) return <Login onSignedIn={refresh} />

  async function logout() {
    try {
      await signOut()
    } finally {
      // Clear local state even if signOut() rejects, so a network hiccup can't leave the UI logged in.
      setUser(null)
      setView('overview')
    }
  }

  return (
    <Shell user={user} view={view} onView={setView} onLogout={logout}>
      {view === 'overview' && <Overview onOpen={setDetail} onGoShipments={() => setView('shipments')} />}
      {view === 'shipments' && <Shipments onOpen={setDetail} />}
      {view === 'reports' && <Reports />}
      {view === 'facturacion' && user.role !== 'viewer' && <Facturacion role={user.role} />}
      {view === 'customers' && user.role !== 'viewer' && <Customers role={user.role} />}
      {view === 'integraciones' && (
        <ComingSoon
          title="Integraciones"
          description="Conectá el panel con otras herramientas (billing, mensajería, proveedores). Esta sección estará disponible pronto."
        />
      )}
      {view === 'configuracion' && (
        <ComingSoon
          title="Configuración"
          description="Ajustes del panel: usuarios, roles y preferencias del equipo. Esta sección estará disponible pronto."
        />
      )}
      {detail && (
        <ShipmentDetail guia={detail} role={user.role} onClose={() => setDetail(null)} />
      )}
    </Shell>
  )
}
