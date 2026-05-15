import { UserProfile, DailyLog, MealPlan, WorkoutPlan } from '@/types'
import { buildSystemPrompt } from './anthropic'

export { buildSystemPrompt }

export const MEAL_PLAN_PROMPT = `Generate a 7-day meal plan for this user.
Return ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "week_start_date": "YYYY-MM-DD",
  "days": {
    "monday": {
      "breakfast": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["2 cups ingredient", "..."], "image_url": null, "image_prompt": "A hand-drawn watercolor illustration of [meal name], fine liner pen with loose watercolor fill, Great British Baking Show recipe card style, warm rich colors, sketchbook paper texture" },
      "lunch": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["..."], "image_url": null, "image_prompt": "..." },
      "dinner": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["..."], "image_url": null, "image_prompt": "..." },
      "snack": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["..."], "image_url": null, "image_prompt": "..." }
    },
    "tuesday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "wednesday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "thursday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "friday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "saturday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "sunday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} }
  }
}

QUALITY RULES — these are as important as the health rules:
- Every meal must be GENUINELY DELICIOUS and restaurant-quality — never bland, generic, or boring
- Use bold, layered flavors: umami-rich, aromatic, textured combinations the user would actually crave
- Draw heavily from the user's loved cuisines to make meals feel personal and exciting
- Use fresh herbs, quality fats, and interesting cooking techniques (roasted, caramelized, marinated)
- description must read like an appetizing menu item — make it sound delicious, not clinical
- Variety across the week: no ingredient or cooking method should repeat more than twice

HEALTH RULES — non-negotiable:
- Meals MUST respect ALL allergies and restrictions
- Tailor nutrients to conditions (low glycemic for insulin resistance, omega-3-rich for inflammation, iodine-rich for hypothyroidism, etc.)
- Use anti-inflammatory spices where relevant (turmeric, ginger, garlic, cinnamon)
- Calories and macros must match user's weight and goals
- Ingredients list: include quantities (e.g. "2 cups spinach", "1 tbsp olive oil")
- reasoning must cite the specific condition or biomarker this meal addresses
- Use real UUIDs for ids
- ALL 7 days MUST be fully populated — never omit a day`

export const WORKOUT_PLAN_PROMPT = `Generate a 7-day workout plan for this user.
Return ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "week_start_date": "YYYY-MM-DD",
  "days": {
    "monday": {
      "type": "workout",
      "workout_name": "Lower Body Strength",
      "location": "gym",
      "duration_mins": 45,
      "exercises": [
        { "id": "uuid", "name": "Hip Thrust", "sets": 3, "reps": 12, "rest_seconds": 60, "reasoning": "...", "gif_url": null }
      ]
    },
    "tuesday": { "type": "rest", "recovery_note": "..." },
    "wednesday": { "type": "workout", "workout_name": "...", "location": "gym", "duration_mins": 45, "exercises": [...] },
    "thursday": { "type": "rest", "recovery_note": "..." },
    "friday": { "type": "workout", "workout_name": "...", "location": "gym", "duration_mins": 45, "exercises": [...] },
    "saturday": { "type": "workout", "workout_name": "...", "location": "home", "duration_mins": 30, "exercises": [...] },
    "sunday": { "type": "rest", "recovery_note": "..." }
  }
}
Rules:
- Respect gym_access and preferred activity types
- Schedule exactly \${workout_preferences.days_per_week} workout days, with rest days distributed optimally
- Reasoning must reference the user's specific goals or conditions
- For home workouts, only use bodyweight or stated home equipment
- Use real UUIDs for ids
- ALL 7 days must be present (type: "workout" or "rest")`

export const ROUTINE_PROMPT = `Generate a personalized daily routine checklist for this user — a morning routine and a night routine.

Return ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "morning_items": [
    { "id": "uuid", "label": "Drink 16oz water", "time_target": "7:00 AM" }
  ],
  "night_items": [
    { "id": "uuid", "label": "Take magnesium glycinate 400mg", "time_target": "9:30 PM" }
  ]
}

Rules:
- morning_items should begin at or just after the user's wake_time, spanning the first 60-90 minutes of their day
- night_items should span the 60-90 minutes before the user's sleep_time
- Include their specific medications with correct timing (e.g. levothyroxine must be taken on an empty stomach 30-60 min before food; metformin with food; statins at night)
- Include their supplements with appropriate timing
- Include items tailored to their medical conditions (e.g. blood glucose check for diabetes, weigh-in for weight management, stretching for joint conditions)
- Reference the habits they mentioned during onboarding
- 6-10 items per routine is ideal — thorough but not overwhelming
- Labels must be specific and actionable: "Take levothyroxine 50mcg on empty stomach" not "Take medication"
- time_target must use 12-hour format: "7:00 AM", "9:30 PM"
- Use real UUID-like strings for ids (e.g. "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
- Do NOT include exercise or meals — those are handled separately`

