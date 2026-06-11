# Vitalia — Current State PRD

**Date:** 2026-06-11
**Purpose:** Documents exactly what is built as of this date

---

## 1. App Overview

### What the App Does
Vitalia is an AI-powered personal health companion web app (mobile-first PWA). It generates personalized weekly meal plans, workout plans, and health reports using AI, tracks daily routine completion, hosts a virtual pet companion whose health mirrors the user's habit consistency, and provides a 7-day grocery list, recipe cards, and exercise GIF demos.

### Tech Stack (exact versions from package.json)

| Package | Version |
|---|---|
| next | 14.2.18 |
| react | ^18 |
| react-dom | ^18 |
| @supabase/supabase-js | ^2.45.4 |
| @supabase/ssr | ^0.5.1 |
| @anthropic-ai/sdk | ^0.27.0 (installed but NOT used in runtime code — see note below) |
| ai | ^3.4.0 (installed but not used in runtime code) |
| framer-motion | ^11.11.11 |
| lucide-react | ^0.460.0 |
| react-beautiful-dnd | ^13.1.1 |
| react-markdown | ^9.0.1 |
| web-push | ^3.6.7 |
| next-pwa | ^5.6.0 |
| @fal-ai/serverless-client | ^0.15.0 (installed but not used in runtime code) |
| tailwindcss | ^3.4.1 |
| typescript | ^5 |

> **Note:** The `@anthropic-ai/sdk` package is installed but the runtime code does NOT use it. All AI calls go directly to the **Google Gemini API** (`gemini-2.5-flash`) via raw `fetch()` calls wrapped in `lib/openrouter.ts`. The file `lib/anthropic.ts` exports only the `buildSystemPrompt()` helper function — no actual Anthropic API calls. Similarly, `@fal-ai/serverless-client` is installed but unused.

### Deployment URL
Not determinable from code alone (no `.env` or Vercel project ID in repo). Deployed to Vercel (inferred from `vercel.json` with cron configuration).

### Database: Supabase Tables

All tables inferred from code read/write patterns:

**`users`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, matches Supabase auth user ID |
| name | text | User's first name |
| age | integer | |
| height_cm | numeric | |
| weight_kg | numeric | |
| onboarding_complete | boolean | Defaults to false on signup |

**`medical_profile`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id (unique) |
| conditions | text[] | e.g. ["hypothyroidism", "PCOS"] |
| medications | text[] | |
| supplements | text[] | |
| exercise_history | text | Brief description |
| concerns | text[] | Health concerns |
| goals | text[] | Health goals (min 3) |
| success_definition | text | What success looks like in 6 months |

**`food_preferences`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id (unique) |
| restrictions | text[] | e.g. ["vegetarian", "gluten-free"] |
| allergies | text[] | e.g. ["peanuts", "shellfish"] |
| loved_cuisines | text[] | |
| disliked_foods | text[] | |
| meal_prep_days | integer | Days per week user can meal prep |
| typical_meals | jsonb | Record<string, string> — meals user typically eats |

**`workout_preferences`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id (unique) |
| goals | text[] | e.g. ["weight loss", "muscle gain"] |
| activity_types | text[] | e.g. ["strength training", "yoga"] |
| days_per_week | integer | |
| gym_access | boolean | |
| home_equipment | text[] | |
| preferred_duration_mins | integer | |

**`routine_preferences`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id (unique) |
| wake_time | text | HH:MM 24-hour format, e.g. "07:00" |
| sleep_time | text | HH:MM 24-hour format, e.g. "23:00" |
| morning_items | jsonb | Array of RoutineItem objects: `[{id, label, time_target?, category?}]` |
| night_items | jsonb | Array of RoutineItem objects |

**`bloodwork`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| biomarker_name | text | e.g. "TSH", "LDL Cholesterol" |
| value | numeric | |
| unit | text | e.g. "mg/dL", "mIU/L" |
| reference_range_low | numeric | nullable |
| reference_range_high | numeric | nullable |
| is_flagged | boolean | true if value outside reference range |
| upload_date | date | Date of upload |
| created_at | timestamp | (implied) |

**`weekly_plans`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| week_start_date | date | Monday of the week (ISO date) |
| meal_plan | jsonb | Full MealPlan JSON object (see Section 5) |
| workout_plan | jsonb | Full WorkoutPlan JSON object (see Section 6) |
| health_report | text | Markdown string |
| grocery_checklist | jsonb | Record<string, boolean> — item name → checked |
| generated_at | timestamp | |
| UNIQUE | — | (user_id, week_start_date) |

**`daily_logs`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| date | date | |
| meal_log | jsonb | Record<string, MealLogStatus> — key is `{day}_{mealType}`, value is `"eaten" \| "swapped" \| "skipped" \| null` |
| workout_log | jsonb | Record<string, WorkoutLogStatus> — key is day name, value is `"completed" \| "modified" \| "skipped" \| null` |
| morning_routine_completion | integer | 0–100 percentage |
| night_routine_completion | integer | 0–100 percentage |
| morning_items_checked | text[] | Array of RoutineItem IDs checked today |
| night_items_checked | text[] | Array of RoutineItem IDs checked today |
| last_seen_at | timestamp | Updated on every dashboard load |
| UNIQUE | — | (user_id, date) |

**`pet`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id (unique) |
| pet_type | text | `"cat" \| "dog" \| "dragon" \| "bunny" \| "fox"` |
| pet_name | text | User-given name |
| accessories | text[] | Unlocked accessories (e.g. "crown", "sunglasses") |
| current_streak | integer | Current streak in days |
| longest_streak | integer | |

**`push_subscriptions`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| endpoint | text | Web push endpoint URL |
| auth | text | Push subscription auth key |
| p256dh | text | Push subscription p256dh key |

**Supabase Storage Buckets (inferred):**
- `meal-images` — public bucket, stores AI-generated meal images as `{userId}/{mealId}.png`
- `bloodwork-pdfs` — stores uploaded bloodwork PDFs as `{userId}/{timestamp}.pdf` (fire-and-forget, non-blocking)

---

## 2. Authentication & Entry Flow

### Exact Routes in Order

| URL | What It Loads |
|---|---|
| `/` | Landing page + inline signup form (two-section scroll-snap layout) |
| `/signup` | Standalone signup page (duplicate of landing page signup form) |
| `/login` | Login page |
| `/onboarding` | Onboarding chat (7-step AI conversation) |
| `/onboarding/pet` | Pet selection + plan generation loading screen |
| `/onboarding/results` | 4-slide preview of generated plans |
| `/dashboard` | Main dashboard (auth-gated) |

### How Auth Works
- **Provider:** Supabase Auth (email + password only — no OAuth)
- **Client:** `@supabase/ssr` — `createBrowserClient` for client-side, `createServerClient` for server-side API routes
- **Session handling:** Cookie-based sessions managed by Supabase SSR. The `lib/supabase/middleware.ts` function `updateSession()` reads/refreshes the session from request cookies and returns the user object
- **Middleware:** `middleware.ts` runs on every request matching the pattern `/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-*.png|badge-*.png|*.svg|*.png|*.jpg|*.jpeg|*.gif|*.webp).*)`. Public paths (`/`, `/login`, `/signup`, `/api/`) pass through without auth check. All other routes require a valid user session, redirecting to `/login` if absent
- **Cron route auth:** API routes under `/api/cron/` use a Bearer token check against `CRON_SECRET` env var (not Supabase auth)

