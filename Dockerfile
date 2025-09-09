# -----------------
# 1) Builder
# -----------------
FROM node:20-alpine AS builder
WORKDIR /app

# deps first (better caching)
COPY package*.json ./
COPY pnpm-lock.yaml* ./
COPY yarn.lock* ./
RUN npm install

# app files
COPY . .

# build (API routes marked dynamic in code so they don't execute at build)
RUN npm run build

# -----------------
# 2) Runner
# -----------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# minimal runtime files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# ❌ do NOT copy next.config.js if it doesn't exist
# If you really have one and need it at runtime, uncomment the right line:
# COPY --from=builder /app/next.config.mjs ./next.config.mjs
# COPY --from=builder /app/next.config.js ./next.config.js
# COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["npm", "start"]
