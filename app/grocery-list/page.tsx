'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { MealPlan, Meal } from '@/types'
import { Printer, RefreshCw, ShoppingCart, AlertCircle } from 'lucide-react'

interface GrocerySection {
  title: string
  emoji: string
  items: string[]
}

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  now.setUTCDate(diff)
  return now.toISOString().split('T')[0]
}

function extractAllIngredients(plan: MealPlan): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  console.log('[grocery] extracting ingredients from days:', Object.keys(plan.days))
  for (const [dayName, day] of Object.entries(plan.days)) {
    const mealKeys = Object.keys(day)
    console.log(`[grocery]   ${dayName}: meals =`, mealKeys)
    for (const meal of Object.values(day) as Meal[]) {
      if (meal?.ingredients) {
        for (const ing of meal.ingredients) {
          const clean = ing.trim()
          if (clean && !seen.has(clean.toLowerCase())) {
            seen.add(clean.toLowerCase())
            result.push(clean)
          }
        }
      }
    }
  }
  return result
}

const CACHE_KEY_PREFIX = 'grocery_list_'

export default function GroceryListPage() {
  const [sections, setSections] = useState<GrocerySection[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasPlan, setHasPlan] = useState(false)
  const [weeklyPlanId, setWeeklyPlanId] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState('')
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null)

  const saveChecklist = useCallback(async (newChecked: Set<string>, planId: string | null, allSections: GrocerySection[]) => {
    if (!planId) return
    const checklist: Record<string, boolean> = {}
    for (const section of allSections) {
      for (const item of section.items) {
        checklist[item] = newChecked.has(item)
      }
    }
    const supabase = createClient()
    await supabase.from('weekly_plans').update({ grocery_checklist: checklist }).eq('id', planId)
  }, [])

  useEffect(() => {
    const ws = getWeekStartDate()
    setWeekStart(ws)

    async function fetchData() {
      console.log('[grocery] === START ===')
      console.log('[grocery] fetching weekly plan for week_start:', ws)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('[grocery] no user, aborting')
        setLoading(false)
        return
      }

      const { data, error: dbError } = await supabase
        .from('weekly_plans')
        .select('id, meal_plan, grocery_checklist')
        .eq('user_id', user.id)
        .eq('week_start_date', ws)
        .maybeSingle()

      console.log('[grocery] weekly plan data:', JSON.stringify(data, null, 2))
      console.log('[grocery] db error:', dbError)
      console.log('[grocery] meal_plan exists:', !!data?.meal_plan)

      if (dbError) {
        console.error('[grocery] DB error:', dbError.message)
        setError('Failed to load your meal plan. Please try again.')
        setLoading(false)
        return
      }

      if (!data?.meal_plan) {
        console.log('[grocery] no meal_plan in DB row — showing empty state')
        setHasPlan(false)
        setLoading(false)
        return
      }

      setHasPlan(true)
      setWeeklyPlanId(data.id)
      const plan = data.meal_plan as MealPlan
      setMealPlan(plan)

      // Restore checkbox state
      const checklist = (data.grocery_checklist as Record<string, boolean>) || {}
      const checkedItems = Object.entries(checklist).filter(([, v]) => v).map(([k]) => k)
      setChecked(new Set(checkedItems))

      // Try localStorage cache first
      const cacheKey = `${CACHE_KEY_PREFIX}${ws}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.sections?.length) {
            console.log('[grocery] loaded from cache:', parsed.sections.length, 'sections')
            setSections(parsed.sections)
            setLoading(false)
            return
          }
        } catch {
          localStorage.removeItem(cacheKey)
        }
      }

      setLoading(false)
      generateList(plan, ws)
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateList(plan: MealPlan, ws: string) {
    console.log('[grocery] === GENERATE START ===')
    setGenerating(true)
    setError(null)

    try {
      const ingredients = extractAllIngredients(plan)
      console.log('[grocery] unique ingredients extracted:', ingredients.length)
      console.log('[grocery] first 10 ingredients:', ingredients.slice(0, 10))

      if (ingredients.length === 0) {
        console.warn('[grocery] no ingredients found in meal plan — check plan structure')
        setError('No ingredients found in your meal plan. Try regenerating your meal plan.')
        setGenerating(false)
        return
      }

      console.log('[grocery] calling Gemini to convert quantities...')
      const res = await fetch('/api/plans/grocery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      })

      console.log('[grocery] API response status:', res.status)
      const data = await res.json()
      console.log('[grocery] Gemini raw response (data):', JSON.stringify(data, null, 2))

      if (!res.ok || data.error) {
        const errMsg = data.error || `API error ${res.status}`
        console.error('[grocery] API returned error:', errMsg)
        setError('Failed to build your shopping list. Tap "Retry" to try again.')
        setGenerating(false)
        return
      }

      const parsedList = data.sections
      console.log('[grocery] parsed grocery list sections:', parsedList?.length, '| total items:', parsedList?.reduce((a: number, s: GrocerySection) => a + s.items.length, 0))

      if (!parsedList?.length) {
        console.error('[grocery] sections is empty or missing in response')
        setError('Received an empty grocery list. Tap "Retry" to try again.')
        setGenerating(false)
        return
      }

      console.log('[grocery] saving to state...')
      setSections(parsedList)
      localStorage.setItem(`${CACHE_KEY_PREFIX}${ws}`, JSON.stringify({ sections: parsedList }))
      setChecked(new Set())
      console.log('[grocery] === DONE ===')
    } catch (e) {
      console.error('[grocery] unhandled exception:', e)
      setError('Something went wrong. Tap "Retry" to try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function toggleItem(item: string) {
    const newChecked = new Set(checked)
    if (newChecked.has(item)) {
      newChecked.delete(item)
    } else {
      newChecked.add(item)
    }
    setChecked(newChecked)
    await saveChecklist(newChecked, weeklyPlanId, sections)
  }

  function clearCompleted() {
    setChecked(new Set())
    saveChecklist(new Set(), weeklyPlanId, sections)
  }

  function handleRegenerate() {
    if (!mealPlan) return
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${weekStart}`)
    setSections([])
    setChecked(new Set())
    generateList(mealPlan, weekStart)
  }

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0)
  const checkedCount = checked.size
  const uncheckedSections = sections.map((s) => ({
    ...s,
    items: s.items.filter((item) => !checked.has(item)),
  })).filter((s) => s.items.length > 0)

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-text-primary">Grocery List</h1>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200">
                <div className="h-5 skeleton-shimmer rounded w-1/4 mb-4" />
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-4 skeleton-shimmer rounded mb-2" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </AppShell>
    )
  }

  // ── No meal plan ────────────────────────────────────────────────────────────
  if (!hasPlan) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <span className="text-7xl mb-6">🛒</span>
          <h2 className="text-2xl font-bold text-text-primary mb-3">No meal plan yet</h2>
          <p className="text-text-secondary mb-8 max-w-sm">
            Generate your meal plan first — Vitalia will build a real shopping list organised by store section.
          </p>
          <Link href="/meal-plan">
            <Button>Go to Meal Plan</Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  // ── Generating (first time, no sections yet) ────────────────────────────────
  if (generating && sections.length === 0) {
    return (
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-text-primary">Grocery List</h1>
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4 animate-pulse">
              <ShoppingCart size={28} className="text-emerald-600" />
            </div>
            <h3 className="font-semibold text-text-primary mb-2">Building your shopping list…</h3>
            <p className="text-text-secondary text-sm">Converting recipe quantities to real store amounts</p>
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error && sections.length === 0) {
    return (
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-text-primary">Grocery List</h1>
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <h3 className="font-semibold text-text-primary mb-2">Something went wrong</h3>
            <p className="text-text-secondary text-sm mb-6 max-w-sm">{error}</p>
            <Button onClick={handleRegenerate} loading={generating}>
              Retry
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="space-y-6 print:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Grocery List</h1>
            {totalItems > 0 && (
              <p className="text-text-secondary text-sm mt-0.5">
                {checkedCount} of {totalItems} items checked
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {checkedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCompleted} className="text-text-secondary">
                Clear done
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleRegenerate} loading={generating} className="text-text-secondary">
              <RefreshCw size={14} />
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer size={14} />
              Print
            </Button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">Grocery List</h1>
          <p className="text-sm text-gray-500">Week of {new Date(weekStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Error banner (non-fatal, sections still visible) */}
        {error && sections.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Progress bar */}
        {totalItems > 0 && checkedCount > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 print:hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">Shopping progress</span>
              <span className="text-sm font-bold text-emerald-600">{Math.round((checkedCount / totalItems) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-slate-100">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${(checkedCount / totalItems) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Refreshing spinner (while sections still visible) */}
        {generating && sections.length > 0 && (
          <div className="text-center text-sm text-text-secondary animate-pulse py-2">
            Refreshing shopping list…
          </div>
        )}

        {/* Sections */}
        {sections.map((section) => {
          const uncheckedItems = section.items.filter((item) => !checked.has(item))
          const checkedItems = section.items.filter((item) => checked.has(item))
          return (
            <div key={section.title} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border print:border-gray-200">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                <span className="text-lg">{section.emoji}</span>
                <h2 className="font-bold text-text-primary text-sm tracking-wide uppercase">{section.title}</h2>
                <span className="ml-auto text-xs text-text-secondary font-medium">
                  {checkedItems.length > 0 ? `${checkedItems.length}/${section.items.length}` : section.items.length}
                </span>
              </div>

              <div className="px-5 py-3 space-y-0.5">
                {uncheckedItems.map((item) => (
                  <label key={item} className="flex items-center gap-3 py-2.5 cursor-pointer group border-b border-slate-100 last:border-0 print:border-gray-200">
                    <div className="w-5 h-5 rounded-md border-2 border-slate-200 group-hover:border-emerald-400 flex-shrink-0 flex items-center justify-center transition-all print:hidden">
                      <input type="checkbox" checked={false} onChange={() => toggleItem(item)} className="sr-only" />
                    </div>
                    <div className="hidden print:block w-4 h-4 border border-gray-400 rounded flex-shrink-0" />
                    <span className="text-sm text-text-primary flex-1">{item}</span>
                  </label>
                ))}

                {checkedItems.map((item) => (
                  <label key={item} className="flex items-center gap-3 py-2.5 cursor-pointer group border-b border-slate-100 last:border-0 print:hidden">
                    <div className="w-5 h-5 rounded-md border-2 border-emerald-500 bg-emerald-500 flex-shrink-0 flex items-center justify-center">
                      <input type="checkbox" checked={true} onChange={() => toggleItem(item)} className="sr-only" />
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-sm text-text-secondary line-through flex-1">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}

        {/* All done state */}
        {sections.length > 0 && uncheckedSections.length === 0 && checkedCount > 0 && (
          <div className="text-center py-8 print:hidden">
            <span className="text-5xl block mb-3">🎉</span>
            <h3 className="font-semibold text-text-primary mb-1">All done!</h3>
            <p className="text-text-secondary text-sm">You&apos;ve got everything on your list.</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
