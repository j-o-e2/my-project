import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest, context: any) {
  try {
    let params = context?.params
    if (params && typeof params.then === 'function') params = await params
    const id = params?.id
    if (!id) return NextResponse.json({ error: 'Missing application id' }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: cookieStore as any })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch application to verify ownership and status
    const { data: appRow, error: appErr } = await supabase.from('job_applications').select('id, provider_id, status, client_contact_revealed').eq('id', id).maybeSingle()
    if (appErr) {
      console.error('Error fetching application for reveal:', appErr)
      return NextResponse.json({ error: 'Failed to fetch application' }, { status: 500 })
    }
    if (!appRow) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

    if (appRow.provider_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (appRow.status !== 'accepted') return NextResponse.json({ error: 'Application must be accepted to reveal contact' }, { status: 400 })

    if (appRow.client_contact_revealed) return NextResponse.json({ success: true, alreadyRevealed: true })

    const { data: updated, error: updateErr } = await supabase.from('job_applications').update({ client_contact_revealed: true, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (updateErr) {
      console.error('Failed to set client_contact_revealed:', updateErr)
      return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
    }

    return NextResponse.json({ success: true, application: updated })
  } catch (err) {
    console.error('Error in reveal endpoint:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
