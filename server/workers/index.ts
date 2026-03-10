import { queue } from '../queue'
import { ShopeeClient } from '../integrations/shopee'
import { handleReportGeneration } from './report'
import { handleNotification } from './notification'

// Factory to get client based on channel config
const getClient = (channelId: string) => {
    // In real app, load config from DB
    if (channelId === 'shopee-1') {
        return new ShopeeClient({ shopId: '123456', accessToken: 'xxx' })
    }
    return new ShopeeClient({ shopId: 'default', accessToken: 'xxx' })
}

export function initWorkers() {
    console.log('[Workers] Initializing Job Consumers...')

    // 1. Order Sync
    queue.register('SYNC_ORDER', async ({ channelId, orderId }) => {
        console.log(`[Worker: Order] Syncing ${orderId} from ${channelId}`)
        const client = getClient(channelId)
        // Fetch order detail...
        // Update DB...
    })

    // 2. Inventory Sync
    queue.register('SYNC_INVENTORY', async ({ sku, qty }) => {
        console.log(`[Worker: Inventory] Pushing stock ${sku} -> ${qty}`)
        // Iterate all channels and update
        const channels = ['shopee-1'] 
        for (const ch of channels) {
            const client = getClient(ch)
            await client.syncInventory(sku, qty)
        }
    })

    // 3. Reports
    queue.register('GENERATE_REPORT', handleReportGeneration)

    // 4. Notifications
    queue.register('SEND_NOTIFICATION', handleNotification)
    
    // 5. Forecast (Mock)
    queue.register('FORECAST_DEMAND', async () => {
        console.log('[Worker: AI] Running demand forecasting...')
    })
}
