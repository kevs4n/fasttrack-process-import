#!/bin/bash

# FastTrack Process Import Tool Management Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to build the application
build() {
    print_status "Building FastTrack Process Import Tool..."
    docker-compose build
    print_success "Build completed successfully"
}

# Function to start the application
start() {
    print_status "Starting FastTrack Process Import Tool..."
    check_docker
    docker-compose up -d
    print_success "Application started successfully"
    print_status "Application is available at: http://localhost:8085"
}

# Function to start in development mode
dev() {
    print_status "Starting FastTrack Process Import Tool in development mode..."
    check_docker
    docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
    print_success "Development environment started successfully"
    print_status "Application is available at: http://localhost:8085"
    print_warning "Development mode includes hot-reloading"
}

# Function to start in production mode
prod() {
    print_status "Starting FastTrack Process Import Tool in production mode..."
    check_docker
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    print_success "Production environment started successfully"
    print_status "Application is available at: http://localhost:8085"
}

# Function to stop the application
stop() {
    print_status "Stopping FastTrack Process Import Tool..."
    docker-compose down
    print_success "Application stopped successfully"
}

# Function to restart the application
restart() {
    print_status "Restarting FastTrack Process Import Tool..."
    stop
    start
}

# Function to view logs
logs() {
    docker-compose logs -f "$@"
}

# Function to show status
status() {
    print_status "Application status:"
    docker-compose ps
    echo ""
    print_status "Application health:"
    curl -s http://localhost:8085/health | jq . || echo "Health check failed or jq not installed"
}

# Function to clean up
clean() {
    print_warning "This will remove all containers, images, and volumes related to this project"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up..."
        docker-compose down -v --rmi all
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to backup data
backup() {
    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    print_status "Creating backup in $BACKUP_DIR..."
    
    # Backup data directory
    if [ -d "./data" ]; then
        cp -r ./data "$BACKUP_DIR/"
        print_success "Data backed up to $BACKUP_DIR/data"
    fi
    
    # Backup logs
    if [ -d "./logs" ]; then
        cp -r ./logs "$BACKUP_DIR/"
        print_success "Logs backed up to $BACKUP_DIR/logs"
    fi
    
    print_success "Backup completed: $BACKUP_DIR"
}

# Function to show help
help() {
    echo "FastTrack Process Import Tool Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  build     Build the Docker image"
    echo "  start     Start the application"
    echo "  dev       Start in development mode (with hot-reloading)"
    echo "  prod      Start in production mode"
    echo "  stop      Stop the application"
    echo "  restart   Restart the application"
    echo "  logs      View application logs (add container name for specific logs)"
    echo "  status    Show application status and health"
    echo "  clean     Remove all containers, images, and volumes"
    echo "  backup    Create a backup of data and logs"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start              # Start the application"
    echo "  $0 dev                # Start in development mode"
    echo "  $0 logs fasttrack-app # View logs for specific container"
    echo "  $0 backup             # Create a backup"
}

# Main script logic
case "${1:-help}" in
    build)
        build
        ;;
    start)
        start
        ;;
    dev)
        dev
        ;;
    prod)
        prod
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        shift
        logs "$@"
        ;;
    status)
        status
        ;;
    clean)
        clean
        ;;
    backup)
        backup
        ;;
    help|--help|-h)
        help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        help
        exit 1
        ;;
esac
