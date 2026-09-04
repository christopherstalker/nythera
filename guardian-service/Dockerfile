FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY guardian-service/package.json guardian-service/pnpm-lock.yaml guardian-service/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY guardian-service/tsconfig.json ./
COPY guardian-service/src ./src
RUN pnpm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
COPY guardian-service/package.json guardian-service/pnpm-lock.yaml guardian-service/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4100
CMD ["node", "dist/server.js"]
