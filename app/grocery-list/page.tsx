'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { MealPlan, Meal } from '@/types'
import { Printer, Trash2 } from 'lucide-react'

type GroceryCategory = 'Produce' | 'Proteins' | 'Dairy' | 'Pantry' | 'Other'

const categoryKeywords: Record<GroceryCategory, string[]> = {
  Produce: ['lettuce', 'spinach', 'kale', 'tomato', 'onion', 'garlic', 'pepper', 'cucumber', 'carrot', 'broccoli', 'zucchini', 'mushroom', 'apple', 'banana', 'berry', 'lemon', 'lime', 'avocado', 'celery', 'herb', 'basil', 'cilantro', 'parsley', 'mint'],
  Proteins: ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'turkey', 'egg', 'tofu', 'tempeh', 'lentil', 'bean', 'chickpea'],
  Dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'mozzarella', 'parmesan', 'feta', 'cottage'],
  Pantry: ['rice', 'pasta', 'oat', 'flour', 'bread', 'oil', 'olive oil', 'vinegar', 'sauce', 'soy sauce', 'honey', 'maple syrup', 'salt', 'pepper', 'spice', 'cumin', 'paprika', 'turmeric', 'cinnamon', 'nuts', 'seeds', 'nut butter', 'quinoa', 'barley'],
  Other: [],
}

function categorize(ingredient: string): GroceryCategory {
  const lower = ingredient.toLowerCase()
  for (const [category, keywords] of Object.entries(categoryKeywords) as [GroceryCategory, string[]][]) {
    if (category === 'Other') continue
    if (keywords.some((kw) => lower.includes(kw))) return category
  }
  return 'Other'
}

function extractIngredients(plan: MealPlan): Map<string, GroceryCategory> {
  const ingredients = new Map<string, GroceryCategory>()

  for (const day of Object.values(plan.days)) {
    for (const meal of Object.values(day) as Meal[]) {
      if (meal?.ingredients) {
        for (const ing of meal.ingredients) {
          const clean = ing.trim().toLowerCase()
          if (clean && !ingredients.has(clean)) {
            ingredients.set(clean, categorize(clean))
          }
        }
      }
    }
  }
  return ingredients
}

function mapToArray<K, V>(map: Map<K, V>): Array<[K, V]> {
  const result: Array<[K, V]> = []
  map.forEach((value, key) => result.push([key, value]))
  return result
}

function mapKeysToArray<K>(map: Map<K, unknown>): K[] {
  const result: K[] = []
  map.forEach((_, key) => result.push(key))
  return result
}

export default function GroceryListPage() {
  const [ingredients, setIngredients] = useState<Map<string, GroceryCategory>>(new Map())
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [weeklyPlanId, setWeeklyPlanId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchGroceries() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('weekly_plans')
        .select('id, meal_plan, grocery_checklist')
        .eq('user_id', user.id)
        .order('week_start_date', { ascending: false })
        .limit(1)
        .single()

      if (data?.meal_plan) {
        setIngredients(extractIngredients(data.meal_plan as MealPlan))
        setWeeklyPlanId(data.id)
        const checklist = (data.grocery_checklist as Record<string, boolean>) || {}
        const checkedKeys = Object.entries(checklist).filter(([, v]) => v).map(([k]) => k)
        setChecked(new Set(checkedKeys))
      }
      setLoading(false)
    }
    fetchGroceries()
  }, [])

  async function toggleItem(item: string) {
    const newChecked = new Set(checked)
    if (newChecked.has(item)) {
      newChecked.delete(item)
    } else {
      newChecked.add(item)
    }
    setChecked(newChecked)

    if (!weeklyPlanId) return
    const supabase = createClient()
    const checklist: Record<string, boolean> = {}
    mapKeysToArray(ingredients).forEach((ing) => {
      checklist[ing] = newChecked.has(ing)
    })
    await supabase.from('weekly_plans').update({ grocery_checklist: checklist }).eq('id', weeklyPlanId)
  }

  function clearCompleted() {
    const newChecked = new Set<string>()
    setChecked(newChecked)
    if (!weeklyPlanId) return
    const supabase = createClient()
    supabase.from('weekly_plans').update({ grocery_checklist: {} }).eq('id', weeklyPlanId)
  }

  const categories = ['Produce', 'Proteins', 'Dairy', 'Pantry', 'Other'] as GroceryCategory[]
  const grouped: Record<GroceryCategory, string[]> = {
    Produce: [], Proteins: [], Dairy: [], Pantry: [], Other: []
  }
  mapToArray(ingredients).forEach(([ing, cat]) => {
    grouped[cat].push(ing)
  })

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Grocery List</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={clearCompleted}>
              <Trash2 size={14} />
              Clear done
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer size={14} />
              Print
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-text-secondary">Loading groceries...</div>
        ) : ingredients.size === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">🛒</span>
            <h3 className="font-semibold text-text-primary mb-2">No grocery list yet</h3>
            <p className="text-text-secondary">Generate your meal plan first to see your grocery list</p>
          </div>
        ) : (
          categories.map((cat) => {
            const items = grouped[cat]
            if (items.length === 0) return null
            return (
              <Card key={cat}>
                <h2 className="font-bold text-text-primary mb-3">{cat}</h2>
                <div className="space-y-2">
                  {items.sort().map((item) => (
                    <label key={item} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked.has(item)}
                        onChange={() => toggleItem(item)}
                        className="w-5 h-5 rounded-md border-2 border-accent-primary accent-accent-primary"
                      />
                      <span className={`text-sm capitalize flex-1 ${checked.has(item) ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
              </Card>
            )
          })
        )}
      </div>
    </AppShell>
  )
}
