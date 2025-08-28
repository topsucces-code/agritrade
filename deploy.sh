#!/bin/bash

# AgriTrade Production Deployment Script
# Usage: ./deploy.sh [environment] [version]

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="agritrade"
ENVIRONMENTS=("development" "staging" "production")
DEFAULT_ENV="development"
DEFAULT_VERSION="latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    echo "Usage: $0 [environment] [version]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (development|staging|production) [default: development]"
    echo "  version       Application version tag [default: latest]"
    echo ""
    echo "Examples:"
    echo "  $0                          # Deploy development with latest version"
    echo "  $0 production v1.2.0        # Deploy production with specific version"
    echo "  $0 staging                  # Deploy staging with latest version"
    echo ""
    echo "Available commands:"
    echo "  build         Build Docker images"
    echo "  deploy        Deploy services"
    echo "  stop          Stop all services"
    echo "  restart       Restart all services"
    echo "  logs          Show service logs"
    echo "  status        Show service status"
    echo "  backup        Create database backup"
    echo "  restore       Restore database from backup"
    echo "  health        Check system health"
    echo "  cleanup       Clean up unused Docker resources"
}

validate_environment() {
    local env=$1
    for valid_env in "${ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done
    log_error "Invalid environment: $env"
    log_info "Valid environments: ${ENVIRONMENTS[*]}"
    exit 1
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if environment file exists
    if [[ "$ENVIRONMENT" == "production" ]] && [[ ! -f "$SCRIPT_DIR/.env" ]]; then
        log_error "Production .env file not found"
        log_info "Copy .env.template to .env and configure production values"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

build_images() {
    log_info "Building Docker images for $ENVIRONMENT..."
    
    local compose_files="-f docker-compose.yml"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        compose_files="$compose_files -f docker-compose.prod.yml"
    fi
    
    # Set version
    export APP_VERSION="$VERSION"
    export START_TIME="$(date -Iseconds)"
    
    # Build images
    docker-compose $compose_files build --no-cache backend
    
    # Tag images with version
    docker tag "${PROJECT_NAME}_backend:latest" "${PROJECT_NAME}_backend:$VERSION"
    
    log_success "Images built successfully"
}

deploy_services() {
    log_info "Deploying services for $ENVIRONMENT..."
    
    local compose_files="-f docker-compose.yml"
    local profiles=""
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        compose_files="$compose_files -f docker-compose.prod.yml"
        profiles="--profile monitoring --profile logging"
    fi
    
    # Set environment variables
    export APP_VERSION="$VERSION"
    export START_TIME="$(date -Iseconds)"
    
    # Create necessary directories
    mkdir -p logs uploads ssl config
    
    # Deploy core services
    log_info "Starting core services..."
    docker-compose $compose_files up -d mongodb redis
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 30
    
    # Deploy application services
    log_info "Starting application services..."
    docker-compose $compose_files up -d backend nginx
    
    # Deploy monitoring services (production only)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "Starting monitoring services..."
        docker-compose $compose_files $profiles up -d
    fi
    
    # Wait for services to start
    sleep 10
    
    # Verify deployment
    if verify_deployment; then
        log_success "Deployment completed successfully"
    else
        log_error "Deployment verification failed"
        show_logs
        exit 1
    fi
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    local backend_url="http://localhost:3000"
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$backend_url/health" > /dev/null; then
            log_success "Backend health check passed"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: Waiting for backend to be ready..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Backend health check failed after $max_attempts attempts"
    return 1
}

stop_services() {
    log_info "Stopping services..."
    
    local compose_files="-f docker-compose.yml"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        compose_files="$compose_files -f docker-compose.prod.yml"
    fi
    
    docker-compose $compose_files down
    log_success "Services stopped"
}

restart_services() {
    log_info "Restarting services..."
    stop_services
    deploy_services
}

show_logs() {
    local service=${1:-backend}
    local compose_files="-f docker-compose.yml"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        compose_files="$compose_files -f docker-compose.prod.yml"
    fi
    
    docker-compose $compose_files logs -f --tail=100 "$service"
}

show_status() {
    log_info "Service status:"
    
    local compose_files="-f docker-compose.yml"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        compose_files="$compose_files -f docker-compose.prod.yml"
    fi
    
    docker-compose $compose_files ps
}

create_backup() {
    log_info "Creating database backup..."
    
    local backup_name="agritrade_backup_$(date +%Y%m%d_%H%M%S)"
    local backup_dir="./backups"
    
    mkdir -p "$backup_dir"
    
    # MongoDB backup
    docker-compose exec -T mongodb mongodump \
        --authenticationDatabase admin \
        -u "$MONGODB_ROOT_USERNAME" \
        -p "$MONGODB_ROOT_PASSWORD" \
        --db "$MONGODB_DATABASE" \
        --archive="/tmp/$backup_name.archive"
    
    # Copy backup from container
    docker cp "$(docker-compose ps -q mongodb):/tmp/$backup_name.archive" "$backup_dir/"
    
    # Compress backup
    gzip "$backup_dir/$backup_name.archive"
    
    log_success "Backup created: $backup_dir/$backup_name.archive.gz"
}

restore_backup() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file path required"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warning "This will restore the database from backup: $backup_file"
    log_warning "This operation cannot be undone!"
    
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Backup restore cancelled"
        exit 0
    fi
    
    log_info "Restoring database from backup..."
    
    # Copy backup to container
    docker cp "$backup_file" "$(docker-compose ps -q mongodb):/tmp/restore.archive.gz"
    
    # Extract and restore
    docker-compose exec -T mongodb bash -c "
        gunzip /tmp/restore.archive.gz &&
        mongorestore \
            --authenticationDatabase admin \
            -u \"$MONGODB_ROOT_USERNAME\" \
            -p \"$MONGODB_ROOT_PASSWORD\" \
            --db \"$MONGODB_DATABASE\" \
            --drop \
            --archive=/tmp/restore.archive
    "
    
    log_success "Database restored successfully"
}

