FROM oven/bun:alpine AS builder
COPY package.json bun.lock /opt/
WORKDIR /opt
RUN bun i --frozen-lockfile
COPY ./ /opt
RUN bun run build
RUN bun run bundle

FROM oven/bun:slim
WORKDIR /opt
COPY --from=builder /opt/dist/ ./dist/
COPY --from=builder /opt/bundle/ ./src/

ENV NODE_ENV=production
ENTRYPOINT ["bun", "run", "./src/index.js"]
