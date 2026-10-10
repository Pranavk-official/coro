FROM node:24-alpine AS build
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
# generate needs the var present (no connection); runtime uses .env
ENV DATABASE_URL=postgresql://app:app@localhost:5432/app
# public URL baked into metadata, OG tags, robots.txt and sitemap.xml
ARG BETTER_AUTH_URL=http://localhost:3000
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:24-alpine AS runtime
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bunx /usr/local/bin/
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://app:app@localhost:5432/app
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile --production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/generated ./src/generated
COPY server.ts tsconfig.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src/lib/socket.io ./src/lib/socket.io
COPY src/server ./src/server
COPY src/lib ./src/lib
EXPOSE 3000
CMD ["node", "--import", "tsx", "server.ts"]
