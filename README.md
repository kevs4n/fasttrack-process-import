# Fasttrack Process Model Import Tool

⚡ **Import Microsoft Dynamics 365 Business Process Models into Azure DevOps** ⚡

This MACHETE platform tool allows you to easily import business process models from Microsoft's Dynamics 365 patterns & practices repository into Azure DevOps as work items.

## Features

- 📥 **Direct GitHub Integration**: Download Excel files directly from Microsoft's repository
- 📤 **File Upload**: Upload your own Excel files for processing
- 🔄 **Automated Processing**: Convert Excel data into structured work items
- ☁️ **Azure DevOps Integration**: Create work items directly in your Azure DevOps project
- 📊 **Model Management**: View, manage, and export your imported models
- 📋 **CSV Export**: Export processed data for manual import into other systems

## Quick Start

### 1. Access the Tool
Once installed in MACHETE, access the tool through your MACHETE dashboard. The tool runs on port 8085.

### 2. Import Process Models

#### Option A: From GitHub Repository
1. Navigate to the "GitHub Repository" tab
2. Click "Load Available Files" to see all Excel files in the Microsoft repository
3. Click on any file to download and process it automatically

#### Option B: Upload Your Own Files
1. Go to the "Upload & Import" tab
2. Drag and drop an Excel file or click to browse
3. The file will be processed automatically

### 3. Configure Azure DevOps (Optional)
1. Go to the "Azure DevOps" tab
2. Enter your organization name, project name, and Personal Access Token (PAT)
3. Click "Configure Connection" to test and save the settings

### 4. Import to Azure DevOps
1. Ensure Azure DevOps is configured
2. Select a model from the dropdown
3. Click "Import Work Items" to create the work items in your project

## Technical Details

### Architecture
- **Backend**: Python Flask application
- **Frontend**: HTML/CSS/JavaScript
- **Data Processing**: pandas for Excel processing
- **Azure Integration**: Azure DevOps REST API

### Supported File Formats
- Excel (.xlsx, .xls)
- Maximum file size: 16MB

### Work Item Mapping
The tool maps Excel data to Azure DevOps work items as follows:
- **Business Process** → Epic
- **Process Step** → Feature
- **Activity** → User Story
- **Sub-Activity** → Task

### Required Azure DevOps Permissions
Your PAT token needs the following permissions:
- **Work Items**: Read & Write
- **Project and Team**: Read (for areas and iterations)

## API Endpoints

### Health Check
- `GET /health` - Returns tool health status

### Models Management
- `GET /api/models` - List all imported models
- `GET /api/models/{id}` - Get specific model details
- `POST /api/upload` - Upload and process Excel file
- `GET /api/models/{id}/export/csv` - Export model as CSV

### GitHub Integration
- `GET /api/github/files` - List available Excel files
- `POST /api/github/download` - Download specific file

### Azure DevOps Integration
- `POST /api/azure-devops/configure` - Configure Azure DevOps connection
- `GET /api/azure-devops/status` - Get connection status
- `POST /api/azure-devops/import/{id}` - Import model to Azure DevOps

## Data Storage

All data is stored in the `/app/data` directory within the container:
- `uploads/` - Uploaded Excel files
- `downloads/` - Files downloaded from GitHub
- `models/` - Processed model data (JSON format)
- `exports/` - Generated CSV files

## Configuration

### Environment Variables
- `PORT` - Application port (default: 8085)
- `LOG_LEVEL` - Logging level (default: INFO)

### Azure DevOps Configuration
Configuration is saved locally but PAT tokens are not persisted for security.

## Troubleshooting

### Common Issues

**Excel file processing fails**
- Ensure the file is a valid Excel format (.xlsx or .xls)
- Check that the file contains recognizable column headers
- Verify the file isn't corrupted

**Azure DevOps connection fails**
- Verify your organization and project names are correct
- Ensure your PAT token has the required permissions
- Check that your Azure DevOps organization is accessible

**Import to Azure DevOps fails**
- Confirm the work item types exist in your project
- Verify area paths are valid
- Check that your PAT token hasn't expired

### Logs
Application logs are available in `/app/data/fasttrack_import.log` within the container.

## Development

### Local Development Setup
1. Install Python 3.9+
2. Install dependencies: `pip install -r requirements.txt`
3. Run the application: `python src/app.py`
4. Access at `http://localhost:8085`

### MACHETE Integration
This tool follows MACHETE conventions:
- Uses `machete.yml` for tool configuration
- Implements health check endpoint
- Runs on port 8085
- Follows container naming conventions

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the application logs
3. Create an issue in the repository

## Data Sources

This tool works with Excel files from the [Microsoft Dynamics 365 Patterns & Practices repository](https://github.com/microsoft/dynamics365patternspractices/tree/main/business-process-catalog), which contains comprehensive business process models for various industries and scenarios.
