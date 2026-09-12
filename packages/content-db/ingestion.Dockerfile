FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY tsconfig.base.json ./
ENV INGESTION_DB_PATH=/data/staging-ingestion.sqlite INGESTION_BIND=0.0.0.0
EXPOSE 8788
CMD ["node", "--import", "tsx", "packages/content-db/src/ingestion/cli.ts", "serve"]
