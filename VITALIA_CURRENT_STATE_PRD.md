# Vitalia — Current State PRD

**Date:** 2026-06-12
**Purpose:** Documents exactly what is built as of this date — verified against full codebase audit of all 50+ source files.

---

## 1. App Overview

### What the App Does
Vitalia is an AI-powered personal health companion web app (mobile-first, no PWA). It generates personalized weekly meal plans, workout plans, and health reports using Google Gemini AI, tracks daily routine completion via interactive morning/night checklists, hosts a virtual pet companion whose emotional state mirrors habit consistency, and provides a 7-day grocery list, recipe cards, and exercise swap alternatives.

### Core User Journey
1. Land on root page (`/`) — animated intro with breathing circle + inline sign-up form
2. Complete multi-step onboarding chat (`/onboarding`) — 7 steps, bloodwork upload, pet selection
3. Land on `/dashboard` — see pet, today's summary, quick links, weekly progress
4. Browse/interact with: Meal Plan, Workout Plan, Morning/Night Routine, Grocery List, Health Report, Settings

### Tech Stack (exact versions from package.json)

| Package | Version |
|---|---|
| next | 14.2.18 |
| react | ^18 |
| react-dom | ^18 |
| @supabase/supabase-js | ^2.45.4 |
| @supabase/ssr | ^0.5.1 |
| @anthropic-ai/sdk | ^0.27.0 (installed, NOT used at runtime) |
| ai | ^3.4.0 (installed, NOT used at runtime) |
| framer-motion | ^11.11.11 |
| lucide-react | ^0.460.0 |
| react-beautiful-dnd | ^13.1.1 |
| react-markdown | ^9.0.1 |
| web-push | ^3.6.7 |
| next-pwa | ^5.6.0 (installed, disabled — see §4) |
| @fal-ai/serverless-client | ^0.15.0 (installed, NOT used at runtime) |
| tailwindcss | ^3.4.1 |
| typescript | ^5 |

> **Critical note:** `@anthropic-ai/sdk` is installed but has zero runtime usage. All AI calls go to **Google Gemini** (`gemini-2.5-flash`) via raw `fetch()` in `lib/openrouter.ts`. `lib/anthropic.ts` exports only `buildSystemPrompt()` — a pure string-building helper with no API calls.

### Deployment
Deployed to Vercel (confirmed by `vercel.json` with 3 cron jobs). No `.env` or Vercel project ID committed.

---

## 2. Database Schema (Supabase)

All tables inferred from code read/write patterns across all routes and hooks.

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, matches Supabase auth user ID |
| name | text | User's first name |
| age | integer | |
| height_cm | numeric | |
| weight_kg | numeric | |
| onboarding_complete | boolean | Set true after onboarding finishes |
| created_at | timestamptz | |

### `medical_profile`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | FK → users.id |
| conditions | text[] | e.g. ["Type 2 Diabetes", "Hypertension"] |
| medications | text[] | |
| supplements | text[] | |
| allergies | text[] | |

### `food_preferences`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | FK → users.id |
| restrictions | text[] | e.g. ["Vegetarian", "Gluten-free"] |
| dislikes | text[] | Foods to avoid |
| cuisine_preferences | text[] | |
| health_goals | text[] | e.g. ["Weight loss", "Muscle gain"] |

### `workout_preferences`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | FK → users.id |
| goals | text[] | |
| activity_types | text[] | |
| days_per_week | integer | |
| gym_access | boolean | |
| home_equipment | text[] | |
| preferred_duration_mins | integer | |

### `routine_preferences`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | PK, FK → users.id |
| wake_time | text | e.g. "07:00" |
| sleep_time | text | e.g. "22:30" |
| morning_items | jsonb | RoutineItem[] |
| night_items | jsonb | RoutineItem[] |

### `bloodwork`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| marker_name | text | e.g. "Glucose" |
| value | numeric | |
| unit | text | e.g. "mg/dL" |
| reference_range | text | e.g. "70-99" |
| is_flagged | boolean | Outside reference range |
| created_at | timestamptz | |

### `weekly_plans`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| week_start_date | date | Monday of the week |
| meal_plan | jsonb | Full MealPlan object |
| workout_plan | jsonb | Full WorkoutPlan object |
| health_report | text | Markdown string |
| grocery_checklist | jsonb | Record<string, boolean> |
| generated_at | timestamptz | |
| UNIQUE | — | (user_id, week_start_date) |

### `daily_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| date | date | |
| morning_items_checked | text[] | Item IDs checked off |
| night_items_checked | text[] | Item IDs checked off |
| morning_completion | numeric | 0–100 percentage |
| night_completion | numeric | 0–100 percentage |
| last_seen_at | timestamptz | Updated on dashboard load |
| UNIQUE | — | (user_id, date) |

### `pet`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | PK, FK → users.id |
| pet_name | text | |
| pet_type | text | cat / dog / dragon / bunny / fox |
| current_streak | integer | Read but NEVER updated in code (known gap) |

