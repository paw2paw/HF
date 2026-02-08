#!/bin/bash
#
# HF Admin Development Startup Script
# Usage:
#   ./scripts/dev-start.sh          # Start with Colima (default)
#   ./scripts/dev-start.sh docker   # Start with Docker Desktop
#   ./scripts/dev-start.sh stop     # Stop everything
#   ./scripts/dev-start.sh status   # Check status
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PostgreSQL settings (must match .env DATABASE_URL)
PG_CONTAINER="hf-postgres"
PG_USER="hf_user"
PG_PASSWORD="hf_password"
PG_DB="hf"
PG_PORT="5432"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if a command exists
has_command() {
  command -v "$1" &> /dev/null
}

# Check if Docker is responding
docker_ready() {
  docker info &> /dev/null
}

# Start Colima
start_colima() {
  log_info "Starting Colima (lightweight Docker runtime)..."

  if ! has_command colima; then
    log_error "Colima not installed. Install with: brew install colima"
    exit 1
  fi

  if colima status &> /dev/null; then
    log_success "Colima already running"
  else
    colima start --cpu 2 --memory 2
    log_success "Colima started"
  fi
}

# Start Docker Desktop
start_docker_desktop() {
  log_info "Starting Docker Desktop..."

  if ! [ -d "/Applications/Docker.app" ]; then
    log_error "Docker Desktop not installed"
    exit 1
  fi

  # Check if already running
  if docker_ready; then
    log_success "Docker Desktop already running"
    return
  fi

  open -a Docker

  log_info "Waiting for Docker Desktop to start (this may take a minute)..."
  local count=0
  while ! docker_ready; do
    sleep 2
    count=$((count + 1))
    if [ $count -gt 60 ]; then
      log_error "Docker Desktop failed to start after 2 minutes"
      exit 1
    fi
  done

  log_success "Docker Desktop started"
}

# Start PostgreSQL container
start_postgres() {
  log_info "Starting PostgreSQL container..."

  # Check if container exists
  if docker ps -a --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
    # Container exists, check if running
    if docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
      log_success "PostgreSQL already running"
    else
      docker start "$PG_CONTAINER"
      log_success "PostgreSQL container started"
    fi
  else
    # Create new container with persistent volume
    docker volume create hf-postgres-data 2>/dev/null || true
    docker run -d --name "$PG_CONTAINER" \
      -e POSTGRES_USER="$PG_USER" \
      -e POSTGRES_PASSWORD="$PG_PASSWORD" \
      -e POSTGRES_DB="$PG_DB" \
      -p "$PG_PORT:5432" \
      -v hf-postgres-data:/var/lib/postgresql/data \
      postgres:15
    log_success "PostgreSQL container created with persistent volume"
  fi

  # Wait for PostgreSQL to be ready
  log_info "Waiting for PostgreSQL to be ready..."
  local count=0
  while ! docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" &> /dev/null; do
    sleep 1
    count=$((count + 1))
    if [ $count -gt 30 ]; then
      log_error "PostgreSQL failed to become ready"
      exit 1
    fi
  done

  log_success "PostgreSQL ready on localhost:$PG_PORT"
}

# Run Prisma migrations
run_migrations() {
  log_info "Running Prisma migrations..."
  cd "$PROJECT_DIR"

  if npx prisma migrate deploy 2>/dev/null; then
    log_success "Migrations applied"
  else
    log_warn "Migration failed or no migrations to apply"
  fi
}

# Show status
show_status() {
  echo ""
  echo "=== HF Development Environment Status ==="
  echo ""

  # Check Colima
  if has_command colima && colima status &> /dev/null; then
    log_success "Colima: Running"
  else
    log_warn "Colima: Not running"
  fi

  # Check Docker
  if docker_ready; then
    log_success "Docker: Ready"
  else
    log_error "Docker: Not available"
  fi

  # Check PostgreSQL container
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${PG_CONTAINER}$"; then
    log_success "PostgreSQL Container: Running"
  elif docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${PG_CONTAINER}$"; then
    log_warn "PostgreSQL Container: Stopped"
  else
    log_warn "PostgreSQL Container: Not created"
  fi

  # Check database connectivity
  if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" &> /dev/null; then
    log_success "PostgreSQL: Accepting connections"
  else
    log_error "PostgreSQL: Not accepting connections"
  fi

  # Check HF_KB_PATH
  local kb_path="${HF_KB_PATH:-/Volumes/PAWSTAW/Projects/hf_kb}"
  if [ -d "$kb_path" ]; then
    log_success "HF_KB_PATH: $kb_path (exists)"
  else
    log_error "HF_KB_PATH: $kb_path (NOT FOUND)"
  fi

  echo ""
}

# Stop everything
stop_all() {
  log_info "Stopping development environment..."

  # Stop PostgreSQL container
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${PG_CONTAINER}$"; then
    docker stop "$PG_CONTAINER"
    log_success "PostgreSQL stopped"
  fi

  # Stop Colima if running
  if has_command colima && colima status &> /dev/null; then
    colima stop
    log_success "Colima stopped"
  fi

  log_success "Development environment stopped"
}

# Main
case "${1:-colima}" in
  colima)
    echo ""
    echo "=== Starting HF Development Environment (Colima) ==="
    echo ""
    start_colima
    start_postgres
    run_migrations
    show_status
    echo ""
    log_success "Ready! Run: cd apps/admin && npm run dev"
    echo ""
    ;;
  docker)
    echo ""
    echo "=== Starting HF Development Environment (Docker Desktop) ==="
    echo ""
    start_docker_desktop
    start_postgres
    run_migrations
    show_status
    echo ""
    log_success "Ready! Run: cd apps/admin && npm run dev"
    echo ""
    ;;
  stop)
    stop_all
    ;;
  status)
    show_status
    ;;
  *)
    echo "Usage: $0 [colima|docker|stop|status]"
    echo ""
    echo "  colima  - Start with Colima (default, lightweight)"
    echo "  docker  - Start with Docker Desktop"
    echo "  stop    - Stop all services"
    echo "  status  - Show current status"
    exit 1
    ;;
esac
