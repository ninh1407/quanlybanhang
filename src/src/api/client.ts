import { getServerUrl } from '../config'

export async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getServerUrl()
  // Ensure baseUrl doesn't end with slash and path doesn't start with slash if needed, 
  // but usually simple concatenation works if consistent.
  // getServerUrl usually returns "http://localhost:3000"
  
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`
  
  const token = localStorage.getItem('auth_token')
  
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
    const refreshToken = localStorage.getItem('refresh_token')
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
                localStorage.setItem('auth_token', data.accessToken)
                localStorage.setItem('refresh_token', data.refreshToken)
                
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
