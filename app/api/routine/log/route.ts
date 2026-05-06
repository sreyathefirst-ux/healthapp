import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request) {
  try {
    const { type, itemId, checked, date } = await req.json()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const logDate = date || new Date().toISOString().split('T')[0]

    // Get current log
    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', logDate)
      .single()

    const checkedField = type === 'morning' ? 'morning_items_checked' : 'night_items_checked'
    const completionField = type === 'morning' ? 'morning_routine_completion' : 'night_routine_completion'

    let currentChecked: string[] = existingLog?.[checkedField] || []

    if (checked && !currentChecked.includes(itemId)) {
      currentChecked = [...currentChecked, itemId]
    } else if (!checked) {
      currentChecked = currentChecked.filter((id: string) => id !== itemId)
    }

    // Get total items count from routine preferences
    const { data: routinePrefs } = await supabase
      .from('routine_preferences')
      .select('morning_items, night_items')
      .eq('user_id', user.id)
      .single()

    const itemsKey = type === 'morning' ? 'morning_items' : 'night_items'
    const totalItems = (routinePrefs?.[itemsKey] as unknown[])?.length || 1
    const completion = Math.round((currentChecked.length / totalItems) * 100)

    await supabase.from('daily_logs').upsert({
      user_id: user.id,
      date: logDate,
      [checkedField]: currentChecked,
      [completionField]: completion,
      last_seen_at: new Date().toISOString(),
    })

    return Response.json({ completion })
  } catch (error) {
    console.error('Routine log error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