// ── Dynamic health report ──────────────────────────────────────────────────

type BloodworkRow = {
  biomarker_name: string
  value: number
  unit: string
  reference_range_low: number
  reference_range_high: number
  is_flagged?: boolean
}

function markerMatch(marker: BloodworkRow, keywords: string[]): boolean {
  const name = marker.biomarker_name.toLowerCase()
  return keywords.some((k) => name.includes(k.toLowerCase()))
}

function isFlagged(markers: BloodworkRow[], keywords: string[]): boolean {
  return markers.some((m) => m.is_flagged && markerMatch(m, keywords))
}

function hasCondition(conditions: string[], keywords: string[]): boolean {
  return conditions.some((c) =>
    keywords.some((k) => c.toLowerCase().includes(k.toLowerCase()))
  )
}

function buildChangeSummary(current: BloodworkRow[], previous: BloodworkRow[]): string {
  if (previous.length === 0) return ''
  const changes: string[] = []
  for (const curr of current) {
    const prev = previous.find((p) => p.biomarker_name.toLowerCase() === curr.biomarker_name.toLowerCase())
    if (!prev || prev.value === 0) continue
    const delta = curr.value - prev.value
    const pct = Math.abs(delta / prev.value) * 100
    if (pct < 10) continue
    const direction = delta > 0 ? 'increased' : 'decreased'
    const nowStatus = curr.is_flagged ? ' ⚠️ still flagged' : (prev.is_flagged && !curr.is_flagged ? ' ✅ now in range' : '')
    changes.push(`${curr.biomarker_name}: ${prev.value}${prev.unit} → ${curr.value}${curr.unit} (${direction} ${pct.toFixed(0)}%)${nowStatus}`)
  }
  if (changes.length === 0) return ''
  const prevDate = (previous[0] as BloodworkRow & { upload_date?: string }).upload_date ?? 'previous upload'
  return `SIGNIFICANT CHANGES SINCE LAST BLOODWORK (${prevDate}):\n${changes.join('\n')}`
}

function flaggedSummary(markers: BloodworkRow[]): string {
  const flagged = markers.filter((m) => m.is_flagged)
  if (flagged.length === 0) return 'No flagged biomarkers.'
  return flagged
    .map(
      (m) =>
        `${m.biomarker_name}: ${m.value}${m.unit} (ref: ${m.reference_range_low}–${m.reference_range_high}) ⚠️ FLAGGED`
    )
    .join('\n')
}