### Logged Out vs Logged In
- **Logged out:** Landing page (`/`) checks auth on mount. If user IS logged in, immediately `router.replace('/dashboard')`. Login/signup pages are accessible
- **Logged in:** Dashboard checks `onboarding_complete` on the users row. If `false`, redirects to `/onboarding`. If `true`, shows the dashboard. Every dashboard page load upserts `last_seen_at` in `daily_logs`

---

## 3. Onboarding

### Every Step That Exists

The onboarding is a 7-step AI chat conversation (`/onboarding`) followed by pet selection (`/onboarding/pet`) and a results preview (`/onboarding/results`).

**Step 1 — About You**
Questions asked: name, age, height, weight, medical conditions, medications, supplements, exercise history. The AI asks one question at a time conversationally.

**Step 2 — Bloodwork**
Presents a PDF upload button and a "Skip for now" button. If PDF is uploaded, calls `POST /api/bloodwork/parse`, shows up to 6 extracted biomarkers, then auto-advances to step 3. If skipped, chat message acknowledges and advances. The text input is disabled during step 2 (bloodwork-only step).

**Step 3 — Health Goals**
Questions asked: health concerns (what worries them), at least 3 health goals, and what success looks like in 6 months.

**Step 4 — Food Preferences**
Questions asked: dietary restrictions (vegetarian, vegan, halal, etc.), allergies, favorite cuisines, disliked foods, how many days per week they can meal prep.

**Step 5 — Workout Preferences**
Questions asked: fitness goals, preferred activities (weightlifting, running, yoga, cycling), days per week, gym access (yes/no), home equipment, preferred session duration.

**Step 6 — Daily Routine**
Questions asked: wake time, sleep time, existing morning habits, existing night habits.

**Step 7 — Meet Your Pet** (transition signal only)
When the AI detects step 7, it navigates to `/onboarding/pet` after 1500ms.

### Data Saved at Each Step

All data is saved server-side after detecting the `<step_complete>{"step": N, "data": {...}}</step_complete>` tag in the AI response stream:

| Step | Table | Fields Written |
|---|---|---|
| 1 | `users` | name, age, height_cm, weight_kg |
| 1 | `medical_profile` | conditions, medications, supplements, exercise_history |
| 3 | `medical_profile` | concerns, goals, success_definition |
| 4 | `food_preferences` | restrictions, allergies, loved_cuisines, disliked_foods, meal_prep_days, typical_meals |
| 5 | `workout_preferences` | goals, activity_types, days_per_week, gym_access, home_equipment, preferred_duration_mins |
| 6 | `routine_preferences` | wake_time, sleep_time, morning_items, night_items |
| 2 | `bloodwork` | Saved by `/api/bloodwork/parse` separately (deletes existing rows, inserts new batch) |

### How Step Completion Is Tracked
The client (`OnboardingChat.tsx`) parses a `<step_complete>` XML tag from the streaming response. When detected, it strips the tag from the displayed text, increments `currentStep` state, and navigates to `/onboarding/pet` when step 7 is reached.

### Pet Selection & Plan Generation (`/onboarding/pet`)

**PetSelector component** shows 5 pet options:
- 🐱 Cat — "Elegant and independent, but deeply loyal"
- 🐶 Dog — "Enthusiastic and supportive every single day"
- 🐉 Dragon — "Fierce, powerful, and legendary"
- 🐰 Bunny — "Gentle, hopeful, and endlessly encouraging"
- 🦊 Fox — "Clever, quick, and full of surprises"

On "Meet your pet!" click:
1. Upserts to `pet` table (pet_type, pet_name, accessories=[], current_streak=0, longest_streak=0)
2. Sets `users.onboarding_complete = true`
3. Requests browser push notification permission and calls `POST /api/push/subscribe` if granted
4. Kicks off 5 parallel plan generation tasks:
   - `POST /api/plans/report` → health report
   - `POST /api/plans/meal` → meal plan
   - `POST /api/plans/workout` → workout plan
   - `POST /api/plans/routine` → morning + night routine (one call for both)
   - Night routine shares the same `/api/plans/routine` call
5. Shows animated loading screen with per-task status (pending/running/done/error)
6. Supports retry of failed tasks individually
7. On all done: navigates to `/onboarding/results` after 800ms

### Onboarding Results (`/onboarding/results`)

4-slide swipeable preview:
1. **Health Report** — rendered as Markdown with ReactMarkdown
2. **Meal Plan** — shows all 7 days in a grid; each day shows 4 meals with calories + protein
3. **Workout Plan** — shows all 7 days with workout/rest type, location badge, duration, exercise count
4. **Daily Routine** — shows morning and night items as a checklist preview

Polls Supabase every 4 seconds (up to 5 times) if data isn't ready yet. Has a manual "Check again" button after polling exhausted. Final "Go to my dashboard" button on last slide sets route to `/dashboard`.

---

## 4. Dashboard (Home)

### Every Element That Renders

1. **Greeting header** — "Good morning/afternoon/evening, [name]! 👋" with subtitle "Here's your health overview for today."
2. **PetWidget** — pet emoji with animation, name, state badge, streak text, 7-day avg completion progress bar. Tap/click pet to get a speech bubble message from the pet
3. **TodaySummaryCard** — three rows: morning routine, meals logged, workout status
4. **QuickLinks** — 2×2 grid of navigation cards
5. **Weekly Goal Progress** — progress bar with label showing average completion percentage

### Health Score (Weekly Progress)
Not a numeric "score" — it's a percentage. Calculated as:
- Fetches all `daily_logs` rows for the current user from the last 7 days
- For each log: averages `morning_routine_completion` and `night_routine_completion`
- Takes mean of those averages across all log rows in the 7-day window
- Rounds to integer and stores in `weeklyProgress` state
- Displayed via `<ProgressBar>` component

### Pet Widget
**State calculation (`usePetState` hook):**
- Fetches `pet` table row for user
- Fetches `daily_logs` for past 7 days
- Averages `(morning_routine_completion + night_routine_completion) / 2` per day, then averages across all log days
- Maps `avgCompletion` to `PetState`:
  - ≥ 90% → `thriving`
  - ≥ 70% → `happy`
  - ≥ 50% → `neutral`
  - ≥ 30% → `sad`
  - ≥ 10% → `sick`
  - < 10% → `critical`

**Pet animation states:**
- `thriving`: scale pulse + brightness flash (1.5s loop)
- `happy`: rotation wiggle (2s loop)
- `neutral`: vertical float (3s loop)
- `sad`: horizontal sway + opacity fade (4s loop)
- `sick`: rapid horizontal shake with 2s delay (0.4s shake)
- `critical`: opacity pulsing (2s loop)

**Accessories (derived from `current_streak`):**
- streak ≥ 7 days → 👑 crown overlay
- streak ≥ 30 days → 🕶️ sunglasses overlay

**Speech bubble:** Clicking the pet calls `POST /api/pet/message`. Shows the returned message for 5 seconds then auto-dismisses.

### Today's Summary Rows
1. **🌅 Morning routine** — shows `{morningChecked} of {morningTotal} items ({morningCompletion}%)`
   - Data source: `daily_logs.morning_items_checked` length + `daily_logs.morning_routine_completion` + `routine_preferences.morning_items` length
