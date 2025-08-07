"""
Fasttrack Process Model Import Tool - Main FastAPI Application

🔄 EXECUTION PLAN REMINDER: Update EXECUTION_PLAN.md after major changes!
📍 Current Status: FastAPI conversion complete, ready for local testing
📋 Next Steps: Install dependencies, test endpoints, validate functionality

Architecture: FastAPI (Python) backend + JavaScript frontend
Purpose: Import Microsoft Dynamics 365 Excel files → Azure DevOps work items
Port: Container 8085 → Host 8085 (MACHETE compliance)
"""
import os
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import pandas as pd
from datetime import datetime
import json

from .services.excel_processor import ExcelProcessor
from .services.github_client import GitHubClient
from .services.azure_devops_client import AzureDevOpsClient
from .utils.logger import setup_logger
from .config import Config

# Initialize FastAPI app
app = FastAPI(
    title="Fasttrack Process Model Import Tool",
    description="Import Microsoft Dynamics 365 Business Process Models into Azure DevOps",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Setup logging
logger = setup_logger(__name__)

# Initialize services
excel_processor = ExcelProcessor()
github_client = GitHubClient()
azure_devops_client = AzureDevOpsClient()

# Pydantic models for request/response
class GitHubDownloadRequest(BaseModel):
    file_path: str

class AzureDevOpsConfig(BaseModel):
    organization: str
    project: str
    pat_token: str

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    service: str
    version: str

class ApiResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class FieldReplacementRequest(BaseModel):
    field_name: str
    old_value: str
    new_value: str

class FieldDeletionRequest(BaseModel):
    field_name: str
    field_value: str

@app.get("/", response_class=HTMLResponse)
async def index():
    """Main dashboard"""
    try:
        with open("static/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Index file not found")

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint for MACHETE"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="fasttrack-process-import",
        version="1.0.0"
    )

@app.get("/api/models")
async def list_models():
    """Get list of imported models"""
    try:
        models = excel_processor.list_imported_models()
        return ApiResponse(success=True, data={"models": models})
    except Exception as e:
        logger.error("Error listing models: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/github/files")
async def list_github_files():
    """Get list of available Excel files from GitHub"""
    try:
        files = github_client.list_excel_files()
        return ApiResponse(success=True, data={"files": files})
    except Exception as e:
        logger.error("Error fetching GitHub files: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/github/download")
