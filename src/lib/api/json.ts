import "server-only";

/**
 * Media API helpers. Requests must be JSON from this site's own pages: a
 * cross-site form can't send application/json without a CORS preflight,
 * and a foreign Origin header is refused outright (CSRF).
 */
export async function readJson(req: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) {
    return { ok: false, response: Response.json({ error: "בקשה ממקור לא מורשה." }, { status: 403 }) };
  }
  if (req.method !== "DELETE" && !req.headers.get("content-type")?.startsWith("application/json")) {
    return { ok: false, response: Response.json({ error: "יש לשלוח JSON." }, { status: 415 }) };
  }
  if (req.method === "DELETE") return { ok: true, body: {} };
  try {
    const body = await req.json();
    return body && typeof body === "object" ? { ok: true, body } : { ok: false, response: Response.json({ error: "בקשה לא תקינה." }, { status: 400 }) };
  } catch {
    return { ok: false, response: Response.json({ error: "בקשה לא תקינה." }, { status: 400 }) };
  }
}

/** { ok: true, ...data } → 200 JSON of data; { ok: false, status, error } → that status. Never cached. */
export function respond(result: { ok: true } | { ok: false; status: number; error: string }) {
  const headers = { "Cache-Control": "no-store" };
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status, headers });
  const data: Record<string, unknown> = { ...result };
  delete data.ok;
  return Response.json(data, { headers });
}
