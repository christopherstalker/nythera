FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY proxy-service/package.json proxy-service/pnpm-lock.yaml proxy-service/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY proxy-service/tsconfig.json ./
COPY proxy-service/src ./src
RUN pnpm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
COPY proxy-service/package.json proxy-service/pnpm-lock.yaml proxy-service/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
