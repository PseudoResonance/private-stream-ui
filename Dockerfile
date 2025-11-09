FROM oven/bun:alpine AS builder
COPY package.json bun.lock /opt/
WORKDIR /opt
RUN bun i --frozen-lockfile -p
COPY ./ /opt
RUN bun run build

FROM oven/bun:slim
WORKDIR /opt
COPY --from=builder /opt/dist/ ./dist/
COPY --from=builder /opt/src/ ./src/

ENV NODE_ENV=production
ENTRYPOINT ["bun", "run", "./src/index.ts"]
