export const MODEL = 'gemini-2.5-flash'

const GOOGLE_AI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function toGeminiMessages(messages: ChatMessage[]) {
  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMessages = messages.filter((m) => m.role !== 'system')

  const contents = chatMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = { contents }
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] }
  }
  return body
}

export async function callOpenRouter(
  messages: ChatMessage[],
  maxTokens: number,
  debugLabel?: string  // when provided, logs full request + response
): Promise<{ text: string | null; stopReason: string | null; usage: unknown }> {
  const key = process.env.GOOGLE_AI_KEY
  const body = { ...toGeminiMessages(messages), generationConfig: { maxOutputTokens: maxTokens } }

  if (debugLabel) {
    console.log(`[${debugLabel}] REQUEST TO GEMINI:`)
    console.log(`[${debugLabel}] Model:`, MODEL)
    console.log(`[${debugLabel}] systemInstruction length:`, JSON.stringify((body as Record<string, unknown>).systemInstruction ?? '').length, 'chars')
    const contents = (body as Record<string, unknown>).contents
    if (Array.isArray(contents)) {
      contents.forEach((msg: unknown, i: number) => {
        const m = msg as { role: string; parts: Array<{ text: string }> }
        console.log(`[${debugLabel}] contents[${i}] role:`, m.role, '| text length:', m.parts?.[0]?.text?.length ?? 0, 'chars')
        console.log(`[${debugLabel}] contents[${i}] text (first 300 chars):`, m.parts?.[0]?.text?.slice(0, 300))
      })
    }
    console.log(`[${debugLabel}] maxOutputTokens:`, maxTokens)
  }

  const response = await fetch(`${GOOGLE_AI_URL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (debugLabel) {
    console.log(`[${debugLabel}] GEMINI RAW RESPONSE:`)
    console.log(`[${debugLabel}] Status:`, response.status, response.statusText)
  }

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    if (debugLabel) {
      console.error(`[${debugLabel}] Error body:`, err)
    }
    throw new Error(`Google AI error ${response.status}: ${err}`)
  }

  const data = await response.json()

  if (debugLabel) {
    // Log the full structure without truncating — this is what we need to diagnose
    console.log(`[${debugLabel}] Full response object:`, JSON.stringify(data, null, 2).slice(0, 3000))

    const candidates = data.candidates
    console.log(`[${debugLabel}] candidates count:`, candidates?.length ?? 0)
    if (candidates?.[0]) {
      console.log(`[${debugLabel}] candidates[0].finishReason:`, candidates[0].finishReason)
      console.log(`[${debugLabel}] candidates[0].content.role:`, candidates[0].content?.role)
      const parts = candidates[0].content?.parts
      console.log(`[${debugLabel}] parts count:`, parts?.length ?? 0)
      parts?.forEach((p: Record<string, unknown>, i: number) => {
        console.log(`[${debugLabel}] parts[${i}] keys:`, Object.keys(p))
        console.log(`[${debugLabel}] parts[${i}] thought:`, p.thought ?? false)
        console.log(`[${debugLabel}] parts[${i}] text (first 500 chars):`, String(p.text ?? '').slice(0, 500))
      })
    }
    if (data.promptFeedback) {
      console.log(`[${debugLabel}] promptFeedback:`, JSON.stringify(data.promptFeedback))
    }
  }

  // Gemini 2.5 Flash may return thinking tokens (thought: true) before the actual text part.
  // Find the first non-thought part that has text.
  const parts = data.candidates?.[0]?.content?.parts as Array<{ text?: string; thought?: boolean }> | undefined
  const textPart = parts?.find((p) => p.text && !p.thought)
  const text: string | null = textPart?.text ?? null
  const stopReason: string | null = data.candidates?.[0]?.finishReason ?? null

  if (debugLabel) {
    console.log(`[${debugLabel}] extracted text (first 500 chars):`, text?.slice(0, 500) ?? 'NULL')
    console.log(`[${debugLabel}] stopReason:`, stopReason)
  }

  return { text, stopReason, usage: null }
}

export function buildGeminiStreamRequest(messages: ChatMessage[], maxTokens: number) {
  const key = process.env.GOOGLE_AI_KEY
  const body = { ...toGeminiMessages(messages), generationConfig: { maxOutputTokens: maxTokens } }
  return {
    url: `${GOOGLE_AI_URL}:streamGenerateContent?alt=sse&key=${key}`,
    body: JSON.stringify(body),
  }
}
