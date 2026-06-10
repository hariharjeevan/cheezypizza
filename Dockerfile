# Stage 1: Dependencies
FROM node:lts-alpine AS deps

RUN apk add --no-cache pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:lts-alpine AS builder

RUN apk add --no-cache pnpm

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# Stage 3: Runner
FROM node:lts-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]