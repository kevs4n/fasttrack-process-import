# FastTrack Process Import Tool Management Script for Windows PowerShell

param(
    [Parameter(Position=0)]
    [ValidateSet("build", "start", "dev", "prod", "stop", "restart", "logs", "status", "clean", "backup", "help")]
    [string]$Command = "help",
    
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$AdditionalArgs
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check if Docker is running
function Test-Docker {
    try {
        docker info | Out-Null
        return $true
    }
    catch {
        Write-Error "Docker is not running. Please start Docker first."
        exit 1
    }
}

# Function to build the application
function Build-Application {
    Write-Status "Building FastTrack Process Import Tool..."
    docker-compose build
    Write-Success "Build completed successfully"
}

# Function to start the application
function Start-Application {
    Write-Status "Starting FastTrack Process Import Tool..."
    Test-Docker
    docker-compose up -d
    Write-Success "Application started successfully"
    Write-Status "Application is available at: http://localhost:8085"
}

# Function to start in development mode
function Start-Development {
    Write-Status "Starting FastTrack Process Import Tool in development mode..."
    Test-Docker
    docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
    Write-Success "Development environment started successfully"
    Write-Status "Application is available at: http://localhost:8085"
    Write-Warning "Development mode includes hot-reloading"
}

# Function to start in production mode
function Start-Production {
    Write-Status "Starting FastTrack Process Import Tool in production mode..."
    Test-Docker
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    Write-Success "Production environment started successfully"
    Write-Status "Application is available at: http://localhost:8085"
}

# Function to stop the application
function Stop-Application {
    Write-Status "Stopping FastTrack Process Import Tool..."
    docker-compose down
    Write-Success "Application stopped successfully"
}

# Function to restart the application
function Restart-Application {
    Write-Status "Restarting FastTrack Process Import Tool..."
    Stop-Application
    Start-Application
}

# Function to view logs
function Show-Logs {
    if ($AdditionalArgs) {
        docker-compose logs -f $AdditionalArgs
    } else {
        docker-compose logs -f
    }
}

# Function to show status
function Show-Status {
    Write-Status "Application status:"
    docker-compose ps
    Write-Host ""
    Write-Status "Application health:"
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8085/health" -Method Get
        $response | ConvertTo-Json -Depth 3
    }
    catch {
        Write-Warning "Health check failed or application not responding"
    }
}

# Function to clean up
function Clean-Application {
    Write-Warning "This will remove all containers, images, and volumes related to this project"
    $response = Read-Host "Are you sure? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Status "Cleaning up..."
        docker-compose down -v --rmi all
        Write-Success "Cleanup completed"
    } else {
        Write-Status "Cleanup cancelled"
    }
}

# Function to backup data
function Backup-Data {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "./backups/$timestamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Status "Creating backup in $backupDir..."
    
    # Backup data directory
    if (Test-Path "./data") {
        Copy-Item -Path "./data" -Destination "$backupDir/" -Recurse
        Write-Success "Data backed up to $backupDir/data"
    }
    
    # Backup logs
    if (Test-Path "./logs") {
        Copy-Item -Path "./logs" -Destination "$backupDir/" -Recurse
        Write-Success "Logs backed up to $backupDir/logs"
    }
    
    Write-Success "Backup completed: $backupDir"
}

# Function to show help
function Show-Help {
    Write-Host "FastTrack Process Import Tool Management Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\manage.ps1 [COMMAND]" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  build     Build the Docker image" -ForegroundColor Gray
    Write-Host "  start     Start the application" -ForegroundColor Gray
    Write-Host "  dev       Start in development mode (with hot-reloading)" -ForegroundColor Gray
    Write-Host "  prod      Start in production mode" -ForegroundColor Gray
    Write-Host "  stop      Stop the application" -ForegroundColor Gray
    Write-Host "  restart   Restart the application" -ForegroundColor Gray
    Write-Host "  logs      View application logs (add container name for specific logs)" -ForegroundColor Gray
    Write-Host "  status    Show application status and health" -ForegroundColor Gray
    Write-Host "  clean     Remove all containers, images, and volumes" -ForegroundColor Gray
    Write-Host "  backup    Create a backup of data and logs" -ForegroundColor Gray
    Write-Host "  help      Show this help message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor White
    Write-Host "  .\manage.ps1 start              # Start the application" -ForegroundColor Gray
    Write-Host "  .\manage.ps1 dev                # Start in development mode" -ForegroundColor Gray
    Write-Host "  .\manage.ps1 logs fasttrack-app # View logs for specific container" -ForegroundColor Gray
    Write-Host "  .\manage.ps1 backup             # Create a backup" -ForegroundColor Gray
}

# Main script logic
switch ($Command) {
    "build" { Build-Application }
    "start" { Start-Application }
    "dev" { Start-Development }
    "prod" { Start-Production }
    "stop" { Stop-Application }
    "restart" { Restart-Application }
    "logs" { Show-Logs }
    "status" { Show-Status }
    "clean" { Clean-Application }
    "backup" { Backup-Data }
    "help" { Show-Help }
    default {
        Write-Error "Unknown command: $Command"
        Write-Host ""
        Show-Help
        exit 1
    }
}
