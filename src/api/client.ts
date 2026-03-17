import { getServerUrl } from '../config'

function readTokenPair(): { token: string | null; refreshToken: string | null; store: Storage } {
  const lsToken = localStorage.getItem('auth_token')
  const ssToken = sessionStorage.getItem('auth_token')
  const store = lsToken ? localStorage : ssToken ? sessionStorage : localStorage
  const token = (store === localStorage ? lsToken : ssToken) ?? null
  const refreshToken = (store === localStorage ? localStorage.getItem('refresh_token') : sessionStorage.getItem('refresh_token'))
  return { token, refreshToken, store }
}

function writeTokenPair(store: Storage, accessToken: string, refreshToken?: string) {
  const other = store === localStorage ? sessionStorage : localStorage
  store.setItem('auth_token', accessToken)
  if (refreshToken) store.setItem('refresh_token', refreshToken)
  other.removeItem('auth_token')
  other.removeItem('refresh_token')
}

export async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getServerUrl()
  // Ensure baseUrl doesn't end with slash and path doesn't start with slash if needed, 
  // but usually simple concatenation works if consistent.
  // getServerUrl usually returns "http://localhost:3000"
  
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`
  
  const { token, refreshToken, store } = readTokenPair()
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  // Handle Token Refresh on 401
  if (res.status === 401) {
    if (refreshToken) {
        try {
            // Try refresh
            const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            })
            
            if (refreshRes.ok) {
                const data = await refreshRes.json()
                writeTokenPair(store, data.accessToken, data.refreshToken)
                
                // Retry original request with new token
                const newHeaders = {
                    ...headers,
                    Authorization: `Bearer ${data.accessToken}`
                }
                const retryRes = await fetch(url, { ...options, headers: newHeaders })
                if (retryRes.ok) return retryRes.json()
            } else {
                // Refresh failed, clear tokens and redirect to login?
                // For now, let it fail so UI can handle logout
                localStorage.removeItem('auth_token')
                localStorage.removeItem('refresh_token')
                sessionStorage.removeItem('auth_token')
                sessionStorage.removeItem('refresh_token')
            }
        } catch (e) {
            console.error('Failed to refresh token', e)
        }
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || `Request failed with status ${res.status}`)
  }

  return res.json()
}
