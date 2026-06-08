import { createClient } from "@supabase/supabase-js"
import { DetectedCode } from "./detector"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export interface MonitoredAccount {
  id: string
  username: string
  display_name: string
  platform_color: string
  is_active: boolean
  auto_remove: boolean
}

// Get list of TikTok accounts to monitor
export async function getMonitoredAccounts(): Promise<MonitoredAccount[]> {
  const { data, error } = await supabase
    .from("tiktok_monitored")
    .select("*")
    .eq("is_active", true)
  if (error) { console.error("getMonitoredAccounts:", error.message); return [] }
  return data ?? []
}

// Upsert live stream record
export async function upsertStream(account: MonitoredAccount, isLive: boolean, viewers: number) {
  const { error } = await supabase
    .from("live_streams")
    .upsert(
      {
        platform: "tiktok",
        streamer: account.display_name || account.username,
        title: `TikTok Live — ${account.display_name || account.username}`,
        viewers,
        color: account.platform_color || "#ec4899",
        is_live: isLive,
        stream_url: `https://www.tiktok.com/@${account.username}/live`,
        codes: [],
      },
      { onConflict: "streamer,platform" }
    )
  if (error) console.error("upsertStream:", error.message)
}

// Add detected code to a stream
export async function pushCode(streamer: string, code: DetectedCode) {
  // Get current stream
  const { data } = await supabase
    .from("live_streams")
    .select("id, codes")
    .eq("streamer", streamer)
    .eq("platform", "tiktok")
    .single()

  if (!data) return

  const existing: DetectedCode[] = Array.isArray(data.codes) ? data.codes : []
  // Avoid duplicate codes
  if (existing.some(c => c.code === code.code)) return

  const updated = [{ ...code, detected: true }, ...existing].slice(0, 10)

  const { error } = await supabase
    .from("live_streams")
    .update({ codes: updated })
    .eq("id", data.id)

  if (error) console.error("pushCode:", error.message)
  else console.log(`[${streamer}] New code detected: ${code.code} (${code.discount})`)
}

// Mark stream as offline
export async function markOffline(streamer: string) {
  await supabase
    .from("live_streams")
    .update({ is_live: false, viewers: 0 })
    .eq("streamer", streamer)
    .eq("platform", "tiktok")
}

// Remove account from monitored list (for auto_remove accounts)
export async function removeMonitoredAccount(username: string) {
  const { error } = await supabase
    .from("tiktok_monitored")
    .delete()
    .eq("username", username)
  if (error) console.error("removeMonitoredAccount:", error.message)
  else console.log(`[${username}] 🗑️ Auto-removed from monitored list`)
}
