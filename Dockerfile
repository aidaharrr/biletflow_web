# BiletFlow web (Next.js) production image.
# Built by ../biletflow/docker-compose.yml; can also run alone:
#   docker build -t biletflow-web . && docker run -p 3000:3000 \
#     -e API_BASE_URL=http://host.docker.internal:8000/api/v1 biletflow-web
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Browser-visible fallback only; the app talks to the API through its server-side gateway.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# API_BASE_URL (server-side gateway target) is read at runtime, e.g. http://api:8000/api/v1.
CMD ["node", "server.js"]
