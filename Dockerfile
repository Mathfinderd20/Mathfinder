# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.19.0
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /usr/src/app

# Copy every workspace manifest so npm can resolve local package links.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/content-db/package.json packages/content-db/package.json
COPY packages/rules-data/package.json packages/rules-data/package.json
COPY packages/rules-engine/package.json packages/rules-engine/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev \
    --workspace @mathfinder/web --workspace @mathfinder/rules-data \
    --workspace @mathfinder/rules-engine --include-workspace-root=false

COPY tsconfig.base.json ./
COPY scripts/split-runtime-content.mjs scripts/split-runtime-content.mjs
COPY apps/web/ apps/web/
COPY packages/rules-data/ packages/rules-data/
COPY packages/rules-engine/ packages/rules-engine/

# Optional public frontend configuration; local-only mode is the default.
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_PUBLISHABLE_KEY=""
RUN npm run build:web

FROM nginx:stable-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/apps/web/dist/ /usr/share/nginx/html/
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
