# ==============================================================================
# Multi-stage Dockerfile cho Next.js Standalone (Tối ưu Production & Kích thước nhẹ)
# ==============================================================================

# 1. Base Image
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production

# 2. Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --legacy-peer-deps

# 3. Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Khởi tạo Prisma Client cho Linux Alpine
RUN npx prisma generate

# Build ứng dụng ở chế độ standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 4. Runner (Production container tối ưu < 150MB)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Tạo người dùng non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy tài nguyên tĩnh và standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

# Health check định kỳ qua endpoint /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
