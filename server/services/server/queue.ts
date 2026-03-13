export type JobType = 'SYNC_ORDER' | 'SYNC_INVENTORY'

interface Job {
    id: string
    type: JobType
    payload: any
    status: 'pending' | 'processing' | 'completed' | 'failed'
    error?: string
}

export class JobQueue {
    private jobs: Job[] = []
    private handlers: Record<string, (payload: any) => Promise<void>> = {}

    register(type: JobType, handler: (payload: any) => Promise<void>) {
        this.handlers[type] = handler
    }

    add(type: JobType, payload: any) {
        const job: Job = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            payload,
            status: 'pending'
        }
        this.jobs.push(job)
        console.log(`[Queue] Job added: ${type} (${job.id})`)
        
        // Simulate async processing
        setTimeout(() => this.process(job), 100)
    }

    private async process(job: Job) {
        job.status = 'processing'
        try {
            const handler = this.handlers[job.type]
            if (handler) {
                await handler(job.payload)
                job.status = 'completed'
                console.log(`[Queue] Job completed: ${job.id}`)
            } else {
                console.error(`[Queue] No handler for ${job.type}`)
                job.status = 'failed'
                job.error = 'No handler'
            }
        } catch (e: any) {
            job.status = 'failed'
            job.error = e.message
            console.error(`[Queue] Job failed: ${job.id}`, e)
        }
    }
}

export const queue = new JobQueue()