check_health() {
    log_info "Checking system health..."
    
    local health_url="http://localhost:3000/health/full"
    
    if curl -f -s "$health_url" | jq -r '.data.status' | grep -q "healthy"; then
        log_success "System health check passed"
    else
        log_error "System health check failed"
        curl -s "$health_url" | jq '.'
        exit 1
    fi
}

cleanup_docker() {
    log_info "Cleaning up Docker resources..."
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (be careful with this)
    read -p "Remove unused volumes? This may delete data. (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
    fi
    
    # Remove unused networks
    docker network prune -f
    
    log_success "Docker cleanup completed"
}

# Main script
main() {
    # Parse arguments
    ENVIRONMENT="${1:-$DEFAULT_ENV}"
    VERSION="${2:-$DEFAULT_VERSION}"
    COMMAND="$1"
    
    # Handle special commands
    case "$COMMAND" in
        help|--help|-h)
            show_usage
            exit 0
            ;;
        build)
            ENVIRONMENT="${2:-$DEFAULT_ENV}"
            VERSION="${3:-$DEFAULT_VERSION}"
            validate_environment "$ENVIRONMENT"
            check_prerequisites
            build_images
            exit 0
            ;;
        stop)
            ENVIRONMENT="${2:-$DEFAULT_ENV}"
            validate_environment "$ENVIRONMENT"
            stop_services
            exit 0
            ;;
        restart)
            ENVIRONMENT="${2:-$DEFAULT_ENV}"
            validate_environment "$ENVIRONMENT"
            check_prerequisites
            restart_services
            exit 0
            ;;
        logs)
            ENVIRONMENT="${2:-$DEFAULT_ENV}"
            SERVICE="${3:-backend}"
            validate_environment "$ENVIRONMENT"
            show_logs "$SERVICE"
            exit 0
            ;;
        status)
            ENVIRONMENT="${2:-$DEFAULT_ENV}"
            validate_environment "$ENVIRONMENT"
            show_status
            exit 0
            ;;
        backup)
            ENVIRONMENT="${2:-$DEFAULT_ENV}"
            validate_environment "$ENVIRONMENT"
            create_backup
            exit 0
            ;;
        restore)
            ENVIRONMENT="${2:-$DEFAULT_ENV}"
            BACKUP_FILE="$3"
            validate_environment "$ENVIRONMENT"
            restore_backup "$BACKUP_FILE"
            exit 0
            ;;
        health)
            ENVIRONMENT="${2:-$DEFAULT_ENV}"
            validate_environment "$ENVIRONMENT"
            check_health
            exit 0
            ;;
        cleanup)
            cleanup_docker
            exit 0
            ;;
    esac
    
    # Default deployment flow
    validate_environment "$ENVIRONMENT"
    check_prerequisites
    
    log_info "Starting deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    
    build_images
    deploy_services
    
    log_success "Deployment completed!"
    log_info "Backend URL: http://localhost:3000"
    log_info "API Docs: http://localhost:3000/docs"
    log_info "Health Check: http://localhost:3000/health"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "Grafana: http://localhost:3001"
        log_info "Prometheus: http://localhost:9090"
        log_info "Kibana: http://localhost:5601"
    fi
}

# Run main function
main "$@"