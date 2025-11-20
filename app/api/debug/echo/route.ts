import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const hdrs: Record<string, string | null> = {}
    for (const [k, v] of request.headers.entries()) hdrs[k] = v

    let raw = ''
    try {
      raw = await request.text()
    } catch (e) {
      raw = ''
    }

    // Attempt to parse JSON if present
    let body: any = null
    try {
      body = raw ? JSON.parse(raw) : null
    } catch (e) {
      body = { raw }
    }

    // Inspect cookies helper shape
    const cookieShape = typeof cookies === 'function' ? 'function' : typeof cookies
    let cookiePreview: any = null
    try {
      const cs = (typeof cookies === 'function' ? cookies() : cookies) as any
      cookiePreview = {
        hasGet: !!(cs && typeof cs.get === 'function'),
        keys: cs && typeof cs.keys === 'function' ? cs.keys() : null,
      }
    } catch (e) {
      cookiePreview = { error: String(e) }
    }

    console.log('[DEBUG /api/debug/echo] headers:', hdrs)
    console.log('[DEBUG /api/debug/echo] cookieShape:', cookieShape, 'cookiePreview:', cookiePreview)
    console.log('[DEBUG /api/debug/echo] raw length:', raw?.length)

    return NextResponse.json({ headers: hdrs, body, raw: raw?.slice(0, 10000), cookieShape, cookiePreview })
  } catch (err) {
    console.error('Unhandled error /api/debug/echo:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'echo endpoint' })
}
