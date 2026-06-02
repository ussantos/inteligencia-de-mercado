// Identifica um visitante sem exigir login.
// O navegador envia um id anonimo no header; se ele faltar, usamos o IP como fallback simples.
export function anonymousUserId(request: Request) {
  const explicit = request.headers.get('x-visitor-id') || '';
  const cleanExplicit = explicit.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  if (cleanExplicit) return `visitor:${cleanExplicit}`;

  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'public';
  return `anonymous:${ip.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 80)}`;
}
