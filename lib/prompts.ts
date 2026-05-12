import { UserProfile } from '@/types'
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
  bloodwork: BloodworkRow[]
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

  let prompt = `Generate a comprehensive, deeply personalized health report for this patient. Write it as if from a coordinated specialist care team who have all reviewed this patient's complete profile.

The report must be in Markdown, minimum 600 words. Write with warmth and clinical authority — not overly clinical. Use the patient's name throughout. Write in first-person plural ("we recommend", "our team has reviewed"). Use clear headers, short paragraphs, and bullet points where helpful.

FLAGGED BLOODWORK (outside reference range for this patient):
${flaggedBlock}

---

## From Your Functional Medicine Doctor
Analyze the patient's full clinical picture holistically: how conditions connect, how medications interact, and what patterns emerge across symptoms and lab values. ${hasBloodwork ? 'Interpret each relevant bloodwork marker and explain what it means in the context of everything else we know.' : 'Address what you would monitor given their conditions.'} Flag any concerning patterns or nutrient depletions from medications. Minimum 120 words.

## From Your Clinical Nutritionist
Provide specific, evidence-based nutritional guidance grounded in this patient's conditions, ${hasBloodwork ? 'bloodwork, ' : ''}medications (including drug-nutrient interactions), allergies, and food preferences. Name specific nutrients, foods, or dietary patterns and explain precisely why they are recommended for this individual. Address any deficiencies suggested by ${hasBloodwork ? 'bloodwork or ' : ''}conditions. Reference their dietary restrictions and preferences. Minimum 120 words.

## From Your Personal Trainer
Assess this patient's fitness starting point given their conditions, exercise history, and goals. Explain the training approach designed for them and why it is specifically appropriate — including any modifications for health conditions, joint concerns, or medication side effects. Outline expected physiological adaptations and timeline. Minimum 100 words.`

  if (needsEndocrinologist) {
    prompt += `

## From Your Endocrinologist
Address hormonal, metabolic, and endocrine dimensions of this patient's profile.${endoFlaggedText} Interpret relevant biomarkers with clinical precision — what these values mean for their energy, weight, mood, and long-term risk. Connect the endocrine picture to their conditions, medications, and symptoms. Minimum 120 words.`
  }

  if (needsCardiologist) {
    prompt += `

## From Your Cardiologist
Review this patient's cardiovascular risk profile.${cardioFlaggedText} Interpret their lipid panel and relevant markers in clinical context. Explain cardiovascular risk factors present and what we recommend to address them. Be specific about targets and timeline. Minimum 100 words.`
  }

  if (needsGastroenterologist) {
    prompt += `

## From Your Gastroenterologist
Address this patient's digestive health given their conditions. Explain the gut-systemic connections relevant to their profile. Provide specific guidance on diet, supplements, or lifestyle modifications for their gut condition. Minimum 100 words.`
  }

  if (needsDermatologist) {
    prompt += `

## From Your Dermatologist
Address the patient's skin condition in the context of their full health picture — including gut-skin axis, hormonal influences, and nutritional factors that may be contributing. Provide specific guidance grounded in their lab work and conditions. Minimum 80 words.`
  }

  if (needsRheumatologist) {
    prompt += `

## From Your Rheumatologist
Address the autoimmune and inflammatory dimensions of this patient's profile. Interpret relevant inflammatory markers and explain the connections between their autoimmune condition, lifestyle, and the plan we've designed. Minimum 80 words.`
  }

  prompt += `

## Priority Action Items for This Week
List 5 specific, high-impact action items this patient should focus on immediately. Each must be directly grounded in their clinical picture — not generic wellness tips. Include a brief clinical rationale for each. Use bullet points.

## A Note From Your Care Team
A warm, personal closing paragraph addressed to the patient by name. Acknowledge the complexity of their situation. Validate their goals. Express genuine encouragement and explain what having a coordinated specialist team means for their outcomes. 3-4 sentences.`

  return prompt
}

