"""
GitHub Client for downloading Excel files from Microsoft Dynamics 365 repository
"""
import os
import requests
import logging
from typing import List, Dict, Any
from urllib.parse import urljoin
import json

from ..config import Config

logger = logging.getLogger(__name__)

class GitHubClient:
    def __init__(self):
        self.api_base = Config.GITHUB_API_BASE
        self.raw_base = Config.GITHUB_RAW_BASE
        self.repo_owner = Config.GITHUB_REPO_OWNER
        self.repo_name = Config.GITHUB_REPO_NAME
        self.base_path = Config.GITHUB_BASE_PATH
        
        # Create downloads directory
        self.downloads_dir = os.path.join(Config.DATA_DIR, 'downloads')
        os.makedirs(self.downloads_dir, exist_ok=True)
    
    def list_excel_files(self) -> List[Dict[str, Any]]:
        """Get list of Excel files from the GitHub repository"""
        try:
            # API endpoint to get repository contents
            api_url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/contents/{self.base_path}"
            
            logger.info(f"Fetching file list from: {api_url}")
            
            response = requests.get(api_url, timeout=30)
            response.raise_for_status()
            
            contents = response.json()
            excel_files = []
            
            # Filter for Excel files and process the response
            for item in contents:
                if item['type'] == 'file' and item['name'].lower().endswith(('.xlsx', '.xls')):
                    excel_files.append({
                        'name': item['name'],
                        'path': item['path'],
                        'size': item['size'],
                        'download_url': item['download_url'],
                        'html_url': item['html_url'],
                        'sha': item['sha']
                    })
                elif item['type'] == 'dir':
                    # Recursively check subdirectories
                    try:
                        sub_files = self._get_files_from_directory(item['path'])
                        excel_files.extend(sub_files)
                    except Exception as e:
                        logger.warning(f"Error accessing subdirectory {item['path']}: {str(e)}")
            
            logger.info(f"Found {len(excel_files)} Excel files")
            return excel_files
            
        except requests.RequestException as e:
            logger.error(f"Error fetching file list from GitHub: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error listing GitHub files: {str(e)}")
            raise
    
    def _get_files_from_directory(self, dir_path: str) -> List[Dict[str, Any]]:
        """Recursively get Excel files from a directory"""
        api_url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/contents/{dir_path}"
        
        try:
            response = requests.get(api_url, timeout=30)
            response.raise_for_status()
            
            contents = response.json()
            excel_files = []
            
            for item in contents:
                if item['type'] == 'file' and item['name'].lower().endswith(('.xlsx', '.xls')):
                    excel_files.append({
                        'name': item['name'],
                        'path': item['path'],
                        'size': item['size'],
                        'download_url': item['download_url'],
                        'html_url': item['html_url'],
                        'sha': item['sha']
                    })
                elif item['type'] == 'dir':
                    # Recursive call for subdirectories (limit depth to avoid infinite loops)
                    if dir_path.count('/') < 5:  # Limit recursion depth
                        sub_files = self._get_files_from_directory(item['path'])
                        excel_files.extend(sub_files)
            
            return excel_files
            
        except requests.RequestException as e:
            logger.warning(f"Error accessing directory {dir_path}: {str(e)}")
            return []
    
    def download_file(self, file_path: str) -> str:
        """Download a file from GitHub and return local path"""
        try:
            # Get file info first
            api_url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/contents/{file_path}"
            
            logger.info(f"Getting file info for: {file_path}")
            response = requests.get(api_url, timeout=30)
            response.raise_for_status()
            
            file_info = response.json()
            download_url = file_info['download_url']
            
            # Download the file
            logger.info(f"Downloading file from: {download_url}")
            file_response = requests.get(download_url, timeout=60)
            file_response.raise_for_status()
            
            # Save to local file
            filename = os.path.basename(file_path)
            local_path = os.path.join(self.downloads_dir, filename)
            
            # Ensure unique filename if file already exists
            counter = 1
            base_name, ext = os.path.splitext(filename)
            while os.path.exists(local_path):
                local_path = os.path.join(self.downloads_dir, f"{base_name}_{counter}{ext}")
                counter += 1
            
            with open(local_path, 'wb') as f:
                f.write(file_response.content)
            
            logger.info(f"Successfully downloaded {file_path} to {local_path}")
            return local_path
            
        except requests.RequestException as e:
            logger.error(f"Error downloading file {file_path}: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error downloading file {file_path}: {str(e)}")
            raise
    
    def get_file_info(self, file_path: str) -> Dict[str, Any]:
        """Get detailed information about a file"""
        try:
            api_url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/contents/{file_path}"
            
            response = requests.get(api_url, timeout=30)
            response.raise_for_status()
            
            return response.json()
            
        except requests.RequestException as e:
            logger.error(f"Error getting file info for {file_path}: {str(e)}")
            raise
    
    def get_repository_info(self) -> Dict[str, Any]:
        """Get general repository information"""
        try:
            api_url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}"
            
            response = requests.get(api_url, timeout=30)
            response.raise_for_status()
            
            repo_info = response.json()
            
            return {
                'name': repo_info['name'],
                'full_name': repo_info['full_name'],
                'description': repo_info['description'],
                'html_url': repo_info['html_url'],
                'updated_at': repo_info['updated_at'],
                'size': repo_info['size'],
                'default_branch': repo_info['default_branch']
            }
            
        except requests.RequestException as e:
            logger.error(f"Error getting repository info: {str(e)}")
            raise

    def list_repositories(self) -> List[Dict[str, Any]]:
        """Get list of available GitHub repositories (for now, return predefined Microsoft repos)"""
        try:
            # For now, return a curated list of Microsoft Dynamics 365 repositories
            return [
                {
                    'name': 'Dynamics365-Apps-Samples',
                    'full_name': 'microsoft/Dynamics365-Apps-Samples',
                    'description': 'Microsoft Dynamics 365 Apps Samples',
                    'html_url': 'https://github.com/microsoft/Dynamics365-Apps-Samples',
                    'default_branch': 'master'
                },
                {
                    'name': 'dynamics365patternspractices',
                    'full_name': 'microsoft/dynamics365patternspractices',
                    'description': 'Microsoft Dynamics 365 Patterns & Practices',
                    'html_url': 'https://github.com/microsoft/dynamics365patternspractices',
                    'default_branch': 'master'
                },
                {
                    'name': 'Dynamics-365-FastTrack-Implementation-Assets',
                    'full_name': 'microsoft/Dynamics-365-FastTrack-Implementation-Assets',
                    'description': 'Dynamics 365 FastTrack Implementation Assets',
                    'html_url': 'https://github.com/microsoft/Dynamics-365-FastTrack-Implementation-Assets',
                    'default_branch': 'master'
                }
            ]
        except Exception as e:
            logger.error(f"Error listing repositories: {str(e)}")
            raise

    def list_repo_files(self, repo_name: str, path: str = "") -> List[Dict[str, Any]]:
        """Get list of files from a specific repository path"""
        try:
            # Parse repo_name to get owner/repo
            if '/' in repo_name:
                repo_owner, repo_name_only = repo_name.split('/', 1)
            else:
                repo_owner = self.repo_owner
                repo_name_only = repo_name
            
            # Build API URL
            api_url = f"{self.api_base}/repos/{repo_owner}/{repo_name_only}/contents"
            if path:
                api_url += f"/{path}"
            
            logger.info(f"Fetching files from: {api_url}")
            
            response = requests.get(api_url, timeout=30)
            response.raise_for_status()
            
            contents = response.json()
            files = []
            
            # Process the response
            for item in contents:
                file_info = {
                    'name': item['name'],
                    'path': item['path'],
                    'type': item['type'],
                    'size': item.get('size', 0),
                    'html_url': item['html_url'],
                    'sha': item['sha']
                }
                
                # Add download_url for files
                if item['type'] == 'file':
                    file_info['download_url'] = item.get('download_url', '')
                    file_info['is_excel'] = item['name'].lower().endswith(('.xlsx', '.xls'))
                
                files.append(file_info)
            
            logger.info(f"Found {len(files)} items in {repo_name}/{path}")
            return files
            
        except requests.RequestException as e:
            logger.error(f"Error fetching files from {repo_name}/{path}: {str(e)}")
            raise
