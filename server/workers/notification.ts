export async function handleNotification(payload: { type: string; recipient: string; message: string }) {
    console.log(`[Worker] Sending ${payload.type} to ${payload.recipient}: ${payload.message}`)
    // Send Push / Email / SMS
}