### `push_subscriptions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| subscription | jsonb | Web Push PushSubscription object |
| created_at | timestamptz | |

---

## 3. Design System

### Colors (defined in `tailwind.config.js` + `app/globals.css`)

| Token | Value | Usage |
|---|---|---|
| `bg` / `--bg` | `#FFFFFF` | Page background |
| `teal` / `accent-primary` | `#5DDAB8` | Primary actions, active states, morning routine |
| `lavender` / `accent-coral` | `#B48FE8` | Secondary accent, night routine |
| `accent-sage` | `#6FD8A0` | Gradient start |
| `text-primary` | `#1A1A2E` | Body text |
| `text-secondary` | `#6B6B8A` | Muted text |
| `vitalia-border` | `#EBEBF0` | Card borders, dividers |
| `vitalia-muted` | `#9B9BAA` | Placeholder text |
| `bg-2` | (defined in CSS vars) | Secondary background |

### Gradients
```css
--gradient-brand: linear-gradient(135deg, #6FD8A0, #5DDAB8, #B48FE8)
vitalia-gradient: same as above (Tailwind backgroundImage token)
```

### Typography
- Font: **DM Sans** (Google Fonts, weights 300/400/500/600/700/900)
- Loaded in `app/layout.tsx` via `next/font/google`

### Border Radius
| Token | Value |
|---|---|
| `rounded-card` | `20px` |
| `rounded-btn` | `999px` (pill) |
| `rounded-pill` | `999px` |

### Shadows
- `shadow-card`: `0px 2px 8px rgba(0,0,0,0.06)`

### Custom CSS Classes (`app/globals.css`)
| Class | Description |
|---|---|
| `.card` | White bg, `rounded-card`, `shadow-card`, `border vitalia-border` |
| `.btn-vitalia` | Gradient bg, rounded-pill, white text, hover scale |
| `.vitalia-input` | Border `vitalia-border`, `rounded-xl`, focus ring teal |
| `.text-vitalia-gradient` | `background-clip: text` with brand gradient |
| `.skeleton-shimmer` | Shimmer loading animation |

### Animations (`app/globals.css` keyframes)
| Class | Keyframe | Duration | Behavior |
|---|---|---|---|
| `animate-breathe` | `breathe` | 4s | scale 1→1.3, ease-in-out |
| `animate-breathe-2` | `breatheRing2` | 4s 0.5s | second breathing ring |
| `animate-vitalia-in` | `vitaliaFadeIn` | 0.8s | opacity + translateY fade in |
| `animate-fade-in-up-1` | `fadeInUp` | 0.6s 0.2s | staggered fade in |
| `animate-fade-in-up-2` | `fadeInUp` | 0.6s 0.4s | staggered fade in |
| `animate-scroll-bounce` | `scrollBounce` | 1.5s infinite | bouncing scroll indicator |

---

## 4. App Structure & Navigation

### PWA Status
**Disabled.** Files exist as `public/manifest.json.disabled` and `public/sw.js.disabled`. No PWA manifest link in `app/layout.tsx`. App is a standard web app.

### Layout Wrapper: AppShell (`components/layout/AppShell.tsx`)
All authenticated pages (dashboard, meal-plan, workout-plan, routine, grocery, health-report, settings) are wrapped in `<AppShell>`.

AppShell renders:
1. `<ToastProvider>` — global toast notifications
2. `<Sidebar>` — desktop navigation (hidden on mobile)
3. `<main>` — `md:ml-60 pb-20 md:pb-0 min-h-screen`; inner: `max-w-4xl mx-auto px-4 md:px-8 py-8`
4. `<BottomNav>` — mobile navigation (hidden on desktop)

### Sidebar (`components/layout/Sidebar.tsx`)
- Visible: `hidden md:flex` — desktop only (md+), fixed left, w-60, bg-white, border-r
- Logo: `public/leaf-logo.svg` + "VITALIA" text
- 5 nav items:
  | Label | Route | Icon |
  |---|---|---|
  | Home | `/dashboard` | Home |
  | Meals | `/meal-plan` | UtensilsCrossed |
  | Workout | `/workout-plan` | Dumbbell |
  | Routine | `/routine/morning` | Sun |
  | Settings | `/settings` | Settings |
- Active item style: `bg-teal/10 text-teal rounded-xl`

### BottomNav (`components/layout/BottomNav.tsx`)
- Visible: `md:hidden` — mobile only, fixed bottom
- Same 5 items as Sidebar
- Active item: teal color + small teal dot indicator below icon

### Route Map

```
/                        → Intro + sign-up (public)
/login                   → Login page (public)
/signup                  → Separate sign-up page (public)
/onboarding              → 7-step chat onboarding
/onboarding/pet          → Pet selection step
/onboarding/results      → Plan generation + results reveal
/dashboard               → Main dashboard (authenticated)
/meal-plan               → Weekly meal plan
/workout-plan            → Weekly workout plan
/routine/morning         → Morning routine checklist
/routine/night           → Night routine checklist
/grocery-list            → AI-generated grocery list
/health-report           → AI health analysis reports
/settings                → Settings hub
/settings/profile        → Edit profile & health info
/settings/routine        → Edit routine items
/settings/notifications  → Push notification settings
```

