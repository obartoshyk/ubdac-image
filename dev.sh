#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$ROOT/.pids"
LOG_DIR="$ROOT/.logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GRN}▶${NC} $*"; }
warn()  { echo -e "${YLW}⚠${NC}  $*"; }
err()   { echo -e "${RED}✗${NC} $*" >&2; }

# ── Helpers ───────────────────────────────────────────────────────

is_running() {
  local f="$PID_DIR/$1.pid"
  [[ -f "$f" ]] && kill -0 "$(cat "$f")" 2>/dev/null
}

ensure_deps() {
  local dir="$1"
  if [[ ! -d "$dir/node_modules" ]]; then
    info "Installing deps in $dir..."
    (cd "$dir" && npm install)
  fi
}

ensure_env() {
  if [[ ! -f "$ROOT/server/.env" ]]; then
    cp "$ROOT/server/.env.example" "$ROOT/server/.env"
    warn "Created server/.env from .env.example — set JWT_SECRET before production use"
  fi
}

free_port() {
  # Kill anything holding the port — handles stale processes from previous runs
  local port="$1"
  if fuser "$port/tcp" &>/dev/null 2>&1; then
    warn "Port $port is in use — force-releasing..."
    fuser -k "$port/tcp" 2>/dev/null || true
    sleep 0.3
  fi
}

start_proc() {
  local name="$1" dir="$2" port="$3"; shift 3
  if is_running "$name"; then
    warn "$name already running (PID $(cat "$PID_DIR/$name.pid"))"
    return
  fi
  free_port "$port"
  : >"$LOG_DIR/$name.log"   # truncate log on each start
  info "Starting $name..."
  # Run in a new session: setsid makes the process the leader of a new process group.
  # The PID equals the PGID, so the entire tree can be killed with a single kill -- -PGID.
  setsid bash -c 'cd "$1" && shift && exec "$@"' -- "$dir" "$@" \
    >>"$LOG_DIR/$name.log" 2>&1 &
  echo $! >"$PID_DIR/$name.pid"
}

stop_proc() {
  local name="$1" f="$PID_DIR/$1.pid"
  if ! is_running "$name"; then warn "$name is not running"; return; fi
  local pid
  pid=$(cat "$f")
  info "Stopping $name (PID $pid)..."
  # kill -- -PGID sends the signal to the entire process group (including node --watch children)
  kill -TERM -- -"$pid" 2>/dev/null || true
  sleep 0.5
  kill -KILL -- -"$pid" 2>/dev/null || true
  rm -f "$f"
}

wait_for_db() {
  info "Waiting for PostgreSQL..."
  for _ in $(seq 1 30); do
    docker compose exec -T db pg_isready -U ubdac -d ubdac &>/dev/null && return 0
    sleep 1
  done
  err "PostgreSQL did not become ready in time"; exit 1
}

# ── Commands ─────────────────────────────────────────────────────

cmd_start() {
  ensure_env
  ensure_deps "$ROOT/server"
  ensure_deps "$ROOT/client"

  info "Starting PostgreSQL..."
  docker compose up -d
  wait_for_db

  start_proc server "$ROOT/server" 3001 npm run dev
  sleep 1
  start_proc client "$ROOT/client" 5173 npm run dev

  echo
  info "All services started."
  echo -e "  App     → ${GRN}http://localhost:5173${NC}"
  echo -e "  API     → ${GRN}http://localhost:3001${NC}"
  echo -e "  Logs    → ./dev.sh logs [server|client]"
  echo -e "  Status  → ./dev.sh status"
}

cmd_stop() {
  stop_proc client
  stop_proc server
  info "Stopping PostgreSQL..."
  docker compose down
  info "All stopped."
}

cmd_restart() {
  case "${1:-all}" in
    server) stop_proc server; start_proc server "$ROOT/server" 3001 npm run dev ;;
    client) stop_proc client; start_proc client "$ROOT/client" 5173 npm run dev ;;
    db)     info "Restarting DB..."; docker compose restart db; wait_for_db ;;
    all)    cmd_stop; cmd_start ;;
    *)      err "Unknown service: $1  (server|client|db|all)"; exit 1 ;;
  esac
}

cmd_status() {
  echo
  printf "  %-8s  %s\n" "SERVICE" "STATUS"
  printf "  %-8s  %s\n" "-------" "------"

  if docker compose ps db 2>/dev/null | grep -qE "running|Up"; then
    printf "  %-8s  ${GRN}● running${NC}\n" "db"
  else
    printf "  %-8s  ${RED}● stopped${NC}\n" "db"
  fi

  for svc in server client; do
    if is_running "$svc"; then
      printf "  %-8s  ${GRN}● running${NC}  (PID %s)\n" "$svc" "$(cat "$PID_DIR/$svc.pid")"
    else
      printf "  %-8s  ${RED}● stopped${NC}\n" "$svc"
    fi
  done
  echo
}

cmd_logs() {
  local svc="${1:-all}"
  case "$svc" in
    server) tail -f "$LOG_DIR/server.log" ;;
    client) tail -f "$LOG_DIR/client.log" ;;
    all)
      # colour-coded merged tail
      (tail -f "$LOG_DIR/server.log" | sed "s/^/${GRN}[server]${NC} /" &
       tail -f "$LOG_DIR/client.log" | sed "s/^/${YLW}[client]${NC} /" &
       wait)
      ;;
    *) err "Unknown service: $svc  (server|client|all)"; exit 1 ;;
  esac
}

cmd_db_reset() {
  warn "This will WIPE ALL DATA in the database!"
  read -r -p "  Type 'yes' to confirm: " confirm
  [[ "$confirm" == "yes" ]] || { info "Aborted."; exit 0; }
  docker compose down -v
  docker compose up -d
  wait_for_db
  info "Database wiped and ready."
}

# ── Main ─────────────────────────────────────────────────────────

case "${1:-help}" in
  start)    cmd_start ;;
  stop)     cmd_stop ;;
  restart)  cmd_restart "${2:-all}" ;;
  status)   cmd_status ;;
  logs)     cmd_logs "${2:-all}" ;;
  db-reset) cmd_db_reset ;;
  help|--help|-h)
    echo
    echo "Usage: ./dev.sh <command> [service]"
    echo
    echo "  start                  Start DB + server + client"
    echo "  stop                   Stop everything"
    echo "  restart [service]      Restart all or one: server | client | db | all"
    echo "  status                 Show what is running"
    echo "  logs [service]         Tail logs: server | client | all (default)"
    echo "  db-reset               ⚠ Wipe DB volume and restart"
    echo
    ;;
  *) err "Unknown command: $1"; echo "Run ./dev.sh help"; exit 1 ;;
esac
