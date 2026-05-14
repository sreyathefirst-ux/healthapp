import { NextRequest } from 'next/server'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

interface VideoResult {
  videoId: string
  thumbnailUrl: string
  title: string
}

const FITNESS_CHANNEL_KEYWORDS = ['fitness', 'yoga', 'pilates', 'health', 'workout', 'training', 'gym', 'exercise', 'sport', 'coach', 'athleti', 'strength', 'bodybuild']
const BAD_TITLE_KEYWORDS = ['extreme', 'beast mode', 'insane', 'crazy', 'epic', 'brutal', 'destroy']

const CATEGORY_FALLBACKS: Record<string, string> = {
  strength:   'proper squat form tutorial',
  pilates:    'pilates beginner tutorial',
  yoga:       'yoga for beginners tutorial',
  cardio:     'cardio workout beginner tutorial',
  stretching: 'full body stretch tutorial',
}

function detectType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('yoga') || n.includes('warrior') || n.includes('downward') || n.includes('child') || n.includes('cobra')) return 'yoga'
  if (n.includes('pilates') || n.includes('reformer') || n.includes('hundred')) return 'pilates'
  if (n.includes('stretch') || n.includes('foam roll') || n.includes('mobility') || n.includes('flexibility')) return 'stretching'
  if (n.includes('cardio') || n.includes('hiit') || n.includes('jump') || n.includes('burpee') || n.includes('sprint')) return 'cardio'
  return 'strength'
}

async function searchYouTube(query: string, key: string): Promise<VideoResult | null> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'video')
  url.searchParams.set('videoDuration', 'short')
  url.searchParams.set('videoEmbeddable', 'true')
  url.searchParams.set('safeSearch', 'strict')
  url.searchParams.set('relevanceLanguage', 'en')
  url.searchParams.set('maxResults', '3')
  url.searchParams.set('key', key)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(`YouTube ${res.status}: ${errBody?.error?.message ?? res.statusText}`)
  }
  const data = await res.json()
  const items: Record<string, unknown>[] = data.items ?? []
  if (items.length === 0) return null

  // Pick best: prefer fitness channel + clean title, fall back to first result
  const pick =
    items.find((item) => {
      const ch = ((item.snippet as Record<string, string>).channelTitle ?? '').toLowerCase()
      const t = ((item.snippet as Record<string, string>).title ?? '').toLowerCase()
      return FITNESS_CHANNEL_KEYWORDS.some((k) => ch.includes(k)) && !BAD_TITLE_KEYWORDS.some((k) => t.includes(k))
    }) ??
    items.find((item) => {
      const t = ((item.snippet as Record<string, string>).title ?? '').toLowerCase()
      return !BAD_TITLE_KEYWORDS.some((k) => t.includes(k))
    }) ??
    items[0]

  const snippet = pick.snippet as Record<string, unknown>
  const thumbs = (snippet.thumbnails as Record<string, { url: string }>) ?? {}
  return {
    videoId: (pick.id as Record<string, string>).videoId,
    thumbnailUrl: thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? '',
    title: snippet.title as string,
  }
}

export async function GET(req: NextRequest) {
  console.log('[youtube] === START ===')

  const exercise = req.nextUrl.searchParams.get('exercise')
  const gender = req.nextUrl.searchParams.get('gender') === 'female' ? 'female' : 'male'
  const typeParam = req.nextUrl.searchParams.get('type')

  console.log('[youtube] exercise name:', exercise)
  console.log('[youtube] gender:', gender)
  console.log('[youtube] YOUTUBE_API_KEY exists:', !!YOUTUBE_API_KEY)
  console.log('[youtube] key prefix:', YOUTUBE_API_KEY?.substring(0, 8))

  if (!exercise) return Response.json({ error: 'Missing exercise param' }, { status: 400 })
  if (!YOUTUBE_API_KEY) {
    console.error('[youtube] YOUTUBE_API_KEY is not set')
    return Response.json({ error: 'Missing API key', videoId: null, thumbnailUrl: null, title: null })
  }

  const type = typeParam ?? detectType(exercise)
  const queries = [
    gender === 'female' ? `female ${exercise} proper form tutorial` : `${exercise} proper form tutorial`,
    `${exercise} how to tutorial`,
    `${exercise} workout`,
    CATEGORY_FALLBACKS[type] ?? `${exercise} exercise tutorial`,
  ]

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i]
    console.log(`[youtube] tier ${i + 1} query:`, q)
    try {
      const result = await searchYouTube(q, YOUTUBE_API_KEY)
      if (result) {
        console.log('[youtube] videoId found:', result.videoId, '| title:', result.title.slice(0, 60))
        console.log('[youtube] === DONE ===')
        return Response.json(result)
      }
      console.log(`[youtube] tier ${i + 1} returned no results, trying next tier`)
    } catch (err) {
      console.error(`[youtube] tier ${i + 1} error:`, err)
      // On API error (e.g. quota exceeded) don't retry — return null immediately
      return Response.json({ videoId: null, thumbnailUrl: null, title: null })
    }
  }

  console.log('[youtube] all tiers exhausted — no video found')
  return Response.json({ videoId: null, thumbnailUrl: null, title: null })
}
