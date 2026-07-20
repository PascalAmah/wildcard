FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/server/package.json packages/server/tsconfig.json packages/server/
RUN pnpm install --frozen-lockfile
COPY packages/shared/src packages/shared/src/
COPY packages/server/src packages/server/src/
RUN pnpm --filter @wildcard/shared build
RUN pnpm --filter @wildcard/server build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=builder /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=builder /app/packages/shared/dist /app/packages/shared/dist
COPY --from=builder /app/packages/server/package.json /app/packages/server/package.json
COPY --from=builder /app/packages/server/dist /app/packages/server/dist
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
ENV PORT=3001
EXPOSE 3001
CMD ["node", "packages/server/dist/index.js"]
