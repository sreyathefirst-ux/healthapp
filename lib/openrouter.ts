export const MODEL = 'google/gemini-2.5-flash'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callOpenRouter(
  messages: ChatMessage[],
  maxTokens: number
): Promise<{ text: string | null; stopReason: string | null; usage: unknown }> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`OpenRouter error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text: string | null = data.choices?.[0]?.message?.content ?? null
  const stopReason: string | null = data.choices?.[0]?.finish_reason ?? null
  const usage = data.usage ?? null
  return { text, stopReason, usage }
}