export function buildHealthReportPrompt(
  profile: UserProfile,
  bloodwork: BloodworkRow[],
  previousBloodwork: BloodworkRow[] = []
): string {
  const conditions = (profile.medical_profile?.conditions || []).map((c) => c.toLowerCase())

  // Determine which specialists are relevant
  const needsCardiologist =
    hasCondition(conditions, ['heart', 'cardio', 'hypertension', 'cholesterol', 'atherosclerosis', 'arrhythmia']) ||
    isFlagged(bloodwork, ['LDL', 'Cholesterol', 'Triglyceride', 'HDL', 'Non-HDL', 'VLDL', 'Lipoprotein', 'CRP', 'hsCRP'])

  const needsEndocrinologist =
    hasCondition(conditions, [
      'pcos', 'thyroid', 'hypothyroid', 'hyperthyroid', 'hashimoto', 'graves',
      'diabetes', 'prediabetes', 'insulin resistance', 'adrenal', 'hormonal', 'cortisol',
      'testosterone', 'estrogen', 'progesterone', 'menstrual', 'perimenopause', 'menopause',
    ]) ||
    isFlagged(bloodwork, [
      'TSH', 'T3', 'T4', 'Thyroid', 'HbA1c', 'Hemoglobin A1c', 'Glucose', 'Fasting Glucose',
      'Insulin', 'Cortisol', 'DHEA', 'Testosterone', 'Estrogen', 'Progesterone', 'LH', 'FSH',
    ])

  const needsGastroenterologist =
    hasCondition(conditions, [
      'ibs', 'crohn', 'celiac', 'colitis', 'sibo', 'digestive', 'gut', 'reflux', 'gerd',
      'gastroparesis', 'bowel', 'colon',
    ])

  const needsDermatologist =
    hasCondition(conditions, ['acne', 'eczema', 'psoriasis', 'rosacea', 'skin', 'dermatitis'])

  const needsRheumatologist =
    hasCondition(conditions, [
      'lupus', 'rheumatoid', 'autoimmune', 'fibromyalgia', 'sjögren', 'sjogren', 'ra ', 'ra,',
    ]) ||
    isFlagged(bloodwork, ['ANA', 'Anti-', 'Rheumatoid Factor', 'CCP', 'ESR', 'Sed Rate'])

  const flaggedBlock = flaggedSummary(bloodwork)
  const changesBlock = buildChangeSummary(bloodwork, previousBloodwork)
  const hasBloodwork = bloodwork.length > 0
  const allFlagged = bloodwork.filter((m) => m.is_flagged)

  // Cholesterol routing text for cardiologist
  const cardioFlagged = allFlagged.filter((m) =>
    ['LDL', 'Cholesterol', 'Triglyceride', 'HDL', 'CRP', 'hsCRP'].some((k) =>
      m.biomarker_name.toLowerCase().includes(k.toLowerCase())
    )
  )
  const endoFlagged = allFlagged.filter((m) =>
    ['TSH', 'T3', 'T4', 'Thyroid', 'HbA1c', 'Glucose', 'Insulin', 'Cortisol', 'DHEA', 'Testosterone', 'Estrogen', 'Progesterone', 'LH', 'FSH'].some(
      (k) => m.biomarker_name.toLowerCase().includes(k.toLowerCase())
    )
  )

  const cardioFlaggedText = cardioFlagged.length > 0
    ? `\nFLAGGED markers for your review: ${cardioFlagged.map((m) => `${m.biomarker_name} ${m.value}${m.unit} (ref: ${m.reference_range_low}–${m.reference_range_high})`).join(', ')}`
    : ''
  const endoFlaggedText = endoFlagged.length > 0
    ? `\nFLAGGED markers for your review: ${endoFlagged.map((m) => `${m.biomarker_name} ${m.value}${m.unit} (ref: ${m.reference_range_low}–${m.reference_range_high})`).join(', ')}`
    : ''

  const med = profile.medical_profile || {}
  const foodPref = profile.food_preferences || {}
  const profileBlock = `
PATIENT PROFILE (you MUST address ALL of the following in your report — do not skip any):
- Name: ${profile.name || 'Patient'}, Age: ${profile.age || 'unknown'}, Height: ${profile.height_cm || '?'}cm, Weight: ${profile.weight_kg || '?'}kg
- Medical conditions: ${med.conditions?.join(', ') || 'none reported'}
- Current medications: ${med.medications?.join(', ') || 'none reported'}
- Current supplements: ${med.supplements?.join(', ') || 'none reported'}
- Health concerns raised by patient: ${med.concerns?.join(', ') || 'none reported'}
- Health goals: ${med.goals?.join(', ') || 'not specified'}
- What success looks like to this patient: ${med.success_definition || 'not specified'}
- Dietary restrictions: ${foodPref.restrictions?.join(', ') || 'none'}
- Food allergies: ${foodPref.allergies?.join(', ') || 'none'}
- Exercise history: ${med.exercise_history || 'not specified'}`

  let prompt = `Generate a comprehensive, deeply personalized health report for this patient. Write it as if from a coordinated specialist care team who have all reviewed this patient's complete profile.

The report must be in Markdown, minimum 800 words. Write with warmth and clinical authority — not overly clinical. Use the patient's name throughout. Write in first-person plural ("we recommend", "our team has reviewed"). Use bullet points generously — recommendations should almost always be bulleted, not buried in paragraphs.

CRITICAL: Each specialist must stay strictly within their own domain. Do NOT repeat information covered in other sections. If a topic belongs to another specialist, acknowledge it in one sentence and refer the patient to that section (e.g. "see your Nutritionist section for specific dietary guidance"). Every section must add unique value.
${profileBlock}
${changesBlock ? `\n${changesBlock}\nIf significant changes are listed above, each relevant specialist section MUST acknowledge these changes and explain what they mean clinically for this patient.\n` : ''}
FLAGGED BLOODWORK (outside reference range for this patient):
${flaggedBlock}

---

## From Your Functional Medicine Doctor
SCOPE: The big picture only — how this patient's conditions, symptoms, and medications interact with each other as a system. What patterns emerge? What is the root-cause thread connecting their issues?
DO NOT cover: specific foods or meal advice (Nutritionist), individual hormone/metabolic marker interpretation (Endocrinologist), or exercise details (Trainer).
MUST include: Any nutrient depletions caused by their specific medications (e.g. metformin depletes B12). ${hasBloodwork ? 'Note any patterns across the bloodwork as a whole — not marker-by-marker (leave that to the relevant specialist).' : 'Note what patterns you would watch for given their conditions.'}
Format: 2–3 short paragraphs + bullet points for key connections and medication-related depletions. 80–120 words.

## From Your Clinical Nutritionist
SCOPE: Food, nutrients, and eating patterns only — nothing else.
DO NOT cover: general condition connections (Functional Medicine), gut condition management beyond food choices (Gastroenterologist), hormone interpretation (Endocrinologist), or supplements (covered in the Personalized Health Plan section).
MUST include: Specific foods and nutrients that directly address this patient's conditions${hasBloodwork ? ' and any bloodwork deficiencies' : ''}. Drug-nutrient interactions for their specific medications that affect what they should eat. Practical guidance respecting their dietary restrictions (${foodPref.restrictions?.join(', ') || 'none'}) and allergies (${foodPref.allergies?.join(', ') || 'none'}).
Format: mostly bullet points — each bullet names a specific food/nutrient and gives a one-line reason tied to their conditions. 80–100 words.

## From Your Personal Trainer
SCOPE: Exercise and movement only — nothing else.
DO NOT cover: nutrition, supplements, or medical interpretation.
MUST include: A specific training structure recommendation (e.g. frequency, type, intensity) appropriate for their exercise history and conditions. Any modifications required by their health conditions. Expected timeline for seeing their fitness goals. One brief note on what to watch for (e.g. signs to ease off).
Format: bullet points for training structure, short paragraph for rationale. 70–90 words.`

  if (needsEndocrinologist) {
    prompt += `

## From Your Endocrinologist
SCOPE: Hormonal and metabolic markers only — nothing else.${endoFlaggedText}
DO NOT cover: diet in detail (Nutritionist), general condition connections (Functional Medicine), supplements (Personalized Health Plan).
MUST include: Plain-English interpretation of each relevant hormonal/metabolic marker and what it means practically for this patient (energy, weight, mood, long-term risk). One clear sentence per marker — what is it, what does their value mean, what does it affect.
Format: bullet point per relevant marker, then 1–2 sentences on overall hormonal picture. 80–100 words.`
  }

  if (needsCardiologist) {
    prompt += `

## From Your Cardiologist
SCOPE: Cardiovascular risk only — nothing else.${cardioFlaggedText}
DO NOT cover: diet in detail ("see Nutritionist section") or exercise in detail ("see Trainer section") — one cross-reference sentence is enough.
MUST include: Interpretation of lipid markers and any relevant cardiovascular risk factors in plain English. Specific targets to aim for and rough timeline.
Format: bullets per relevant marker/risk factor, then 1–2 sentences on overall cardiovascular picture. 70–90 words.`
  }

  if (needsGastroenterologist) {
    prompt += `

## From Your Gastroenterologist
SCOPE: Digestive condition management only — nothing else.
DO NOT cover: general nutrition advice (Nutritionist), gut-skin axis or hormonal connections (those belong to the Dermatologist/Endocrinologist), or autoimmune inflammation (Rheumatologist). Do NOT recommend supplements — that is in the Personalized Health Plan.
MUST include: What this patient needs to know about managing their specific gut condition. Specific trigger foods or patterns to avoid for their condition. One practical lifestyle or habit recommendation for gut health that goes beyond diet.
Format: bullet points throughout. 70–90 words.`
  }

  if (needsDermatologist) {
    prompt += `

## From Your Dermatologist
SCOPE: Skin condition management only — nothing else.
DO NOT cover: diet in detail (one cross-reference to Nutritionist is fine), gut health (Gastroenterologist), or hormonal interpretation (Endocrinologist — one cross-reference sentence is fine).
MUST include: Specific triggers to identify and avoid for their skin condition. Topical or environmental factors to address. One lifestyle recommendation unique to skin health.
Format: bullet points throughout. 60–80 words.`
  }

  if (needsRheumatologist) {
    prompt += `

## From Your Rheumatologist
SCOPE: Autoimmune condition and inflammatory markers only — nothing else.
DO NOT cover: gut health (Gastroenterologist), diet in detail (Nutritionist), or exercise specifics (Trainer — one cross-reference is fine).
MUST include: Interpretation of any inflammatory markers. Specific flare triggers to monitor for this patient. One evidence-based lifestyle factor that affects autoimmune activity.
Format: bullet points throughout. 60–80 words.`
  }

  prompt += `

## Your Personalized Health Plan

### Supplements Worth Considering
Review this patient's current supplements (listed in their profile above) and evaluate each one — is it appropriate, dosed correctly, and relevant to their conditions? Then recommend **4–8 additional supplements** specifically justified by their conditions, bloodwork, medication-induced depletions, or concerns. For each recommendation, include:
- The supplement name (define it in plain English if it is unfamiliar)
- Exactly why it is relevant to THIS patient (cite their specific condition, marker, goal, or concern)
- Evidence level: Strong / Moderate / Emerging
- Suggested dosage range
- Any interactions with their current medications or existing supplements to be aware of
Do NOT list generic wellness supplements — every recommendation must be directly tied to something in their profile. Format as bullets.

### Daily Habits & Lifestyle
List **6–10 specific, actionable habits** tailored to this patient's conditions, concerns, and goals. Each habit must: (a) reference a specific condition, goal, or concern they mentioned, and (b) be concrete enough to act on today. Include sleep hygiene, stress management, movement habits, and any behavior patterns relevant to their health picture. Avoid vague advice — for example, say "practice 4–7–8 breathing for 5 minutes before sleep to lower your cortisol (stress hormone) levels" not "reduce stress".

### Foods to Prioritize and Avoid
Write two clear lists based on this patient's specific conditions, bloodwork, goals, and dietary preferences (respecting their restrictions and allergies above):

**Prioritize — add these to your plate regularly:**
List 6–8 specific foods or food groups. For each, write one sentence explaining why it is particularly beneficial for THIS patient's conditions or goals.

**Reduce or avoid — these may be working against you:**
List 4–6 specific foods or patterns. For each, explain why it is specifically problematic for their conditions or goals — not a generic health claim.

## A Note From Your Care Team
A warm, personal closing paragraph addressed to the patient by name. Acknowledge every concern and goal they shared during onboarding — show them they were heard. Validate the complexity of managing their health. Express genuine encouragement and explain what having a coordinated specialist team means for their outcomes. 4–5 sentences.

---
FORMATTING RULES (mandatory — apply throughout every section):
- Write for someone who is new to tracking their health. Never assume medical knowledge.
- When using any medical or technical term (e.g. "LDL", "TSH", "cortisol", "insulin resistance"), always define it in plain English immediately after in parentheses — e.g. "LDL (the 'bad' cholesterol that can clog arteries)"
- Use **bold** for every key finding, recommendation, and important number or value
- Use bullet points for all lists of recommendations, findings, or action items — avoid long prose paragraphs
- Keep paragraphs short: 2–3 sentences maximum
- Lead each specialist section with a 1-sentence plain-English summary of the main takeaway before going into details
- Use everyday language: say "your thyroid is underactive" not "hypothyroidism is present"; say "blood sugar control" not "glycemic regulation"
- Avoid jargon phrases like "inflammatory cascade", "metabolic dysregulation", or "cardiovascular sequelae" — always say what it means`

  return prompt
}

