const TESTFLIGHT_URL = "https://testflight.apple.com/join/DCYydfe6";
const BN_FRIEND_FORM = "https://bn-friend-form.favs.workers.dev/";
const APEX_HOST = "whatsupcomi.ng";
const WWW_HOST = "www.whatsupcomi.ng";

const SUPABASE_URL = "https://fmtszjjyadmvvlviecmd.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtdHN6amp5YWRtdnZsdmllY21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzQ3NzQsImV4cCI6MjEwNDA1MDc3NH0.pPNBm1XuyNtsA07GhpCVvHX61jrIm91M6F238SVid8I";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function birthdayNotesToken(url) {
  const nMatch = url.pathname.match(/^\/n\/([^/]+)\/?$/);
  if (nMatch) return decodeURIComponent(nMatch[1]);
  return url.searchParams.get("t");
}

async function handleWaitlist(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "method_not_allowed" });
  }

  let email = "";
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim() : "";
  } catch {
    return jsonResponse(400, { ok: false, error: "invalid_json" });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return jsonResponse(400, { ok: false, error: "invalid_email" });
  }

  const normalized = email.toLowerCase();
  const createdAt = new Date().toISOString();
  const ua = request.headers.get("user-agent") || null;
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    null;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/join_upcoming_waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({
        p_email: normalized,
        p_source: "whatsupcomi.ng",
        p_user_agent: ua,
        p_ip: ip,
      }),
    });
  } catch {
    // Waitlist write is best-effort; the client still gets ok: true.
  }

  if (env.WAITLIST) {
    try {
      const key = `email:${normalized}`;
      const existing = await env.WAITLIST.get(key);
      if (!existing) {
        await env.WAITLIST.put(key, JSON.stringify({ email: normalized, createdAt }));
      }
    } catch {
      // KV is a secondary store; ignore failures.
    }
  }

  return jsonResponse(200, { ok: true });
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);

    if (url.hostname === WWW_HOST) {
      url.hostname = APEX_HOST;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/waitlist") {
      return handleWaitlist(request, env);
    }

    const token = birthdayNotesToken(url);
    if (token) {
      return Response.redirect(
        `${BN_FRIEND_FORM}?t=${encodeURIComponent(token)}`,
        302
      );
    }

    return Response.redirect(TESTFLIGHT_URL, 302);
  },
};
