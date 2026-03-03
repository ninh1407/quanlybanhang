import { Location, WarehouseRegionMapping, AllocationRule } from './types'

export type StockMap = Map<string, number> // key: skuId::locationId

export function getStockKey(skuId: string, locationId: string): string {
    return `${skuId}::${locationId}`
}

export function findBestLocationForOrder(
    items: { skuId: string; qty: number }[],
    locations: Location[],
    stockMap: StockMap,
    customerProvince?: string,
    regionMappings?: WarehouseRegionMapping[],
    rules?: AllocationRule[]
): string | null {
    // 1. Filter active locations
    let candidates = locations.filter(l => l.active)
    
    // Apply "Store Online Restriction" rule if active
    const restrictionRule = rules?.find(r => r.active && r.type === 'store_online_restriction')
    if (restrictionRule && restrictionRule.config.allowBranchOnlineSales === false) {
        // Only allow Central Warehouse(s) or whitelisted ones
        // Assuming we identify central warehouse by ID or Code or Note.
        // Or if we have centralWarehouseId in rule config
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
    
    if (validLocations.length === 0) {
        // Fallback Logic (e.g., Central Warehouse even if out of stock? No, we need stock)
        // Unless we allow backorder on central warehouse?
        // For now, return null.
        return null
    }
    
    // 3. Score Locations
    const scores = validLocations.map(loc => {
        let score = 0
        
        // A. Region Match (Priority from Rules or Default)
        const regionRule = rules?.find(r => r.active && r.type === 'region_match')
        if (customerProvince && regionMappings && (!rules || regionRule)) {
            const mapping = regionMappings.find(m => m.locationId === loc.id)
            if (mapping) {
                const match = mapping.provinces.some(p => 
                    p.toLowerCase().trim() === customerProvince.toLowerCase().trim() ||
                    customerProvince.toLowerCase().includes(p.toLowerCase())
                )
                
                if (match) {
                    const baseBoost = 1000
                    const priorityBoost = Math.max(0, (11 - (mapping.priority || 10)) * 50)
                    
                    // If Rule exists, use its priority to weight this factor
                    const ruleWeight = regionRule ? (11 - regionRule.priority) : 1
                    
                    score += (baseBoost + priorityBoost) * ruleWeight
                }
            }
        }
        
        // B. Central Warehouse Priority
        const centralRule = rules?.find(r => r.active && r.type === 'central_warehouse')
        if (centralRule && centralRule.config.centralWarehouseId === loc.id) {
             score += 2000 * (11 - centralRule.priority)
        }
        
        // C. Stock Level Bonus (Prefer higher stock to avoid depletion)
        const stockRule = rules?.find(r => r.active && r.type === 'stock_level')
        const totalStock = items.reduce((sum, item) => sum + (stockMap.get(getStockKey(item.skuId, loc.id)) ?? 0), 0)
        // Cap at 500 units to avoid skewing too much
        const stockScore = Math.min(500, totalStock)
        score += stockScore * (stockRule ? (11 - stockRule.priority) : 1)
        
        return { id: loc.id, score, totalStock }
    })
    
    // Sort by Score DESC
    scores.sort((a, b) => b.score - a.score)
    
    return scores[0].id
}