export function buildMealSwapPrompt(
  currentMeal: Record<string, unknown>,
  mealType: string,
  feedback?: string,
  profile?: UserProfile
): string {
  const name = currentMeal.name as string || 'unknown'
  const calories = currentMeal.calories as number || 0
  const protein = currentMeal.protein_g as number || 0
  const carbs = currentMeal.carbs_g as number || 0
  const fat = currentMeal.fat_g as number || 0

  const restrictions = profile?.food_preferences?.restrictions?.join(', ') || 'none'
  const allergies = profile?.food_preferences?.allergies?.join(', ') || 'none'
  const cuisines = profile?.food_preferences?.loved_cuisines?.join(', ') || 'any'
  const conditions = profile?.medical_profile?.conditions?.join(', ') || 'none'

  const feedbackLine = feedback
    ? `PRIORITY — user said: "${feedback}"`
    : 'Offer real variety from the original meal'

  return `Generate 3 alternative ${mealType} meals to replace "${name}".

USER CONSTRAINTS (must respect exactly):
- Dietary restrictions: ${restrictions}
- Allergies: ${allergies}
- Loved cuisines: ${cuisines}
- Medical conditions: ${conditions}
- Macro targets: ~${calories} cal, ~${protein}g protein, ~${carbs}g carbs, ~${fat}g fat (within 15%)
- ${feedbackLine}

Return a JSON array of exactly 3 meal objects. Each object must have these exact fields:
id (generate a uuid), name, description (appetizing 1-sentence), reasoning (health reason),
calories, protein_g, carbs_g, fat_g, fiber_g, ingredients (array of strings with quantities),
image_url (always null), image_prompt (short watercolor art description)`
}

