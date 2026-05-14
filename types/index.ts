export type PetType = 'cat' | 'dog' | 'dragon' | 'bunny' | 'fox'
export type PetState = 'thriving' | 'happy' | 'neutral' | 'sad' | 'sick' | 'critical'
export type MealLogStatus = 'eaten' | 'swapped' | 'skipped' | null
export type WorkoutLogStatus = 'completed' | 'modified' | 'skipped' | null

export interface Meal {
  id: string
  name: string
  description: string
  reasoning: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  ingredients: string[]
  image_url: string | null
  image_prompt: string
  // Optional — populated on demand when user opens the recipe card
  instructions?: string[]
  prep_time_mins?: number
  cook_time_mins?: number
  servings?: number
}

export interface DayMeals {
  breakfast: Meal
  lunch: Meal
  dinner: Meal
  snack: Meal
}

export interface MealPlan {
  week_start_date: string
  days: {
    monday: DayMeals
    tuesday: DayMeals
    wednesday: DayMeals
    thursday: DayMeals
    friday: DayMeals
    saturday: DayMeals
    sunday: DayMeals
  }
}

export interface Exercise {
  id: string
  name: string
  sets?: number
  reps?: number
  duration_seconds?: number
  rest_seconds?: number
  reasoning: string
  gif_url?: string
  // YouTube video cache — keyed by gender so switching gender re-fetches
  video_id?: string | null
  thumbnail_url?: string | null
  video_gender?: 'male' | 'female'
}

export interface WorkoutDay {
  type: 'workout' | 'rest'
  workout_name?: string
  location?: 'gym' | 'home' | 'class'
  duration_mins?: number
  exercises?: Exercise[]
  recovery_note?: string
}

export interface WorkoutPlan {
  week_start_date: string
  days: {
    monday: WorkoutDay
    tuesday: WorkoutDay
    wednesday: WorkoutDay
    thursday: WorkoutDay
    friday: WorkoutDay
    saturday: WorkoutDay
    sunday: WorkoutDay
  }
}

export interface RoutineItem {
  id: string
  label: string
  time_target?: string
  category?: string
}

export interface Pet {
  pet_type: PetType
  pet_name: string
  accessories: string[]
  current_streak: number
  longest_streak: number
}

export interface UserProfile {
  id: string
  name: string
  age: number
  height_cm: number
  weight_kg: number
  onboarding_complete: boolean
  medical_profile: {
    conditions: string[]
    medications: string[]
    supplements: string[]
    exercise_history: string
    concerns: string[]
    goals: string[]
    success_definition: string
  }
  food_preferences: {
    typical_meals: Record<string, string>
    restrictions: string[]
    allergies: string[]
    loved_cuisines: string[]
    meal_prep_days: number
    disliked_foods: string[]
  }
  workout_preferences: {
    goals: string[]
    activity_types: string[]
    days_per_week: number
    gym_access: boolean
    home_equipment: string[]
    preferred_duration_mins: number
  }
  routine_preferences: {
    wake_time: string
    sleep_time: string
    morning_items: RoutineItem[]
    night_items: RoutineItem[]
  }
}

export interface DailyLog {
  id: string
  user_id: string
  date: string
  meal_log: Record<string, MealLogStatus>
  workout_log: Record<string, WorkoutLogStatus>
  morning_routine_completion: number
  night_routine_completion: number
  morning_items_checked: string[]
  night_items_checked: string[]
  last_seen_at: string
}

export interface WeeklyPlan {
  id: string
  user_id: string
  week_start_date: string
  meal_plan: MealPlan | null
  workout_plan: WorkoutPlan | null
  health_report: string | null
  grocery_checklist: Record<string, boolean>
  generated_at: string
}

export interface PushSubscriptionData {
  endpoint: string
  auth: string
  p256dh: string
}
