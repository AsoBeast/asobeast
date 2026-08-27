FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV TURBO_TELEMETRY_DISABLED=1
RUN corepack enable && apk add --no-cache libc6-compat

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@^2 prune web --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG CI
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm turbo run build --filter=web

FROM base AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
