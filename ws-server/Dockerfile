# Build stage
FROM rust:latest AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./

RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release

COPY src ./src

RUN touch src/main.rs && \
    cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/cheezypizza-ws-server /usr/local/bin/cheezypizza-ws-server

RUN useradd -r -s /usr/sbin/nologin appuser

ENV PORT=4000

EXPOSE 4000

USER appuser

CMD ["cheezypizza-ws-server"]