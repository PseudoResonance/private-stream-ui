FROM oven/bun:alpine AS builder
COPY package.json bun.lock /opt/
WORKDIR /opt
RUN bun i -p
COPY ./ /opt
# RUN bun run build

# FROM alpine:3
# COPY --from=builder /opt/dist/private-stream-ui /opt/private-stream-ui
ENTRYPOINT ["/usr/bin/env", "bun", "run", "prod"]