2. **🍽️ Meals logged** — shows `{N} of 4 today`
   - Data source: counts `meal_log` entries in `daily_logs` where value is `"eaten"` or `"swapped"` for today
3. **💪 Workout** — shows status string
   - Data source: `weekly_plans.workout_plan.days[dayOfWeek]` to get workout name; `daily_logs.workout_log[dayOfWeek]` to check completion. Shows "Rest day 🧘", "Done ✅", "Scheduled: {workout_name}", or "No plan yet"

### Quick Links (4 cards)
| Card | Emoji | Label | Navigates To |
|---|---|---|---|
| 1 | 🍽️ | Meal Plan | `/meal-plan` |
| 2 | 💪 | Workout | `/workout-plan` |
| 3 | ☀️ | Morning Routine | `/routine/morning` |
| 4 | 📋 | Health Report | `/health-report` |

### Morning/Night Toggle
There is **no toggle on the dashboard** — morning and night routines are separate pages. The BottomNav links to `/routine/morning` only. The RoutineChecklist component shows a link to switch between the two at the bottom of each page.

### API Calls on Page Load
1. `supabase.auth.getUser()` — auth check
2. `supabase.from('users').select('name, onboarding_complete')` — greeting + onboarding gate
3. `supabase.from('daily_logs').upsert(...)` — update `last_seen_at` for today
4. `supabase.from('daily_logs').select('morning_routine_completion, night_routine_completion').gte('date', 7daysAgo)` — weekly progress

The PetWidget (`usePetState`) and TodaySummaryCard make their own independent Supabase calls on mount.

---

## 5. Meal Plan

### How Plans Are Generated

**API Route:** `POST /api/plans/meal`

**Data passed to AI:** Full user profile via `buildSystemPrompt()`:
- name, age, height_cm, weight_kg
- medical conditions, medications, supplements, concerns, goals, success_definition
- All bloodwork markers with values and reference ranges
- food restrictions, allergies, loved cuisines, disliked foods
- workout preferences (goals, activities, days/week, gym access, duration)

**Model:** `gemini-2.5-flash` via direct Google AI REST API (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`)

**Exact prompt (MEAL_PLAN_PROMPT from `lib/prompts.ts`):**
```
Generate a 7-day meal plan for this user.
Return ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "week_start_date": "YYYY-MM-DD",
  "days": {
    "monday": {
      "breakfast": { "id": "uuid", "name": "...", "description": "...", "reasoning": "...", 
        "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, 
        "ingredients": ["2 cups ingredient", "..."], "image_url": null, 
        "image_prompt": "A hand-drawn watercolor illustration of [meal name], fine liner pen with loose watercolor fill, Great British Baking Show recipe card style, warm rich colors, sketchbook paper texture" },
      "lunch": {...}, "dinner": {...}, "snack": {...}
    },
    "tuesday": {...}, ... "sunday": {...}
  }
}

QUALITY RULES: Every meal must be GENUINELY DELICIOUS and restaurant-quality — never bland, generic, or boring.
Use bold, layered flavors; draw heavily from the user's loved cuisines; use fresh herbs, quality fats, and interesting cooking techniques.
description must read like an appetizing menu item. Variety across the week: no ingredient or cooking method should repeat more than twice.

