import { NextRequest } from 'next/server'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const EXERCISEDB_HOST = 'exercisedb.p.rapidapi.com'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return Response.json({ gif_url: null }, { status: 400 })

  if (!RAPIDAPI_KEY) {
    // No API key configured — return null so UI shows placeholder
    return Response.json({ gif_url: null })
  }

  try {
    const encoded = encodeURIComponent(name.toLowerCase())
    const res = await fetch(
      `https://${EXERCISEDB_HOST}/exercises/name/${encoded}?limit=1&offset=0`,
      {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': EXERCISEDB_HOST,
        },
        next: { revalidate: 86400 }, // cache 24 hours
      }
    )

    if (!res.ok) {
      console.warn('[exercises/gif] ExerciseDB returned', res.status, 'for', name)
      return Response.json({ gif_url: null })
    }

    const data = await res.json()
    const gifUrl: string | null = Array.isArray(data) && data.length > 0 ? data[0].gifUrl : null
    return Response.json({ gif_url: gifUrl })
  } catch (err) {
    console.error('[exercises/gif] fetch error:', err)
    return Response.json({ gif_url: null })
  }
}
