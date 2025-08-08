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
        """Convert dataframe rows to Azure DevOps work items format - capture ALL data from Excel with proper hierarchy"""
        work_items = []
        
        try:
            # Look for hierarchical title columns (Title 1, Title 2, etc.)
            title_columns = []
            for i in range(1, 6):  # Title 1 through Title 5
                col_name = f"Title {i}"
                if col_name in df.columns:
                    title_columns.append(col_name)
            
            # Track the last seen parent at each level (for proper hierarchy)
            last_parent_at_level = {}  # level -> parent_title
            
            # Process EVERY row in the dataframe to capture all data
            for idx, row in df.iterrows():
                # Skip completely empty rows
                if row.isna().all():
                    continue
                
                # Check if this row has any meaningful content in any column
                has_content = False
                for col in df.columns:
                    if pd.notna(row[col]) and str(row[col]).strip():
                        has_content = True
                        break
                
                if not has_content:
                    continue
                
                # Find the deepest level that has content in this row
                primary_title = None
                hierarchy_level = 1
                area_path_parts = []
                
                if title_columns:
                    # Find the deepest level with content
                    for level, title_col in enumerate(title_columns, 1):
                        if pd.notna(row[title_col]) and str(row[title_col]).strip():
                            title_value = str(row[title_col]).strip()
                            
                            # This becomes our primary title and level
                            primary_title = title_value
                            hierarchy_level = level
                            
                            # Update the "last seen" parent at this level
                            last_parent_at_level[level] = title_value
                            
                            # Clear any deeper levels since we have a new parent
                            levels_to_clear = [l for l in last_parent_at_level.keys() if l > level]
                            for l in levels_to_clear:
                                del last_parent_at_level[l]
                    
                    # Build area path from the hierarchy (parent chain)
                    area_path_parts = []
                    for level in range(1, hierarchy_level + 1):
                        if level in last_parent_at_level:
                            area_path_parts.append(last_parent_at_level[level])
                
                # If no title found in hierarchy columns, look for any meaningful title-like content
                if not primary_title:
                    # Look for any column that might contain a title
                    potential_title_cols = [col for col in df.columns if 
                                          any(keyword in col.lower() for keyword in ['title', 'name', 'process', 'activity', 'description'])]
                    
                    for col in potential_title_cols:
                        if pd.notna(row[col]) and str(row[col]).strip():
                            primary_title = str(row[col]).strip()
                            break
                    
                    # If still no title, use the first non-empty column
                    if not primary_title:
                        for col in df.columns:
                            if pd.notna(row[col]) and str(row[col]).strip():
                                primary_title = str(row[col]).strip()
                                break
                
                # Skip if we still couldn't find any title
                if not primary_title:
                    continue
                
                # Build area path
                area_path = "\\".join(area_path_parts) if area_path_parts else sheet_name
                
                # Determine work item type - first check if there's a Work Item Type column
                item_type = 'User Story'  # default
                
                # Look for work item type in Excel columns first
                type_cols = ['Work Item Type', 'Type', 'Item Type', 'WorkItemType']
                for type_col in type_cols:
                    if type_col in df.columns and pd.notna(row[type_col]):
                        excel_type = str(row[type_col]).strip()
                        if excel_type:
                            # Map Excel types to Azure DevOps types
                            type_mapping = {
                                'Epic': 'Epic',
                                'Feature': 'Feature', 
                                'User Story': 'User Story',
                                'Story': 'User Story',
                                'Task': 'Task',
                                'Bug': 'Bug',
                                'Issue': 'Bug',
                                'Business Process': 'Epic',
                                'Process Step': 'Feature',
                                'Activity': 'User Story',
                                'Sub-Activity': 'Task'
                            }
                            item_type = type_mapping.get(excel_type, excel_type)
                            break
                
                # If no type found in columns, fall back to hierarchy level
                if item_type == 'User Story':  # Still default, so use hierarchy
                    if hierarchy_level == 1:
                        item_type = 'Epic'
                    elif hierarchy_level == 2:
                        item_type = 'Feature'
                    elif hierarchy_level == 3:
                        item_type = 'User Story'
                    else:
                        item_type = 'Task'
                
                # Get state from State column if available
                state = 'New'  # default
                if 'State' in df.columns and pd.notna(row['State']):
                    state = str(row['State']).strip()
                
                # Create work item
                work_item = {
                    'id': f"{model_id}_{sheet_name}_{idx}",
                    'title': primary_title,
                    'description': '',  # We'll populate this from custom fields if available
                    'type': item_type,
                    'area_path': area_path,
                    'iteration_path': '',
                    'priority': 2,
                    'state': state,
                    'tags': f"fasttrack-import;{sheet_name.lower().replace(' ', '-')};row-{idx}",
                    'source_sheet': sheet_name,
                    'source_row': idx,
                    'hierarchy_level': hierarchy_level,
                    'custom_fields': {}
                }
                
                # Store ALL columns as custom fields
                for col in df.columns:
                    if pd.notna(row[col]) and str(row[col]).strip():
                        # Clean column name and value
                        clean_col_name = str(col).strip()
                        clean_value = str(row[col]).strip()
                        
                        # Store everything in custom_fields
                        work_item['custom_fields'][clean_col_name] = clean_value
                        
                        # Also check for description-like content
                        if any(desc_keyword in clean_col_name.lower() for desc_keyword in ['description', 'detail', 'summary', 'note']):
                            if not work_item['description']:  # Only set if not already set
                                work_item['description'] = clean_value
                
                # Ensure we have Area Path in custom fields for tree building
                work_item['custom_fields']['Area Path'] = area_path
                
                # Add specific important fields as top-level properties if they exist
                if 'Catalog Status' in df.columns and pd.notna(row['Catalog Status']):
                    work_item['catalog_status'] = str(row['Catalog Status']).strip()
                
                if 'Process sequence ID' in df.columns and pd.notna(row['Process sequence ID']):
                    work_item['process_sequence_id'] = str(row['Process sequence ID']).strip()
                
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
    
    def bulk_replace_field_value(self, model_id: str, field_name: str, old_value: str, new_value: str) -> Dict[str, Any]:
        """Bulk replace field values in work items"""
        model_data = self.get_model_data(model_id)
        if not model_data:
            raise ValueError(f"Model {model_id} not found")
        
        work_items = model_data.get('work_items', [])
        replacement_count = 0
        
        for item in work_items:
            # Check top-level fields first
            if field_name in item and item[field_name] == old_value:
                item[field_name] = new_value
                replacement_count += 1
            
            # Check custom fields
            elif field_name in item.get('custom_fields', {}) and item['custom_fields'][field_name] == old_value:
                item['custom_fields'][field_name] = new_value
                replacement_count += 1
        
        # Update summary work item types if we changed the 'type' field
        if field_name == 'type':
            unique_types = set()
            for item in work_items:
                unique_types.add(item.get('type', 'Unknown'))
            model_data['summary']['work_item_types'] = list(unique_types)
        
        # Save the updated model
        if replacement_count > 0:
            self._save_model_data(model_id, model_data)
        
        logger.info(f"Replaced {replacement_count} instances of '{field_name}': '{old_value}' → '{new_value}' in model {model_id}")
        
        return {
            'model_id': model_id,
            'field_name': field_name,
            'old_value': old_value,
            'new_value': new_value,
            'replacement_count': replacement_count,
            'updated_summary': model_data['summary']
        }
    
    def get_field_values(self, model_id: str, field_name: str) -> List[str]:
        """Get all unique values for a specific field across all work items"""
        model_data = self.get_model_data(model_id)
        if not model_data:
            return []
        
        work_items = model_data.get('work_items', [])
        values = set()
        
        for item in work_items:
            # Check top-level fields
            if field_name in item and item[field_name]:
                values.add(str(item[field_name]))
            
            # Check custom fields
            elif field_name in item.get('custom_fields', {}) and item['custom_fields'][field_name]:
                values.add(str(item['custom_fields'][field_name]))
        
        return sorted(list(values))
    
    def get_all_field_names(self, model_id: str) -> Dict[str, List[str]]:
        """Get all available field names in the model"""
        model_data = self.get_model_data(model_id)
        if not model_data:
            return {'top_level': [], 'custom_fields': []}
        
        work_items = model_data.get('work_items', [])
        if not work_items:
            return {'top_level': [], 'custom_fields': []}
        
        # Get top-level field names from the first work item
        top_level_fields = list(work_items[0].keys())
        top_level_fields = [f for f in top_level_fields if f != 'custom_fields']
        
        # Get all custom field names across all work items
        custom_fields = set()
        for item in work_items:
            if 'custom_fields' in item:
                custom_fields.update(item['custom_fields'].keys())
        
        return {
            'top_level': sorted(top_level_fields),
            'custom_fields': sorted(list(custom_fields))
        }
    
    def bulk_delete_items_by_field_value(self, model_id: str, field_name: str, field_value: str) -> Dict[str, Any]:
        """Bulk delete work items by field value - simple field/value matching deletion"""
        model_data = self.get_model_data(model_id)
        if not model_data:
            raise ValueError(f"Model {model_id} not found")
        
        work_items = model_data.get('work_items', [])
        original_count = len(work_items)
        
        # Find items that match the deletion criteria and separate them
        remaining_items = []
        deleted_items = []
        
        for item in work_items:
            # Check if item matches deletion criteria
            matches = False
            
            # Check top-level fields
            if field_name in item and str(item[field_name]) == field_value:
                matches = True
            # Check custom fields
            elif field_name in item.get('custom_fields', {}) and str(item['custom_fields'][field_name]) == field_value:
                matches = True
            
            if matches:
                deleted_items.append(item)
            else:
                remaining_items.append(item)
        
        # Update the model data
        model_data['work_items'] = remaining_items
        
        # Update summary
        unique_types = set()
        for item in remaining_items:
            unique_types.add(item.get('type', 'Unknown'))
        model_data['summary']['work_item_types'] = list(unique_types)
        model_data['summary']['total_rows'] = len(remaining_items)
        
        # Save the updated model
        deletion_count = len(deleted_items)
        if deletion_count > 0:
            self._save_model_data(model_id, model_data)
        
        logger.info(f"Deleted {deletion_count} items where '{field_name}' = '{field_value}' in model {model_id}")
        
        return {
            'model_id': model_id,
            'field_name': field_name,
            'field_value': field_value,
            'deletion_count': deletion_count,
            'original_count': original_count,
            'remaining_count': len(remaining_items),
            'deleted_items': [{'id': item['id'], 'title': item['title']} for item in deleted_items],
            'updated_summary': model_data['summary']
        }
