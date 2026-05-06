import { UserProfile } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchFullProfile(supabase: any, userId: string): Promise<UserProfile | null> {
  const [userRes, medRes, foodRes, workoutRes, routineRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    supabase.from('medical_profile').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('food_preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('workout_preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('routine_preferences').select('*').eq('user_id', userId).maybeSingle(),
  ])

  if (!userRes.data) return null

  return {
    id: userId,
    name: userRes.data.name || '',
    age: userRes.data.age || 0,
    height_cm: userRes.data.height_cm || 0,
    weight_kg: userRes.data.weight_kg || 0,
    onboarding_complete: userRes.data.onboarding_complete,
    medical_profile: {
      conditions: medRes.data?.conditions || [],
      medications: medRes.data?.medications || [],
      supplements: medRes.data?.supplements || [],
      exercise_history: medRes.data?.exercise_history || '',
      concerns: medRes.data?.concerns || [],
      goals: medRes.data?.goals || [],
      success_definition: medRes.data?.success_definition || '',
    },
    food_preferences: {
      typical_meals: foodRes.data?.typical_meals || {},
      restrictions: foodRes.data?.restrictions || [],
      allergies: foodRes.data?.allergies || [],
      loved_cuisines: foodRes.data?.loved_cuisines || [],
      meal_prep_days: foodRes.data?.meal_prep_days || 0,
      disliked_foods: foodRes.data?.disliked_foods || [],
    },
    workout_preferences: {
      goals: workoutRes.data?.goals || [],
      activity_types: workoutRes.data?.activity_types || [],
      days_per_week: workoutRes.data?.days_per_week || 3,
      gym_access: workoutRes.data?.gym_access || false,
      home_equipment: workoutRes.data?.home_equipment || [],
      preferred_duration_mins: workoutRes.data?.preferred_duration_mins || 45,
    },
    routine_preferences: {
      wake_time: routineRes.data?.wake_time || '07:00',
      sleep_time: routineRes.data?.sleep_time || '23:00',
      morning_items: routineRes.data?.morning_items || [],
      night_items: routineRes.data?.night_items || [],
    },
  }
}