---

## 5. Pages (Detailed)

### Root Page (`app/page.tsx`)
**Public** — scroll-snap 2-section layout, `h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth`.

**Section 1 — Intro:**
- White background
- Breathing circle: 2 animated rings using `animate-breathe` + `animate-breathe-2`, teal/lavender border colors
- `leaf-logo.svg` centered inside circle
- "VITALIA" title with `text-vitalia-gradient`
- Tagline text
- "Get Started" `.btn-vitalia` CTA — scrolls to section 2
- Bouncing chevron-down `animate-scroll-bounce` scroll indicator

**Section 2 — Sign Up:**
- Inline Create Account form: email input + password input (`.vitalia-input`)
- Submit → `supabase.auth.signUp()` → redirects to `/onboarding`
- Auth check on mount: if already logged in → `router.replace('/dashboard')`

### Login (`app/login/page.tsx`)
- White bg, "Welcome back" header, "Continue your journey" subtitle
- Gradient accent line at top
- `.vitalia-input` email + password fields
- After login: checks `onboarding_complete` → routes to `/dashboard` or `/onboarding`
- Link to `/signup`

### Signup (`app/signup/page.tsx`)
- Separate page (also accessible at `/signup`)
- Shows `leaf-logo.svg` + "VITALIA" title above form
- Same form as root section 2

### Onboarding (`app/onboarding/page.tsx`)
- Renders `<OnboardingChat />` (7-step conversational onboarding — see §8)

### Onboarding Pet (`app/onboarding/pet/page.tsx`)
- Pet selection interface — pick from 5 pet types
- Saves to `pet` table

### Onboarding Results (`app/onboarding/results/page.tsx`)
- Generates all plans (meal, workout, routine, health report) in parallel
- Animated results reveal with Framer Motion

### Dashboard (`app/dashboard/page.tsx`)
- Wrapped in `<AppShell>`
- On load:
  1. Checks `onboarding_complete`; if false → redirect to `/onboarding`
  2. Updates `daily_logs.last_seen_at` to current timestamp
- Content:
  - Greeting: "Good [morning/afternoon/evening], {name}" + date
  - `<PetWidget />` — clickable pet with speech bubble
  - `<TodaySummaryCard />` — today's habit progress
  - `<QuickLinks />` — 2×2 grid of nav shortcuts
  - Weekly goal `<ProgressBar />` — average of 7-day morning+night routine completion

### Meal Plan (`app/meal-plan/page.tsx`)
- Week selector with left/right chevrons (cannot navigate forward past current week)
- Day tabs (Mon–Sun), auto-selects today on load
- `normalizePlan()` lowercases all day keys before rendering
- `generateImagesForDay()` — fires image generation for meals missing `image_url` when tab is selected; uses a Set to prevent re-triggering for already-requested days
- `<MealCard />` rendered for each meal slot (breakfast, lunch, dinner, snack)
- `<SwapModal />` for swapping individual meals
- `<RecipeModal />` for viewing full recipe
- Empty state for first-time users, error state with retry button

### Workout Plan (`app/workout-plan/page.tsx`)
- Week selector (same left/right pattern, no future weeks)
- Day tabs: shows 🧘 for rest days, green dot for logged days
- Renders `<WorkoutDayCard />` for selected day
- Inline swap modal (not a separate component): opens immediately by fetching `/api/workouts/swap` on modal open
- `handleUpdateDay()` — saves changes inline to `weekly_plans.workout_plan` in Supabase
- `onUpdate` prop only passed to WorkoutDayCard for current week (weekOffset === 0)

### Morning Routine (`app/routine/morning/page.tsx`)
```tsx
<AppShell><RoutineChecklist type="morning" /></AppShell>
```

### Night Routine (`app/routine/night/page.tsx`)
```tsx
<AppShell><RoutineChecklist type="night" /></AppShell>
```

### Grocery List (`app/grocery-list/page.tsx`)
- Extracts all ingredients from current week's meal plan via `extractAllIngredients()`
- Calls `/api/plans/grocery` to organize into categorized sections
- **Sections:** PRODUCE 🥦, PROTEINS 🥩, DAIRY & ALTERNATIVES 🥛, PANTRY & GRAINS 🌾, SPICES & SEASONINGS 🧂, FROZEN ❄️, CONDIMENTS & SAUCES 🫙
- **Checkbox behavior:** unchecked items shown first, checked items shown dimmed at bottom
- **Progress bar** — fraction of items checked
- Checked state saved to `weekly_plans.grocery_checklist` (Record<string, boolean>)
- **localStorage cache:** key `grocery_list_YYYY-MM-DD` — persists generated list across refreshes
- Buttons: "Clear done" | "Refresh" (re-fetches) | "Print" (`window.print()`)
- Print-specific CSS classes hide UI chrome for clean printing
- "All done!" celebration state when all items checked

