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
  maxTokens: number
): Promise<{ text: string | null; stopReason: string | null; usage: unknown }> {
  const key = process.env.GOOGLE_AI_KEY
  const body = { ...toGeminiMessages(messages), generationConfig: { maxOutputTokens: maxTokens } }

  const response = await fetch(`${GOOGLE_AI_URL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`Google AI error ${response.status}: ${err}`)
  }

  const data = await response.json()
  // Gemini 2.5 Flash may return thinking tokens (thought: true) before the actual text part.
  // Find the first non-thought part that has text.
  const parts = data.candidates?.[0]?.content?.parts as Array<{ text?: string; thought?: boolean }> | undefined
  const textPart = parts?.find((p) => p.text && !p.thought)
  const text: string | null = textPart?.text ?? null
  const stopReason: string | null = data.candidates?.[0]?.finishReason ?? null
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
