import { cacheDel } from "@/lib/cache.server";

export function profileCacheKey(userId: string) {
  return `profile:me:${userId}`;
}

export function internalProfileCacheKey(userId: string) {
  return `iprofile:me:${userId}`;
}

export async function invalidateProfileCache(userId: string) {
  await cacheDel([profileCacheKey(userId), internalProfileCacheKey(userId)]);
}