export function buildWorkoutSwapPrompt(currentWorkout: Record<string, unknown>, day: string): string {
  return `The user wants to swap their ${day} workout. The current workout is:
${JSON.stringify(currentWorkout, null, 2)}

Generate 3 alternative workout options that:
1. Target similar muscle groups or fitness goals
2. Match the user's equipment access and location preference
3. Have similar duration
4. Are appropriate for the user's fitness level

Return ONLY valid JSON array of 3 WorkoutDay objects:
[
  { "type": "workout", "workout_name": "...", "location": "gym|home|class", "duration_mins": 0, "exercises": [{ "id": "uuid", "name": "...", "sets": 0, "reps": 0, "rest_seconds": 60, "reasoning": "...", "gif_url": null }] },
  ...
]`
}

export function buildPetMessagePrompt(params: {
  petName: string
  petType: string
  petState: string
  completionPercent: number
  currentStreak: number
}): string {
  return `You are ${params.petName}, a ${params.petType}. You are the user's virtual health companion pet.
Your current state is: ${params.petState}
The user's 7-day average routine completion is: ${params.completionPercent}%
Their current streak is: ${params.currentStreak} days

Generate a short, sweet, and personality-rich message (1-2 sentences) from the pet's perspective.
- If thriving/happy: enthusiastic and proud
- If neutral: encouraging and gentle
- If sad/sick/critical: concerned but still loving
Keep it cute, personal, and slightly playful. Refer to yourself as ${params.petName}.
Return ONLY the message text, no JSON.`
}

