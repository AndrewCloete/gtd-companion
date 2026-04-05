FROM rust:1.85-slim AS builder

WORKDIR /app

# Cache dependencies — rebuild only when Cargo files change
COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src/bin && \
    echo 'pub mod model;' > src/lib.rs && \
    touch src/model.rs && \
    echo 'fn main() {}' > src/bin/gtd-server.rs && \
    echo 'fn main() {}' > src/bin/gtd-cli.rs && \
    echo 'fn main() {}' > src/bin/gtd-inbox.rs && \
    cargo build --release --bin gtd-server && \
    rm -rf src

COPY src ./src
RUN touch src/bin/gtd-server.rs && \
    cargo build --release --bin gtd-server

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/gtd-server /usr/local/bin/

EXPOSE 10084
CMD ["gtd-server"]
