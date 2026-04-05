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
    @echo "  just server   # start the backend"
    @echo "  just web      # start the web dev server"
    @echo "  just scan     # push tasks (re-run whenever knowledge base changes)"
