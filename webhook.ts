import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PADDLE_PRICE_PLANS: Record<string, string> = {
  'pri_01ktkyghkqyja64dehh3cwj04v': 'starter',
  'pri_01ktkyhnvrbd671eh8ktmm6dxy': 'growth',
  'pri_01ktkyjpzqv74qbxr1mmv1hnng': 'pro',
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()

    // Only handle completed transactions
    if (payload.event_type !== 'transaction.completed') {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    const email = payload.data?.customer?.email
    const priceId = payload.data?.items?.[0]?.price?.id
    const subscriptionId = payload.data?.id

    if (!email || !priceId) {
      return new Response(JSON.stringify({ error: 'Missing email or priceId' }), { status: 400 })
    }

    const plan = PADDLE_PRICE_PLANS[priceId] || 'starter'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Create user if not exists
    let userId: string | undefined

    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const found = existingUser?.users?.find((u: any) => u.email === email)

    if (found) {
      userId = found.id
      // Update their plan if they upgraded
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        plan,
        paddle_subscription_id: subscriptionId
      })
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { plan }
      })

      if (createError) {
        console.error('Create user error:', createError)
        return new Response(JSON.stringify({ error: createError.message }), { status: 400 })
      }

      userId = newUser.user?.id

      // Create profile
      await supabase.from('profiles').insert({
        id: userId,
        email,
        plan,
        paddle_subscription_id: subscriptionId
      })
    }

    // Send magic link to user
    const redirectUrl = `https://content-floww.github.io/contentflow/platform-${plan}.html`
    const { error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: redirectUrl }
    })

    if (linkError) {
      console.error('Magic link error:', linkError)
    }

    return new Response(JSON.stringify({ ok: true, plan, email }), { status: 200 })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
