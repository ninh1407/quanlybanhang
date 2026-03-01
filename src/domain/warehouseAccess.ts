import type { Location, User } from './types'

export function userCanAccessLocation(user: User | null, locationId: string): boolean {
  if (!user) return false
  if (!user.active) return false
  if (user.role === 'admin') return true
  return (user.allowedLocationIds ?? []).includes(locationId)
}

export function accessibleLocations(user: User | null, locations: Location[]): Location[] {
  const active = locations.filter((l) => l.active)
  if (!user) return []
  if (user.role === 'admin') return active
  const allowed = user.allowedLocationIds ?? []
  return active.filter((l) => allowed.includes(l.id))
}