### Health Report (`app/health-report/page.tsx`)
- Fetches all `weekly_plans` with non-null `health_report`, ordered newest first
- Shows most recent report by default
- Past Reports dropdown (visible if >1 report exists)
- "Update" button calls `/api/plans/report` to regenerate
- Renders report via `<ReactMarkdown>` with styled h2, h3, p, ul, li, strong
- Medical disclaimer sticky at bottom

### Settings Hub (`app/settings/page.tsx`)
- Profile summary card with `vitalia-gradient` background
- 4 settings link cards: Profile & Health Info, Routine Editor, Notifications, Grocery List
- "Sign Out" button → `supabase.auth.signOut()` → router to `/login`
- Footer: "Vitalia v1.0 — Your personal AI health companion"

### Settings: Profile (`app/settings/profile/page.tsx`)
- 4 edit cards: Personal Details (name/age/weight/height), Medical Profile, Food Preferences, Workout Preferences
- Array fields displayed as comma-separated text inputs, split on save
- Bloodwork re-upload via hidden `<input type="file">` → `/api/bloodwork/parse`
- Saves to all 4 tables simultaneously with `Promise.all`

### Settings: Routine Editor (`app/settings/routine/page.tsx`)
- Two `<RoutineEditor>` components side by side (morning + night)
- Add / edit / delete / reorder (up/down arrows) for routine items
- **Auto-save:** 600ms debounce after any change → upserts to `routine_preferences`

### Settings: Notifications (`app/settings/notifications/page.tsx`)
- "Enable Push Notifications" button → `Notification.requestPermission()` → Web Push subscribe → `/api/push/subscribe`
- Wake time + bedtime `<input type="time">` fields
- Saves wake/sleep times to `routine_preferences` table

---

## 6. Components (Detailed)

### AppShell, Sidebar, BottomNav
See §4 above.

### PetWidget (`components/dashboard/PetWidget.tsx`)
- Renders `<PetAnimation>` with current pet type + state
- Click → calls `/api/pet/message` → shows AI-generated speech bubble for 5 seconds
- Uses `usePetState()` hook for current state
- Accessories computed locally: crown 👑 at streak ≥ 7, sunglasses 🕶️ at streak ≥ 30
- Speech bubble: absolute positioned `top-4 left-28`, CSS triangle pointer

### PetAnimation (`components/pet/PetAnimation.tsx`)
- Emoji-based rendering (no image assets):
  | Pet Type | Emoji |
  |---|---|
  | cat | 🐱 |
  | dog | 🐶 |
  | dragon | 🐉 |
  | bunny | 🐰 |
  | fox | 🦊 |
- State overlays (absolute positioned):
  - sad → 😢, sick → 🤒, critical → 💀
- Accessories (absolute): crown 👑 (`-top-3`, centered), sunglasses 🕶️ (`top-0`)
- Thriving glow: yellow-200/30 blur-lg div
- Framer Motion animations per state:
  | State | Animation |
  |---|---|
  | thriving | scale + brightness pulse |
  | happy | rotate |
  | neutral | y float |
  | sad | x shake + opacity |
  | sick | fast x shake with delay |
  | critical | opacity pulse |

### TodaySummaryCard (`components/dashboard/TodaySummaryCard.tsx`)
- Shows 3 summary items:
  1. **Morning Routine** — "X of Y items (Z%)"
  2. **Meals Logged** — "X of 4"
  3. **Workout** — one of: "Rest day 🧘" / "Done ✅" / "Scheduled: [workout name]" / "No plan yet"
- Fetches: `daily_logs` for today, `routine_preferences`, latest `weekly_plans`

### QuickLinks (`components/dashboard/QuickLinks.tsx`)
- 2×2 grid of card links:
  | Label | Route |
  |---|---|
  | Meal Plan | `/meal-plan` |
  | Workout | `/workout-plan` |
  | Morning Routine | `/routine/morning` |
  | Health Report | `/health-report` |

### MealCard (`components/meal-plan/MealCard.tsx`)
- **Image area:** 160px tall; `image_url` if available, else gradient fallback with food emoji
- **Badge:** meal type label (Breakfast / Lunch / Dinner / Snack) top-left
- **Name:** clickable → triggers `onViewRecipe` callback
- **Macros:** colored badges — calories, protein (g), carbs (g), fat (g), fiber (g)
- **"Why this meal?"** — collapsible `<details>` element showing reasoning text
- **Log buttons:** ✅ Eaten | 🔄 Swapped | ❌ Skipped — togglable (clicking same status unchecks)
- **Swap button:** bottom-right, triggers `onSwap` callback

