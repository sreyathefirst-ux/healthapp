import { NextRequest } from 'next/server'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

function detectType(exerciseName: string): string {
  const n = exerciseName.toLowerCase()
  if (n.includes('yoga') || n.includes('warrior') || n.includes('downward') || n.includes('child') || n.includes('cobra')) return 'yoga'
  if (n.includes('pilates') || n.includes('reformer') || n.includes('hundred')) return 'pilates'
  if (n.includes('stretch') || n.includes('flexibility') || n.includes('foam roll') || n.includes('mobility')) return 'stretching'
  if (n.includes('cardio') || n.includes('hiit') || n.includes('jump') || n.includes('burpee') || n.includes('sprint') || n.includes('run')) return 'cardio'
  return 'strength'
}

function buildQuery(exercise: string, gender: string, type: string): string {
  switch (type) {
    case 'yoga':      return `${exercise} yoga pose tutorial`
    case 'pilates':   return `${exercise} pilates tutorial how to`
    case 'stretching':return `${exercise} stretch how to`
    case 'cardio':    return `${exercise} cardio workout tutorial`
    default:          return `${gender} ${exercise} proper form tutorial`
  }
}

export async function GET(req: NextRequest) {
  const exercise = req.nextUrl.searchParams.get('exercise')
  if (!exercise) return Response.json({ error: 'Missing exercise param' }, { status: 400 })

  const gender = req.nextUrl.searchParams.get('gender') === 'female' ? 'female' : 'male'
  const typeParam = req.nextUrl.searchParams.get('type')
  const type = typeParam ?? detectType(exercise)
  const q = buildQuery(exercise, gender, type)

  console.log('[exercises/video] search:', JSON.stringify(q))

  if (!YOUTUBE_API_KEY) {
    console.warn('[exercises/video] YOUTUBE_API_KEY not set')
    return Response.json({ videoId: null, thumbnailUrl: null, title: null })
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('q', q)
    url.searchParams.set('type', 'video')
    url.searchParams.set('videoDuration', 'short')
    url.searchParams.set('videoEmbeddable', 'true')
    url.searchParams.set('safeSearch', 'strict')
    url.searchParams.set('maxResults', '1')
    url.searchParams.set('key', YOUTUBE_API_KEY)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const err = await res.text()
      console.error('[exercises/video] YouTube API error', res.status, err.slice(0, 300))
      return Response.json({ videoId: null, thumbnailUrl: null, title: null })
    }

    const data = await res.json()
    const item = data.items?.[0]
    if (!item) {
      console.log('[exercises/video] no results for:', q)
      return Response.json({ videoId: null, thumbnailUrl: null, title: null })
    }

    const videoId: string = item.id.videoId
    const thumbnailUrl: string =
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.default?.url
    const title: string = item.snippet.title

    console.log('[exercises/video] found:', videoId, '|', title.slice(0, 60))
    return Response.json({ videoId, thumbnailUrl, title })
  } catch (err) {
    console.error('[exercises/video] fetch error:', err)
    return Response.json({ videoId: null, thumbnailUrl: null, title: null })
  }
}
