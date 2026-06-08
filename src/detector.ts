export interface DetectedCode {
  code: string
  discount: string
  min_spend: number
  left: number
}

// Patterns that indicate a discount code in Thai/English TikTok chat
const CODE_PATTERNS = [
  /โค้ด\s*:?\s*([A-Z0-9]{3,15})/i,
  /code\s*:?\s*([A-Z0-9]{3,15})/i,
  /คูปอง\s*:?\s*([A-Z0-9]{3,15})/i,
  /coupon\s*:?\s*([A-Z0-9]{3,15})/i,
  /ส่วนลด\s*:?\s*([A-Z0-9]{3,15})/i,
  // Standalone uppercase codes 4-12 chars (e.g. "SHOP50" "SALE100")
  /\b([A-Z]{2,}[0-9]{1,6})\b/,
  /\b([A-Z0-9]{4,12})\b(?=.*(?:ลด|บาท|%|discount|off))/i,
]

const DISCOUNT_PATTERNS = [
  /ลด\s*(\d+)\s*%/,
  /(\d+)\s*%\s*off/i,
  /ลด\s*(\d+)\s*บาท/,
  /(\d+)\s*บาท/,
  /save\s*(\d+)/i,
]

const MIN_SPEND_PATTERNS = [
  /ขั้นต่ำ\s*(\d+)/,
  /min(?:imum)?\s*(\d+)/i,
  /ซื้อครบ\s*(\d+)/,
]

const LEFT_PATTERNS = [
  /เหลือ\s*(\d+)\s*สิทธิ์/,
  /(\d+)\s*สิทธิ์/,
  /(\d+)\s*left/i,
  /เหลือ\s*(\d+)/,
]

function extractNumber(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return parseInt(m[1])
  }
  return null
}

export function detectCode(message: string): DetectedCode | null {
  const upper = message.toUpperCase()

  for (const pattern of CODE_PATTERNS) {
    const match = message.match(pattern)
    if (!match) continue

    const code = match[1].toUpperCase()
    // Skip common words that look like codes
    if (["HTTP", "HTTPS", "WWW", "COM", "THE"].includes(code)) continue

    const discount = (() => {
      const pct = extractNumber(message, [/ลด\s*(\d+)\s*%/, /(\d+)\s*%\s*off/i])
      if (pct) return `ลด ${pct}%`
      const thb = extractNumber(message, [/ลด\s*(\d+)\s*บาท/, /(\d+)\s*บาท/])
      if (thb) return `ลด ฿${thb}`
      return "ส่วนลดพิเศษ"
    })()

    const min_spend = extractNumber(message, MIN_SPEND_PATTERNS) ?? 0
    const left      = extractNumber(message, LEFT_PATTERNS) ?? Math.floor(Math.random() * 400 + 100)

    return { code, discount, min_spend, left }
  }
  return null
}

// Check if message is likely announcing a code (not just mentioning one)
export function isCodeAnnouncement(message: string): boolean {
  const keywords = ["โค้ด", "code", "คูปอง", "coupon", "ส่วนลด", "discount", "ลด", "สิทธิ์", "grab", "รีบ"]
  const lower = message.toLowerCase()
  return keywords.some(k => lower.includes(k))
}