### SwapModal (`components/meal-plan/SwapModal.tsx`)
- **4 phases:** `loading` → `pick` → `feedback` → `skip`
- Mobile: bottom sheet; Desktop: centered modal
- Sticky header + sticky footer
- Phase `pick`: shows up to 3 alternative meal cards to choose from
- "None of these work for me" → phase `feedback` (text input for feedback)
- Feedback phase: 1 round only — after submitting feedback, re-fetches alternatives; then → `skip` phase
- Error state: shows error detail + Retry button

### RecipeModal (`components/meal-plan/RecipeModal.tsx`)
- Fetches recipe on mount from `/api/meals/recipe`
- Header image (48px tall) with close X button overlaid
- Shows:
  - Macro badges
  - "Why this meal" card
  - Prep time / Cook time / Servings
  - Ingredients list (numbered circles)
  - Step-by-step instructions (numbered)

### WorkoutDayCard (`components/workout-plan/WorkoutDayCard.tsx`)
- **Rest day:** centered 🧘 emoji, recovery note, "Switch to workout day" link
- **Workout day:**
  - Exercise list via `<ExerciseItem>` subcomponent
  - Add custom exercise inline form
  - Edit dropdown: "Make rest day" + location selector (gym / home / class)
  - Log buttons: ✅ Completed | ⚡ Modified | ❌ Skipped
  - "Swap workout" button — opens swap modal (inline in parent page)

### ExerciseItem (`components/workout-plan/ExerciseItem.tsx`)
- Shows exercise name, sets, reps/duration, notes
- Inline edit mode (pencil icon)
- Delete button (trash icon)

### RoutineChecklist (`components/routine/RoutineChecklist.tsx`)
- Uses `useRoutine()` hook
- **Checked items:** line-through text, teal/lavender background tint
- **Edit controls (hover-reveal):** pencil icon for inline rename, trash icon for delete
- **Add form:** Plus button → inline input → adds new item
- **Progress bar:** teal for morning, lavender for night
- **Completion celebration:** animated congratulation card when 100% reached (Framer Motion)
- Link to the other routine (morning ↔ night) at bottom

### OnboardingChat (`components/onboarding/OnboardingChat.tsx`)
- 7 steps with progress bar (7 filled teal segments for completed steps):
  | # | Step | Notes |
  |---|---|---|
  | 1 | About You | Name, age, height, weight |
  | 2 | Bloodwork | Upload PDF + Skip buttons; disables text input |
  | 3 | Health Goals | Medical conditions, goals |
  | 4 | Food Preferences | Restrictions, dislikes, cuisines |
  | 5 | Workout Preferences | Goals, equipment, schedule |
  | 6 | Daily Routine | Wake/sleep times, routine preferences |
  | 7 | Meet Your Pet | Intro before pet selection |
- Step 2: PDF upload → `/api/bloodwork/parse`; shows first 6 markers found
- `<step_complete>` tag detection: strips tag from display text, advances step automatically
- After Step 6 → 1500ms delay → `router.push('/onboarding/pet')`

---

## 7. Hooks

### `usePetState` (`hooks/usePetState.ts`)
- Reads `pet` table + last 7 days of `daily_logs`
- Calculates 7-day rolling average: `(morning_completion + night_completion) / 2`
- Maps average to state:
  | Avg | State |
  |---|---|
  | ≥ 90 | thriving |
  | ≥ 70 | happy |
  | ≥ 50 | neutral |
  | ≥ 30 | sad |
  | ≥ 10 | sick |
  | < 10 | critical |
- `current_streak` read from `pet` table but **never written anywhere** (known gap)

### `useRoutine` (`hooks/useRoutine.ts`)
- Fetches `routine_preferences` + today's `daily_logs` on mount
- `toggleItem(id)` — optimistic update + PATCH `/api/routine/log`
- `persistItems(items, type)` — upserts changed list to `routine_preferences`
- `removeItem()`, `updateItem()`, `addItem()` — all call `persistItems()`
- Returns: `{ items, checkedIds, completion, loading, toggleItem, removeItem, updateItem, addItem }`

### `useUser` (`hooks/useUser.ts`)
- Aggregates 5 tables: `users`, `medical_profile`, `food_preferences`, `workout_preferences`, `routine_preferences`
- Returns full `UserProfile` object

### `useWeeklyPlan` (`hooks/useWeeklyPlan.ts`)
- `useWeeklyPlan(weekStartDate?)` — fetches specific or most recent plan
- `useAllWeeklyPlans()` — fetches all plans ordered desc by `week_start_date`

---

## 8. API Routes

### AI / Data Generation

#### `POST /api/chat` — Onboarding chat
- Streams Gemini response via SSE (`buildGeminiStreamRequest()`)
- System prompt: `buildSystemPrompt(profile, bloodwork)` from `lib/anthropic.ts`
- Parses `<step_complete>` tags to signal step advancement
- Saves profile data to appropriate tables per step

#### `POST /api/meals/generate` — Weekly meal plan
- Calls Gemini (`callOpenRouter`) with `buildMealPlanPrompt()`
- Saves result to `weekly_plans.meal_plan`
- Uses `responseMimeType: 'application/json'`

