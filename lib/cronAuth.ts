export function cronAuthorized(request: Request, secret = process.env.CRON_SECRET): boolean {
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
