import { getServerUrl } from '../config'

export async function fetchApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getServerUrl()
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`

  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
  
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `API Error: ${res.status}`)
  }

  return data as T
}
