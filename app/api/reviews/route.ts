import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Force dynamic so we can access cookies/session
export const dynamic = 'force-dynamic'

// GET: /api/reviews?bookingId=...&jobId=...&userId=...
export async function GET(request: Request) {
  try {
    // Make cookies usage robust: allow either the `cookies` function or a cookies object
    const cookieProvider = typeof cookies === 'function' ? () => cookies() : () => cookies
    console.log('[DEBUG GET /api/reviews] cookies typeof:', typeof cookies)
    try {
      const maybeCookies = cookieProvider();
      console.log('[DEBUG GET /api/reviews] cookies() shape:', maybeCookies && typeof (maybeCookies as any).get === 'function' ? 'has-get' : typeof maybeCookies)
    } catch (e) {
      console.warn('[DEBUG GET /api/reviews] cookies provider call failed:', e)
    }
    const supabase = createRouteHandlerClient({ cookies: cookieProvider })
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')
    const bookingId = url.searchParams.get('bookingId')
    const userId = url.searchParams.get('userId')

    let query = supabase
      .from('reviews')
      .select(`
        *,
        reviewer:profiles!reviewer_id ( id, full_name, avatar_url ),
        reviewee:profiles!reviewee_id ( id, full_name, avatar_url )
      `)

    if (jobId) query = query.eq('job_id', jobId)
    if (bookingId) query = query.eq('booking_id', bookingId)
    if (userId) query = query.or(`reviewer_id.eq.${userId},reviewee_id.eq.${userId}`)

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error GET /api/reviews:', error)
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Unhandled error GET /api/reviews:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST: create a new review (authenticated route)
export async function POST(request: Request) {
  try {
    // Make cookies usage robust and add detailed debug info
    const cookieProvider = typeof cookies === 'function' ? () => cookies() : () => cookies
    console.log('[DEBUG POST /api/reviews] cookies typeof:', typeof cookies)
    try {
      const maybeCookies = cookieProvider();
      console.log('[DEBUG POST /api/reviews] cookies() shape:', maybeCookies && typeof (maybeCookies as any).get === 'function' ? 'has-get' : typeof maybeCookies)
    } catch (e) {
      console.warn('[DEBUG POST /api/reviews] cookies provider call failed:', e)
    }
    const supabase = createRouteHandlerClient({ cookies: cookieProvider })

    // Log content-type and authorization presence to help debug empty body issues
    console.log('[DEBUG POST /api/reviews] content-type:', request.headers.get('content-type'))
    console.log('[DEBUG POST /api/reviews] has Authorization:', !!request.headers.get('authorization'))

    // Also capture raw text to see exactly what the client sent (defensive)
    const rawText = await request.text().catch(() => '')
    let body: any = {}
    try {
      body = rawText ? JSON.parse(rawText) : {}
    } catch (e) {
      console.warn('[DEBUG POST /api/reviews] failed to parse JSON body, rawText length:', (rawText || '').length)
      body = {}
    }
    const { revieweeId, jobId, bookingId, rating, comment } = body || {}

    console.log('[DEBUG POST /api/reviews] Request body:', { revieweeId, jobId, bookingId, rating, comment })

    if (!revieweeId) {
      console.log('[DEBUG POST /api/reviews] Missing revieweeId:', { revieweeId, jobId, bookingId, rating, comment })
      return NextResponse.json({ error: 'revieweeId is required' }, { status: 400 })
    }
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      console.log('[DEBUG POST /api/reviews] Invalid rating:', { rating, type: typeof rating })
      return NextResponse.json({ error: 'rating must be a number between 1 and 5' }, { status: 400 })
    }

    // Get authenticated user via cookies/session
    let user: any = null
    const { data: { user: sessionUser }, error: userErr } = await supabase.auth.getUser()
    console.log('[DEBUG POST /api/reviews] Auth user (from cookie):', sessionUser?.id, 'Error:', userErr)
    if (userErr) {
      console.error('Auth error POST /api/reviews:', userErr)
      // don't immediately return; we'll attempt fallback token extraction below
    }
    user = sessionUser || null

    // Fallback: if no session user, try extracting user id from Bearer token in Authorization header or body.accessToken
    if (!user) {
      const incomingAuth = request.headers.get('authorization') || ''
      const bodyAccessToken = (body as any)?.accessToken || null
      const token = incomingAuth.startsWith('Bearer ') ? incomingAuth.substring(7) : (bodyAccessToken || null)
      if (token) {
        try {
          const parts = token.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'))
            if (payload?.sub) {
              user = { id: payload.sub }
              console.log('[DEBUG POST /api/reviews] Extracted user from Bearer token:', user.id)
            }
          }
        } catch (e) {
          console.warn('Failed to decode Bearer token in POST /api/reviews fallback:', e)
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Prevent duplicates: same reviewer + job_id OR same reviewer + booking_id
    const dupQuery: any = { reviewer_id: user.id, reviewee_id: revieweeId }
    if (jobId) dupQuery.job_id = jobId
    if (bookingId) dupQuery.booking_id = bookingId

    const { data: existing } = await supabase.from('reviews').select('id').match(dupQuery).single()
    console.log('[DEBUG POST /api/reviews] Duplicate check query:', dupQuery, 'Result:', existing)
    if (existing) {
      return NextResponse.json({ error: 'You have already reviewed this item' }, { status: 400 })
    }

    const insertPayload = {
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      job_id: jobId || null,
      booking_id: bookingId || null,
      rating,
      comment: comment || null,
    }
    console.log('[DEBUG POST /api/reviews] Insert payload:', insertPayload)

    const { data, error } = await supabase
      .from('reviews')
      .insert([insertPayload])
      .select(`
        *,
        reviewer:profiles!reviewer_id ( id, full_name, avatar_url ),
        reviewee:profiles!reviewee_id ( id, full_name, avatar_url )
      `)
      .single()

    console.log('[DEBUG POST /api/reviews] Insert result - Data:', data, 'Error:', error)

    if (error) {
      console.error('Supabase insert error POST /api/reviews:', error)
      return NextResponse.json({ error: 'Failed to create review', details: error }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Unhandled error POST /api/reviews:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : ''
    console.error('Error details:', { message: errMsg, stack: errStack })
    return NextResponse.json({ error: 'Server error', message: errMsg }, { status: 500 })
  }
}