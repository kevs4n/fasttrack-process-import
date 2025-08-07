/**
 * Bulk Operations Manager - Handle field replacement and hierarchy operations
 * Part of FastTrack Process Import Tool modularization
 */

class BulkOperationsManager {
    constructor() {
        this.selectedBulkModel = null;
        this.loadedModel = null;
        this.init();
    }

    init() {
        console.log('BulkOperationsManager initialized');
        this.loadModels();
    }

    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const result = await response.json();
            
            if (result.success) {
                this.populateModelSelect(result.data.models);
            } else {
                UIUtils.showStatus('bulkStatus', 'error', result.error || 'Failed to load models');
            }
        } catch (error) {
            UIUtils.showStatus('bulkStatus', 'error', `Error: ${error.message}`);
        }
    }

    populateModelSelect(models) {
        const select = document.getElementById('modelSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select a model...</option>';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.filename} (${model.id})`;
            select.appendChild(option);
        });

        // Set up change handler
        select.onchange = (e) => this.selectModel(e.target.value);
    }

    async selectModel(modelId) {
        if (!modelId) {
            this.clearModelData();
            return;
        }

        this.selectedBulkModel = modelId;
        
        try {
            UIUtils.showStatus('bulkStatus', 'info', 'Loading model data...');
            
            const response = await fetch(`/api/models/${modelId}`);
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.loadedModel = result.data.model;
                this.displayModelData(this.loadedModel);
                this.setupFieldReplacementUI();
                UIUtils.showStatus('bulkStatus', 'success', 'Model loaded successfully');
            } else {
                throw new Error(result.error || result.detail || 'Failed to load model');
            }
        } catch (error) {
            console.error('Model loading error:', error);
            UIUtils.showStatus('bulkStatus', 'error', `Error loading model: ${error.message}`);
            this.clearModelData();
        }
    }

    clearModelData() {
        this.selectedBulkModel = null;
        this.loadedModel = null;
        
        // Clear displays
        document.getElementById('modelData').style.display = 'none';
        document.getElementById('fieldReplacementSection').style.display = 'none';
        document.getElementById('hierarchySection').style.display = 'none';
    }

    displayModelData(model) {
        const container = document.getElementById('modelData');
        if (!container) return;

        const workItems = model.work_items || [];
        const summary = model.summary || {};
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Total Work Items</h4>
                    <div class="stat-number">${workItems.length}</div>
                </div>
                <div class="stat-card">
                    <h4>Unique Work Item Types</h4>
                    <div class="stat-number">${summary.unique_work_item_types || this.getUniqueWorkItemTypes(workItems).length}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Area Paths</h4>
                    <div class="stat-number">${summary.unique_area_paths || this.getUniqueAreaPaths(workItems).length}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Iterations</h4>
                    <div class="stat-number">${summary.unique_iterations || this.getUniqueIterations(workItems).length}</div>
                </div>
            </div>
            
            <div class="model-preview">
                <h4>Sample Work Items (First 5)</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Title</th>
                                <th>Type</th>
                                <th>State</th>
                                <th>Area Path</th>
                                <th>Iteration</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${workItems.slice(0, 5).map(item => `
                                <tr>
                                    <td>${item.ID || item.id || 'N/A'}</td>
                                    <td>${item.Title || item.title || 'N/A'}</td>
                                    <td>${item['Work Item Type'] || item.type || 'N/A'}</td>
                                    <td>${item.State || item.state || 'N/A'}</td>
                                    <td>${item['Area Path'] || item.area_path || 'N/A'}</td>
                                    <td>${item['Iteration Path'] || item.iteration || 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        container.style.display = 'block';
        document.getElementById('fieldReplacementSection').style.display = 'block';
        document.getElementById('hierarchySection').style.display = 'block';
    }

    setupFieldReplacementUI() {
        if (!this.loadedModel) return;

        const workItems = this.loadedModel.work_items || [];
        const fieldSelect = document.getElementById('targetField');
        
        if (!fieldSelect || workItems.length === 0) return;

        // Get all unique field names from work items
        const fieldNames = new Set();
        workItems.forEach(item => {
            Object.keys(item).forEach(key => fieldNames.add(key));
        });

        // Populate field select
        fieldSelect.innerHTML = '<option value="">Select field to update...</option>';
        
        Array.from(fieldNames).sort().forEach(field => {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = field;
            fieldSelect.appendChild(option);
        });

        // Set up field change handler
        fieldSelect.onchange = (e) => this.populateFieldValues(e.target.value);
    }

    populateFieldValues(fieldName) {
        if (!this.loadedModel || !fieldName) {
            this.clearFieldValues();
            return;
        }

        const workItems = this.loadedModel.work_items || [];
        const values = new Set();
        
        workItems.forEach(item => {
            if (item[fieldName] !== undefined && item[fieldName] !== null && item[fieldName] !== '') {
                values.add(item[fieldName]);
            }
        });

        const fromValueSelect = document.getElementById('fromValue');
        if (fromValueSelect) {
            fromValueSelect.innerHTML = '<option value="">Select current value...</option>';
            
            Array.from(values).sort().forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                fromValueSelect.appendChild(option);
            });
        }

        // Show the form section
        document.getElementById('replacementForm').style.display = 'block';
    }

    clearFieldValues() {
        const fromValueSelect = document.getElementById('fromValue');
        const toValueInput = document.getElementById('toValue');
        
        if (fromValueSelect) fromValueSelect.innerHTML = '<option value="">Select current value...</option>';
        if (toValueInput) toValueInput.value = '';
        
        document.getElementById('replacementForm').style.display = 'none';
    }

    async performFieldReplacement() {
        if (!this.selectedBulkModel) {
            UIUtils.showStatus('bulkStatus', 'error', 'No model selected');
            return;
        }

        const targetField = document.getElementById('targetField').value;
        const fromValue = document.getElementById('fromValue').value;
        const toValue = document.getElementById('toValue').value;

        if (!targetField || !fromValue || !toValue) {
            UIUtils.showStatus('bulkStatus', 'error', 'Please fill in all fields');
            return;
        }

        if (!confirm(`Replace all instances of "${fromValue}" with "${toValue}" in field "${targetField}"?\n\nThis operation cannot be undone!`)) {
            return;
        }

        try {
            UIUtils.showStatus('bulkStatus', 'info', 'Performing field replacement...');
            
            const response = await fetch('/api/bulk-replace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: this.selectedBulkModel,
                    field_name: targetField,
                    old_value: fromValue,
                    new_value: toValue
                })
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                UIUtils.showStatus('bulkStatus', 'success', 
                    `Successfully replaced ${result.modified_count} items`);
                
                // Reload model data to reflect changes
                this.selectModel(this.selectedBulkModel);
                
                // Clear form
                this.clearFieldValues();
                document.getElementById('targetField').value = '';
            } else {
                throw new Error(result.error || result.detail || 'Replacement failed');
            }
        } catch (error) {
            console.error('Replacement error:', error);
            UIUtils.showStatus('bulkStatus', 'error', `Error: ${error.message}`);
        }
    }

    async deleteByHierarchy() {
        if (!this.selectedBulkModel) {
            UIUtils.showStatus('bulkStatus', 'error', 'No model selected');
            return;
        }

        const hierarchyType = document.getElementById('hierarchyType').value;
        const hierarchyValue = document.getElementById('hierarchyValue').value;

        if (!hierarchyType || !hierarchyValue) {
            UIUtils.showStatus('bulkStatus', 'error', 'Please select hierarchy type and enter a value');
            return;
        }

        if (!confirm(`Delete all work items where ${hierarchyType} contains "${hierarchyValue}"?\n\nThis operation cannot be undone!`)) {
            return;
        }

        try {
            UIUtils.showStatus('bulkStatus', 'info', 'Deleting work items...');
            
            const response = await fetch('/api/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: this.selectedBulkModel,
                    hierarchy_type: hierarchyType,
                    hierarchy_value: hierarchyValue
                })
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                UIUtils.showStatus('bulkStatus', 'success', 
                    `Successfully deleted ${result.deleted_count} work items`);
                
                // Reload model data to reflect changes
                this.selectModel(this.selectedBulkModel);
                
                // Clear form
                document.getElementById('hierarchyValue').value = '';
            } else {
                throw new Error(result.error || result.detail || 'Delete operation failed');
            }
        } catch (error) {
            console.error('Delete error:', error);
            UIUtils.showStatus('bulkStatus', 'error', `Error: ${error.message}`);
        }
    }

    // Helper methods for statistics
    getUniqueWorkItemTypes(workItems) {
        const types = new Set();
        workItems.forEach(item => {
            const type = item['Work Item Type'] || item.type;
            if (type) types.add(type);
        });
        return Array.from(types);
    }

    getUniqueAreaPaths(workItems) {
        const paths = new Set();
        workItems.forEach(item => {
            const path = item['Area Path'] || item.area_path;
            if (path) paths.add(path);
        });
        return Array.from(paths);
    }

    getUniqueIterations(workItems) {
        const iterations = new Set();
        workItems.forEach(item => {
            const iteration = item['Iteration Path'] || item.iteration;
            if (iteration) iterations.add(iteration);
        });
        return Array.from(iterations);
    }

    // Get selected model for other components
    getSelectedModel() {
        return this.selectedBulkModel;
    }

    // Get loaded model data
    getLoadedModel() {
        return this.loadedModel;
    }
}

// Initialize and expose globally
window.BulkOperations = new BulkOperationsManager();

// Global functions for backward compatibility (to be removed after full migration)
window.loadModelsForBulk = () => window.BulkOperations.loadModels();
window.selectModel = (id) => window.BulkOperations.selectModel(id);
window.performFieldReplacement = () => window.BulkOperations.performFieldReplacement();
window.deleteByHierarchy = () => window.BulkOperations.deleteByHierarchy();
