import { User } from '../../shared/types/domain'

export function filterByScope<T extends { locationId?: string | null }>(
    data: T[], 
    user: User | null
): T[] {
    if (!user) return []
    if (user.role === 'admin') return data
    if (!user.allowedLocationIds || user.allowedLocationIds.length === 0) return []
    
    return data.filter(item => {
        // Global items (null location) are usually visible to all
        if (!item.locationId) return true
        return user.allowedLocationIds?.includes(item.locationId)
    })
}

export function canAccessLocation(user: User | null, locationId: string): boolean {
    if (!user) return false
    if (user.role === 'admin') return true
    return user.allowedLocationIds?.includes(locationId) ?? false
}
