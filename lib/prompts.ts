import { UserProfile } from '@/types'
import { buildSystemPrompt } from './anthropic'

export { buildSystemPrompt }

export const MEAL_PLAN_PROMPT = `Generate a 7-day meal plan for this user.
Return ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "week_start_date": "YYYY-MM-DD",
  "days": {
    "monday": {
      "breakfast": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["2 cups ingredient", "..."], "image_url": null, "image_prompt": "A hand-drawn watercolor illustration of [meal name], fine liner pen with loose watercolor fill, warm rich colors on a sketchbook paper texture background. Food only, close-up, no text, no labels, no writing, no words." },
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

  const med = profile.medical_profile || {}
  const foodPref = profile.food_preferences || {}
  const workoutPref = profile.workout_preferences || {}

  const specialists = [
    {
      id: 'functional', name: 'Functional Medicine Doctor', icon: 'Stethoscope',
      scope: `Systemic patterns and root causes — how this patient's conditions, medications, and symptoms interact. Include medication-induced nutrient depletions. NOT: specific foods (Nutritionist), individual hormone markers (Endocrinologist), exercise details (Trainer).`,
    },
    {
      id: 'nutritionist', name: 'Clinical Nutritionist', icon: 'Apple',
      scope: `Specific foods and nutrients addressing this patient's conditions${hasBloodwork ? ' and bloodwork deficiencies' : ''}. Drug-nutrient interactions for their medications. Respect restrictions (${foodPref.restrictions?.join(', ') || 'none'}) and allergies (${foodPref.allergies?.join(', ') || 'none'}). NOT: supplements, hormone interpretation, general condition connections.`,
    },
    {
      id: 'trainer', name: 'Personal Trainer', icon: 'Dumbbell',
      scope: `Training structure suited to exercise history (${med.exercise_history || 'unspecified'}) and goals (${workoutPref.goals?.join(', ') || 'not specified'}). Include modifications for their conditions. NOT: nutrition, supplements, medical interpretation.`,
    },
    ...(needsEndocrinologist ? [{
      id: 'endocrinologist', name: 'Endocrinologist', icon: 'Activity',
      scope: 'Plain-English interpretation of relevant hormonal/metabolic markers. One sentence per marker covering what it is, their value, and what it affects. NOT: diet details, supplements.',
    }] : []),
    ...(needsCardiologist ? [{
      id: 'cardiologist', name: 'Cardiologist', icon: 'Heart',
      scope: 'Cardiovascular risk, lipid markers, specific targets and timelines. One cross-reference to Nutritionist or Trainer is OK. NOT: diet or exercise specifics.',
    }] : []),
    ...(needsGastroenterologist ? [{
      id: 'gastroenterologist', name: 'Gastroenterologist', icon: 'Shield',
      scope: 'Digestive condition management, specific trigger foods to avoid, one practical gut-health lifestyle habit. NOT: general nutrition advice, supplements.',
    }] : []),
    ...(needsDermatologist ? [{
      id: 'dermatologist', name: 'Dermatologist', icon: 'Shield',
      scope: 'Skin condition triggers, topical and environmental factors, one lifestyle recommendation unique to skin health. One cross-reference to Nutritionist or Endocrinologist is OK. NOT: diet or hormone specifics.',
    }] : []),
    ...(needsRheumatologist ? [{
      id: 'rheumatologist', name: 'Rheumatologist', icon: 'Microscope',
      scope: 'Inflammatory marker interpretation, specific flare triggers to monitor, one evidence-based lifestyle factor for autoimmune activity. NOT: gut health, diet details, exercise specifics.',
    }] : []),
  ]

  const specialistLines = specialists
    .map((s) => `  - id: "${s.id}" | name: "${s.name}" | icon: "${s.icon}" | scope: ${s.scope}`)
    .join('\n')

  const bloodworkSection = hasBloodwork
    ? `\nFLAGGED BLOODWORK:\n${flaggedBlock}`
    : '\nNo bloodwork uploaded yet.'
  const changesSection = changesBlock ? `\nBLOODWORK CHANGES FROM PREVIOUS TEST:\n${changesBlock}` : ''

  return `You are a coordinated specialist care team. Analyze this patient's complete profile and return a structured JSON health report. Output ONLY valid JSON — no markdown, no code fences, no text before or after the JSON object.

PATIENT PROFILE:
- Name: ${profile.name || 'Patient'}, Age: ${profile.age || 'unknown'}, Height: ${profile.height_cm || '?'}cm, Weight: ${profile.weight_kg || '?'}kg
- Medical conditions: ${med.conditions?.join(', ') || 'none reported'}
- Current medications: ${med.medications?.join(', ') || 'none reported'}
- Current supplements: ${med.supplements?.join(', ') || 'none reported'}
- Health concerns: ${med.concerns?.join(', ') || 'none reported'}
- Health goals: ${med.goals?.join(', ') || 'not specified'}
- Success definition: ${med.success_definition || 'not specified'}
- Dietary restrictions: ${foodPref.restrictions?.join(', ') || 'none'}
- Food allergies: ${foodPref.allergies?.join(', ') || 'none'}
- Exercise history: ${med.exercise_history || 'not specified'}
- Workout goals: ${workoutPref.goals?.join(', ') || 'not specified'}
- Workout days/week: ${workoutPref.days_per_week || 'not specified'}
- Gym access: ${workoutPref.gym_access ? 'yes' : 'no'}
${bloodworkSection}${changesSection}

SPECIALIST TEAM FOR THIS PATIENT (use EXACTLY these id/name/icon values in specialist_insights):
${specialistLines}

Return EXACTLY this JSON structure (fill all string values with real content — no placeholders):
{
  "health_insights": {
    "focus_areas": ["string — 3 to 5 items: the patient's main health priorities based on their profile"],
    "wins": [
      {
        "metric": "biomarker name or health dimension going well",
        "status": "short positive label e.g. Optimal",
        "value": "actual value with unit, or descriptive phrase if no bloodwork",
        "reference_range": "reference range or N/A",
        "description": "1-2 sentences: why this is good specifically for this patient"
      }
    ],
    "priority": {
      "metric": "single highest-priority area to improve",
      "status": "short label e.g. Needs Attention",
      "current_value": "current value with unit",
      "reference_range": "reference or target range",
      "explanation": "2-3 sentences explaining why this matters for this patient in plain English",
      "target_value": "specific target to reach",
      "progress_percent": 30,
      "recommended_action": "one specific actionable step"
    },
    "specialist_insights": [
      {
        "id": "from specialist team above",
        "name": "from specialist team above",
        "icon": "from specialist team above",
        "content": "3-5 bullet points using the • character. Specific findings or recommendations for THIS patient strictly within their scope. 80-120 words total. No repetition across specialists."
      }
    ],
    "goals_3_6_months": [
      { "metric": "measurable outcome", "description": "1 sentence: what achieving this looks like for this patient" }
    ]
  },
  "action_plan": {
    "nutrition": {
      "prioritize": { "title": "short label e.g. Anti-Inflammatory Foods", "description": "specific foods and nutrients to add with reasons tied to this patient's conditions" },
      "avoid": { "title": "short label", "description": "specific foods or patterns to reduce with reasons tied to this patient's conditions" },
      "key_habit": { "title": "short label", "description": "one concrete daily nutrition habit for this patient" },
      "note": "one sentence respecting their restrictions (${foodPref.restrictions?.join(', ') || 'none'}) and allergies (${foodPref.allergies?.join(', ') || 'none'})"
    },
    "workout": {
      "frequency": "e.g. 4x per week",
      "breakdown": ["3-4 strings e.g. 2x strength training", "1x cardio", "1x mobility"],
      "key_focus": "most important training focus for this patient's goals and conditions",
      "expected_results": [
        { "timeline": "e.g. 4 weeks", "description": "specific result to expect" },
        { "timeline": "e.g. 3 months", "description": "specific result to expect" }
      ]
    },
    "supplements": [
      { "name": "supplement name", "description": "why for THIS patient (cite their condition, marker, or goal) plus suggested dosage range and any interactions with their current medications" }
    ]
  }
}

RULES — follow strictly:
- specialist_insights: include EXACTLY the specialists listed above with same id/name/icon. Do NOT add or remove any.
- wins: 2-4 items. If no bloodwork, use health dimensions going well based on their lifestyle and goals.
- priority.progress_percent: integer 0-100 (how far current value is toward target). Use 20-40 if no bloodwork.
- goals_3_6_months: 3-5 measurable outcomes specific to this patient.
- supplements: 3-5 items. Review current supplements (${med.supplements?.join(', ') || 'none'}) — only recommend what is missing or should be added.
- No specialist should cover topics belonging to another specialist's scope.
- All content in plain English. Define medical terms inline (e.g. TSH (thyroid-stimulating hormone)).`
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