HEALTH RULES: Meals MUST respect ALL allergies and restrictions. Tailor nutrients to conditions.
Use anti-inflammatory spices where relevant. Calories and macros must match user's weight and goals.
Ingredients list: include quantities. reasoning must cite the specific condition or biomarker this meal addresses.
Use real UUIDs for ids. ALL 7 days MUST be fully populated — never omit a day.
```

**Retry logic:** Attempt 1 uses the full prompt with `maxOutputTokens=16000`. If the response is truncated or missing days, Attempt 2 uses a compact version (shorter per-meal structure) also with `maxOutputTokens=16000`. If both fail, returns HTTP 500.

### How Plans Are Stored
Upserted to `weekly_plans` table with conflict key `(user_id, week_start_date)`:
```json
{
  "user_id": "uuid",
  "week_start_date": "2026-06-09",
  "meal_plan": { ...full MealPlan JSON object... },
  "generated_at": "ISO timestamp"
}
```

### Every Element on the Meal Plan Page (`/meal-plan`)

1. **Page title** — "Meal Plan" + "Regenerate" button (secondary)
2. **Week selector** — left/right chevrons, "Week of [Month Day]" label. Cannot navigate forward past current week
3. **Day tabs** — Mon–Sun, horizontally scrollable. Default is today's day
4. **Meal cards** (4 per day: breakfast, lunch, dinner, snack) — each card has:
   - Watercolor meal image (160px tall) or emoji placeholder
   - Meal type badge (e.g. "breakfast")
   - Meal name (clickable → opens RecipeModal)
   - Description (2-line clamp)
   - "View recipe →" link
   - "Why this meal?" collapsible details
   - Macro badges: 🔥 cal, P: Xg, C: Xg, F: Xg, Fiber: Xg
   - Log buttons: ✅ eaten, 🔄 swapped, ❌ skipped (toggle on/off)
   - "Swap" ghost button
5. **Empty state** (no plan) — full-page with "Generate my first plan ✨" button
6. **Error state** — "Failed to load meal plan" with Retry button
7. **Past week with no plan** — "No meal plan for this week."

### How Meal Images Are Generated and Stored

**API Route:** `POST /api/images/meal`

**Trigger:** Background generation is triggered on page load and whenever the user switches to a new day tab. Only triggered once per `{weekStart}_{day}` combination (tracked via `imageGenTriggered` ref).

**Process:**
1. Calls Google Gemini image model `gemini-2.5-flash-image` with a watercolor art prompt: `"A hand-drawn watercolor illustration of {mealName}, rendered in fine liner pen with loose watercolor fill, in the style of The Great British Baking Show recipe cards. Show a close-up view with warm, rich colors on a sketchbook paper texture background. Artistic and food-forward, no photography."`
2. Gets base64-encoded image data from response
3. Uploads to Supabase Storage bucket `meal-images` at path `{userId}/{mealId}.png` using service role admin client (bypasses RLS)
4. Returns public URL
5. Updates `weekly_plans.meal_plan` in database to persist the `image_url` on the meal object

### Swap/Replace Flow
1. User clicks "Swap" on a MealCard → `SwapModal` opens
2. SwapModal calls `POST /api/meals/swap` with `{meal, mealType, day}`
3. Shows 3 AI-generated alternative meals with macros
4. User selects one → clicks "Swap Meal" → `onConfirm` callback
5. Plan updated in-memory AND persisted to `weekly_plans` via Supabase update
6. Image generation triggered for the new meal
7. **Feedback flow:** If none of the 3 options work, user can type feedback ("quicker", "no dairy", etc.) → triggers a second `POST /api/meals/swap` call with the feedback string → gets refined alternatives. On second rejection, shows "Nothing's clicking?" state with option to try again or keep original.

### Log Meal Flow
1. User taps ✅/🔄/❌ on a MealCard → toggles the status (tapping same status again = null/unlog)
2. Log key is `{selectedDay}_{mealType}` (e.g. `monday_breakfast`)
3. Upserts to `daily_logs.meal_log` immediately (no debounce)

### Grocery List (page: `/grocery-list`)

**Trigger:** Auto-generated when grocery list page loads and no cached list exists for current week.

**How it works:**
1. Reads `meal_plan` from `weekly_plans` for current week
2. Extracts all unique ingredients from all 28 meals (breakfast/lunch/dinner/snack × 7 days) using `extractAllIngredients()` (deduplicates case-insensitively)
3. Sends ingredient list to `POST /api/plans/grocery`
4. AI converts recipe-quantity ingredients into real store amounts organized by section (PRODUCE, PROTEINS, DAIRY & ALTERNATIVES, PANTRY & GRAINS, SPICES & SEASONINGS, FROZEN, CONDIMENTS & SAUCES)
5. Result cached in `localStorage` under key `grocery_list_{weekStart}`
6. Checkbox state saved to `weekly_plans.grocery_checklist` (Record<string, boolean>)

**UI elements:** Section headers with emojis, alphabetically sorted items, checkboxes, shopping progress bar, "Clear done" button, "Refresh" button (clears cache + regenerates), "Print" button (`window.print()`)

### Regenerate Flow
Clicking "Regenerate" on the meal plan page calls `POST /api/plans/meal`. A new plan is generated, persisted, displayed, and image generation is re-triggered for the selected day.

---

## 6. Workout Plan

### How Plans Are Generated

**API Route:** `POST /api/plans/workout`

**Data passed to AI:** Same `buildSystemPrompt()` system prompt as meal plan (full profile + bloodwork).

**Model:** `gemini-2.5-flash`

**Exact prompt (WORKOUT_PLAN_PROMPT from `lib/prompts.ts`):**
```
Generate a 7-day workout plan for this user.
Return ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "week_start_date": "YYYY-MM-DD",
  "days": {
    "monday": { "type": "workout", "workout_name": "Lower Body Strength", "location": "gym",
      "duration_mins": 45, "exercises": [
        { "id": "uuid", "name": "Hip Thrust", "sets": 3, "reps": 12, "rest_seconds": 60, 
          "reasoning": "...", "gif_url": null }
      ]
    },
    "tuesday": { "type": "rest", "recovery_note": "..." },
    ...
  }
}
Rules:
- Respect gym_access and preferred activity types
- Schedule exactly {workout_preferences.days_per_week} workout days, with rest days distributed optimally
- Reasoning must reference the user's specific goals or conditions
- For home workouts, only use bodyweight or stated home equipment
- Use real UUIDs for ids
- ALL 7 days must be present (type: "workout" or "rest")
```

**Retry logic:** If JSON parse fails, retries with a follow-up message "Return ONLY raw JSON..." at `maxOutputTokens=8192`.

### How Plans Are Stored
Same `weekly_plans` upsert pattern as meal plan, updating the `workout_plan` JSONB column.

### Every Element on the Workout Plan Page (`/workout-plan`)

1. **Page title** — "Workout Plan" + "Regenerate" button
2. **Week selector** — same left/right chevron pattern as meal plan
3. **Day tabs** — Mon–Sun with rest emoji (🧘) on rest days, green dot badge on logged days
4. **WorkoutDayCard** (for current selected day):
   - **Rest day:** Shows 🧘 emoji, "Rest Day" header, recovery note, "Switch to workout day" option
   - **Workout day:**
     - Workout name header
     - Location badge (🏋️ gym / 🏠 home / 🧘 class) + duration badge (⏱️ N min)
     - "Edit" dropdown (change to rest day, change location)
     - Exercise list (ExerciseItems)
     - "Add exercise" button (custom form with name, sets, reps, rest_seconds)
     - Log buttons: ✅ Completed, ⚡ Modified, ❌ Skipped
     - "Swap workout" ghost button
5. **Empty state** — "Generate my first plan ✨"
6. **Error state** — retry button

### Exercise Video/Demo (ExerciseDB via RapidAPI)

**API Route:** `GET /api/exercises/gif?name={exerciseName}`

Each `ExerciseItem` component auto-fetches a GIF on mount from `/api/exercises/gif`. The API calls ExerciseDB at `exercisedb.p.rapidapi.com/exercises/name/{encoded_name}?limit=1&offset=0`. Returns the `gifUrl` from the first result. Response is cached 24 hours via Next.js `next: { revalidate: 86400 }`. If `RAPIDAPI_KEY` is not configured, returns `{gif_url: null}` — no GIF shown. If no match found, shows 💪 emoji placeholder.

ExerciseItem shows: exercise name, sets × reps, duration (if set), rest seconds. "Why this?" expandable shows reasoning.

### Location Selector
Dropdown on WorkoutDayCard Edit menu. Options: 🏋️ Gym, 🏠 Home, 🧘 Class. Updates the `location` field in the workout day object and persists to `weekly_plans`.

### Swap Workout Flow
1. User clicks "Swap workout" → `POST /api/workouts/swap` with `{workout, day}`
2. Returns 3 alternative `WorkoutDay` objects
3. Shown in a modal as buttons with workout name, location, duration, exercise count
4. User selects → plan updated in-memory and persisted to Supabase

### Log Workout Flow
Tap ✅/⚡/❌ buttons on WorkoutDayCard. Upserts to `daily_logs.workout_log` with key = day name (e.g. `"monday"`).

---

## 7. Health Report

### How Reports Are Generated

**API Route:** `POST /api/plans/report`

**Data passed to AI:**
- Same `buildSystemPrompt()` as other plans (full profile + bloodwork)
- Additional dynamic prompt from `buildHealthReportPrompt()` which:
  - Lists all flagged biomarkers (outside reference range)
  - Determines which specialist sections to include based on conditions and flagged markers
  - Conditionally adds sections for: Cardiologist, Endocrinologist, Gastroenterologist, Dermatologist, Rheumatologist

**Model:** `gemini-2.5-flash`, `maxOutputTokens=8192`

**Exact specialist routing logic:**
- Cardiologist: if conditions include heart/cardio/hypertension/cholesterol/atherosclerosis/arrhythmia OR bloodwork flags LDL/Cholesterol/Triglyceride/HDL/CRP/hsCRP
- Endocrinologist: if conditions include pcos/thyroid/hashimoto/graves/diabetes/prediabetes/insulin resistance/adrenal/hormonal/cortisol/testosterone/estrogen/progesterone/menstrual/perimenopause/menopause OR bloodwork flags TSH/T3/T4/Thyroid/HbA1c/Glucose/Insulin/Cortisol/DHEA/Testosterone/Estrogen/Progesterone/LH/FSH
- Gastroenterologist: if conditions include ibs/crohn/celiac/colitis/sibo/digestive/gut/reflux/gerd/gastroparesis/bowel/colon
- Dermatologist: if conditions include acne/eczema/psoriasis/rosacea/skin/dermatitis
- Rheumatologist: if conditions include lupus/rheumatoid/autoimmune/fibromyalgia/sjögren/ra OR bloodwork flags ANA/Anti-/Rheumatoid Factor/CCP/ESR/Sed Rate

### Report Sections (always present)
1. **From Your Functional Medicine Doctor** — holistic clinical picture
2. **From Your Clinical Nutritionist** — nutrition guidance grounded in profile/bloodwork
3. **From Your Personal Trainer** — fitness assessment and training approach
4. **From Your [Specialist]** — (conditionally added based on conditions/bloodwork)
5. **Priority Action Items for This Week** — 5 bullet points, clinically grounded
6. **A Note From Your Care Team** — warm closing paragraph

### Where Stored
`weekly_plans.health_report` as a plain Markdown string, upserted by `(user_id, week_start_date)`.

### Past Reports
Health Report page (`/health-report`) fetches ALL weekly_plans rows where `health_report IS NOT NULL`, ordered by `week_start_date DESC`. Shows the most recent report by default. A "Past Reports" dropdown appears if more than 1 report exists, showing "Week of [Month Day]" for each. Selecting one swaps the displayed report.

---

## 8. Routine (Morning & Night)

### How Routine Items Are Generated
`POST /api/plans/routine` — called during onboarding pet generation phase. Uses same `buildSystemPrompt()` + `ROUTINE_PROMPT` from `lib/prompts.ts`. Generates both morning and night items in one call. Saves to `routine_preferences` table.

### Routine Prompt
```
Generate a personalized daily routine checklist for this user — a morning routine and a night routine.
Return ONLY valid JSON:
{
  "morning_items": [{ "id": "uuid", "label": "Drink 16oz water", "time_target": "7:00 AM" }],
  "night_items": [{ "id": "uuid", "label": "Take magnesium glycinate 400mg", "time_target": "9:30 PM" }]
}
Rules:
- morning_items begin at or just after wake_time, spanning first 60-90 minutes
- night_items span 60-90 minutes before sleep_time
- Include specific medications with correct timing (levothyroxine empty stomach, metformin with food, statins at night)
- Include supplements with appropriate timing
- Include items tailored to medical conditions
- 6-10 items per routine
- Labels must be specific and actionable
- time_target must use 12-hour format
- Do NOT include exercise or meals
```

### Default vs Custom Items
No "default" items. All items are AI-generated during onboarding. Users can then add/edit/remove/reorder in `/settings/routine`.

### Check-off Mechanic
- `RoutineChecklist` component uses `useRoutine` hook
- Checking/unchecking a checkbox calls `PATCH /api/routine/log` with `{type, itemId, checked, date}`
- Server reads `routine_preferences` to get total item count
- Recalculates completion: `Math.round((checkedIds.length / totalItems) * 100)`
- Upserts to `daily_logs` with `morning_items_checked` / `night_items_checked` arrays and completion percentage
- Check state persists across page loads (loaded from `daily_logs` on mount)
- When 100% complete, shows "🎉 Morning complete!" / "Night routine done!" banner with animation

### Time-Based Switching Logic
There is **no automatic time-based switching**. The morning and night routines are separate static routes (`/routine/morning` and `/routine/night`). At the bottom of each RoutineChecklist, there is a link to switch to the other routine manually (e.g. "Night Routine →").

### Daily Reset Logic
No explicit cron reset. The `daily_logs` table uses a `(user_id, date)` unique constraint. On each day, a new row is created via upsert with empty checked arrays and 0 completion. The `useRoutine` hook fetches the log for `today` (current ISO date string) — so each new calendar day starts with a fresh empty state automatically.

### Edit Routine
Via `/settings/routine` (RoutineEditor):
- **Add item:** Label text + optional time target, Enter to confirm
- **Edit item:** Pencil icon (hover-reveal), edit inline with Enter to save / Escape to cancel
- **Delete item:** Trash icon (hover-reveal)
- **Reorder:** Up/down arrow buttons
- **Auto-save:** Debounced 600ms after any change, persists to `routine_preferences` via upsert
- Also editable inline from the RoutineChecklist page (add item form + pencil/trash hover actions)

---

## 9. Insights

> **Note:** There is no dedicated "Insights" page in this codebase. No `/insights` route, no energy/sleep/weight/water trackers, no biomarkers tab, no lifestyle tab, no chart components. The `useWeeklyPlan` and `useUser` hooks exist but are not used by any current page. The Health Report is accessed at `/health-report` (see Section 7). The dashboard shows basic daily/weekly summaries but no trend charts or dedicated insights section.

---

## 10. Chat (Vita)

### Where the Bubble Renders
There is **no persistent chat bubble** in the authenticated app shell. The chat only exists during onboarding at `/onboarding` (the `OnboardingChat` component). There is no AI chat accessible from the dashboard or any other authenticated route.

### How the Chat API Works

**Route:** `POST /api/chat`

**Method:** Streaming response (`ReadableStream` with `text/plain` content type)

**What it receives:** `{ messages: [{role, content}], step: number }`

**What it does:**
1. Builds a system prompt via `buildOnboardingSystemPrompt(step, stepGoal)` — a warm, clinical onboarding assistant prompt that instructs the AI to ask one question at a time and emit `<step_complete>` XML tags when a step is complete
2. Filters messages to only pass user/assistant messages starting from the first user message
3. Calls Google Gemini SSE stream endpoint (`gemini-2.5-flash:streamGenerateContent?alt=sse`)
4. Strips out thinking tokens (parts with `thought: true`)
5. Streams text delta chunks directly to the browser
6. After stream completes, parses `<step_complete>` block and calls `saveStepData()` to persist to Supabase

**Morning/Night Check-in:** Not implemented. No check-in logic exists in the codebase.

**New health info detection:** Not implemented.

**Chat history:** Not stored. Messages are only held in React state during the onboarding session. Refreshing the page resets to the initial greeting message.

---

## 11. Settings

### Every Row That Exists (`/settings`)

The settings page shows:
1. **Profile summary card** — avatar placeholder, user name, weight in kg, pet name
2. **Settings links (4 rows):**

| Row | Emoji | Label | Description | Routes To |
|---|---|---|---|---|
| 1 | 👤 | Profile & Health Info | Edit personal details, conditions, preferences | `/settings/profile` |
| 2 | ✅ | Routine Editor | Customize morning & night routine items | `/settings/routine` |
| 3 | 🔔 | Notifications | Manage push notification preferences | `/settings/notifications` |
| 4 | 🛒 | Grocery List | View this week's shopping list | `/grocery-list` |

3. **Sign Out button** — calls `supabase.auth.signOut()`, redirects to `/login`
4. **Version footer** — "Vitalia v1.0 — Your personal AI health companion"

### Profile Settings (`/settings/profile`)

Editable sections:
1. **Personal Details:** Name, Age, Height (cm), Weight (kg)
2. **Medical Profile:** Medical Conditions, Medications, Supplements, Health Concerns, Health Goals, "What does success look like?" (textarea)
3. **Bloodwork:** Re-upload PDF button (calls `POST /api/bloodwork/parse`)
4. **Food Preferences:** Dietary Restrictions, Allergies, Favorite Cuisines, Disliked Foods, Meal Prep Days per Week
5. **Workout Preferences:** Fitness Goals, Preferred Activities, Workout Days/Week, Session Duration, Gym Access (checkbox), Home Equipment

All comma-separated text fields are split on save. Saves to `users`, `medical_profile`, `food_preferences`, `workout_preferences` tables in parallel. Toast on success/failure.

### Routine Settings (`/settings/routine`)
Full RoutineEditor component — see Section 8 above.

### Notifications (`/settings/notifications`)

1. **Push Notifications card:** Shows "Enable Notifications" button (if not yet granted) or "✅ Push notifications are enabled". Calls `Notification.requestPermission()` then subscribes via service worker and `POST /api/push/subscribe`. Shows error if permission denied
2. **Reminder Schedule card:** Wake Up Time (time input), Bedtime (time input). Saves to `routine_preferences.wake_time` / `routine_preferences.sleep_time`

---

## 12. API Routes

All routes are under `/app/api/`.

### `POST /api/chat`
- **What it does:** Onboarding AI chat streaming endpoint
- **Receives:** `{ messages: [{role, content}], step: number }`
- **Returns:** Streaming `text/plain` response (raw text deltas from Gemini)
- **External APIs:** Google Gemini API (`gemini-2.5-flash:streamGenerateContent?alt=sse`)
- **Side effects:** After stream completes, parses `<step_complete>` block and upserts data to `users`, `medical_profile`, `food_preferences`, `workout_preferences`, or `routine_preferences` tables

### `POST /api/bloodwork/parse`
- **What it does:** Parses a bloodwork PDF using Gemini vision, extracts biomarkers, saves to DB
- **Receives:** `FormData` with field `file` (PDF)
- **Returns:** `{ success: true, biomarkers: [{biomarker_name, value, unit, reference_range_low, reference_range_high, is_flagged, upload_date}] }` or `{ error }`
- **External APIs:** Google Gemini API (`gemini-2.5-flash:generateContent`) — sends PDF as inline base64 data
- **Side effects:** Deletes ALL existing bloodwork rows for user, inserts new batch. Also uploads PDF to `bloodwork-pdfs` storage bucket (fire-and-forget)

### `POST /api/plans/meal`
- **What it does:** Generates a 7-day personalized meal plan using AI
- **Receives:** Nothing in body (uses authenticated user session)
- **Returns:** `{ success: true, plan: MealPlan }` or `{ error }`
- **External APIs:** Google Gemini API (`gemini-2.5-flash:generateContent`)
- **Side effects:** Upserts `weekly_plans` row for current week with `meal_plan` JSON

### `POST /api/plans/workout`
- **What it does:** Generates a 7-day personalized workout plan using AI
- **Receives:** Nothing in body
- **Returns:** `{ success: true, plan: WorkoutPlan }` or `{ error }`
- **External APIs:** Google Gemini API
- **Side effects:** Upserts `weekly_plans` row with `workout_plan` JSON

### `POST /api/plans/report`
- **What it does:** Generates a personalized health report using AI
- **Receives:** Nothing in body
- **Returns:** `{ success: true, report: string }` or `{ error }`
- **External APIs:** Google Gemini API
- **Side effects:** Upserts `weekly_plans` row with `health_report` text

### `POST /api/plans/routine`
- **What it does:** Generates AI-personalized morning and night routine items
- **Receives:** Nothing in body
- **Returns:** `{ success: true, morning_items, night_items }` or `{ error }`
- **External APIs:** Google Gemini API
- **Side effects:** Upserts `routine_preferences` row with `morning_items` and `night_items` JSON arrays

### `POST /api/plans/grocery`
- **What it does:** Converts raw meal plan ingredients into a real shopping list organized by store section
- **Receives:** `{ ingredients: string[] }` — array of raw ingredient strings from meal plan
- **Returns:** `{ sections: [{title, emoji, items: string[]}] }` or `{ error }`
- **External APIs:** Google Gemini API (with `responseMimeType: 'application/json'`)
- **Side effects:** None — client handles saving checklist state to `weekly_plans.grocery_checklist`

### `POST /api/meals/swap`
- **What it does:** Generates 3 alternative meals to replace a specific meal
- **Receives:** `{ meal: Meal, mealType: string, day: string, feedback?: string }`
- **Returns:** `{ alternatives: Meal[] }` (always 3) or `{ error }`
- **External APIs:** Google Gemini API with `responseMimeType: 'application/json'`, `maxOutputTokens=16000`

### `POST /api/meals/recipe`
- **What it does:** Generates full step-by-step recipe for a meal
- **Receives:** `{ mealName: string, ingredients: string[], description: string }`
- **Returns:** `{ recipe: {prep_time_mins, cook_time_mins, servings, ingredients_with_quantities, instructions} }` or `{ error }`
- **External APIs:** Google Gemini API with `responseMimeType: 'application/json'`

### `POST /api/images/meal`
- **What it does:** Generates a watercolor-style meal image using Gemini and uploads to Supabase Storage
- **Receives:** `{ mealId: string, mealName: string, imagePrompt: string, weekStartDate: string }`
- **Returns:** `{ image_url: string }` or `{ error }`
- **External APIs:** Google Gemini image model `gemini-2.5-flash-image:generateContent` (base64 image response)
- **Side effects:** Uploads image to `meal-images` Supabase Storage bucket; updates `weekly_plans.meal_plan` to set `image_url` on the specific meal object

### `POST /api/workouts/swap`
- **What it does:** Generates 3 alternative workout days to replace a specific day's workout
- **Receives:** `{ workout: WorkoutDay, day: string }`
- **Returns:** `{ alternatives: WorkoutDay[] }` or `{ error }`
- **External APIs:** Google Gemini API

### `GET /api/exercises/gif?name={exerciseName}`
- **What it does:** Looks up a GIF animation for an exercise from ExerciseDB
- **Receives:** Query param `name`
- **Returns:** `{ gif_url: string | null }`
- **External APIs:** ExerciseDB RapidAPI (`exercisedb.p.rapidapi.com/exercises/name/{name}?limit=1&offset=0`)
- **Notes:** Cached 24h via Next.js cache. Returns `{gif_url: null}` if `RAPIDAPI_KEY` not configured

### `POST /api/pet/message`
- **What it does:** Generates a short in-character message from the user's pet
- **Receives:** `{ petName, petType, petState, completionPercent, currentStreak }`
- **Returns:** `{ message: string }`
- **External APIs:** Google Gemini API, `maxOutputTokens=256`

### `POST /api/push/subscribe`
- **What it does:** Saves a web push subscription for the user
- **Receives:** `{ subscription: { endpoint, keys: { auth, p256dh } } }`
- **Returns:** `{ success: true }` or `{ error }`
- **External APIs:** None
- **Side effects:** Upserts to `push_subscriptions` table

### `PATCH /api/routine/log`
- **What it does:** Logs a single routine item check/uncheck and recalculates completion
- **Receives:** `{ type: "morning" | "night", itemId: string, checked: boolean, date?: string }`
- **Returns:** `{ completion: number }` (0–100)
- **External APIs:** None
- **Side effects:** Upserts to `daily_logs` table (morning/night items_checked array + completion percentage)

### `POST /api/cron/weekly-plans`
- **What it does:** Generates new weekly plans for ALL onboarded users
- **Receives:** `Authorization: Bearer {CRON_SECRET}` header
- **Returns:** `{ success: true, processed: number }`
- **External APIs:** Google Gemini API (3 calls per user: meal plan, workout plan, health report)
- **Side effects:** Upserts `weekly_plans` for each user; sends push notification if subscription exists. Deletes stale push subscription on failure

### `POST /api/cron/pet-checkin`
- **What it does:** Sends push notification to users who haven't been active today (inactive for 3+ hours)
- **Receives:** `Authorization: Bearer {CRON_SECRET}` header
- **Returns:** `{ success: true }`
- **External APIs:** Web push (via `web-push` library)
- **Side effects:** Sends push with "🥺 [PetName] misses you..."; deletes stale push subscription on failure

### `POST /api/cron/push-reminders`
- **What it does:** Sends time-based reminder push notifications based on user's wake/sleep schedule
- **Receives:** `Authorization: Bearer {CRON_SECRET}` header
- **Returns:** `{ success: true }`
- **External APIs:** Web push
- **Logic:** Checks current UTC hour/minute against 5 reminder windows per user:
  1. Wake time → "Good morning! 🌅 Time to start your morning routine."
  2. Wake time + 2 hours → "Workout reminder 💪 Have you completed your workout today?"
  3. 12:00 → "Lunch time 🥗 Don't forget to log your lunch!"
  4. 18:30 → "Dinner time 🍽️ Don't forget to log your dinner!"
  5. Sleep time − 1 hour → "Night routine time 🌙 Wind down with your night routine."
- Sends if within ±15 minutes of window time. Deletes stale subscriptions on failure

---

## 13. Cron Jobs

Configured in `vercel.json`. All routes require `Authorization: Bearer {CRON_SECRET}` header.

| Cron Job | Route | Schedule | What It Does |
|---|---|---|---|
| Weekly Plans | `/api/cron/weekly-plans` | `0 8 * * 6` (every Saturday at 8:00 AM UTC) | Generates new meal plan, workout plan, and health report for all onboarded users in parallel; sends push notification |
| Pet Check-in | `/api/cron/pet-checkin` | `0 19 * * *` (daily at 7:00 PM UTC) | Sends push notification to users inactive for 3+ hours today using pet's name |
| Push Reminders | `/api/cron/push-reminders` | `0 8 * * *` (daily at 8:00 AM UTC) | Sends time-based routine/meal/workout reminders based on each user's wake/sleep schedule |

> **Note:** The push reminders cron runs once daily at 8:00 AM UTC, but it uses a ±15 minute matching window. This means reminders are only sent if the user's wake/sleep time happens to align with 8:00 AM UTC. The design intent is for this to run more frequently (e.g. every 15 minutes), but as currently configured it only fires once a day.

---

## 14. Environment Variables

| Variable | What It Is For | Service |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Supabase |
| `GOOGLE_AI_KEY` | Google Gemini API key | Google AI / Gemini |
| `RAPIDAPI_KEY` | RapidAPI key for ExerciseDB | ExerciseDB via RapidAPI |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for web push notifications | Web Push |
| `VAPID_PRIVATE_KEY` | VAPID private key for web push notifications | Web Push |
| `VAPID_EMAIL` | Contact email for VAPID | Web Push |
| `CRON_SECRET` | Bearer token to authenticate cron job requests | Internal (Vercel Cron) |

---

## 15. Known Issues

### TODO Comments
None found in code.

### console.error Calls (indicating error paths that exist in production)

**`/app/api/chat/route.ts`:**
- `[chat] auth error on step N` — auth failure during step data save
- `[chat] no user found when saving step N` — session lost mid-onboarding
- `[chat] failed to parse step_complete block on step N` — malformed AI JSON tag
- `[chat] SSE JSON parse error` — malformed SSE chunk from Gemini

**`/app/api/plans/meal/route.ts`:**
- Attempt 1 JSON parse failure falls through to attempt 2 silently
- Attempt 2 JSON parse failure returns HTTP 500 with error message

**`/app/api/images/meal/route.ts`:**
- `[images/meal] public URL returned {non-200}` — image uploaded but may not display in browser (logged as warning, not error)
- DB update failure on `weekly_plans` is non-fatal (warned but doesn't fail the request)

**`/app/api/bloodwork/parse/route.ts`:**
- Storage upload is fire-and-forget; failures only `console.warn`

**`/components/onboarding/OnboardingChat.tsx`:**
- Multiple `console.error` calls for bloodwork parse failures, stream errors, fetch errors
- `console.log` statements throughout for debugging (not removed)

**`/app/meal-plan/page.tsx`:**
- Multiple `console.error` calls for normalizePlan failures, image gen failures

**`/app/workout-plan/page.tsx`:**
- `console.error` for fetch errors in swap modal

### Incomplete Implementations

1. **`/app/signup/page.tsx` is a duplicate:** The `/signup` route is a full standalone page with the same signup form as the landing page (`/`). Both do exactly the same thing. The landing page links to `/login` with a "Sign in" link, and the login page links to `/signup`. The root page also contains an inline signup form. This duplication is unnecessary.

2. **`lib/anthropic.ts` is misnamed:** Contains only `buildSystemPrompt()` — no Anthropic SDK usage. The actual AI provider is Google Gemini. The file is named `anthropic.ts` but the `@anthropic-ai/sdk` package is never called at runtime.

3. **`lib/openrouter.ts` is misnamed:** Contains direct Google Gemini API calls, not OpenRouter. The module exports `callOpenRouter()` and `buildGeminiStreamRequest()` but neither calls OpenRouter.

4. **No Insights page:** The nav/sidebar shows only Home, Meals, Workout, Routine, Settings. There is no Insights/trackers page, no energy/sleep/weight/water tracking, no biomarkers visualization, no lifestyle tracking.

5. **No persistent Chat (Vita) bubble:** The design intent suggests a persistent AI chat companion. Currently only the onboarding chat is implemented. There is no chat UI accessible from the authenticated app.

6. **`/public/manifest.json.disabled` and `/public/sw.js.disabled`:** PWA manifest and service worker files are disabled (renamed with `.disabled` suffix). The `next-pwa` package is installed but not effective. Push notifications require a service worker — the current service worker file `public/workbox-4754cb34.js` exists but the main `sw.js` is disabled.

7. **Pet streak is never updated:** The `pet` table has `current_streak` and `longest_streak` columns. These are initialized to 0 in `PetSelector.tsx` and never updated anywhere in the codebase (no cron job, no API route, no client-side logic updates streak values).

8. **Weekly plan cron sends `POST` but vercel.json expects it:** The cron schedule is correct, but the cron handler in `route.ts` validates `Authorization: Bearer {CRON_SECRET}` — this header must be configured in Vercel's cron job settings or the cron calls will fail with 401.

9. **`useWeeklyPlan` and `useUser` hooks are unused:** Both hooks are defined in `/hooks/` but not imported or used by any page component currently.

10. **`react-beautiful-dnd` is installed but unused:** No drag-and-drop UI exists in the current codebase.

11. **`@fal-ai/serverless-client` is installed but unused:** Was likely an earlier image generation approach before switching to Gemini image model.

12. **Push reminders cron runs only once daily:** The cron at `0 8 * * *` (8AM UTC daily) attempts to match reminder windows within ±15 minutes. It will only ever send reminders to users whose wake time is ≈8AM UTC. Most users will never receive push reminders.

---

## 16. File Structure

```
healthapp/
├── app/
│   ├── api/
│   │   ├── bloodwork/
│   │   │   └── parse/
│   │   │       └── route.ts          # POST — parse bloodwork PDF via Gemini
│   │   ├── chat/
│   │   │   └── route.ts              # POST — onboarding AI chat (streaming)
│   │   ├── cron/
│   │   │   ├── pet-checkin/
│   │   │   │   └── route.ts          # POST — daily pet inactivity push notification
│   │   │   ├── push-reminders/
│   │   │   │   └── route.ts          # POST — time-based push reminders
│   │   │   └── weekly-plans/
│   │   │       └── route.ts          # POST — weekly plan generation for all users
│   │   ├── exercises/
│   │   │   └── gif/
│   │   │       └── route.ts          # GET — exercise GIF from ExerciseDB
│   │   ├── images/
│   │   │   └── meal/
│   │   │       └── route.ts          # POST — generate meal image via Gemini
│   │   ├── meals/
│   │   │   ├── recipe/
│   │   │   │   └── route.ts          # POST — generate full recipe
│   │   │   └── swap/
│   │   │       └── route.ts          # POST — generate meal swap alternatives
│   │   ├── pet/
│   │   │   └── message/
│   │   │       └── route.ts          # POST — generate pet speech bubble message
│   │   ├── plans/
│   │   │   ├── grocery/
│   │   │   │   └── route.ts          # POST — generate grocery list from ingredients
│   │   │   ├── meal/
│   │   │   │   └── route.ts          # POST — generate weekly meal plan
│   │   │   ├── report/
│   │   │   │   └── route.ts          # POST — generate health report
│   │   │   ├── routine/
│   │   │   │   └── route.ts          # POST — generate morning/night routine
│   │   │   └── workout/
│   │   │       └── route.ts          # POST — generate weekly workout plan
│   │   ├── push/
│   │   │   └── subscribe/
│   │   │       └── route.ts          # POST — save push subscription
│   │   ├── routine/
│   │   │   └── log/
│   │   │       └── route.ts          # PATCH — log routine item check/uncheck
│   │   └── workouts/
│   │       └── swap/
│   │           └── route.ts          # POST — generate workout swap alternatives
│   ├── dashboard/
│   │   └── page.tsx                  # Main dashboard
│   ├── grocery-list/
│   │   └── page.tsx                  # Grocery list page
│   ├── health-report/
│   │   └── page.tsx                  # Health report page
│   ├── login/
│   │   └── page.tsx                  # Login page
│   ├── meal-plan/
│   │   └── page.tsx                  # Meal plan page
│   ├── onboarding/
│   │   ├── page.tsx                  # Onboarding chat (renders OnboardingChat)
│   │   ├── pet/
│   │   │   └── page.tsx              # Pet selection (renders PetSelector)
│   │   └── results/
│   │       └── page.tsx              # Post-onboarding plan preview (4 slides)
│   ├── routine/
│   │   ├── morning/
│   │   │   └── page.tsx              # Morning routine checklist
│   │   └── night/
│   │       └── page.tsx              # Night routine checklist
│   ├── settings/
│   │   ├── page.tsx                  # Settings hub
│   │   ├── notifications/
│   │   │   └── page.tsx              # Push notification settings
│   │   ├── profile/
│   │   │   └── page.tsx              # Full profile editor
│   │   └── routine/
│   │       └── page.tsx              # Routine editor
│   ├── signup/
│   │   └── page.tsx                  # Standalone signup page (duplicate of root signup)
│   ├── workout-plan/
│   │   └── page.tsx                  # Workout plan page
│   ├── globals.css                   # Global styles + CSS variables + Tailwind base
│   ├── layout.tsx                    # Root HTML layout (DM Sans font, meta tags)
│   └── page.tsx                      # Landing page + inline signup form
├── components/
│   ├── dashboard/
│   │   ├── PetWidget.tsx             # Pet emoji + state + streak + speech bubble
│   │   ├── QuickLinks.tsx            # 2×2 navigation grid
│   │   └── TodaySummaryCard.tsx      # Morning routine + meals logged + workout status
│   ├── layout/
│   │   ├── AppShell.tsx              # Layout wrapper: Sidebar + BottomNav + ToastProvider
│   │   ├── BottomNav.tsx             # Mobile bottom navigation (5 items)
│   │   └── Sidebar.tsx               # Desktop sidebar (5 items)
│   ├── meal-plan/
│   │   ├── MealCard.tsx              # Single meal card with image, macros, log, swap
│   │   ├── RecipeModal.tsx           # Full recipe modal (fetches recipe on open)
│   │   └── SwapModal.tsx             # Meal swap modal with feedback flow
│   ├── onboarding/
│   │   ├── OnboardingChat.tsx        # 7-step AI chat with streaming + bloodwork upload
│   │   └── PetSelector.tsx           # Pet selection + plan generation loading screen
│   ├── pet/
│   │   └── PetAnimation.tsx          # Animated emoji pet with state-based animations
│   ├── routine/
│   │   └── RoutineChecklist.tsx      # Routine checklist with check, edit, add, remove
│   ├── ui/
│   │   ├── Badge.tsx                 # Color-coded badge component
│   │   ├── Button.tsx                # Button with variants (primary, secondary, ghost)
│   │   ├── Card.tsx                  # White rounded card with shadow
│   │   ├── ChatBubble.tsx            # Chat message bubble (user/assistant)
│   │   ├── ChecklistItem.tsx         # Single checklist item (appears unused)
│   │   ├── ProgressBar.tsx           # Colored progress bar with optional label
│   │   ├── Skeleton.tsx              # Shimmer loading skeleton (single + lines + card)
│   │   └── Toast.tsx                 # Toast notification (success/error) with provider
│   └── workout-plan/
│       ├── ExerciseItem.tsx          # Single exercise with GIF, sets/reps, expandable reasoning
│       └── WorkoutDayCard.tsx        # Workout day card with exercises, log, swap, edit
├── hooks/
│   ├── usePetState.ts                # Fetches pet + 7-day completion → computes pet state
│   ├── useRoutine.ts                 # Fetches routine items + daily log → check/add/edit
│   ├── useUser.ts                    # Fetches full user profile (unused by any page currently)
│   └── useWeeklyPlan.ts              # Fetches weekly plan(s) (unused by any page currently)
├── lib/
│   ├── anthropic.ts                  # buildSystemPrompt() — formats full profile as AI system prompt
│   ├── openrouter.ts                 # callOpenRouter() + buildGeminiStreamRequest() — Google Gemini API client
│   ├── profile.ts                    # fetchFullProfile() — aggregates all 5 profile tables
│   ├── prompts.ts                    # All AI prompt templates (meal, workout, routine, report, swap, pet, onboarding)
│   ├── push.ts                       # sendPushNotification() — web-push wrapper
│   └── supabase/
│       ├── client.ts                 # createBrowserClient (client-side Supabase)
│       ├── middleware.ts             # updateSession() — refreshes session from cookies
│       └── server.ts                 # createServerClient + createServiceClient (server-side Supabase)
├── public/
│   ├── badge-72.png                  # PWA notification badge
│   ├── icon-192.png                  # PWA app icon 192px
│   ├── icon-512.png                  # PWA app icon 512px
│   ├── leaf-logo.png                 # Vitalia leaf logo (PNG)
│   ├── manifest.json.disabled        # PWA manifest (disabled — renamed)
│   ├── sw.js.disabled                # Service worker (disabled — renamed)
│   └── workbox-4754cb34.js           # Workbox library (unused since sw.js is disabled)
├── types/
│   └── index.ts                      # All TypeScript types: Meal, MealPlan, Exercise, WorkoutPlan,
│                                     # RoutineItem, Pet, UserProfile, DailyLog, WeeklyPlan, PushSubscriptionData
├── .gitignore
├── middleware.ts                     # Next.js middleware — auth gate + session refresh
├── next.config.js                    # Next.js config — remote image patterns (Supabase, fal.media, fal.ai)
├── package.json                      # Dependencies and scripts
├── package-lock.json
├── postcss.config.js                 # PostCSS config (Tailwind + autoprefixer)
├── tailwind.config.js                # Tailwind config
├── tsconfig.json                     # TypeScript config
└── vercel.json                       # Vercel deployment config — 3 cron jobs
```
