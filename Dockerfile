FROM node:24.14.0-alpine AS dependencies

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM node:24.14.0-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
