import { NextRequest } from 'next/server'

// Temporary diagnostic route — visit /api/exercises/test in browser to check YouTube API connectivity
export async function GET(_req: NextRequest) {
  const key = process.env.YOUTUBE_API_KEY

  if (!key) {
    return Response.json({
      status: 'error',
      message: 'YOUTUBE_API_KEY is not set in environment variables',
      env_keys_present: Object.keys(process.env).filter(k => k.startsWith('YOUTUBE') || k.startsWith('GOOGLE') || k.startsWith('NEXT')),
    })
  }

  const query = 'squat tutorial'
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'video')
  url.searchParams.set('videoDuration', 'short')
  url.searchParams.set('videoEmbeddable', 'true')
  url.searchParams.set('safeSearch', 'strict')
  url.searchParams.set('maxResults', '1')
  url.searchParams.set('key', key)

  try {
    const response = await fetch(url.toString())
    const data = await response.json()

    return Response.json({
      status: response.ok ? 'ok' : 'error',
      http_status: response.status,
      key_prefix: key.substring(0, 8) + '...',
      query_used: query,
      youtube_response: data,
    })
  } catch (err) {
    return Response.json({
      status: 'exception',
      error: String(err),
      key_prefix: key.substring(0, 8) + '...',
    })
  }
}
