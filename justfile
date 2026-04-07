# List available recipes
default:
    @just --list

# ── Backend ───────────────────────────────────────────────────────────────────

# Run the GTD HTTP server
server:
    cd backend && cargo run --bin gtd-server

# Scan the knowledge base and push tasks to the server
scan:
    cd backend && cargo run --bin gtd-cli -- -w true

# Scan the bundled Obsidian demo vault (`demo-vault/`) and push to the server
scan-demo:
    cd backend && cargo run --bin gtd-cli -- --dir ../demo-vault -w true

# Shift demo-vault @d/@s/@v/@b dates by (target − anchor); default target is today.
# Anchor is `demo-vault/.gtd-date-anchor` (updated after each run). Example: `just refresh-demo-dates to=20261225`
refresh-demo-dates to="":
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -n "{{to}}" ]; then python3 demo-vault/refresh_demo_vault_dates.py --to "{{to}}"; else python3 demo-vault/refresh_demo_vault_dates.py; fi

# Dump current tasks to JSON (written to /tmp/gtd-out.json)
dump:
    cd backend && cargo run --bin gtd-cli -- -j true | tee /tmp/gtd-out.json

# Check backend for compile errors without building
check:
    cd backend && cargo check

# Install CLI binaries to ~/.cargo/bin
install:
    cd backend && cargo install --path .

# ── Web ───────────────────────────────────────────────────────────────────────

# Start the web dev server with hot-reload
web:
    cd web && npm start

# Build the web app for production
build:
    cd web && npm run build

# Serve the production build locally (vite preview on port 3030)
serve: build
    cd web && npm run preview -- --port 3030

# ── Dev workflow ──────────────────────────────────────────────────────────────

# Reminder: start server + web in separate terminals, then scan
dev:
    @echo "Open three terminals and run:"
    @echo ""
    @echo "  just server    # start the backend"
    @echo "  just web       # start the web dev server"
    @echo "  just refresh-demo-dates   # slide demo date tokens to today (see demo-vault/.gtd-date-anchor)"
    @echo "  just scan-demo            # push tasks from demo-vault/"
    @echo "  just scan      # same, but uses dirs from ~/.gtd.json default_dirs"

# ── Docker ────────────────────────────────────────────────────────────────────

# Build all Docker images
docker-build:
    docker compose build

# Start all services (detached)
docker-up:
    docker compose up -d

# Stop all services
docker-down:
    docker compose down

# Tail logs from all services
docker-logs:
    docker compose logs -f

# Rebuild and restart everything
docker-deploy: docker-build docker-up