async def download_github_file(request: GitHubDownloadRequest):
    """Download an Excel file from GitHub"""
    try:
        # Download and process the file
        local_path = github_client.download_file(request.file_path)
        model_data = excel_processor.process_excel_file(local_path)
        
        return ApiResponse(
            success=True,
            message=f"Successfully downloaded and processed {request.file_path}",
            data={
                "model_id": model_data["id"],
                "summary": model_data["summary"]
            }
        )
        
    except Exception as e:
        logger.error("Error downloading GitHub file: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and process an Excel file"""
    try:
        # Validate file type
        if not file.filename.lower().endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file.")
        
        # Save uploaded file
        file_path = os.path.join(Config.UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Process the Excel file
        model_data = excel_processor.process_excel_file(file_path)
        
        return ApiResponse(
            success=True,
            message=f"Successfully processed {file.filename}",
            data={
                "model_id": model_data["id"],
                "summary": model_data["summary"]
            }
        )
        
    except Exception as e:
        logger.error("Error uploading file: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/{model_id}")
async def get_model(model_id: str):
    """Get details of a specific model"""
    try:
        model_data = excel_processor.get_model_data(model_id)
        if not model_data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        return ApiResponse(success=True, data={"model": model_data})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting model %s: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/{model_id}/export/csv")
async def export_model_csv(model_id: str):
    """Export model as CSV for Azure DevOps import"""
    try:
        csv_file_path = excel_processor.export_to_csv(model_id)
        
        return ApiResponse(
            success=True,
            data={
                "download_url": f"/api/models/{model_id}/download/csv"
            }
        )
        
    except Exception as e:
        logger.error("Error exporting model %s to CSV: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/{model_id}/download/csv")
async def download_model_csv(model_id: str):
    """Download CSV file for Azure DevOps import"""
    try:
        csv_file_path = excel_processor.get_csv_file_path(model_id)
        if not os.path.exists(csv_file_path):
            raise HTTPException(status_code=404, detail="CSV file not found")
        
        return FileResponse(
            path=csv_file_path,
            filename=f"fasttrack_import_{model_id}.csv",
            media_type="text/csv"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error downloading CSV for model %s: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/{model_id}/tree")
async def get_model_tree(model_id: str):
    """Get model data in tree structure"""
    try:
        model_data = excel_processor.get_model_data(model_id)
        if not model_data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Build tree structure from work items
        tree_structure = _build_tree_structure(model_data)
        
        return ApiResponse(
            success=True,
            data={
                "model_id": model_id,
                "filename": model_data.get("filename", "Unknown"),
                "tree": tree_structure,
                "summary": model_data.get("summary", {})
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting tree structure for model %s: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

def _build_tree_structure(model_data):
    """Build hierarchical tree structure from model data - work items only, no artificial folders"""
    work_items = model_data.get('work_items', [])
    
    # Create a lookup of work items by their area path
    items_by_path = {}
    all_nodes = {}
    
    # First pass: create all nodes and organize by area path
    for item in work_items:
        area_path = item.get('custom_fields', {}).get('Area Path', item.get('area_path', ''))
        hierarchy_level = item.get('hierarchy_level', 1)
        
        node = {
            "id": item.get('id'),
            "title": item.get('title', 'Unknown'),
            "type": item.get('type', 'Unknown'),
            "state": item.get('state', 'New'),
            "priority": item.get('priority', 2),
            "area_path": area_path,
            "hierarchy_level": hierarchy_level,
            "description": item.get('description', ''),
            "work_item_data": item,
            "children": [],
            "is_folder": False  # All nodes are work items, not folders
        }
        
        all_nodes[item.get('id')] = node
        
        # Group by area path for hierarchy building
        if area_path not in items_by_path:
            items_by_path[area_path] = []
        items_by_path[area_path].append(node)
    
    # Second pass: build parent-child relationships
    root_nodes = []
    
    for node in all_nodes.values():
        area_path = node["area_path"]
        hierarchy_level = node["hierarchy_level"]
        
        # Find parent by looking for items with shorter area paths that are prefixes
        parent_found = False
        
        if area_path:
            path_parts = area_path.split('\\')
            
            # Look for parent in items with one level up
            if len(path_parts) > 1:
                parent_path = '\\'.join(path_parts[:-1])
                
                # Find the parent item (the one that created this area path)
                for potential_parent in all_nodes.values():
                    parent_area_path = potential_parent["area_path"]
                    parent_level = potential_parent["hierarchy_level"]
                    
                    # Parent should have the same path up to the parent level
                    # and be exactly one level higher
                    if (parent_area_path == parent_path and 
                        parent_level == hierarchy_level - 1):
                        potential_parent["children"].append(node)
                        parent_found = True
                        break
        
        # If no parent found, this is a root node
        if not parent_found:
            root_nodes.append(node)
    
    return {
        "roots": root_nodes,
        "total_items": len(work_items),
        "total_folders": 0  # No artificial folders
    }

@app.post("/api/azure-devops/configure")
async def configure_azure_devops(config: AzureDevOpsConfig):
    """Configure Azure DevOps connection"""
    try:
        # Test connection
        success = azure_devops_client.configure(
            config.organization, 
            config.project, 
            config.pat_token
        )
        
        if success:
            return ApiResponse(
                success=True,
                message="Azure DevOps connection configured successfully"
            )
        else:
            raise HTTPException(
                status_code=400, 
                detail="Failed to connect to Azure DevOps. Please check your credentials."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error configuring Azure DevOps: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/azure-devops/import/{model_id}")
async def import_to_azure_devops(model_id: str):
    """Import model to Azure DevOps as work items"""
    try:
        if not azure_devops_client.is_configured():
            raise HTTPException(
                status_code=400,
                detail="Azure DevOps not configured. Please configure connection first."
            )
        
        # Get model data and convert to work items
        model_data = excel_processor.get_model_data(model_id)
        if not model_data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Import to Azure DevOps
        result = azure_devops_client.import_work_items(model_data)
        
        return ApiResponse(
            success=True,
            message=f"Successfully imported {len(result['work_items'])} work items",
            data={"import_summary": result}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error importing model %s to Azure DevOps: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/models/{model_id}/update-work-item-types")
async def update_work_item_types(model_id: str, type_mapping: Dict[str, str]):
    """Update work item types in bulk for a model"""
    try:
        model_data = excel_processor.get_model_data(model_id)
        if not model_data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Update work item types
        updated_count = 0
        work_items = model_data.get('work_items', [])
        
        for item in work_items:
            old_type = item.get('type', '')
            if old_type in type_mapping:
                item['type'] = type_mapping[old_type]
                updated_count += 1
        
        # Update summary work item types
        updated_types = set()
        for item in work_items:
            updated_types.add(item.get('type', 'Unknown'))
        
        model_data['summary']['work_item_types'] = list(updated_types)
        
        # Save updated model data
        excel_processor._save_model_data(model_id, model_data)
        
        return ApiResponse(
            success=True,
            message=f"Updated {updated_count} work items with new types",
            data={
                "updated_count": updated_count,
                "new_types": list(updated_types),
                "mappings_applied": type_mapping
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating work item types for model %s: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/models/{model_id}/replace-field-value")
async def replace_field_value(model_id: str, request: FieldReplacementRequest):
    """Replace all occurrences of a field value with a new value"""
    try:
        result = excel_processor.bulk_replace_field_value(
            model_id=model_id,
            field_name=request.field_name,
            old_value=request.old_value,
            new_value=request.new_value
        )
        
        return ApiResponse(
            success=True,
            message=f"Replaced {result['replacement_count']} occurrences of '{request.field_name}': '{request.old_value}' → '{request.new_value}'",
            data=result
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Error replacing field value for model %s: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/models/{model_id}/delete-by-field-value")
async def delete_by_field_value(model_id: str, request: FieldDeletionRequest):
    """Delete all work items where a field equals a specific value (protects items with children)"""
    try:
        result = excel_processor.bulk_delete_items_by_field_value(
            model_id=model_id,
            field_name=request.field_name,
            field_value=request.field_value
        )
        
        message = f"Deleted {result['deletion_count']} items where '{request.field_name}' = '{request.field_value}'"
        if result['protected_count'] > 0:
            message += f" (protected {result['protected_count']} items with children)"
        
        return ApiResponse(
            success=True,
            message=message,
            data=result
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Error deleting items by field value for model %s: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/{model_id}/fields")
async def get_model_fields(model_id: str):
    """Get all available field names in a model"""
    try:
        fields = excel_processor.get_all_field_names(model_id)
        return ApiResponse(success=True, data=fields)
        
    except Exception as e:
        logger.error("Error getting fields for model %s: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/{model_id}/field-values/{field_name}")
async def get_field_values(model_id: str, field_name: str):
    """Get all unique values for a specific field"""
    try:
        values = excel_processor.get_field_values(model_id, field_name)
        return ApiResponse(success=True, data={"field_name": field_name, "values": values})
        
    except Exception as e:
        logger.error("Error getting field values for model %s, field %s: %s", model_id, field_name, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/models/{model_id}")
async def delete_model(model_id: str):
    """Delete a complete model and all its data"""
    try:
        # Check if model exists
        model_data = excel_processor.get_model_data(model_id)
        if not model_data:
            raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
        
        # Delete the model file
        import os
        model_file_path = os.path.join(excel_processor.models_dir, f"{model_id}.json")
        if os.path.exists(model_file_path):
            os.remove(model_file_path)
            logger.info(f"Deleted model file: {model_file_path}")
        
        # Delete any associated CSV export file if it exists
        csv_file_path = excel_processor.get_csv_file_path(model_id)
        if os.path.exists(csv_file_path):
            os.remove(csv_file_path)
            logger.info(f"Deleted CSV file: {csv_file_path}")
        
        return ApiResponse(
            success=True, 
            message=f"Model '{model_data['filename']}' deleted successfully",
            data={"deleted_model_id": model_id, "filename": model_data['filename']}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting model %s: %s", model_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/azure-devops/status")
async def azure_devops_status():
    """Get Azure DevOps connection status"""
    try:
        status = azure_devops_client.get_status()
        return ApiResponse(success=True, data={"status": status})
        
    except Exception as e:
        logger.error("Error getting Azure DevOps status: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    
    # Ensure required directories exist
    os.makedirs(Config.DATA_DIR, exist_ok=True)
    os.makedirs(Config.UPLOAD_DIR, exist_ok=True)
    os.makedirs(Config.MODELS_DIR, exist_ok=True)
    
    # Start the application
    port = int(os.environ.get('PORT', 8085))
    uvicorn.run(app, host="0.0.0.0", port=port)
