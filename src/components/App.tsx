import { useCallback, useEffect, useState } from 'preact/hooks'
import { currentUser, signOut } from '../lib/insforge'
import type { SessionUser } from '../lib/types'
import Facturacion from './billing/Facturacion'
import Login from './Login'
import Overview from './Overview'
import Reports from './Reports'
import Shell from './Shell'
import ShipmentDetail from './ShipmentDetail'
import Shipments from './Shipments'
import { Spinner } from './ui'

export type View = 'overview' | 'shipments' | 'reports' | 'facturacion'

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
    await signOut()
    setUser(null)
    setView('overview')
  }

  return (
    <Shell user={user} view={view} onView={setView} onLogout={logout}>
      {view === 'overview' && <Overview onOpen={setDetail} onGoShipments={() => setView('shipments')} />}
      {view === 'shipments' && <Shipments onOpen={setDetail} />}
      {view === 'reports' && <Reports />}
      {view === 'facturacion' && (user.role === 'admin' || user.role === 'staff') && <Facturacion role={user.role} />}
      {detail && (
        <ShipmentDetail guia={detail} role={user.role} onClose={() => setDetail(null)} />
      )}
    </Shell>
  )
}
