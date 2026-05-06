import { UserProfile } from '@/types'
import { buildSystemPrompt } from './anthropic'

export { buildSystemPrompt }

export const MEAL_PLAN_PROMPT = `Generate a 7-day meal plan for this user.
Return ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "week_start_date": "YYYY-MM-DD",
  "days": {
    "monday": {
      "breakfast": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["..."], "image_url": null, "image_prompt": "A hand-drawn sketchbook watercolor illustration of [meal name]..." },
      "lunch": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["..."], "image_url": null, "image_prompt": "A hand-drawn sketchbook watercolor illustration of [meal name]..." },
      "dinner": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["..."], "image_url": null, "image_prompt": "A hand-drawn sketchbook watercolor illustration of [meal name]..." },
      "snack": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["..."], "image_url": null, "image_prompt": "A hand-drawn sketchbook watercolor illustration of [meal name]..." }
    },
    "tuesday": { ... },
    "wednesday": { ... },
    "thursday": { ... },
    "friday": { ... },
    "saturday": { ... },
    "sunday": { ... }
  }
}
Rules:
- Meals must respect ALL allergies and restrictions — this is critical
- Tailor to medical conditions (e.g. low glycemic for insulin resistance, iodine-rich for hypothyroidism)
- Calories and macros must be medically appropriate for the user's weight and goals
- Reasoning must reference the user's specific conditions or bloodwork markers
- image_prompt must describe the meal in Great British Baking Show watercolor sketch style
- Use real UUIDs for ids (generate random uuid-like strings)`

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
    "wednesday": { ... },
    "thursday": { ... },
    "friday": { ... },
    "saturday": { ... },
    "sunday": { ... }
  }
}
Rules:
- Respect gym_access and preferred activity types
- Schedule exactly the right number of workout days per week, with rest days distributed optimally
- Reasoning must reference the user's specific goals or conditions
- For home workouts, only use bodyweight or stated home equipment
- Use real UUIDs for ids`

export const HEALTH_REPORT_PROMPT = `Generate a comprehensive, deeply personalized health report for this patient. This report is written collaboratively by a specialist care team: a functional medicine doctor, endocrinologist, clinical nutritionist, and certified personal trainer. Each specialist has reviewed this patient's complete profile, bloodwork, medications, conditions, and stated concerns.

The report must be formatted in Markdown and must be a minimum of 600 words. Write with clinical authority, warmth, and specificity. Do NOT give generic health advice — every statement must directly reference this patient's specific conditions, biomarker values, medications, or concerns. Use the patient's name throughout. Write in first-person plural ("we recommend", "our team has reviewed", "we've noticed").

Include these sections:

## From Your Functional Medicine Doctor
Analyze the patient's full clinical picture holistically: how their conditions connect, how medications interact with their physiology, and what patterns emerge across their symptoms and lab values. If bloodwork is present, interpret each relevant marker and explain what it means for this specific patient — not in isolation, but in the context of everything else we know. Flag any concerning patterns or nutrient depletions that may result from their medications. Minimum 120 words.

## From Your Endocrinologist
Address hormonal, metabolic, and endocrine dimensions of this patient's profile. Interpret any relevant biomarkers (thyroid panel, fasting glucose, HbA1c, lipid panel, cortisol, etc.) with clinical precision — what these values mean for their energy, weight, mood, and long-term risk. Connect the endocrine picture to their stated conditions, medications, and symptoms. If no bloodwork was uploaded, address what we would expect to monitor and why given their conditions. Minimum 120 words.

## From Your Clinical Nutritionist
Provide specific, evidence-based nutritional guidance grounded in this patient's conditions, bloodwork, medications (including any drug-nutrient interactions), allergies, and food preferences. Name specific nutrients, foods, or dietary patterns and explain precisely why they are recommended for this individual's clinical picture. Address any deficiencies suggested by bloodwork or conditions. Reference their dietary restrictions and preferences. Minimum 120 words.

## From Your Personal Trainer
Assess this patient's fitness starting point given their conditions, exercise history, and goals. Explain the training approach we've designed for them and why it is specifically appropriate — including any modifications made for their health conditions, joint concerns, or medication side effects. Outline the physiological adaptations we expect and the timeline. Minimum 100 words.

## Priority Action Items for This Week
List 5 specific, high-impact action items this patient should focus on immediately. Each must be directly grounded in their clinical picture — not generic wellness tips. Include a brief clinical rationale for each.

## A Note From Your Care Team
A warm, personal closing paragraph addressed to the patient by name. Acknowledge the full complexity of their situation. Validate their specific goals. Express genuine encouragement and explain what having a coordinated specialist team means for their outcomes. 3-4 sentences.`

export function buildMealSwapPrompt(currentMeal: Record<string, unknown>, mealType: string): string {
  return `The user wants to swap their ${mealType}. The current meal is:
${JSON.stringify(currentMeal, null, 2)}

Generate 3 alternative meals that:
1. Match similar macronutrient profile (within 15% of original calories/protein)
2. Respect the user's allergies and restrictions (CRITICAL)
3. Are appropriate for the time of day (${mealType})
4. Offer variety from the original

Return ONLY valid JSON array of 3 meal objects with the same structure as a Meal object:
[
  { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": ["..."], "image_url": null, "image_prompt": "..." },
  ...
]`
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
  { "type": "workout", "workout_name": "...", "location": "gym|home|class", "duration_mins": 0, "exercises": [...] },
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
  return `You are Vitalia's onboarding assistant. You are warm, encouraging, and clinical.
You are collecting the user's health profile to build their personalized plan.
Ask ONE question at a time. Be conversational, not form-like.
When you have collected all data for the current step, output a special JSON block:
<step_complete>{"step": ${step}, "data": {...collected fields}}</step_complete>
The frontend will detect this and advance to the next step.
Current step: ${step}
Step goal: ${stepGoal}

Step goals reference:
Step 1: Collect name, age, height, weight, medical conditions, medications, supplements (7 fields total)
Step 2: Bloodwork upload - ask if they have bloodwork to upload
Step 3: Collect health concerns and goals (at least 3 goals)
Step 4: Collect food preferences (dietary restrictions, allergies, favorite cuisines, disliked foods, meal prep days)
Step 5: Collect workout preferences (goals, activity types, days per week, gym access, home equipment, preferred duration)
Step 6: Collect routine preferences (wake time, sleep time, morning habits, night habits)
Step 7: Tell the user to pick their pet companion`
}
