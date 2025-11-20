import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST: attempt to insert a test review using the service role client (bypasses RLS)
 * Useful for verifying the `reviews` table and required columns.
 * Body (optional): { revieweeId, jobId, bookingId, rating, comment }
 */
export async function POST(request: Request) {
  try {
    const cookieProvider = typeof cookies === 'function' ? () => cookies() : () => cookies
    // Create a service role client so we can bypass RLS for testing
    const serviceClient = createRouteHandlerClient(
      { cookies: cookieProvider },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      }
    )

    const raw = await request.text().catch(() => '')
    let body: any = {}
    try { body = raw ? JSON.parse(raw) : {} } catch (e) { body = {} }

    // If no revieweeId provided, pick any profile id
    let revieweeId = body?.revieweeId || null
    if (!revieweeId) {
      const { data: pData, error: pErr } = await serviceClient.from('profiles').select('id').limit(1).maybeSingle()
      if (pErr) return NextResponse.json({ error: 'Failed to read profiles', details: pErr }, { status: 500 })
      revieweeId = pData?.id || null
    }

    if (!revieweeId) return NextResponse.json({ error: 'No revieweeId available to test' }, { status: 400 })

    const insertPayload = {
      reviewer_id: body?.reviewerId || 'test-reviewer',
      reviewee_id: revieweeId,
      job_id: body?.jobId || null,
      booking_id: body?.bookingId || null,
      rating: typeof body?.rating === 'number' ? body.rating : 5,
      comment: body?.comment || 'Test review from reviews-test endpoint',
    }

    // Insert using service role
    const { data: inserted, error: insertErr } = await serviceClient
      .from('reviews')
      .insert([insertPayload])
      .select('*')
      .single()

    if (insertErr) {
      console.error('reviews-test insert error:', insertErr)
      return NextResponse.json({ error: 'Insert failed', details: insertErr }, { status: 500 })
    }

    // Fetch the inserted row back
    return NextResponse.json({ ok: true, inserted })
  } catch (err) {
    console.error('Unhandled error /api/debug/reviews-test:', err)
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'reviews-test endpoint' })
}
