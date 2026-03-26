import type { AppLocation, User } from '../types/domain'

export function userCanAccessLocation(user: User | null, locationId: string): boolean {
  if (!user) return false
  if (!user.active) return false
  
  // 1. Admin/CEO/Manager: Full access
  if (['admin', 'ceo', 'manager'].includes(user.role)) return true
  if (user.scope === 'all') return true

  // 2. Accountant: Access if assigned or global scope (usually global)
  if (user.role === 'accountant') return true 

  // 3. Region Manager: Access if location is in allowed list OR matches region (todo)
  if (user.role === 'region_manager') {
      return (user.allowedLocationIds ?? []).includes(locationId)
  }

  // 4. Staff: Strict access check
  if (user.role === 'staff') {
      return (user.allowedLocationIds ?? []).includes(locationId)
  }
  
  return (user.allowedLocationIds ?? []).includes(locationId)
}

export function accessibleLocations(user: User | null, locations: AppLocation[]): AppLocation[] {
    const active = locations.filter((l) => l.active)
  if (!user) return []
  
  // 1. Admin/CEO/Manager: Full access
  if (['admin', 'ceo', 'manager'].includes(user.role)) return active
  if (user.scope === 'all') return active

  // 2. Accountant: Full access (to see all financial data)
  if (user.role === 'accountant') return active

  // 3. Region Manager & Staff: Filter by allowedLocationIds
  if (['region_manager', 'staff'].includes(user.role)) {
      const allowed = user.allowedLocationIds ?? []
      return active.filter((l) => allowed.includes(l.id))
  }

  const allowed = user.allowedLocationIds ?? []
  return active.filter((l) => allowed.includes(l.id))
}

