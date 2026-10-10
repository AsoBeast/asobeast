FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV TURBO_TELEMETRY_DISABLED=1
RUN corepack enable && apk add --no-cache libc6-compat openssl

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@^2 prune api --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=api
RUN find /repo/node_modules/.pnpm -path '*@tesseract.js-data*' -name 4.0.0 -type d -prune -exec rm -rf {} +
RUN rm -rf /repo/node_modules/.pnpm/@react-email+ui@* /repo/node_modules/.pnpm/next@* /repo/node_modules/.pnpm/@next+*

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=builder --chown=node:node /repo .
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && exec node dist/main.js"]
