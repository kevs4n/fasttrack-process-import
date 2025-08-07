# FastTrack Process Import Tool - Deployment & Management Guide

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- PowerShell (Windows) or Bash (Linux/macOS)
- 8085 port available

### Start the Application
```powershell
# Windows PowerShell
.\manage.ps1 start

# Linux/macOS Bash
./manage.sh start
```

The application will be available at: http://localhost:8085

## 📋 Management Commands

### Windows PowerShell
```powershell
.\manage.ps1 [command]
```

### Linux/macOS Bash
```bash
./manage.sh [command]
```

### Available Commands

| Command | Description |
|---------|-------------|
| `build` | Build the Docker image |
| `start` | Start the application |
| `dev` | Start in development mode (with hot-reloading) |
| `prod` | Start in production mode |
| `stop` | Stop the application |
| `restart` | Restart the application |
| `logs` | View application logs |
| `status` | Show application status and health |
| `clean` | Remove all containers, images, and volumes |
| `backup` | Create a backup of data and logs |
| `help` | Show help message |

## 🛠️ Development vs Production

### Development Mode
- **Hot-reloading**: Source code changes are reflected immediately
- **Debug logging**: More verbose output
- **Source mounting**: Local files are mounted into container

```powershell
.\manage.ps1 dev
```

### Production Mode
- **Optimized performance**: Resource limits and security settings
- **Production logging**: Structured logs with rotation
- **Security hardening**: Read-only filesystem, no new privileges

```powershell
.\manage.ps1 prod
```

## 📁 File Structure

```
fasttrack-process-import/
├── docker-compose.yml           # Main Docker Compose configuration
├── docker-compose.override.yml  # Development overrides
├── docker-compose.prod.yml      # Production overrides
├── .env                         # Environment variables
├── manage.ps1                   # PowerShell management script
├── manage.sh                    # Bash management script
├── data/                        # Persistent data (auto-created)
│   ├── uploads/                 # User uploaded files
│   ├── downloads/               # GitHub downloaded files
│   ├── exports/                 # CSV exports
│   └── models/                  # Processed models
├── logs/                        # Application logs (auto-created)
├── static/                      # Web interface files
├── src/                         # Source code
└── README_DEPLOYMENT.md         # This file
```

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Application Configuration
PORT=8085
LOG_LEVEL=INFO

# GitHub Configuration
GITHUB_REPO=microsoft/dynamics365patternspractices
GITHUB_PATH=business-process-catalog
GITHUB_TOKEN=

# Azure DevOps Configuration (Optional)
AZURE_DEVOPS_ORG=
AZURE_DEVOPS_PROJECT=
AZURE_DEVOPS_PAT=

# File Processing
MAX_FILE_SIZE_MB=10
ALLOWED_EXTENSIONS=xlsx,xls
```

### Volume Mounting

The application uses persistent volumes for:
- **Data Storage**: `./data:/app/data` - All processed models and files
- **Logs**: `./logs:/app/logs` - Application logs
- **Static Files**: `./static:/app/static` - Web interface (dev mode)

## 🏥 Health Monitoring

### Health Check Endpoint
```bash
curl http://localhost:8085/health
```

### View Application Status
```powershell
.\manage.ps1 status
```

### View Logs
```powershell
# All logs
.\manage.ps1 logs

# Specific container logs
.\manage.ps1 logs fasttrack-app

# Follow logs in real-time
.\manage.ps1 logs -f
```

## 🔄 Data Management

### Backup Data
```powershell
.\manage.ps1 backup
```
Creates timestamped backup in `./backups/` directory.

### Restore Data
1. Stop the application: `.\manage.ps1 stop`
2. Replace `./data/` with backup data
3. Start the application: `.\manage.ps1 start`

### Data Persistence
- Data survives container restarts and rebuilds
- Located in `./data/` directory on host
- Includes processed models, uploads, downloads, and exports

## 🚀 Deployment Scenarios

### Local Development
```powershell
# Clone repository
git clone <repository-url>
cd fasttrack-process-import

# Start development environment
.\manage.ps1 dev

# Application available at http://localhost:8085
```

### Production Deployment
```powershell
# Build and start production environment
.\manage.ps1 build
.\manage.ps1 prod

# Monitor status
.\manage.ps1 status
.\manage.ps1 logs
```

### CI/CD Pipeline
```yaml
# Example GitHub Actions
steps:
  - name: Build and Test
    run: |
      docker-compose build
      docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
      # Run tests
      docker-compose down
```

## 🛡️ Security Considerations

### Production Security Features
- Read-only filesystem (except for data volumes)
- No new privileges
- Resource limits (CPU and memory)
- Non-root user execution
- Minimal attack surface

### Environment Security
- Use `.env` file for sensitive configuration
- Never commit tokens or passwords to git
- Use Docker secrets for production deployments
- Regular security updates of base images

## 🔍 Troubleshooting

### Common Issues

#### Port Already in Use
```powershell
# Check what's using port 8085
netstat -ano | findstr :8085

# Kill the process or change port in .env file
```

#### Permission Issues (Linux/macOS)
```bash
# Make scripts executable
chmod +x manage.sh

# Fix data directory permissions
sudo chown -R $USER:$USER ./data
```

#### Container Won't Start
```powershell
# Check logs
.\manage.ps1 logs

# Rebuild container
.\manage.ps1 stop
.\manage.ps1 build
.\manage.ps1 start
```

#### Data Not Persisting
```powershell
# Verify volume mounts
docker-compose config

# Check data directory
ls -la ./data
```

### Debug Mode
```bash
# Enable debug logging
echo "LOG_LEVEL=DEBUG" >> .env

# Restart with debug
.\manage.ps1 restart
.\manage.ps1 logs
```

## 📊 Monitoring & Metrics

### Application Metrics
- Health check endpoint: `/health`
- API endpoint status: Individual endpoint responses
- File processing status: Success/failure rates

### System Metrics
```powershell
# Container resource usage
docker stats fasttrack-app

# Container information
docker inspect fasttrack-app
```

## 🔧 Customization

### Custom Docker Compose Override
Create `docker-compose.local.yml` for local customizations:

```yaml
version: '3.8'
services:
  fasttrack-app:
    environment:
      - CUSTOM_SETTING=value
    ports:
      - "8086:8085"  # Different port
```

Run with: `docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d`

### Environment-Specific Configuration
- Development: `docker-compose.override.yml`
- Production: `docker-compose.prod.yml`
- Local: `docker-compose.local.yml`

## 📞 Support

### Getting Help
1. Check application logs: `.\manage.ps1 logs`
2. Verify configuration: `.\manage.ps1 status`
3. Review this documentation
4. Check GitHub issues (if applicable)

### Reporting Issues
Include:
- Error messages from logs
- System information (OS, Docker version)
- Steps to reproduce
- Configuration (excluding sensitive data)

---

**FastTrack Process Import Tool** - Streamlining Microsoft Dynamics 365 business process model imports to Azure DevOps.
