export let timeOffset = 0

export function updateServerTime(serverDateHeader: string | null) {
  if (!serverDateHeader) return
  const serverTime = Date.parse(serverDateHeader)
  if (!isNaN(serverTime)) {
    // serverTime is the time when server sent response.
    // We assume network latency is symmetric or negligible for this purpose (seconds precision).
    // offset = server - local
    timeOffset = serverTime - Date.now()
  }
}

export function getSecureNow(): number {
  return Date.now() + timeOffset
}
