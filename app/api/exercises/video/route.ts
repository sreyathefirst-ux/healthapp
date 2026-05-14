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
    console.error('[youtube] YOUTUBE_API_KEY is not set — check environment variables')
    return Response.json({ error: 'Missing API key', videoId: null, thumbnailUrl: null, title: null })
  }

  const type = typeParam ?? detectType(exercise)
  const query = buildQuery(exercise, gender, type)

  console.log('[youtube] search query:', query)
  console.log('[youtube] calling YouTube API...')

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('q', query)
    url.searchParams.set('type', 'video')
    url.searchParams.set('videoDuration', 'short')
    url.searchParams.set('videoEmbeddable', 'true')
    url.searchParams.set('safeSearch', 'strict')
    url.searchParams.set('maxResults', '1')
    url.searchParams.set('key', YOUTUBE_API_KEY)

    const response = await fetch(url.toString())
    console.log('[youtube] API response status:', response.status)

    const data = await response.json()
    console.log('[youtube] API response body:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('[youtube] YouTube API error:', response.status, data?.error?.message)
      return Response.json({ error: data?.error?.message ?? 'YouTube API error', videoId: null, thumbnailUrl: null, title: null })
    }

    const item = data.items?.[0]
    if (!item) {
      console.log('[youtube] no results returned for query:', query)
      return Response.json({ videoId: null, thumbnailUrl: null, title: null })
    }

    const videoId: string = item.id.videoId
    const thumbnailUrl: string =
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.default?.url
    const title: string = item.snippet.title

    console.log('[youtube] videoId found:', videoId)
    console.log('[youtube] thumbnailUrl:', thumbnailUrl)
    console.log('[youtube] title:', title)
    console.log('[youtube] === DONE ===')

    return Response.json({ videoId, thumbnailUrl, title })
  } catch (err) {
    console.error('[youtube] fetch exception:', err)
    return Response.json({ error: String(err), videoId: null, thumbnailUrl: null, title: null })
  }
}
