/**
 * In-memory sliding window rate limiter (Tối đa 30 request/phút/IP)
 */

const ipRequestMap = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

export function checkRateLimit(
  ip: string,
  limit: number = 30,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Lấy danh sách timestamp các request gần đây của IP
  const timestamps = ipRequestMap.get(ip) || [];
  const validTimestamps = timestamps.filter((t) => t > windowStart);

  if (validTimestamps.length >= limit) {
    const oldest = validTimestamps[0];
    const resetMs = Math.max(1000, oldest + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.ceil(resetMs / 1000),
    };
  }

  validTimestamps.push(now);
  ipRequestMap.set(ip, validTimestamps);

  // Cơ chế dọn rác tự động (Garbage collection) khi map lớn
  if (ipRequestMap.size > 1000) {
    ipRequestMap.forEach((list, storedIp) => {
      if (list.length === 0 || list[list.length - 1] <= windowStart) {
        ipRequestMap.delete(storedIp);
      }
    });
  }

  return {
    allowed: true,
    remaining: limit - validTimestamps.length,
    resetSeconds: Math.ceil(windowMs / 1000),
  };
}
