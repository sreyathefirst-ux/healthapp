import { NextRequest } from 'next/server'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const EXERCISEDB_HOST = 'exercisedb.p.rapidapi.com'

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

let dbCache: FreeExercise[] | null = null
let dbCacheTime = 0
const DB_TTL_MS = 7 * 24 * 60 * 60 * 1000

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
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1)
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
    if (score > bestScore) { bestScore = score; best = ex }
  }
  if (bestScore < 3) {
    console.log('[exercises/gif] no confident match for:', name, '(best score:', bestScore, ')')
    return null
  }
  console.log('[exercises/gif] matched', JSON.stringify(name), '→', JSON.stringify(best!.name), '(score:', bestScore, ')')
  return best
}

async function fetchExerciseDB(query: string, limit: number): Promise<string | null> {
  if (!RAPIDAPI_KEY) return null
  try {
    const encoded = encodeURIComponent(query.toLowerCase())
    const res = await fetch(
      `https://${EXERCISEDB_HOST}/exercises/name/${encoded}?limit=${limit}&offset=0`,
      { headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': EXERCISEDB_HOST } }
    )
    if (!res.ok) {
      console.warn('[exercises/gif] ExerciseDB status', res.status, 'for query:', query)
      return null
    }
    const data = await res.json()
    const gifUrl = Array.isArray(data) && data.length > 0 ? (data[0].gifUrl ?? null) : null
    console.log('[exercises/gif] ExerciseDB query:', JSON.stringify(query), '→', gifUrl ? 'found' : 'null')
    return gifUrl
  } catch (err) {
    console.error('[exercises/gif] ExerciseDB error:', err)
    return null
  }
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return Response.json({ gif_url: null }, { status: 400 })

  const genderParam = req.nextUrl.searchParams.get('gender')
  const gender: 'male' | 'female' = genderParam === 'female' ? 'female' : 'male'
  console.log('[exercises/gif] request for:', name, '| gender:', gender)

  // --- Path 1: ExerciseDB via RapidAPI ---
  if (RAPIDAPI_KEY) {
    if (gender === 'female') {
      // Try female-specific search first ("women {name}" — ExerciseDB has entries like "women squat")
      const femaleGif = await fetchExerciseDB(`women ${name}`, 5)
      if (femaleGif) return Response.json({ gif_url: femaleGif, is_animated: true })
      // Try alternative female keyword
      const femaleGif2 = await fetchExerciseDB(`female ${name}`, 5)
      if (femaleGif2) return Response.json({ gif_url: femaleGif2, is_animated: true })
    }
    // Male or female fallback: regular search
    const gif = await fetchExerciseDB(name, 5)
    if (gif) return Response.json({ gif_url: gif, is_animated: true })
  }

  // --- Path 2: GitHub-hosted free exercise DB (static JPGs, animate via two frames) ---
  try {
    const db = await loadExerciseDB()
    const match = findBestMatch(name, db)
    if (!match) return Response.json({ gif_url: null })

    const frame1 = `${FREE_IMG_BASE}/${match.images[0]}`
    const frame2 = match.images[1] ? `${FREE_IMG_BASE}/${match.images[1]}` : null
    console.log('[exercises/gif] free DB frames:', frame1, frame2 ?? '(no frame2)')
    return Response.json({ gif_url: frame1, gif_url2: frame2, is_animated: false })
  } catch (err) {
    console.error('[exercises/gif] free DB error:', err)
    return Response.json({ gif_url: null })
  }
}
