import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { phone, token } = await request.json()

    if (!phone || !token) {
      return NextResponse.json(
        { error: 'Phone and token are required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify the OTP using service role client
    const serviceClient = createRouteHandlerClient(
      { cookies: () => cookieStore },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      }
    )
    
    // Verify phone OTP (use auth API directly since we have user context)
    const { error: verifyError } = await (serviceClient.auth as any).verifyOtp({ 
      phone, 
      token, 
      type: 'sms' 
    })

    if (verifyError) {
      console.error('Phone verification error:', verifyError)
      return NextResponse.json(
        { error: verifyError.message },
        { status: 400 }
      )
    }

    // Mark phone as verified using service role client (bypasses RLS)
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({ phone_verified: true })
      .eq('id', user.id)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    // Return success
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Unexpected error in verify-phone:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}