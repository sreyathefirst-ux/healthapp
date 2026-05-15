import { createClient } from '@/lib/supabase/server'
import { callOpenRouter } from '@/lib/openrouter'
import { fetchFullProfile } from '@/lib/profile'
import { UserProfile } from '@/types'

export const maxDuration = 60

const SYSTEM_TRIGGERS = ['START_GENERAL_CHAT', 'START_MORNING_CHECKIN', 'START_NIGHT_CHECKIN']

interface DetectedInfo {
  detected: boolean
  category?: string | null
  field?: string | null
  value?: string | null
  confirmationMessage?: string | null
}

// ── POST: send a message ──────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { message, checkInType = 'general', checkInStep = 0 } = await req.json()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch full user profile
    const profile = await fetchFullProfile(supabase, user.id)

    // Fetch bloodwork (latest)
    const { data: bloodwork } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch this week's plan
    const weekStartDate = getMonday()
    const { data: weeklyPlan } = await supabase
      .from('weekly_plans')
      .select('meal_plan, workout_plan, health_report')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStartDate)
      .maybeSingle()

    // Fetch last 7 daily logs
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const { data: recentLogs } = await supabase
      .from('daily_logs')
      .select('date, morning_checkin, night_checkin, meal_log, workout_log')
      .eq('user_id', user.id)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })

    // Fetch chat history (cap at 100 for context window)
    const { data: rawHistory } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(100)

    const history = (rawHistory ?? []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const systemPrompt = buildSystemPrompt(
      profile, bloodwork, weeklyPlan, recentLogs,
      checkInType, checkInStep
    )

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...compactHistory(history),
      { role: 'user' as const, content: message },
    ]

    const { text } = await callOpenRouter(apiMessages, 700)
    if (!text) return Response.json({ error: 'No AI response' }, { status: 500 })

    // Save to chat_history (skip system trigger messages)
    const isSystemTrigger = SYSTEM_TRIGGERS.includes(message)
    const inserts = [
      ...(isSystemTrigger ? [] : [
        { user_id: user.id, role: 'user', content: message, check_in_type: checkInType },
      ]),
      { user_id: user.id, role: 'assistant', content: text, check_in_type: checkInType },
    ]
    await supabase.from('chat_history').insert(inserts)

    // Detect new health info on general chat (not triggers or check-ins)
    let detectedInfo: DetectedInfo = { detected: false }
    if (checkInType === 'general' && !isSystemTrigger) {
      detectedInfo = await detectHealthInfo(message, profile)
    }

    return Response.json({ content: text, detectedInfo })
  } catch (err) {
    console.error('[vita/chat] POST error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH: save detected health info to profile ───────────────────────────────

export async function PATCH(req: Request) {
  try {
    const { category, field, value } = await req.json()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const table = category === 'food_preferences' ? 'food_preferences' : 'medical_profile'

    // Fetch current value and append
    const { data: existing } = await supabase
      .from(table)
      .select(field)
      .eq('user_id', user.id)
      .maybeSingle()

    const current: string[] = existing?.[field] ?? []
    if (!current.includes(value)) {
      await supabase
        .from(table)
        .upsert({ user_id: user.id, [field]: [...current, value] }, { onConflict: 'user_id' })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('[vita/chat] PATCH error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonday(): string {
  const today = new Date()
  const dow = today.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

function compactHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  if (history.length <= 50) return history
  const recent = history.slice(-20)
  const olderCount = history.length - 20
  return [
    {
      role: 'user' as const,
      content: `[Earlier conversation context: ${olderCount} messages were exchanged covering health goals, meal plans, workout progress, and daily check-ins.]`,
    },
    ...recent,
  ]
}

function buildSystemPrompt(
  profile: UserProfile | null,
  bloodwork: Record<string, unknown> | null,
  weeklyPlan: Record<string, unknown> | null,
  recentLogs: Record<string, unknown>[] | null,
  checkInType: string,
  checkInStep: number
): string {
  const name = profile?.name?.split(' ')[0] || 'there'
  const conditions = profile?.medical_profile?.conditions ?? []

  let prompt = `You are Vita, Vitalia's personal AI health assistant. You are warm, knowledgeable, and speak like a caring doctor who is also a supportive coach. You have full access to the user's health profile, bloodwork, meal plan, workout plan, and chat history. You remember everything discussed since onboarding.

Core behavior:
- Answer health questions with personalized, data-driven responses
- Reference the user's specific conditions, goals, and history in every answer
- Keep responses concise and conversational — max 3-4 sentences unless more detail is requested
- Use the user's first name (${name}) naturally but not on every message
- Never give generic advice — always tie responses to this user's data
- If asked something outside health, gently redirect`

  if (profile) {
    const p = profile
    prompt += `

USER PROFILE:
Name: ${p.name}
Age: ${p.age} | Height: ${p.height_cm}cm | Weight: ${p.weight_kg}kg
Wake time: ${p.routine_preferences?.wake_time || '07:00'} | Sleep time: ${p.routine_preferences?.sleep_time || '23:00'}
Conditions: ${conditions.join(', ') || 'None'}
Medications: ${p.medical_profile?.medications?.join(', ') || 'None'}
Supplements: ${p.medical_profile?.supplements?.join(', ') || 'None'}
Health concerns: ${p.medical_profile?.concerns?.join(', ') || 'None'}
Health goals: ${p.medical_profile?.goals?.join(', ') || 'None'}
Diet restrictions: ${p.food_preferences?.restrictions?.join(', ') || 'None'}
Allergies: ${p.food_preferences?.allergies?.join(', ') || 'None'}
Loved cuisines: ${p.food_preferences?.loved_cuisines?.join(', ') || 'None'}
Workout goals: ${p.workout_preferences?.goals?.join(', ') || 'None'}
Days/week: ${p.workout_preferences?.days_per_week || 3} | Gym: ${p.workout_preferences?.gym_access ? 'Yes' : 'No'}
Equipment: ${p.workout_preferences?.home_equipment?.join(', ') || 'None'}`
  }

  if (bloodwork) {
    prompt += `\n\nBLOODWORK: Biomarker data is available. Reference it when the user asks about cholesterol, blood sugar, vitamin levels, etc.`
  }

  if (weeklyPlan?.health_report) {
    prompt += `\n\nHEALTH REPORT: ${String(weeklyPlan.health_report).slice(0, 400)}`
  }

  if (recentLogs && recentLogs.length > 0) {
    const logSummary = recentLogs.slice(0, 3).map((l: Record<string, unknown>) => l.date).join(', ')
    prompt += `\n\nRECENT ACTIVITY: Logs available for dates: ${logSummary}`
  }

  // System trigger handling
  if (checkInType === 'general') {
    prompt += `

GENERAL CHAT MODE:
When the user message is "START_GENERAL_CHAT":
Greet ${name} warmly by name. Mention one specific thing from their health profile to show you're paying attention. End with "How can I support your health today?" Keep it to 2 sentences max.`
  }

  // Morning check-in
  if (checkInType === 'morning') {
    const dynamicQ = conditions.some(c => /pcos/i.test(c))
      ? 'Any hormonal symptoms today? (bloating, cramps, mood swings)'
      : conditions.some(c => /cholesterol/i.test(c))
        ? 'Did you have any high-fat foods yesterday?'
        : 'Is there anything health-related on your mind today?'

    const questions = [
      'How did you sleep last night? (hours + quality)',
      'How are you feeling physically this morning? Any aches, pains, or discomfort?',
      'How is your energy level right now? Rate it 1–10.',
      'Any new symptoms or health concerns since yesterday?',
      "What's your mood like this morning?",
      dynamicQ,
    ]

    prompt += `

MORNING CHECK-IN (Step ${checkInStep + 1} of ${questions.length}):
Ask questions ONE AT A TIME. Acknowledge each answer briefly before moving to the next.

Questions in order:
${questions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

${checkInStep === 0
  ? `Message is "START_MORNING_CHECKIN". Greet ${name}: "Good morning ${name}! ☀️ Time for your daily check-in. Let's see how you're doing today." Then ask question 1 on a new line.`
  : checkInStep < questions.length
    ? `Briefly acknowledge their answer (1 sentence), then ask question ${checkInStep + 1}.`
    : `Give a brief personalized morning insight based on all their answers. Be encouraging and specific. Max 4 sentences.`
}`
  }

  // Night check-in
  if (checkInType === 'night') {
    const dynamicQ = conditions.some(c => /pcos/i.test(c))
      ? 'Any hormonal symptoms today? (bloating, cramps, mood swings)'
      : conditions.some(c => /cholesterol/i.test(c))
        ? 'Did you have any high-fat foods today?'
        : "Anything you want me to keep in mind for tomorrow's plan?"

    const questions = [
      'How was your energy throughout the day?',
      'Did you complete your workout today? How did it go?',
      'How did your meals go today? Did you stick to the plan?',
      'How are you feeling emotionally tonight?',
      'Any physical symptoms or discomfort today?',
      dynamicQ,
      "Anything else you'd like me to keep in mind for tomorrow?",
    ]

    prompt += `

NIGHT CHECK-IN (Step ${checkInStep + 1} of ${questions.length}):
Ask questions ONE AT A TIME. Acknowledge each answer briefly before the next.

Questions in order:
${questions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

${checkInStep === 0
  ? `Message is "START_NIGHT_CHECKIN". Greet ${name}: "Good evening ${name}! 🌙 Let's do your evening check-in before you wind down." Then ask question 1 on a new line.`
  : checkInStep < questions.length
    ? `Briefly acknowledge their answer (1 sentence), then ask question ${checkInStep + 1}.`
    : `Give a brief, warm evening summary and one actionable tip for tomorrow. Max 4 sentences.`
}`
  }

  return prompt
}

async function detectHealthInfo(
  message: string,
  profile: UserProfile | null
): Promise<DetectedInfo> {
  try {
    const existing = {
      conditions: profile?.medical_profile?.conditions?.join(', ') || 'None',
      medications: profile?.medical_profile?.medications?.join(', ') || 'None',
      allergies: profile?.food_preferences?.allergies?.join(', ') || 'None',
      concerns: profile?.medical_profile?.concerns?.join(', ') || 'None',
      restrictions: profile?.food_preferences?.restrictions?.join(', ') || 'None',
    }

    const { text } = await callOpenRouter(
      [{
        role: 'user',
        content: `Analyze this user message for any NEW health information not already in their profile.

User message: "${message}"

Existing profile:
- Conditions: ${existing.conditions}
- Medications: ${existing.medications}
- Allergies: ${existing.allergies}
- Health concerns: ${existing.concerns}
- Diet restrictions: ${existing.restrictions}

Detect: new symptoms, conditions, medications, supplements, food allergies/intolerances, health concerns.
Only flag information that is clearly NEW and not already listed.

Return ONLY valid JSON (no markdown fences):
{"detected":false}
OR
{"detected":true,"category":"medical_profile","field":"conditions","value":"migraine","confirmationMessage":"I noticed you mentioned migraines. Would you like me to add this to your health profile so I can factor it into your next plan?"}

field must be one of: conditions, concerns, medications, supplements, allergies, restrictions
category is either medical_profile or food_preferences`,
      }],
      150,
      undefined,
      { thinkingConfig: { thinkingBudget: 0 } }
    )

    if (!text) return { detected: false }
    const clean = text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { detected: false }
  }
}
