'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { MealPlan, Meal } from '@/types'
import { Printer, RefreshCw, ShoppingCart, ShoppingBasket, PartyPopper } from 'lucide-react'

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
  for (const day of Object.values(plan.days)) {
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
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('weekly_plans')
        .select('id, meal_plan, grocery_checklist')
        .eq('user_id', user.id)
        .eq('week_start_date', ws)
        .maybeSingle()

      if (!data?.meal_plan) {
        setHasPlan(false)
        setLoading(false)
        return
      }

      setHasPlan(true)
      setWeeklyPlanId(data.id)
      setMealPlan(data.meal_plan as MealPlan)

      // Restore checkbox state
      const checklist = (data.grocery_checklist as Record<string, boolean>) || {}
      const checkedItems = Object.entries(checklist).filter(([, v]) => v).map(([k]) => k)
      setChecked(new Set(checkedItems))

      // Try cache first
      const cacheKey = `${CACHE_KEY_PREFIX}${ws}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.sections?.length) {
            setSections(parsed.sections)
            setLoading(false)
            return
          }
        } catch {
          localStorage.removeItem(cacheKey)
        }
      }

      // No cache — auto-generate
      setLoading(false)
      generateList(data.meal_plan as MealPlan, ws)
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateList(plan: MealPlan, ws: string) {
    setGenerating(true)
    try {
      const ingredients = extractAllIngredients(plan)
      console.log('[grocery] sending', ingredients.length, 'unique ingredient lines to API')

      const res = await fetch('/api/plans/grocery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      })
      const data = await res.json()

      if (data.sections?.length) {
        setSections(data.sections)
        // Cache for this week
        localStorage.setItem(`${CACHE_KEY_PREFIX}${ws}`, JSON.stringify({ sections: data.sections }))
        // Reset checklist since list was regenerated
        setChecked(new Set())
      }
    } catch (e) {
      console.error('[grocery] generation failed:', e)
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
    // Clear cache so a fresh list is generated
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

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-text-primary">Grocery List</h1>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-card p-5">
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

  if (!hasPlan) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <ShoppingCart size={56} className="mb-6 text-green" />
          <h2 className="text-2xl font-bold text-text-primary mb-3">No grocery list yet</h2>
          <p className="text-text-secondary mb-8 max-w-sm">
            Generate your meal plan first — Vitalia will build a real shopping list organized by store section.
          </p>
        </div>
      </AppShell>
    )
  }

  if (generating && sections.length === 0) {
    return (
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-text-primary">Grocery List</h1>
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="w-16 h-16 rounded-full bg-accent-primary/10 flex items-center justify-center mb-4 animate-pulse">
              <ShoppingCart size={28} className="text-accent-primary" />
            </div>
            <h3 className="font-semibold text-text-primary mb-2">Building your shopping list…</h3>
            <p className="text-text-secondary text-sm">Converting recipe quantities to real store amounts</p>
          </div>
        </div>
      </AppShell>
    )
  }

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

        {/* Progress bar */}
        {totalItems > 0 && checkedCount > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-card print:hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">Shopping progress</span>
              <span className="text-sm font-bold text-accent-primary">{Math.round((checkedCount / totalItems) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#EBEBF0' }}>
              <div
                className="h-full bg-accent-primary rounded-full transition-all duration-300"
                style={{ width: `${(checkedCount / totalItems) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Generating overlay while refreshing */}
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
            <div key={section.title} className="bg-white rounded-card shadow-card overflow-hidden print:shadow-none print:border print:border-gray-200">
              {/* Section header */}
              <div className="px-5 py-3 border-b border-vitalia-border bg-bg/60 flex items-center gap-2">
                <ShoppingBasket size={17} className="text-green" />
                <h2 className="font-bold text-text-primary text-sm tracking-wide uppercase">{section.title}</h2>
                <span className="ml-auto text-xs text-text-secondary font-medium">
                  {checkedItems.length > 0 ? `${checkedItems.length}/${section.items.length}` : section.items.length}
                </span>
              </div>

              <div className="px-5 py-3 space-y-0.5">
                {/* Unchecked items */}
                {uncheckedItems.map((item) => (
                  <label key={item} className="flex items-center gap-3 py-2.5 cursor-pointer group border-b border-vitalia-border/30 last:border-0 print:border-gray-200">
                    <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all print:hidden
                      border-vitalia-border group-hover:border-accent-primary`}>
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleItem(item)}
                        className="sr-only"
                      />
                    </div>
                    <div className="hidden print:block w-4 h-4 border border-gray-400 rounded flex-shrink-0" />
                    <span className="text-sm text-text-primary flex-1">{item}</span>
                  </label>
                ))}

                {/* Checked items (dimmed, at bottom) */}
                {checkedItems.map((item) => (
                  <label key={item} className="flex items-center gap-3 py-2.5 cursor-pointer group border-b border-vitalia-border/30 last:border-0 print:hidden">
                    <div className="w-5 h-5 rounded-md border-2 border-accent-primary bg-accent-primary flex-shrink-0 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleItem(item)}
                        className="sr-only"
                      />
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
            <PartyPopper size={40} className="mx-auto mb-3 text-green" />
            <h3 className="font-semibold text-text-primary mb-1">All done!</h3>
            <p className="text-text-secondary text-sm">You've got everything on your list.</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
