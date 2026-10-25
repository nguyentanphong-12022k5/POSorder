import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Health check endpoint phục vụ Docker healthcheck, Kubernetes liveness/readiness probes,
 * và Uptime monitoring (UptimeRobot, BetterUptime)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let dbStatus: "up" | "down" = "down";
  let dbLatencyMs = 0;
  let dbError: string | null = null;

  try {
    const dbPingStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbPingStart;
    dbStatus = "up";
  } catch (error: any) {
    dbStatus = "down";
    dbError = error?.message || "Không thể kết nối tới cơ sở dữ liệu";
    logger.error("Health check thất bại khi ping Database:", error);
  }

  const totalDurationMs = Date.now() - startTime;
  const isHealthy = dbStatus === "up";
  const memory = process.memoryUsage();

  const healthData = {
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        ...(dbError ? { error: dbError } : {}),
      },
      memory: {
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
      },
    },
    latencyMs: totalDurationMs,
  };

  return NextResponse.json(healthData, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
