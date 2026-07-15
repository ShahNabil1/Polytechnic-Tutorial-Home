import { createMiddleware } from "@tanstack/react-start";
import { getFreshSession } from "@/lib/auth-reliability";

export const attachReliableSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const session = await getFreshSession().catch(() => null);
  const token = session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});