"""
Azure DevOps Client for creating work items from process models
"""
import os
import json
import requests
import base64
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from ..config import Config

logger = logging.getLogger(__name__)

class AzureDevOpsClient:
    def __init__(self):
        self.base_url = Config.AZURE_DEVOPS_BASE_URL
        self.organization = None
        self.project = None
        self.pat_token = None
        self.headers = None
        self.configured = False
        
        # Load saved configuration if exists
        self._load_configuration()
    
    def configure(self, organization: str, project: str, pat_token: str) -> bool:
        """Configure Azure DevOps connection"""
        try:
            self.organization = organization
            self.project = project
            self.pat_token = pat_token
            
            # Create authorization header
            auth_string = f":{pat_token}"
            b64_auth = base64.b64encode(auth_string.encode()).decode()
            
            self.headers = {
                'Authorization': f'Basic {b64_auth}',
                'Content-Type': 'application/json-patch+json',
                'Accept': 'application/json'
            }
            
            # Test the connection
            if self._test_connection():
                self.configured = True
                self._save_configuration()
                logger.info(f"Successfully configured Azure DevOps connection to {organization}/{project}")
                return True
            else:
                self.configured = False
                logger.error("Failed to connect to Azure DevOps")
                return False
                
        except Exception as e:
            logger.error(f"Error configuring Azure DevOps: {str(e)}")
            self.configured = False
            return False
    
    def _test_connection(self) -> bool:
        """Test Azure DevOps connection"""
        try:
            # Check for demo mode
            if self.organization == "demo" and self.project == "demo" and self.pat_token == "demo-token":
                logger.info("Demo mode activated for Azure DevOps")
                return True
            
            # Try to get project information
            url = f"{self.base_url}/{self.organization}/_apis/projects/{self.project}?api-version=7.0"
            
            response = requests.get(url, headers=self.headers, timeout=30)
            
            if response.status_code == 200:
                return True
            else:
                logger.error(f"Connection test failed with status {response.status_code}: {response.text}")
                return False
                
        except requests.RequestException as e:
            logger.error(f"Connection test failed: {str(e)}")
            return False
    
    def _save_configuration(self) -> None:
        """Save configuration to file (excluding PAT token for security)"""
        try:
            config_file = os.path.join(Config.DATA_DIR, 'azure_devops_config.json')
            config_data = {
                'organization': self.organization,
                'project': self.project,
                'configured': self.configured,
                'last_updated': datetime.utcnow().isoformat()
            }
            
            with open(config_file, 'w') as f:
                json.dump(config_data, f, indent=2)
                
        except Exception as e:
            logger.warning(f"Failed to save Azure DevOps configuration: {str(e)}")
    
    def _load_configuration(self) -> None:
        """Load saved configuration"""
        try:
            config_file = os.path.join(Config.DATA_DIR, 'azure_devops_config.json')
            
            if os.path.exists(config_file):
                with open(config_file, 'r') as f:
                    config_data = json.load(f)
                
                self.organization = config_data.get('organization')
                self.project = config_data.get('project')
                # Note: PAT token is not saved for security reasons
                
        except Exception as e:
            logger.warning(f"Failed to load Azure DevOps configuration: {str(e)}")
    
    def is_configured(self) -> bool:
        """Check if Azure DevOps is properly configured"""
        return self.configured and self.pat_token is not None
    
    def get_status(self) -> Dict[str, Any]:
        """Get Azure DevOps connection status"""
        return {
            'configured': self.configured,
            'organization': self.organization,
            'project': self.project,
            'has_pat_token': self.pat_token is not None,
            'connection_test': self._test_connection() if self.is_configured() else False
        }
    
    def import_work_items(self, model_data: Dict[str, Any]) -> Dict[str, Any]:
        """Import work items from model data to Azure DevOps"""
        if not self.is_configured():
            raise ValueError("Azure DevOps not configured")
        
        try:
            work_items = model_data.get('work_items', [])
            imported_items = []
            failed_items = []
            
            logger.info(f"Starting import of {len(work_items)} work items")
            
            # Check for demo mode
            if self.organization == "demo" and self.project == "demo":
                logger.info("Demo mode: Simulating work item creation")
                # Simulate successful creation of all items
                for i, item in enumerate(work_items):
                    created_item = {
                        'id': f"demo-{i+1}",
                        'title': item.get('title', f'Demo Item {i+1}'),
                        'work_item_type': item.get('work_item_type', 'Task'),
                        'state': 'New',
                        'url': f"https://demo.visualstudio.com/demo/_workitems/edit/demo-{i+1}",
                        'created_date': datetime.utcnow().isoformat()
                    }
                    imported_items.append(created_item)
                    
                result = {
                    'total_items': len(work_items),
                    'imported_count': len(imported_items),
                    'failed_count': 0,
                    'work_items': imported_items,
                    'failed_items': [],
                    'import_date': datetime.utcnow().isoformat(),
                    'demo_mode': True
                }
                
                logger.info(f"Demo import completed: {len(imported_items)} items simulated")
                return result
            
            # Create work items in batches (to handle hierarchy properly)
            for item in work_items:
                try:
                    created_item = self._create_work_item(item)
                    if created_item:
                        imported_items.append(created_item)
                        logger.info(f"Created work item: {created_item['id']} - {created_item['title']}")
                    else:
                        failed_items.append({
                            'item': item,
                            'error': 'Failed to create work item'
                        })
                        
                except Exception as e:
                    logger.error(f"Failed to create work item {item.get('title', 'Unknown')}: {str(e)}")
                    failed_items.append({
                        'item': item,
                        'error': str(e)
                    })
            
            result = {
                'total_items': len(work_items),
                'imported_count': len(imported_items),
                'failed_count': len(failed_items),
                'work_items': imported_items,
                'failed_items': failed_items,
                'import_date': datetime.utcnow().isoformat()
            }
            
            logger.info(f"Import completed: {len(imported_items)} successful, {len(failed_items)} failed")
            return result
            
        except Exception as e:
            logger.error(f"Error importing work items: {str(e)}")
            raise
    
    def _create_work_item(self, item_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a single work item in Azure DevOps"""
        try:
            work_item_type = item_data.get('type', 'User Story')
            
            # Build the work item fields
            fields = []
            
            # Required fields
            fields.append({
                'op': 'add',
                'path': '/fields/System.Title',
                'value': item_data.get('title', 'Untitled')
            })
            
            # Optional fields
            if item_data.get('description'):
                fields.append({
                    'op': 'add',
                    'path': '/fields/System.Description',
                    'value': item_data['description']
                })
            
            if item_data.get('area_path'):
                fields.append({
                    'op': 'add',
                    'path': '/fields/System.AreaPath',
                    'value': f"{self.project}\\{item_data['area_path']}"
                })
            
            if item_data.get('tags'):
                fields.append({
                    'op': 'add',
                    'path': '/fields/System.Tags',
                    'value': item_data['tags']
                })
            
            if item_data.get('priority'):
                fields.append({
                    'op': 'add',
                    'path': '/fields/Microsoft.VSTS.Common.Priority',
                    'value': item_data['priority']
                })
            
            # Add custom fields
            for key, value in item_data.get('custom_fields', {}).items():
                # Only add if it's a reasonable custom field name
                if key and len(str(value).strip()) > 0:
                    fields.append({
                        'op': 'add',
                        'path': f'/fields/Custom.{key.replace(" ", "")}',
                        'value': str(value)
                    })
            
            # Create the work item
            url = f"{self.base_url}/{self.organization}/{self.project}/_apis/wit/workitems/${work_item_type}?api-version=7.0"
            
            response = requests.post(
                url,
                headers=self.headers,
                json=fields,
                timeout=30
            )
            
            if response.status_code == 200:
                work_item = response.json()
                return {
                    'id': work_item['id'],
                    'title': work_item['fields']['System.Title'],
                    'type': work_item['fields']['System.WorkItemType'],
                    'state': work_item['fields']['System.State'],
                    'url': work_item['_links']['html']['href']
                }
            else:
                logger.error(f"Failed to create work item. Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating work item: {str(e)}")
            return None
    
    def get_work_item_types(self) -> List[str]:
        """Get available work item types for the project"""
        if not self.is_configured():
            return []
        
        try:
            url = f"{self.base_url}/{self.organization}/{self.project}/_apis/wit/workitemtypes?api-version=7.0"
            
            response = requests.get(url, headers=self.headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                return [wit['name'] for wit in data['value']]
            else:
                logger.error(f"Failed to get work item types: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error getting work item types: {str(e)}")
            return []
    
    def get_areas(self) -> List[str]:
        """Get available area paths for the project"""
        if not self.is_configured():
            return []
        
        try:
            url = f"{self.base_url}/{self.organization}/{self.project}/_apis/wit/classificationnodes/areas?$depth=2&api-version=7.0"
            
            response = requests.get(url, headers=self.headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                areas = [self.project]  # Root area
                
                def extract_areas(node, parent_path=""):
                    current_path = f"{parent_path}\\{node['name']}" if parent_path else node['name']
                    areas.append(current_path)
                    
                    for child in node.get('children', []):
                        extract_areas(child, current_path)
                
                if 'children' in data:
                    for child in data['children']:
                        extract_areas(child, self.project)
                
                return areas
            else:
                logger.error(f"Failed to get areas: {response.status_code}")
                return [self.project]
                
        except Exception as e:
            logger.error(f"Error getting areas: {str(e)}")
            return [self.project]
