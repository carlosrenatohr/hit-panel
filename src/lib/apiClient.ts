import { insforge } from './insforge'

// ============================================================================
// Shared Worker API client — routes every Worker call through the SDK HTTP
// client (auth header attached, 5xx retry) and adds the piece the SDK can't do
// for us: on 401 it refreshes the InsForge session once and retries. The SDK's
// own auto-refresh only triggers for its AUTH_UNAUTHORIZED/PGRST301 codes; the
// Worker returns UNAUTHORIZED, so without this an SPA left open past token
// expiry failed every write until a page reload.
// ============================================================================

interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

interface HttpLike {
  request<T>(method: string, path: string, options?: { body?: unknown }): Promise<T>
}

interface ErrorLike {
  statusCode?: number
  message?: string
}

function http(): HttpLike {
  const client = insforge as unknown as { getHttpClient?: () => HttpLike }
  const h = client.getHttpClient?.()
  if (!h) throw new Error('SDK de InsForge sin getHttpClient — actualizá @insforge/sdk.')
  return h
}

function messageOf(e: unknown): string {
  const m = (e as ErrorLike)?.message
  return typeof m === 'string' && m ? m : 'Error inesperado.'
}

/** Reads the live access token the same way the SDK keeps it fresh. */
export function getAccessToken(): string | null {
  const client = insforge as unknown as {
    tokenManager?: { getAccessToken?: () => string | null }
    auth?: { getAccessToken?: () => string | null; getSession?: () => { accessToken?: string | null } | null }
  }
  return client.tokenManager?.getAccessToken?.() ?? client.auth?.getAccessToken?.() ?? client.auth?.getSession?.()?.accessToken ?? null
}

/**
 * Calls a Worker endpoint (absolute URL) and unwraps its `{ ok, data, error }`
 * envelope. On 401, refreshes the SDK session once and retries — the token the
 * SDK hands out expires while the app sits open, and only an explicit refresh
 * recovers it.
 */
export async function workerApi<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const run = async (): Promise<T> => {
    const body = await http().request<ApiEnvelope<T>>(method, url, init.body !== undefined ? { body: init.body } : undefined)
    if (!body?.ok) throw new Error(body?.error?.message ?? 'Error inesperado.')
    return body.data as T
  }
  try {
    return await run()
  } catch (e) {
    if ((e as ErrorLike)?.statusCode === 401) {
      const auth = insforge as unknown as { auth?: { refreshSession?: () => Promise<unknown> } }
      try {
        await auth.auth?.refreshSession?.()
      } catch {
        /* refresh failed — fall through and surface the 401 */
      }
      try {
        return await run()
      } catch (retry) {
        if ((retry as ErrorLike)?.statusCode === 401) {
          throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
        }
        throw new Error(messageOf(retry))
      }
    }
    throw new Error(messageOf(e))
  }
}