export function buildOnboardingSystemPrompt(step: number, stepGoal: string): string {
  const stepSchemas: Record<number, string> = {
    1: `{
  "name": "string — first name",
  "age": number,
  "height_cm": number — convert from feet/inches if needed,
  "weight_kg": number — convert from lbs if needed (1 lb = 0.453592 kg),
  "conditions": ["string array of medical conditions, or []"],
  "medications": ["string array of current medications, or []"],
  "supplements": ["string array of supplements taken, or []"],
  "exercise_history": "string — brief description of past exercise habits, or 'not specified'"
}`,
    2: `{
  "has_bloodwork": boolean
}`,
    3: `{
  "concerns": ["string array of health concerns, or []"],
  "goals": ["string array of health goals"],
  "success_definition": "string — what success looks like to them, or 'not specified'"
}`,
    4: `{
  "restrictions": ["string array — e.g. vegetarian, vegan, halal, kosher, or []"],
  "allergies": ["string array — e.g. nuts, dairy, gluten, or []"],
  "loved_cuisines": ["string array — favorite cuisines, or []"],
  "disliked_foods": ["string array — foods they dislike or avoid, or []"],
  "meal_prep_days": number — how many days per week they can meal prep (default 2 if not specified),
  "typical_meals": {}
}`,
    5: `{
  "goals": ["string array — fitness goals"],
  "activity_types": ["string array — e.g. weightlifting, running, yoga, cycling, or []"],
  "days_per_week": number — workout days per week,
  "gym_access": boolean,
  "home_equipment": ["string array — equipment at home, or []"],
  "preferred_duration_mins": number — preferred workout duration in minutes (default 45 if not specified)
}`,
    6: `{
  "wake_time": "HH:MM — 24-hour format e.g. 07:00",
  "sleep_time": "HH:MM — 24-hour format e.g. 23:00",
  "morning_items": ["string array — existing morning habits they mentioned, or []"],
  "night_items": ["string array — existing night habits they mentioned, or []"]
}`,
  }

  const minimumRequired: Record<number, string> = {
    1: 'name, age, height, weight — emit step_complete as soon as you have all four, using [] for any unmentioned conditions/medications/supplements',
    2: 'emit step_complete immediately after the user answers whether they have bloodwork (yes or no)',
    3: 'at least 1 health goal — emit step_complete once you have their goals; use [] for concerns if not mentioned',
    4: 'at least one food preference answered — emit step_complete with whatever was shared, using [] for anything not mentioned',
    5: 'days_per_week and gym_access — emit step_complete as soon as you have these two; use [] or defaults for the rest',
    6: 'wake_time and sleep_time — emit step_complete as soon as you have both; use [] for habits if not mentioned',
  }

  const schema = stepSchemas[step]
  const schemaInstruction = schema
    ? `\n\nThe "data" field in step_complete MUST use EXACTLY these field names:\n${schema}`
    : ''

  const minRequired = minimumRequired[step]
    ? `\n\nMINIMUM to emit step_complete for step ${step}: ${minimumRequired[step]}`
    : ''

  return `You are Vitalia's onboarding assistant. You are warm, encouraging, and concise.
Your job is to collect the user's health profile through natural conversation, then move on.

CRITICAL RULES — follow these exactly:
1. Ask ONE question at a time. Never list multiple questions in one message.
2. As soon as you have the MINIMUM REQUIRED fields for this step (see below), immediately append <step_complete> to your message and move on. Do NOT ask "Is there anything else?" or "Shall we move on?" or wait for the user to say "next" — just do it naturally.
3. For any field the user did not mention, use the default value shown in the schema (usually [] or a sensible number). Never block on optional fields.
4. Keep your messages short — 1-2 sentences plus the question. Do not over-explain.
5. When you emit step_complete, write a brief natural closing line for this step first (e.g. "Perfect, got everything I need!"), then append the block on a new line at the very end.

FORMAT for step_complete (output at the END of your message when ready):
<step_complete>{"step": ${step}, "data": {...collected fields}}</step_complete>
${minRequired}${schemaInstruction}

Current step: ${step}
Step goal: ${stepGoal}`
}

