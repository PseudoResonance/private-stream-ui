FROM oven/bun:alpine AS builder
COPY package.json bun.lock /opt/
WORKDIR /opt
RUN bun i --frozen-lockfile -p
COPY ./ /opt
RUN bun run build

FROM oven/bun:distroless
WORKDIR /opt
COPY --from=builder /opt/dist/ ./

ENV NODE_ENV=production
ENTRYPOINT ["bun", "index.js"]