export function buildMealSwapPrompt(currentMeal: Record<string, unknown>, mealType: string, feedback?: string): string {
  const name = currentMeal.name as string || 'unknown'
  const calories = currentMeal.calories as number || 0
  const protein = currentMeal.protein_g as number || 0
  const carbs = currentMeal.carbs_g as number || 0
  const fat = currentMeal.fat_g as number || 0

  const feedbackLine = feedback
    ? `USER FEEDBACK — prioritise this above all else: "${feedback}"`
    : 'Offer real variety from the original'

  return `Swap this ${mealType}: "${name}" (~${calories} cal, ${protein}g protein, ${carbs}g carbs, ${fat}g fat)
${feedbackLine}

Rules: match macros within 15%, respect all user allergies/restrictions, delicious and restaurant-quality, appropriate for ${mealType}.

YOUR ENTIRE RESPONSE MUST BE ONLY THE JSON ARRAY BELOW.
Start with [ and end with ]. No markdown. No backticks. No explanation. No text before or after.

[{"id":"uuid4","name":"Meal Name","description":"appetizing 1-sentence description","reasoning":"specific health/nutrition reason","calories":450,"protein_g":32,"carbs_g":40,"fat_g":14,"fiber_g":6,"ingredients":["1 cup item","2 tbsp item"],"image_url":null,"image_prompt":"watercolor illustration of Meal Name, Great British Baking Show style"},{"id":"uuid4","name":"...","description":"...","reasoning":"...","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"ingredients":["..."],"image_url":null,"image_prompt":"..."},{"id":"uuid4","name":"...","description":"...","reasoning":"...","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"ingredients":["..."],"image_url":null,"image_prompt":"..."}]`
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
  "exercise_history": "string — brief description of past exercise habits"
}`,
    2: `{
  "has_bloodwork": boolean
}`,
    3: `{
  "concerns": ["string array of health concerns"],
  "goals": ["string array of at least 3 specific health goals"],
  "success_definition": "string — what success looks like to them in 6 months"
}`,
    4: `{
  "restrictions": ["string array — e.g. vegetarian, vegan, halal, kosher, or []"],
  "allergies": ["string array — e.g. nuts, dairy, gluten, or []"],
  "loved_cuisines": ["string array — favorite cuisines"],
  "disliked_foods": ["string array — foods they dislike or avoid"],
  "meal_prep_days": number — how many days per week they can meal prep,
  "typical_meals": {}
}`,
    5: `{
  "goals": ["string array — fitness goals"],
  "activity_types": ["string array — e.g. weightlifting, running, yoga, cycling"],
  "days_per_week": number — workout days per week,
  "gym_access": boolean,
  "home_equipment": ["string array — equipment at home, or []"],
  "preferred_duration_mins": number — preferred workout duration in minutes
}`,
    6: `{
  "wake_time": "HH:MM — 24-hour format e.g. 07:00",
  "sleep_time": "HH:MM — 24-hour format e.g. 23:00",
  "morning_items": ["string array — existing morning habits they mentioned"],
  "night_items": ["string array — existing night habits they mentioned"]
}`,
  }

  const schema = stepSchemas[step]
  const schemaInstruction = schema
    ? `\n\nWhen you output the step_complete block, the "data" field MUST use EXACTLY these field names:\n${schema}`
    : ''

  return `You are Vitalia's onboarding assistant. You are warm, encouraging, and clinical.
You are collecting the user's health profile to build their personalized plan.
Ask ONE question at a time. Be conversational, not form-like.
When you have collected all data for the current step, output a special JSON block at the END of your message:
<step_complete>{"step": ${step}, "data": {...collected fields}}</step_complete>
The frontend will detect this and advance to the next step.${schemaInstruction}
Current step: ${step}
Step goal: ${stepGoal}

Step goals reference:
Step 1: Collect name, age, height, weight, medical conditions, medications, supplements
Step 2: Bloodwork upload - ask if they have bloodwork to upload
Step 3: Collect health concerns and goals (at least 3 goals)
Step 4: Collect food preferences (dietary restrictions, allergies, favorite cuisines, disliked foods, meal prep days)
Step 5: Collect workout preferences (goals, activity types, days per week, gym access, home equipment, preferred duration)
Step 6: Collect routine preferences (wake time, sleep time, morning habits, night habits)
Step 7: Tell the user to pick their pet companion`
}