// ── Weekly progress report ─────────────────────────────────────────────────

function avg(values: number[]): number | null {
  const valid = values.filter((v) => v != null && !isNaN(v))
  return valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null
}

export function buildWeeklyProgressPrompt(
  profile: UserProfile,
  weekDailyLogs: DailyLog[],
  mealPlan: MealPlan | null,
  workoutPlan: WorkoutPlan | null,
  weekStartDate: string,
): string {
  const name = profile.name || 'there'

  // Routine
  const morningComps = weekDailyLogs.map((d) => d.morning_routine_completion).filter((v) => v != null)
  const nightComps = weekDailyLogs.map((d) => d.night_routine_completion).filter((v) => v != null)
  const avgMorning = avg(morningComps)
  const avgNight = avg(nightComps)

  // Sleep & energy
  const sleepValues = weekDailyLogs.map((d) => d.morning_checkin?.sleep_hours).filter((v): v is number => v != null)
  const energyValues = weekDailyLogs.map((d) => d.morning_checkin?.energy).filter((v): v is number => v != null)
  const avgSleep = avg(sleepValues)
  const avgEnergy = avg(energyValues)

  // Hydration & weight
  const waterValues = weekDailyLogs.map((d) => d.night_checkin?.water_cups).filter((v): v is number => v != null)
  const weightValues = weekDailyLogs
    .map((d) => ({ date: d.date, w: d.night_checkin?.weight }))
    .filter((x): x is { date: string; w: number } => x.w != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  const avgWater = avg(waterValues)
  const weightStart = weightValues[0]?.w ?? null
  const weightEnd = weightValues[weightValues.length - 1]?.w ?? null

  // Meals
  const mealStatuses = weekDailyLogs.flatMap((d) => Object.values(d.meal_log || {}))
  const mealsEaten = mealStatuses.filter((s) => s === 'eaten').length
  const mealsSwapped = mealStatuses.filter((s) => s === 'swapped').length
  const mealsSkipped = mealStatuses.filter((s) => s === 'skipped').length
  const totalMealsPlanned = mealPlan ? 7 * 4 : 0 // 7 days × 4 meals

  // Workouts
  const workoutStatuses = weekDailyLogs.flatMap((d) => Object.values(d.workout_log || {}))
  const workoutsCompleted = workoutStatuses.filter((s) => s === 'completed' || s === 'modified').length
  const workoutsPlanned = workoutPlan
    ? Object.values(workoutPlan.days).filter((d) => d.type === 'workout').length
    : profile.workout_preferences.days_per_week

  const daysLogged = weekDailyLogs.length

  return `Generate a warm, specific weekly check-in report for ${name} covering the week of ${weekStartDate}.

WEEK DATA (what ${name} actually did this week — ${daysLogged} of 7 days logged):

Morning Routine: avg completion ${avgMorning != null ? `${avgMorning}%` : 'no data'} (${morningComps.length} days logged)
Night Routine: avg completion ${avgNight != null ? `${avgNight}%` : 'no data'} (${nightComps.length} days logged)
Sleep: avg ${avgSleep != null ? `${avgSleep} hours/night` : 'no data'} (${sleepValues.length} days logged)
Energy: avg ${avgEnergy != null ? `${avgEnergy}/5` : 'no data'} (${energyValues.length} days logged)
Water: avg ${avgWater != null ? `${avgWater} cups/day` : 'no data'} (${waterValues.length} days logged)
Weight: ${weightStart != null && weightEnd != null && weightStart !== weightEnd ? `${weightStart} kg → ${weightEnd} kg` : weightEnd != null ? `latest ${weightEnd} kg` : 'no data recorded'}
Meals: ${mealsEaten} eaten, ${mealsSwapped} swapped, ${mealsSkipped} skipped${totalMealsPlanned > 0 ? ` (out of ${totalMealsPlanned} planned)` : ''}
Workouts: ${workoutsCompleted} completed out of ${workoutsPlanned} planned

USER GOALS: ${profile.medical_profile?.goals?.join(', ') || 'not specified'}
CONDITIONS: ${profile.medical_profile?.conditions?.join(', ') || 'none'}

Write the report in Markdown with this structure:

## Your Week at a Glance
2-sentence warm summary with the headline stats (use real numbers from the data above). Address ${name} by name.

## Routine & Habits
Morning and night routine completion with specific percentages. Mention any patterns (e.g. "You nailed your mornings but evenings were tougher"). Use bullet points.

## Workouts
X of Y planned workouts completed. Be specific and encouraging — if they hit all workouts, celebrate it; if they missed some, acknowledge it without judgment. Bullet points.

## Sleep & Energy
Avg sleep and energy with context — is this enough? How does energy correlate with sleep nights? Reference their health goals if relevant. Bullets.

## Nutrition & Meals
Meals eaten vs skipped vs swapped. Any notable patterns. How closely they followed their plan. Bullets.

## Hydration & Weight
Avg cups of water per day vs the recommended ~8. Weight trend if data available. Bullets.

## What Went Really Well This Week
3 bullet points — each must reference specific data from above. No generic praise.

## Focus for Next Week
3 specific, actionable things to improve — grounded in this week's data. Each should be concrete (e.g. "Try to get in bed 30 minutes earlier to push sleep toward 7.5 hours" not "sleep more"). Bullets.

## Keep Going, ${name}!
2-3 sentence warm closing. Acknowledge their effort. One forward-looking encouragement tied to their goals.

RULES:
- Be specific — always use the real numbers from the data
- If data is missing for a section (e.g. no sleep data), say so briefly and move on — don't make up numbers
- Write like a supportive coach, not a clinical report
- Use **bold** for key numbers and highlights
- Keep each section concise — this is a weekly check-in, not a novel
- Minimum 300 words total`
}
