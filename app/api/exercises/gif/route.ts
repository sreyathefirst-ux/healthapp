import { NextRequest } from 'next/server'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const EXERCISEDB_HOST = 'exercisedb.p.rapidapi.com'

// Free exercise DB hosted on GitHub — no API key, no IP blocking
const FREE_DB_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const FREE_IMG_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

interface FreeExercise {
  id: string
  name: string
  images: string[]
  category: string
  primaryMuscles: string[]
}

// Module-level cache so the 873-entry JSON is only fetched + parsed once per process
let dbCache: FreeExercise[] | null = null
let dbCacheTime = 0
const DB_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 1 week

async function loadExerciseDB(): Promise<FreeExercise[]> {
  const now = Date.now()
  if (dbCache && now - dbCacheTime < DB_TTL_MS) return dbCache

  console.log('[exercises/gif] loading free exercise DB from GitHub...')
  const res = await fetch(FREE_DB_URL, { cache: 'force-cache' })
  if (!res.ok) throw new Error(`Free DB fetch failed: ${res.status}`)

  dbCache = (await res.json()) as FreeExercise[]
  dbCacheTime = now
  console.log('[exercises/gif] loaded', dbCache.length, 'exercises')
  return dbCache
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

function matchScore(queryTokens: string[], candidateTokens: string[]): number {
  let score = 0
  for (const q of queryTokens) {
    for (const c of candidateTokens) {
      if (c === q) score += 3
      else if (c.includes(q) || q.includes(c)) score += 1
    }
  }
  return score
}

function findBestMatch(name: string, db: FreeExercise[]): FreeExercise | null {
  const query = tokenize(name)
  let best: FreeExercise | null = null
  let bestScore = 0

  for (const ex of db) {
    if (!ex.images?.length) continue
    const score = matchScore(query, tokenize(ex.name))
    if (score > bestScore) {
      bestScore = score
      best = ex
    }
  }

  // Require at least one strong word match
  if (bestScore < 3) {
    console.log('[exercises/gif] no confident match for:', name, '(best score:', bestScore, best ? `"${best.name}"` : 'none', ')')
    return null
  }

  console.log('[exercises/gif] matched', JSON.stringify(name), '→', JSON.stringify(best!.name), '(score:', bestScore, ')')
  return best
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return Response.json({ gif_url: null }, { status: 400 })

  console.log('[exercises/gif] request for:', name)

  // --- Path 1: ExerciseDB via RapidAPI (when key present) ---
  if (RAPIDAPI_KEY) {
    try {
      const encoded = encodeURIComponent(name.toLowerCase())
      const res = await fetch(
        `https://${EXERCISEDB_HOST}/exercises/name/${encoded}?limit=1&offset=0`,
        {
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': EXERCISEDB_HOST,
          },
        }
      )
      if (res.ok) {
        const data = await res.json()
        const gifUrl: string | null =
          Array.isArray(data) && data.length > 0 ? data[0].gifUrl : null
        console.log('[exercises/gif] ExerciseDB →', gifUrl ?? 'null')
        if (gifUrl) return Response.json({ gif_url: gifUrl })
        console.log('[exercises/gif] ExerciseDB returned no match, falling back')
      } else {
        console.warn('[exercises/gif] ExerciseDB status', res.status, '— falling back')
      }
    } catch (err) {
      console.error('[exercises/gif] ExerciseDB error:', err, '— falling back')
    }
  }

  // --- Path 2: GitHub-hosted free exercise DB (no key, no IP restrictions) ---
  try {
    const db = await loadExerciseDB()
    const match = findBestMatch(name, db)

    if (!match) {
      return Response.json({ gif_url: null })
    }

    // Use the first image (0.jpg = start position). Some exercises have a second (1.jpg = end).
    const imageUrl = `${FREE_IMG_BASE}/${match.images[0]}`
    console.log('[exercises/gif] image URL:', imageUrl)
    return Response.json({ gif_url: imageUrl })
  } catch (err) {
    console.error('[exercises/gif] free DB error:', err)
    return Response.json({ gif_url: null })
  }
}
