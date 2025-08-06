"""
Fasttrack Process Model Import Tool - Main Application
"""
import os
import logging
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import pandas as pd
from datetime import datetime
import json

from services.excel_processor import ExcelProcessor
from services.github_client import GitHubClient
from services.azure_devops_client import AzureDevOpsClient
from utils.logger import setup_logger
from config import Config

# Initialize Flask app
app = Flask(__name__, template_folder='../static', static_folder='../static')
CORS(app)

# Setup logging
logger = setup_logger(__name__)

# Initialize services
excel_processor = ExcelProcessor()
github_client = GitHubClient()
azure_devops_client = AzureDevOpsClient()

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = Config.UPLOAD_DIR

@app.route('/')
def index():
    """Main dashboard"""
    return render_template('index.html')

@app.route('/health')
def health():
    """Health check endpoint for MACHETE"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'fasttrack-process-import',
        'version': '1.0.0'
    }), 200

@app.route('/api/models', methods=['GET'])
def list_models():
    """Get list of imported models"""
    try:
        models = excel_processor.list_imported_models()
        return jsonify({
            'success': True,
            'models': models
        })
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/github/files', methods=['GET'])
def list_github_files():
    """Get list of available Excel files from GitHub"""
    try:
        files = github_client.list_excel_files()
        return jsonify({
            'success': True,
            'files': files
        })
    except Exception as e:
        logger.error(f"Error fetching GitHub files: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/github/download', methods=['POST'])
def download_github_file():
    """Download an Excel file from GitHub"""
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        
        if not file_path:
            return jsonify({
                'success': False,
                'error': 'file_path is required'
            }), 400
            
        # Download and process the file
        local_path = github_client.download_file(file_path)
        model_data = excel_processor.process_excel_file(local_path)
        
        return jsonify({
            'success': True,
            'message': f'Successfully downloaded and processed {file_path}',
            'model_id': model_data['id'],
            'summary': model_data['summary']
        })
        
    except Exception as e:
        logger.error(f"Error downloading GitHub file: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Upload and process an Excel file"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
            
        if file and file.filename.lower().endswith(('.xlsx', '.xls')):
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            # Process the Excel file
            model_data = excel_processor.process_excel_file(file_path)
            
            return jsonify({
                'success': True,
                'message': f'Successfully processed {filename}',
                'model_id': model_data['id'],
                'summary': model_data['summary']
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Invalid file type. Please upload an Excel file.'
            }), 400
            
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_id>', methods=['GET'])
def get_model(model_id):
    """Get details of a specific model"""
    try:
        model_data = excel_processor.get_model_data(model_id)
        if not model_data:
            return jsonify({
                'success': False,
                'error': 'Model not found'
            }), 404
            
        return jsonify({
            'success': True,
            'model': model_data
        })
        
    except Exception as e:
        logger.error(f"Error getting model {model_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_id>/export/csv', methods=['GET'])
def export_model_csv(model_id):
    """Export model as CSV for Azure DevOps import"""
    try:
        csv_data = excel_processor.export_to_csv(model_id)
        
        return jsonify({
            'success': True,
            'csv_data': csv_data,
            'download_url': f'/api/models/{model_id}/download/csv'
        })
        
    except Exception as e:
        logger.error(f"Error exporting model {model_id} to CSV: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_id>/download/csv', methods=['GET'])
def download_model_csv(model_id):
    """Download CSV file for Azure DevOps import"""
    try:
        csv_file_path = excel_processor.get_csv_file_path(model_id)
        if not os.path.exists(csv_file_path):
            return jsonify({
                'success': False,
                'error': 'CSV file not found'
            }), 404
            
        return send_from_directory(
            os.path.dirname(csv_file_path),
            os.path.basename(csv_file_path),
            as_attachment=True,
            download_name=f'fasttrack_import_{model_id}.csv'
        )
        
    except Exception as e:
        logger.error(f"Error downloading CSV for model {model_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/azure-devops/configure', methods=['POST'])
def configure_azure_devops():
    """Configure Azure DevOps connection"""
    try:
        data = request.get_json()
        organization = data.get('organization')
        project = data.get('project')
        pat_token = data.get('pat_token')
        
        if not all([organization, project, pat_token]):
            return jsonify({
                'success': False,
                'error': 'organization, project, and pat_token are required'
            }), 400
            
        # Test connection
        success = azure_devops_client.configure(organization, project, pat_token)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Azure DevOps connection configured successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to connect to Azure DevOps. Please check your credentials.'
            }), 400
            
    except Exception as e:
        logger.error(f"Error configuring Azure DevOps: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/azure-devops/import/<model_id>', methods=['POST'])
def import_to_azure_devops(model_id):
    """Import model to Azure DevOps as work items"""
    try:
        if not azure_devops_client.is_configured():
            return jsonify({
                'success': False,
                'error': 'Azure DevOps not configured. Please configure connection first.'
            }), 400
            
        # Get model data and convert to work items
        model_data = excel_processor.get_model_data(model_id)
        if not model_data:
            return jsonify({
                'success': False,
                'error': 'Model not found'
            }), 404
            
        # Import to Azure DevOps
        result = azure_devops_client.import_work_items(model_data)
        
        return jsonify({
            'success': True,
            'message': f'Successfully imported {len(result["work_items"])} work items',
            'import_summary': result
        })
        
    except Exception as e:
        logger.error(f"Error importing model {model_id} to Azure DevOps: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/azure-devops/status', methods=['GET'])
def azure_devops_status():
    """Get Azure DevOps connection status"""
    try:
        status = azure_devops_client.get_status()
        return jsonify({
            'success': True,
            'status': status
        })
        
    except Exception as e:
        logger.error(f"Error getting Azure DevOps status: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.errorhandler(413)
def too_large(e):
    """Handle file too large error"""
    return jsonify({
        'success': False,
        'error': 'File too large. Maximum size is 16MB.'
    }), 413

if __name__ == '__main__':
    # Ensure required directories exist
    os.makedirs(Config.DATA_DIR, exist_ok=True)
    os.makedirs(Config.UPLOAD_DIR, exist_ok=True)
    os.makedirs(Config.MODELS_DIR, exist_ok=True)
    
    # Start the application
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
