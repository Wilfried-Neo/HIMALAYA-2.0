import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!allowedOrigin || req.headers.get('origin') !== allowedOrigin) {
    return json({ error: 'Origine non autorisée.' }, 403);
  }

  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!turnstileSecret || !supabaseUrl || !serviceKey) {
    return json({ error: 'Le service de commande n’est pas configuré.' }, 503);
  }

  try {
    const raw = await req.text();
    if (raw.length > 30_000) return json({ error: 'Requête trop volumineuse.' }, 413);
    const body = JSON.parse(raw);
    const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
    if (!token || token.length > 2048) return json({ error: 'Vérification antispam requise.' }, 400);

    const verifyBody = new URLSearchParams({ secret: turnstileSecret, response: token });
    const ip = req.headers.get('cf-connecting-ip');
    if (ip) verifyBody.set('remoteip', ip);
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: verifyBody,
    });
    const result = await verification.json();
    const expectedHost = new URL(allowedOrigin).hostname;
    if (!result.success || result.hostname !== expectedHost) {
      return json({ error: 'La vérification antispam a échoué. Réessayez.' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.rpc('create_himalaya_order', {
      p_customer: body.customer,
      p_mode: body.mode,
      p_zone: body.zone || '',
      p_date: body.date,
      p_slot: body.slot,
      p_items: body.items,
    });
    if (error) return json({ error: error.message || 'La commande n’a pas pu être enregistrée.' }, 400);
    return json({ order: data }, 200);
  } catch {
    return json({ error: 'Impossible de traiter la commande. Réessayez.' }, 400);
  }

  function json(value: unknown, status: number) {
    return new Response(JSON.stringify(value), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
});
