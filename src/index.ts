import { WebcastPushConnection } from "tiktok-live-connector"
import { detectCode, isCodeAnnouncement } from "./detector"
import { getMonitoredAccounts, upsertStream, pushCode, markOffline, MonitoredAccount } from "./supabase"

const RETRY_DELAY_MS  = 30_000   // 30s before retry after disconnect
const REFRESH_LIST_MS = 5 * 60_000 // Refresh monitored list every 5 min

const activeConnections = new Map<string, WebcastPushConnection>()

async function connectAccount(account: MonitoredAccount) {
  const { username } = account

  if (activeConnections.has(username)) return // already connected

  console.log(`[${username}] Connecting…`)

  const conn = new WebcastPushConnection(username, {
    processInitialData: false,
    enableExtendedGiftInfo: false,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
  })

  activeConnections.set(username, conn)

  conn.on("connected", (state: { upgradedToWebsocket: boolean }) => {
    console.log(`[${username}] ✅ Connected (websocket: ${state.upgradedToWebsocket})`)
    upsertStream(account, true, 0)
  })

  conn.on("roomUser", (data: { viewerCount: number }) => {
    upsertStream(account, true, data.viewerCount)
  })

  conn.on("chat", (data: { comment: string; nickname: string }) => {
    const msg = data.comment ?? ""
    if (!isCodeAnnouncement(msg)) return

    const detected = detectCode(msg)
    if (detected) {
      console.log(`[${username}] 💬 ${data.nickname}: ${msg}`)
      pushCode(account.display_name || username, detected)
    }
  })

  conn.on("streamEnd", () => {
    console.log(`[${username}] 🔴 Stream ended`)
    markOffline(account.display_name || username)
    activeConnections.delete(username)
  })

  conn.on("disconnected", () => {
    console.log(`[${username}] Disconnected — retrying in ${RETRY_DELAY_MS / 1000}s`)
    activeConnections.delete(username)
    setTimeout(() => connectAccount(account), RETRY_DELAY_MS)
  })

  try {
    await conn.connect()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("LIVE_NOT_FOUND") || msg.includes("not live")) {
      console.log(`[${username}] Not live right now — will retry in ${RETRY_DELAY_MS / 1000}s`)
      markOffline(account.display_name || username)
    } else {
      console.error(`[${username}] Connect error: ${msg}`)
    }
    activeConnections.delete(username)
    setTimeout(() => connectAccount(account), RETRY_DELAY_MS)
  }
}

async function refreshAndConnect() {
  const accounts = await getMonitoredAccounts()
  console.log(`Monitoring ${accounts.length} accounts: ${accounts.map(a => a.username).join(", ")}`)

  for (const account of accounts) {
    connectAccount(account)
  }
}

// Main loop
console.log("🎵 TikTok Live Worker starting…")
refreshAndConnect()
setInterval(refreshAndConnect, REFRESH_LIST_MS)
