import type { Location, User } from './types'

export function userCanAccessLocation(user: User | null, locationId: string): boolean {
  if (!user) return false
  if (!user.active) return false
  if (user.role === 'admin') return true
  if (user.scope === 'all') return true
  
  // Region logic (assuming locations have region/province matching user region)
  // This is a placeholder as Location type doesn't have region field explicitly yet, just province
  // if (user.scope === 'region' && user.region) {
  //    const location = locations.find(l => l.id === locationId)
  //    return location?.province === user.region
  // }

  return (user.allowedLocationIds ?? []).includes(locationId)
}

export function accessibleLocations(user: User | null, locations: Location[]): Location[] {
  const active = locations.filter((l) => l.active)
  if (!user) return []
  if (user.role === 'admin') return active
  if (user.scope === 'all') return active

  // if (user.scope === 'region' && user.region) {
  //   return active.filter(l => l.province === user.region)
  // }

  const allowed = user.allowedLocationIds ?? []
  return active.filter((l) => allowed.includes(l.id))
}

