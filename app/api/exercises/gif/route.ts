import { NextRequest } from 'next/server'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const EXERCISEDB_HOST = 'exercisedb.p.rapidapi.com'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return Response.json({ gif_url: null }, { status: 400 })

  console.log('[exercises/gif] requested:', name, '| has RapidAPI key:', !!RAPIDAPI_KEY)

  // --- Path 1: ExerciseDB via RapidAPI ---
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
          next: { revalidate: 86400 },
        }
      )
      if (res.ok) {
        const data = await res.json()
        const gifUrl: string | null = Array.isArray(data) && data.length > 0 ? data[0].gifUrl : null
        console.log('[exercises/gif] ExerciseDB result for', name, '→', gifUrl ?? 'null')
        if (gifUrl) return Response.json({ gif_url: gifUrl })
      } else {
        console.warn('[exercises/gif] ExerciseDB returned', res.status, 'for', name, '— falling back to wger')
      }
    } catch (err) {
      console.error('[exercises/gif] ExerciseDB fetch error:', err, '— falling back to wger')
    }
  }

  // --- Path 2: wger.de (free, no key needed) ---
  try {
    const term = encodeURIComponent(name)
    const searchUrl = `https://wger.de/api/v2/exercise/search/?term=${term}&language=english&format=json`
    console.log('[exercises/gif] wger search URL:', searchUrl)

    const searchRes = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 86400 },
    })

    if (!searchRes.ok) {
      console.warn('[exercises/gif] wger search returned', searchRes.status, 'for', name)
      return Response.json({ gif_url: null })
    }

    const searchData = await searchRes.json()
    console.log('[exercises/gif] wger suggestions count:', searchData.suggestions?.length ?? 0, 'for', name)

    const first = searchData.suggestions?.[0]

    // The search response often includes an image URL directly
    if (first?.data?.image) {
      console.log('[exercises/gif] wger direct image for', name, '→', first.data.image)
      return Response.json({ gif_url: first.data.image })
    }

    const baseId: number | undefined = first?.data?.base_id ?? first?.data?.id
    if (!baseId) {
      console.warn('[exercises/gif] wger no base_id found for', name)
      return Response.json({ gif_url: null })
    }

    // Fetch the exercise image from the image endpoint
    const imgUrl = `https://wger.de/api/v2/exerciseimage/?exercise_base=${baseId}&format=json`
    console.log('[exercises/gif] wger image endpoint:', imgUrl)

    const imgRes = await fetch(imgUrl, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 86400 },
    })

    if (!imgRes.ok) {
      console.warn('[exercises/gif] wger image endpoint returned', imgRes.status)
      return Response.json({ gif_url: null })
    }

    const imgData = await imgRes.json()
    const imageUrl: string | null =
      imgData.results?.find((r: { is_main: boolean }) => r.is_main)?.image ??
      imgData.results?.[0]?.image ??
      null

    console.log('[exercises/gif] wger final image for', name, '→', imageUrl ?? 'null')
    return Response.json({ gif_url: imageUrl })
  } catch (err) {
    console.error('[exercises/gif] wger fetch error for', name, ':', err)
    return Response.json({ gif_url: null })
  }
}