#### `POST /api/meals/swap` — Swap a single meal
- Body: `{ meal, mealType, day, feedback? }`
- **No system prompt** (comment: "long system prompt triggers heavy thinking tokens that eat output token budget")
- Restrictions/allergies embedded directly in swap prompt
- 4-strategy JSON extraction: direct-parse → markdown-code-block → first-to-last-bracket → `[{...}]` regex
- Returns: `{ alternatives: Meal[] }` (up to 3)
- 16000 max tokens, `responseMimeType: 'application/json'`

#### `POST /api/meals/recipe` — Full recipe for a meal
- Body: `{ mealName, ingredients, description }`
- Returns: `{ recipe: { prep_time_mins, cook_time_mins, servings, ingredients_with_quantities, instructions } }`
- 6–12 numbered beginner-friendly instructions

#### `POST /api/meals/image` — Generate meal image
- Calls `gemini-2.5-flash-image` for image generation
- Called per-meal when a day tab is selected in meal plan

#### `POST /api/plans/report` — Health report
- Builds system prompt + `buildHealthReportPrompt(profile, bloodwork)`
- Saves markdown report to `weekly_plans.health_report`
- 8192 max tokens

#### `POST /api/plans/routine` — Generate routine
- Body: none (uses authenticated user's profile)
- Calls Gemini with `ROUTINE_PROMPT` + wake/sleep times
- Retry logic: if JSON parse fails, sends follow-up "return only raw JSON" message
- Saves to `routine_preferences`

#### `POST /api/plans/workout` — Weekly workout plan
- Calls Gemini with `WORKOUT_PLAN_PROMPT`, replaces `${workout_preferences.days_per_week}` token
- Retry on JSON parse failure
- Saves to `weekly_plans.workout_plan`
- 8192 max tokens

#### `POST /api/workouts/swap` — Swap a workout day
- Body: `{ workout, day }`
- Uses system prompt + `buildWorkoutSwapPrompt()`
- Returns: `{ alternatives: WorkoutDay[] }`

#### `POST /api/plans/grocery` — Generate grocery list
- Body: `{ ingredients: string[] }` (all ingredients from weekly meal plan)
- Inline prompt with 12 conversion rules:
  - Produce/fresh → whole units ("3 bell peppers")
  - Oils/liquid pantry → always "1 bottle"
  - Spices/dried herbs → always "1 jar"
  - Grains → standard bag sizes
  - Meat/protein → store weights ("1.5 lbs chicken breast")
  - Omits: water, table salt, black pepper, cooking spray
- Returns: `{ sections: [{ title, emoji, items: string[] }] }`
- Uses `responseMimeType: 'application/json'`

### Data / Auth

#### `POST /api/bloodwork/parse` — Parse uploaded PDF
- Accepts PDF file upload
- Calls Gemini to extract bloodwork markers from PDF text
- Saves markers to `bloodwork` table
- Returns parsed markers array

#### `PATCH /api/routine/log` — Log routine item check/uncheck
- Body: `{ type, itemId, checked, date }`
- Updates `morning_items_checked` or `night_items_checked` array in `daily_logs`
- Calculates completion % from total items in `routine_preferences`
- Upserts `daily_logs` with `onConflict: 'user_id,date'`

#### `POST /api/push/subscribe` — Save push subscription
- Body: Web Push `PushSubscription` object
- Upserts to `push_subscriptions`

#### `GET /api/pet/message` — AI pet speech bubble
- Returns short, personalized message from the pet character

### Cron Jobs (`vercel.json`)

#### `GET /api/cron/weekly-plans` — Saturday 8AM UTC (`0 8 * * 6`)
- Fetches all users with completed onboarding
- Generates meal plan + workout plan + health report in parallel for each user
- Sends push notification on completion
- Deletes `push_subscriptions` row if push send fails (invalid subscription)
- **Known bug:** uses `now.getDate()` instead of `now.getUTCDate()` for week start calculation

#### `GET /api/cron/pet-checkin` — Daily 7PM UTC (`0 19 * * *`)
- Notifies users who have been inactive for > 3 hours (checks `last_seen_at`)
- Message: "{pet_name} misses you... 🥺"

#### `GET /api/cron/push-reminders` — Daily 8AM UTC (`0 8 * * *`)
- Sends 5 reminder windows per user:
  | Reminder | Trigger |
  |---|---|
  | Morning routine | wake_time |
  | Workout | wake_time + 2 hours |
  | Lunch | 12:00 |
  | Dinner | 18:30 |
  | Night routine | sleep_time − 1 hour |
- ±15 min matching window
- **Known bug:** cron fires once at 8AM UTC, so only users whose schedule aligns with 8AM UTC ever match the window — all other users' reminders are never sent

---

## 9. Core Libraries

### `lib/openrouter.ts` — Gemini Client
- Model: `gemini-2.5-flash`
- Base URL: `generativelanguage.googleapis.com/v1beta/models`
- `callOpenRouter(messages, maxTokens, debugLabel?, extraGenerationConfig?)` — non-streaming
  - Filters out `thought: true` parts (strips thinking tokens from response)
  - Returns `{ text: string | null, stopReason: string }`
- `buildGeminiStreamRequest(messages, maxTokens, systemPrompt?)` — returns URL + request body for SSE streaming
- Optional `extraGenerationConfig: { responseMimeType: 'application/json' }` for JSON-constrained outputs
- `MODEL` constant exported for logging purposes

### `lib/anthropic.ts` — System Prompt Builder
- `buildSystemPrompt(profile, bloodwork)` — pure function, no API calls
- Builds detailed system context string from user profile + bloodwork markers

### `lib/prompts.ts` — Prompt Templates
- `buildMealPlanPrompt(profile, bloodwork)` — weekly meal plan generation
- `buildMealSwapPrompt(meal, mealType, feedback?, profile)` — meal swap
- `buildHealthReportPrompt(profile, bloodwork)` — health analysis
- `buildWorkoutSwapPrompt(workout, day)` — workout swap
- `ROUTINE_PROMPT` — constant string for routine generation
- `WORKOUT_PLAN_PROMPT` — constant string (with `${workout_preferences.days_per_week}` placeholder)

### `lib/profile.ts`
- `fetchFullProfile(supabase, userId)` — aggregates all profile tables into a single object

### `lib/push.ts`
- Initializes `web-push` with VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
- `sendPushNotification(subscription, { title, body, icon? })`

### `lib/supabase/` — Supabase Clients
- `lib/supabase/server.ts` — `createClient()` for server-side (SSR cookies)
- `lib/supabase/client.ts` — `createBrowserClient()` for client components

---

## 10. TypeScript Types (`types/index.ts`)

Key types used across the app:

```typescript
type Meal = {
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
  image_prompt?: string
}

type MealPlan = {
  [day: string]: {  // "monday" | "tuesday" | ... | "sunday"
    breakfast: Meal
    lunch: Meal
    dinner: Meal
    snack: Meal
  }
}

type Exercise = {
  name: string
  sets?: number
  reps?: string
  duration?: string
  notes?: string
}

type WorkoutDay = {
  is_rest_day: boolean
  workout_name?: string
  location?: 'gym' | 'home' | 'class'
  exercises?: Exercise[]
  notes?: string
}

type WorkoutPlan = {
  week_start_date: string
  days: { [day: string]: WorkoutDay }
}

type RoutineItem = {
  id: string
  label: string
  time?: string
  category?: string
}

type UserProfile = {
  id: string
  name: string
  age: number
  height_cm: number
  weight_kg: number
  onboarding_complete: boolean
  medical_profile: { conditions: string[]; medications: string[]; supplements: string[]; allergies: string[] }
  food_preferences: { restrictions: string[]; dislikes: string[]; cuisine_preferences: string[]; health_goals: string[] }
  workout_preferences: { goals: string[]; activity_types: string[]; days_per_week: number; gym_access: boolean; home_equipment: string[]; preferred_duration_mins: number }
  routine_preferences: { wake_time: string; sleep_time: string; morning_items: RoutineItem[]; night_items: RoutineItem[] }
}
```

---

## 11. Authentication Flow

1. **Sign up:** `/` section 2 or `/signup` → `supabase.auth.signUp()` → redirect to `/onboarding`
2. **Login:** `/login` → `supabase.auth.signInWithPassword()` → check `onboarding_complete`:
   - `true` → `/dashboard`
   - `false` → `/onboarding`
3. **Session management:** `@supabase/ssr` with cookie-based sessions; server components call `supabase.auth.getUser()` via `createClient()` (server)
4. **Sign out:** Settings page → `supabase.auth.signOut()` → `/login`
5. **Auth guards:** Each API route calls `supabase.auth.getUser()` and returns 401 if no user

---

## 12. Image Generation

- **Route:** `POST /api/meals/image`
- **Model:** `gemini-2.5-flash-image`
- **Trigger:** Fired automatically when switching day tabs in meal plan, for any meal missing `image_url`
- **Deduplication:** Set tracks which days have already triggered generation (prevents re-firing on tab revisit)
- **Fallback:** If no `image_url`, MealCard shows gradient background with food emoji

---

## 13. Known Issues / Gaps

1. **`current_streak` never updated:** `pet.current_streak` is read by `usePetState` to award accessories (crown at ≥7, sunglasses at ≥30) but no code path ever writes to this column. Streaks never increase from their initial value.

2. **Push reminder cron bug:** `/api/cron/push-reminders` fires once at 8AM UTC. The ±15 min matching window means only users whose routine times align with 8AM UTC get reminders. Users on other schedules never receive routine reminders.

3. **Week start date bug:** `/api/cron/weekly-plans` uses `now.getDate()` instead of `now.getUTCDate()` for computing Monday's date — this can produce an off-by-one for users in timezones behind UTC when the cron runs on Saturday morning.

4. **PWA non-functional:** `manifest.json` and `sw.js` are disabled (renamed with `.disabled` extension). The app cannot be installed as a PWA.

5. **`@anthropic-ai/sdk` unused:** Package is installed and appears in package.json but has zero runtime usage. All AI goes through Gemini.

---

## 14. Environment Variables Required

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `GEMINI_API_KEY` | Google Gemini API |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `VAPID_EMAIL` | Web Push sender email |
| `CRON_SECRET` | Vercel cron authentication header |

---

## 15. File Tree (Key Files)

```
healthapp/
├── app/
│   ├── layout.tsx                    # Root layout, DM Sans font, no PWA
│   ├── globals.css                   # Full design system, animations, custom classes
│   ├── page.tsx                      # Public intro + sign-up (scroll-snap)
│   ├── login/page.tsx               # Login page
│   ├── signup/page.tsx              # Signup page
│   ├── onboarding/
│   │   ├── page.tsx                 # 7-step onboarding chat
│   │   ├── pet/page.tsx             # Pet selection
│   │   └── results/page.tsx         # Plan generation + reveal
│   ├── dashboard/page.tsx           # Main dashboard
│   ├── meal-plan/page.tsx           # Weekly meal plan + image gen
│   ├── workout-plan/page.tsx        # Weekly workout plan + swap
│   ├── routine/
│   │   ├── morning/page.tsx         # Morning checklist wrapper
│   │   └── night/page.tsx           # Night checklist wrapper
│   ├── grocery-list/page.tsx        # AI grocery list + checkboxes
│   ├── health-report/page.tsx       # Health analysis reports
│   ├── settings/
│   │   ├── page.tsx                 # Settings hub
│   │   ├── profile/page.tsx         # Edit profile
│   │   ├── routine/page.tsx         # Routine editor
│   │   └── notifications/page.tsx   # Push notification settings
│   └── api/
│       ├── chat/route.ts            # Onboarding SSE streaming
│       ├── meals/
│       │   ├── generate/route.ts    # Meal plan generation
│       │   ├── swap/route.ts        # Meal swap
│       │   ├── recipe/route.ts      # Full recipe fetch
│       │   └── image/route.ts       # Meal image generation
│       ├── plans/
│       │   ├── report/route.ts      # Health report
│       │   ├── routine/route.ts     # Routine generation
│       │   ├── workout/route.ts     # Workout plan generation
│       │   └── grocery/route.ts     # Grocery list generation
│       ├── workouts/swap/route.ts   # Workout swap
│       ├── routine/log/route.ts     # Routine check/uncheck (PATCH)
│       ├── bloodwork/parse/route.ts # PDF bloodwork parsing
│       ├── pet/message/route.ts     # Pet speech bubble message
│       ├── push/subscribe/route.ts  # Save push subscription
│       └── cron/
│           ├── weekly-plans/route.ts   # Sat 8AM UTC
│           ├── pet-checkin/route.ts    # Daily 7PM UTC
│           └── push-reminders/route.ts # Daily 8AM UTC (broken)
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   └── BottomNav.tsx
│   ├── dashboard/
│   │   ├── PetWidget.tsx
│   │   ├── TodaySummaryCard.tsx
│   │   └── QuickLinks.tsx
│   ├── meal-plan/
│   │   ├── MealCard.tsx
│   │   ├── SwapModal.tsx
│   │   └── RecipeModal.tsx
│   ├── workout-plan/
│   │   ├── WorkoutDayCard.tsx
│   │   └── ExerciseItem.tsx
│   ├── routine/
│   │   ├── RoutineChecklist.tsx
│   │   └── RoutineEditor.tsx
│   ├── onboarding/
│   │   └── OnboardingChat.tsx
│   ├── pet/
│   │   └── PetAnimation.tsx
│   └── ui/
│       ├── ProgressBar.tsx
│       ├── Badge.tsx
│       └── Toast.tsx / ToastProvider.tsx
├── hooks/
│   ├── usePetState.ts
│   ├── useRoutine.ts
│   ├── useUser.ts
│   └── useWeeklyPlan.ts
├── lib/
│   ├── openrouter.ts               # Gemini API client
│   ├── anthropic.ts                # buildSystemPrompt() helper only
│   ├── prompts.ts                  # All AI prompt templates
│   ├── profile.ts                  # fetchFullProfile()
│   ├── push.ts                     # Web Push sendPushNotification()
│   └── supabase/
│       ├── server.ts
│       └── client.ts
├── types/
│   └── index.ts                    # Meal, MealPlan, WorkoutPlan, RoutineItem, UserProfile
├── public/
│   ├── leaf-logo.svg               # Primary logo
│   ├── leaf-logo.png               # PNG version
│   ├── manifest.json.disabled      # PWA manifest (disabled)
│   └── sw.js.disabled              # Service worker (disabled)
├── tailwind.config.js              # Full design token system
├── vercel.json                     # 3 cron job definitions
└── package.json
```
