'use client'

import { useState, useEffect, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Upload } from 'lucide-react'

export default function ProfileSettingsPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingBloodwork, setUploadingBloodwork] = useState(false)

  interface BloodworkRow {
    id: string; biomarker_name: string; value: number; unit: string
    reference_range_low: number | null; reference_range_high: number | null
    is_flagged: boolean; upload_date: string
  }
  const [bloodwork, setBloodwork] = useState<BloodworkRow[]>([])
  const [bloodworkLoading, setBloodworkLoading] = useState(true)

  const [profile, setProfile] = useState({
    name: '', age: '', height_cm: '', weight_kg: '',
  })
  const [medical, setMedical] = useState({
    conditions: '', medications: '', supplements: '', concerns: '', goals: '', success_definition: '',
  })
  const [food, setFood] = useState({
    restrictions: '', allergies: '', loved_cuisines: '', disliked_foods: '', meal_prep_days: '0',
  })
  const [workout, setWorkout] = useState({
    goals: '', activity_types: '', days_per_week: '3', gym_access: false, home_equipment: '', preferred_duration_mins: '45',
  })

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [uRes, mRes, fRes, wRes, bwRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('medical_profile').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('food_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('workout_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('bloodwork').select('*').eq('user_id', user.id)
          .order('upload_date', { ascending: false })
          .order('biomarker_name', { ascending: true }),
      ])

      if (uRes.data) setProfile({ name: uRes.data.name || '', age: String(uRes.data.age || ''), height_cm: String(uRes.data.height_cm || ''), weight_kg: String(uRes.data.weight_kg || '') })
      if (mRes.data) setMedical({ conditions: mRes.data.conditions?.join(', ') || '', medications: mRes.data.medications?.join(', ') || '', supplements: mRes.data.supplements?.join(', ') || '', concerns: mRes.data.concerns?.join(', ') || '', goals: mRes.data.goals?.join(', ') || '', success_definition: mRes.data.success_definition || '' })
      if (fRes.data) setFood({ restrictions: fRes.data.restrictions?.join(', ') || '', allergies: fRes.data.allergies?.join(', ') || '', loved_cuisines: fRes.data.loved_cuisines?.join(', ') || '', disliked_foods: fRes.data.disliked_foods?.join(', ') || '', meal_prep_days: String(fRes.data.meal_prep_days || 0) })
      if (wRes.data) setWorkout({ goals: wRes.data.goals?.join(', ') || '', activity_types: wRes.data.activity_types?.join(', ') || '', days_per_week: String(wRes.data.days_per_week || 3), gym_access: wRes.data.gym_access || false, home_equipment: wRes.data.home_equipment?.join(', ') || '', preferred_duration_mins: String(wRes.data.preferred_duration_mins || 45) })
      setBloodwork((bwRes.data as BloodworkRow[]) ?? [])
      setBloodworkLoading(false)
    }
    fetchData()
  }, [])

  const splitList = (str: string) => str.split(',').map((s) => s.trim()).filter(Boolean)

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const results = await Promise.all([
        supabase.from('users').update({ name: profile.name, age: Number(profile.age), height_cm: Number(profile.height_cm), weight_kg: Number(profile.weight_kg) }).eq('id', user.id),
        supabase.from('medical_profile').upsert({ user_id: user.id, conditions: splitList(medical.conditions), medications: splitList(medical.medications), supplements: splitList(medical.supplements), concerns: splitList(medical.concerns), goals: splitList(medical.goals), success_definition: medical.success_definition }, { onConflict: 'user_id' }),
        supabase.from('food_preferences').upsert({ user_id: user.id, restrictions: splitList(food.restrictions), allergies: splitList(food.allergies), loved_cuisines: splitList(food.loved_cuisines), disliked_foods: splitList(food.disliked_foods), meal_prep_days: Number(food.meal_prep_days) }, { onConflict: 'user_id' }),
        supabase.from('workout_preferences').upsert({ user_id: user.id, goals: splitList(workout.goals), activity_types: splitList(workout.activity_types), days_per_week: Number(workout.days_per_week), gym_access: workout.gym_access, home_equipment: splitList(workout.home_equipment), preferred_duration_mins: Number(workout.preferred_duration_mins) }, { onConflict: 'user_id' }),
      ])
      const saveErrors = results.map((r, i) => r.error ? `table[${i}]: ${r.error.message}` : null).filter(Boolean)
      if (saveErrors.length > 0) {
        console.error('[settings/profile] save errors:', saveErrors)
        throw new Error(saveErrors.join('; '))
      }

      toast('Profile saved! Changes will take effect on next plan generation.', 'success')
    } catch {
      toast('Failed to save profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleBloodworkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingBloodwork(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/bloodwork/parse', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.biomarkers) {
        toast(`Bloodwork uploaded! Found ${data.biomarkers.length} markers.`, 'success')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: bw } = await supabase.from('bloodwork').select('*').eq('user_id', user.id)
            .order('upload_date', { ascending: false })
            .order('biomarker_name', { ascending: true })
          setBloodwork((bw as BloodworkRow[]) ?? [])
        }
      } else {
        toast(data.error || 'Failed to parse bloodwork', 'error')
      }
    } catch {
      toast('Upload failed', 'error')
    } finally {
      setUploadingBloodwork(false)
    }
  }

  const InputField = ({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border-[1.5px] border-vitalia-border focus:outline-none focus:border-accent-primary text-sm transition-colors"
      />
    </div>
  )

  const TextArea = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-4 py-3 rounded-xl border-[1.5px] border-vitalia-border focus:outline-none focus:border-accent-primary text-sm resize-none transition-colors"
      />
      <p className="text-xs text-text-secondary mt-1">Separate multiple values with commas</p>
    </div>
  )

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Profile & Health Info</h1>

        <Card>
          <h2 className="font-bold text-text-primary mb-4">Personal Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <InputField label="Name" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
            </div>
            <InputField label="Age" value={profile.age} onChange={(v) => setProfile({ ...profile, age: v })} type="number" />
            <InputField label="Weight (kg)" value={profile.weight_kg} onChange={(v) => setProfile({ ...profile, weight_kg: v })} type="number" />
            <InputField label="Height (cm)" value={profile.height_cm} onChange={(v) => setProfile({ ...profile, height_cm: v })} type="number" />
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-text-primary mb-4">Medical Profile</h2>
          <div className="space-y-4">
            <TextArea label="Medical Conditions" value={medical.conditions} onChange={(v) => setMedical({ ...medical, conditions: v })} placeholder="e.g. hypothyroidism, insulin resistance" />
            <TextArea label="Medications" value={medical.medications} onChange={(v) => setMedical({ ...medical, medications: v })} placeholder="e.g. levothyroxine, metformin" />
            <TextArea label="Supplements" value={medical.supplements} onChange={(v) => setMedical({ ...medical, supplements: v })} placeholder="e.g. vitamin D, magnesium" />
            <TextArea label="Health Concerns" value={medical.concerns} onChange={(v) => setMedical({ ...medical, concerns: v })} />
            <TextArea label="Health Goals" value={medical.goals} onChange={(v) => setMedical({ ...medical, goals: v })} />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">What does success look like?</label>
              <textarea
                value={medical.success_definition}
                onChange={(e) => setMedical({ ...medical, success_definition: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-[1.5px] border-vitalia-border focus:outline-none focus:border-accent-primary text-sm resize-none transition-colors"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-text-primary">Bloodwork</h2>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleBloodworkUpload} className="hidden" />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploadingBloodwork}>
              <Upload size={14} />
              {bloodwork.length > 0 ? 'Upload New PDF' : 'Upload PDF'}
            </Button>
          </div>

          {bloodworkLoading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : bloodwork.length === 0 ? (
            <p className="text-text-secondary text-sm">Upload your latest blood test results for more personalized recommendations.</p>
          ) : (() => {
            const uploadDates = Array.from(new Set(bloodwork.map((b) => b.upload_date))).sort((a, b) => b.localeCompare(a))
            const latestDate = uploadDates[0]
            const latestRows = bloodwork.filter((b) => b.upload_date === latestDate)
            const prevCount = uploadDates.length - 1
            return (
              <div>
                <p className="text-xs text-text-secondary mb-3">
                  Last uploaded: <span className="font-medium">{latestDate}</span>
                  {prevCount > 0 && <span className="ml-2 text-text-secondary">· {prevCount} previous upload{prevCount > 1 ? 's' : ''} on record</span>}
                </p>
                <div className="overflow-y-auto max-h-80 rounded-xl border border-vitalia-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-secondary">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-text-secondary text-xs">Biomarker</th>
                        <th className="text-left px-3 py-2 font-medium text-text-secondary text-xs">Result</th>
                        <th className="text-left px-3 py-2 font-medium text-text-secondary text-xs">Reference</th>
                        <th className="text-left px-3 py-2 font-medium text-text-secondary text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestRows.map((row) => (
                        <tr key={row.id} className={row.is_flagged ? 'bg-red-50' : ''}>
                          <td className="px-3 py-2 font-medium text-text-primary">{row.biomarker_name}</td>
                          <td className="px-3 py-2 text-text-primary">{row.value} {row.unit}</td>
                          <td className="px-3 py-2 text-text-secondary">
                            {row.reference_range_low != null && row.reference_range_high != null
                              ? `${row.reference_range_low}–${row.reference_range_high}`
                              : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {row.is_flagged
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">⚠ Flagged</span>
                              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">✓ Normal</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </Card>

        <Card>
          <h2 className="font-bold text-text-primary mb-4">Food Preferences</h2>
          <div className="space-y-4">
            <TextArea label="Dietary Restrictions" value={food.restrictions} onChange={(v) => setFood({ ...food, restrictions: v })} placeholder="e.g. vegetarian, gluten-free" />
            <TextArea label="Allergies" value={food.allergies} onChange={(v) => setFood({ ...food, allergies: v })} placeholder="e.g. peanuts, shellfish" />
            <TextArea label="Favorite Cuisines" value={food.loved_cuisines} onChange={(v) => setFood({ ...food, loved_cuisines: v })} placeholder="e.g. Mediterranean, Japanese" />
            <TextArea label="Disliked Foods" value={food.disliked_foods} onChange={(v) => setFood({ ...food, disliked_foods: v })} />
            <InputField label="Meal Prep Days per Week" value={food.meal_prep_days} onChange={(v) => setFood({ ...food, meal_prep_days: v })} type="number" />
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-text-primary mb-4">Workout Preferences</h2>
          <div className="space-y-4">
            <TextArea label="Fitness Goals" value={workout.goals} onChange={(v) => setWorkout({ ...workout, goals: v })} placeholder="e.g. weight loss, muscle gain" />
            <TextArea label="Preferred Activities" value={workout.activity_types} onChange={(v) => setWorkout({ ...workout, activity_types: v })} placeholder="e.g. strength training, yoga" />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Workout Days/Week" value={workout.days_per_week} onChange={(v) => setWorkout({ ...workout, days_per_week: v })} type="number" />
              <InputField label="Session Duration (min)" value={workout.preferred_duration_mins} onChange={(v) => setWorkout({ ...workout, preferred_duration_mins: v })} type="number" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={workout.gym_access}
                onChange={(e) => setWorkout({ ...workout, gym_access: e.target.checked })}
                className="w-5 h-5 rounded-md border-2 border-accent-primary accent-accent-primary"
              />
              <span className="text-sm font-medium text-text-primary">I have gym access</span>
            </label>
            <TextArea label="Home Equipment" value={workout.home_equipment} onChange={(v) => setWorkout({ ...workout, home_equipment: v })} placeholder="e.g. dumbbells, resistance bands" />
          </div>
        </Card>

        <Button onClick={handleSave} loading={saving} className="w-full">
          Save Changes
        </Button>
        <p className="text-center text-xs text-text-secondary">Changes will take effect on your next plan generation</p>
      </div>
    </AppShell>
  )
}
