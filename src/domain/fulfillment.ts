import { AppLocation, WarehouseRegionMapping, AllocationRule } from '../../shared/types/domain'
import { calculateDistance, mockGeocode } from '../lib/geo'

export type StockMap = Map<string, number> // key: skuId::locationId

export function getStockKey(skuId: string, locationId: string): string {
    return `${skuId}::${locationId}`
}

export function findBestLocationForOrder(
    items: { skuId: string; qty: number }[],
    locations: AppLocation[],
    stockMap: StockMap,
    customerAddress?: string,
    regionMappings?: WarehouseRegionMapping[],
    rules?: AllocationRule[]
): string | null {
    // 1. Filter active locations
    let candidates = locations.filter(l => l.active)
    
    // Apply "Store Online Restriction" rule if active
    const restrictionRule = rules?.find(r => r.active && r.type === 'store_online_restriction')
    if (restrictionRule && restrictionRule.config.allowBranchOnlineSales === false) {
        // Only allow Central Warehouse(s) or whitelisted ones
        const centralId = restrictionRule.config.centralWarehouseId
        if (centralId) {
            candidates = candidates.filter(l => l.id === centralId)
        }
    }

    // 2. Filter by Stock Availability (Hard Constraint)
    const validLocations = candidates.filter(loc => {
        return items.every(item => {
            const key = getStockKey(item.skuId, loc.id)
            const available = stockMap.get(key) ?? 0
            return available >= item.qty
        })
    })
    
    // Fallback: If no location has enough stock, return null (handled by caller for Split Order suggestion)
    // However, if we just want to suggest the *best possible* even if not full (optional strategy), we could change this.
    // For now, strict "Available >= Required" is correct for "Fulfillment".
    if (validLocations.length === 0) {
        return null
    }
    
    // Attempt Geocoding for Customer
    const customerCoords = customerAddress ? mockGeocode(customerAddress) : null

    // 3. Score Locations
    const scores = validLocations.map(loc => {
        let score = 0
        let debug = []
        
        // A. Region Match (Priority from Rules or Default)
        const regionRule = rules?.find(r => r.active && r.type === 'region_match')
        if (customerAddress && regionMappings) {
            const mapping = regionMappings.find(m => m.locationId === loc.id)
            if (mapping) {
                const match = mapping.provinces.some(p => 
                    p.toLowerCase().trim() === customerAddress.toLowerCase().trim() ||
                    customerAddress.toLowerCase().includes(p.toLowerCase())
                )
                
                if (match) {
                    const baseBoost = 1000
                    const priorityBoost = Math.max(0, (11 - (mapping.priority || 10)) * 50)
                    const ruleWeight = regionRule ? (11 - regionRule.priority) : 1
                    score += (baseBoost + priorityBoost) * ruleWeight
                    debug.push(`Region Match: +${(baseBoost + priorityBoost) * ruleWeight}`)
                }
            }
        }
        
        // B. Distance Calculation (Higher Priority)
        // If customerCoords found, use it.
        // If not found but we have address, maybe we can match region (handled above).
        if (customerCoords && loc.lat && loc.lng) {
            const dist = calculateDistance(customerCoords.lat, customerCoords.lng, loc.lat, loc.lng)
            // Score formula: Max 5000 points. Lose 10 points per km.
            const distScore = Math.max(0, 5000 - (dist * 10))
            score += distScore
            debug.push(`Distance ${dist.toFixed(1)}km: +${distScore.toFixed(0)}`)
        } else if (customerAddress && !customerCoords) {
             // If we have address but failed to geocode, we can't do distance.
             // But we shouldn't penalize too hard if Region Match matched.
        }

        // C. Central Warehouse Priority
        const centralRule = rules?.find(r => r.active && r.type === 'central_warehouse')
        if (centralRule && centralRule.config.centralWarehouseId === loc.id) {
             const boost = 2000 * (11 - centralRule.priority)
             score += boost
             debug.push(`Central: +${boost}`)
        }
        
        // D. Stock Level Bonus (Prefer higher stock to avoid depletion)
        const stockRule = rules?.find(r => r.active && r.type === 'stock_level')
        const totalStock = items.reduce((sum: any, item: any) => sum + (stockMap.get(getStockKey(item.skuId, loc.id)) ?? 0), 0)
        const stockScore = Math.min(500, totalStock)
        const stockWeight = stockRule ? (11 - stockRule.priority) : 1
        score += stockScore * stockWeight
        debug.push(`Stock ${totalStock}: +${stockScore * stockWeight}`)
        
        // console.log(`AppLocation ${loc.code} Score: ${score}`, debug)
        return { id: loc.id, score, totalStock }
    })
    
    // Sort by Score DESC
    scores.sort((a: any, b: any) => b.score - a.score)
    
    return scores[0].id
}
