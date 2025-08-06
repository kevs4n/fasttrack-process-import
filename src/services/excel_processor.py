"""
Excel Processing Service for Fasttrack Process Models
"""
import os
import json
import pandas as pd
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

from ..config import Config

logger = logging.getLogger(__name__)

class ExcelProcessor:
    def __init__(self):
        self.models_dir = Config.MODELS_DIR
        self.exports_dir = Config.EXPORTS_DIR
        os.makedirs(self.models_dir, exist_ok=True)
        os.makedirs(self.exports_dir, exist_ok=True)
    
    def process_excel_file(self, file_path: str) -> Dict[str, Any]:
        """Process an Excel file and extract process model data"""
        try:
            # Generate unique model ID
            model_id = str(uuid.uuid4())[:8]
            
            # Read Excel file
            logger.info(f"Processing Excel file: {file_path}")
            
            # Try to read all sheets
            excel_data = pd.read_excel(file_path, sheet_name=None)
            
            # Initialize model data structure
            model_data = {
                'id': model_id,
                'filename': os.path.basename(file_path),
                'created_at': datetime.utcnow().isoformat(),
                'source': 'upload' if 'uploads' in file_path else 'github',
                'sheets': {},
                'process_hierarchy': [],
                'work_items': [],
                'summary': {
                    'total_sheets': len(excel_data),
                    'total_rows': 0,
                    'process_areas': [],
                    'work_item_types': set()
                }
            }
            
            # Process each sheet
            for sheet_name, df in excel_data.items():
                logger.info(f"Processing sheet: {sheet_name}")
                
                # Clean the dataframe
                df = self._clean_dataframe(df)
                
                if df.empty:
                    continue
                
                # Store sheet data
                model_data['sheets'][sheet_name] = {
                    'rows': len(df),
                    'columns': list(df.columns),
                    'data': df.to_dict('records')
                }
                
                model_data['summary']['total_rows'] += len(df)
                
                # Extract process hierarchy from this sheet
                hierarchy = self._extract_process_hierarchy(df, sheet_name)
                model_data['process_hierarchy'].extend(hierarchy)
                
                # Convert to work items
                work_items = self._convert_to_work_items(df, sheet_name, model_id)
                model_data['work_items'].extend(work_items)
                
                # Update summary
                model_data['summary']['process_areas'].append(sheet_name)
                for item in work_items:
                    model_data['summary']['work_item_types'].add(item.get('type', 'Unknown'))
            
            # Convert set to list for JSON serialization
            model_data['summary']['work_item_types'] = list(model_data['summary']['work_item_types'])
            
            # Save model data
            self._save_model_data(model_id, model_data)
            
            logger.info(f"Successfully processed Excel file. Model ID: {model_id}")
            return model_data
            
        except Exception as e:
            logger.error(f"Error processing Excel file {file_path}: {str(e)}")
            raise
    
    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and prepare dataframe for processing"""
        # Remove completely empty rows and columns
        df = df.dropna(how='all').dropna(axis=1, how='all')
        
        # Reset index
        df = df.reset_index(drop=True)
        
        # Clean column names
        df.columns = [str(col).strip() for col in df.columns]
        
        return df
    
    def _extract_process_hierarchy(self, df: pd.DataFrame, sheet_name: str) -> List[Dict[str, Any]]:
        """Extract hierarchical process structure from dataframe"""
        hierarchy = []
        
        try:
            # Look for common hierarchy indicators
            title_cols = self._find_columns(df, Config.EXCEL_COLUMN_MAPPING['title'])
            type_cols = self._find_columns(df, Config.EXCEL_COLUMN_MAPPING['type'])
            parent_cols = self._find_columns(df, Config.EXCEL_COLUMN_MAPPING['parent'])
            
            if not title_cols:
                # If no clear title column, use first non-empty column
                for col in df.columns:
                    if df[col].notna().any():
                        title_cols = [col]
                        break
            
            if title_cols:
                title_col = title_cols[0]
                type_col = type_cols[0] if type_cols else None
                parent_col = parent_cols[0] if parent_cols else None
                
                for idx, row in df.iterrows():
                    if pd.notna(row[title_col]) and str(row[title_col]).strip():
                        item = {
                            'id': f"{sheet_name}_{idx}",
                            'title': str(row[title_col]).strip(),
                            'sheet': sheet_name,
                            'row_index': idx,
                            'type': str(row[type_col]).strip() if type_col and pd.notna(row[type_col]) else 'Process',
                            'parent': str(row[parent_col]).strip() if parent_col and pd.notna(row[parent_col]) else None,
                            'level': self._determine_hierarchy_level(row, df.columns)
                        }
                        hierarchy.append(item)
            
        except Exception as e:
            logger.warning(f"Error extracting hierarchy from sheet {sheet_name}: {str(e)}")
        
        return hierarchy
    
    def _convert_to_work_items(self, df: pd.DataFrame, sheet_name: str, model_id: str) -> List[Dict[str, Any]]:
        """Convert dataframe rows to Azure DevOps work items format"""
        work_items = []
        
        try:
            # Find relevant columns
            title_cols = self._find_columns(df, Config.EXCEL_COLUMN_MAPPING['title'])
            desc_cols = self._find_columns(df, Config.EXCEL_COLUMN_MAPPING['description'])
            type_cols = self._find_columns(df, Config.EXCEL_COLUMN_MAPPING['type'])
            
            if not title_cols:
                return work_items
            
            title_col = title_cols[0]
            desc_col = desc_cols[0] if desc_cols else None
            type_col = type_cols[0] if type_cols else None
            
            for idx, row in df.iterrows():
                if pd.notna(row[title_col]) and str(row[title_col]).strip():
                    # Determine work item type
                    item_type = 'User Story'  # default
                    if type_col and pd.notna(row[type_col]):
                        raw_type = str(row[type_col]).strip()
                        item_type = Config.WORK_ITEM_TYPE_MAPPING.get(raw_type, 'User Story')
                    
                    work_item = {
                        'id': f"{model_id}_{sheet_name}_{idx}",
                        'title': str(row[title_col]).strip(),
                        'description': str(row[desc_col]).strip() if desc_col and pd.notna(row[desc_col]) else '',
                        'type': item_type,
                        'area_path': sheet_name,
                        'iteration_path': '',
                        'priority': 2,  # default medium priority
                        'state': 'New',
                        'tags': f"fasttrack-import;{sheet_name.lower().replace(' ', '-')}",
                        'source_sheet': sheet_name,
                        'source_row': idx,
                        'custom_fields': {}
                    }
                    
                    # Add any additional fields from the row
                    for col in df.columns:
                        if col not in [title_col, desc_col, type_col] and pd.notna(row[col]):
                            work_item['custom_fields'][col] = str(row[col])
                    
                    work_items.append(work_item)
        
        except Exception as e:
            logger.warning(f"Error converting sheet {sheet_name} to work items: {str(e)}")
        
        return work_items
    
    def _find_columns(self, df: pd.DataFrame, possible_names: List[str]) -> List[str]:
        """Find columns that match possible names (case-insensitive)"""
        found_cols = []
        df_cols_lower = [col.lower() for col in df.columns]
        
        for name in possible_names:
            for col in df.columns:
                if name.lower() in col.lower():
                    found_cols.append(col)
                    break
        
        return found_cols
    
    def _determine_hierarchy_level(self, row: pd.Series, columns: List[str]) -> int:
        """Determine hierarchy level based on row content"""
        # Simple heuristic: count leading spaces or look for level indicators
        title_value = str(row[columns[0]]) if len(columns) > 0 else ""
        
        # Count leading spaces/tabs
        leading_spaces = len(title_value) - len(title_value.lstrip())
        
        # Determine level (0-based)
        if leading_spaces == 0:
            return 0
        elif leading_spaces <= 2:
            return 1
        elif leading_spaces <= 4:
            return 2
        else:
            return 3
    
    def _save_model_data(self, model_id: str, model_data: Dict[str, Any]) -> None:
        """Save model data to JSON file"""
        file_path = os.path.join(self.models_dir, f"{model_id}.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(model_data, f, indent=2, ensure_ascii=False)
    
    def list_imported_models(self) -> List[Dict[str, Any]]:
        """Get list of all imported models"""
        models = []
        
        for filename in os.listdir(self.models_dir):
            if filename.endswith('.json'):
                try:
                    file_path = os.path.join(self.models_dir, filename)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        model_data = json.load(f)
                    
                    # Return summary info
                    models.append({
                        'id': model_data['id'],
                        'filename': model_data['filename'],
                        'created_at': model_data['created_at'],
                        'source': model_data['source'],
                        'summary': model_data['summary']
                    })
                    
                except Exception as e:
                    logger.warning(f"Error reading model file {filename}: {str(e)}")
        
        # Sort by creation date (newest first)
        models.sort(key=lambda x: x['created_at'], reverse=True)
        return models
    
    def get_model_data(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get full model data by ID"""
        file_path = os.path.join(self.models_dir, f"{model_id}.json")
        
        if not os.path.exists(file_path):
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading model {model_id}: {str(e)}")
            return None
    
    def export_to_csv(self, model_id: str) -> str:
        """Export model as CSV for Azure DevOps import"""
        model_data = self.get_model_data(model_id)
        if not model_data:
            raise ValueError(f"Model {model_id} not found")
        
        # Convert work items to CSV format
        work_items = model_data['work_items']
        
        # Create DataFrame with Azure DevOps import format
        csv_data = []
        for item in work_items:
            csv_row = {
                'Title': item['title'],
                'Work Item Type': item['type'],
                'Description': item['description'],
                'Area Path': item['area_path'],
                'Iteration Path': item['iteration_path'],
                'Priority': item['priority'],
                'State': item['state'],
                'Tags': item['tags']
            }
            
            # Add custom fields
            for key, value in item.get('custom_fields', {}).items():
                csv_row[f"Custom.{key}"] = value
            
            csv_data.append(csv_row)
        
        # Save as CSV
        df = pd.DataFrame(csv_data)
        csv_file_path = os.path.join(self.exports_dir, f"{model_id}_export.csv")
        df.to_csv(csv_file_path, index=False, encoding='utf-8-sig')
        
        logger.info(f"Exported model {model_id} to CSV: {csv_file_path}")
        return csv_file_path
    
    def get_csv_file_path(self, model_id: str) -> str:
        """Get path to exported CSV file"""
        return os.path.join(self.exports_dir, f"{model_id}_export.csv")
