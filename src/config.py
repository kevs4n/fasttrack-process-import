"""
Configuration settings for the Fasttrack Process Model Import Tool
"""
import os

class Config:
    # Base directories
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
    MODELS_DIR = os.path.join(DATA_DIR, 'models')
    EXPORTS_DIR = os.path.join(DATA_DIR, 'exports')
    
    # GitHub repository settings
    GITHUB_REPO_OWNER = 'microsoft'
    GITHUB_REPO_NAME = 'dynamics365patternspractices'
    GITHUB_BASE_PATH = 'business-process-catalog'
    GITHUB_API_BASE = 'https://api.github.com'
    GITHUB_RAW_BASE = 'https://raw.githubusercontent.com'
    
    # Azure DevOps settings
    AZURE_DEVOPS_BASE_URL = 'https://dev.azure.com'
    
    # Application settings
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
    ALLOWED_EXTENSIONS = {'.xlsx', '.xls'}
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = os.path.join(DATA_DIR, 'fasttrack_import.log')
    
    # Work item type mappings for Azure DevOps
    WORK_ITEM_TYPE_MAPPING = {
        'Epic': 'Epic',
        'Feature': 'Feature', 
        'User Story': 'User Story',
        'Task': 'Task',
        'Business Process': 'Epic',
        'Process Step': 'Feature',
        'Activity': 'User Story',
        'Sub-Activity': 'Task'
    }
    
    # Excel column mappings
    EXCEL_COLUMN_MAPPING = {
        'title': ['Title', 'Name', 'Process Name', 'Activity Name'],
        'description': ['Description', 'Details', 'Summary'],
        'type': ['Type', 'Work Item Type', 'Category'],
        'parent': ['Parent', 'Parent ID', 'Parent Title'],
        'priority': ['Priority', 'Importance'],
        'effort': ['Effort', 'Story Points', 'Estimation'],
        'owner': ['Owner', 'Assigned To', 'Responsible'],
        'status': ['Status', 'State'],
        'tags': ['Tags', 'Labels', 'Categories']
    }
