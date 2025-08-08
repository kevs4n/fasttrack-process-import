/**
 * Models Manager - Handle model operations and prepare for merge functionality
 * Part of FastTrack Process Import Tool modularization
 */

class ModelsManager {
    constructor() {
        this.selectedModelForManagement = null;
        this.selectedModelsForMerge = new Set();
        this.models = [];
        this.init();
    }

    init() {
        console.log('ModelsManager initialized');
        // Set up event listeners for file upload
        this.setupFileUpload();
    }

    setupFileUpload() {
        const fileUpload = document.getElementById('fileUpload');
        const fileInput = document.getElementById('fileInput');

        if (fileUpload && fileInput) {
            // Click to upload
            fileUpload.addEventListener('click', () => {
                fileInput.click();
            });

            // File input change
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.uploadFile(e.target.files[0]);
                }
            });

            // Drag and drop
            fileUpload.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUpload.classList.add('dragover');
            });

            fileUpload.addEventListener('dragleave', () => {
                fileUpload.classList.remove('dragover');
            });

            fileUpload.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUpload.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.uploadFile(e.dataTransfer.files[0]);
                }
            });
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        UIUtils.showStatus('uploadStatus', 'info', 'Uploading file...');
        this.updateProgress(0);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showStatus('uploadStatus', 'success', result.message);
                this.updateProgress(100);
                this.loadModels(); // Refresh models list
            } else {
                UIUtils.showStatus('uploadStatus', 'error', result.error || 'Upload failed');
                this.updateProgress(0);
            }
        } catch (error) {
            UIUtils.showStatus('uploadStatus', 'error', `Upload error: ${error.message}`);
            this.updateProgress(0);
        }
    }

    updateProgress(percentage) {
        const progressBar = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        
        if (progressBar && progressFill) {
            if (percentage > 0) {
                progressBar.classList.remove('hidden');
                progressFill.style.width = `${percentage}%`;
            } else {
                progressBar.classList.add('hidden');
            }
        }
    }

    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const result = await response.json();
            
            if (result.success) {
                this.models = result.data.models;
                this.displayModels(this.models);
            } else {
                UIUtils.showStatus('modelsStatus', 'error', result.error || 'Failed to load models');
            }
        } catch (error) {
            UIUtils.showStatus('modelsStatus', 'error', `Error: ${error.message}`);
        }
    }

    displayModels(models) {
        const container = document.getElementById('modelsList');
        if (!container) return;
        
        if (models.length === 0) {
            container.innerHTML = '<p>No models imported yet. Upload an Excel file or download from GitHub to get started.</p>';
            document.getElementById('modelManagementImportedSection').style.display = 'none';
            document.getElementById('modelMergeSection').style.display = 'none';
            return;
        }
        
        // Show merge section if multiple models available
        if (models.length > 1) {
            document.getElementById('modelMergeSection').style.display = 'block';
        }
        
        container.innerHTML = models.map(model => `
            <div class="model-card ${this.selectedModelForManagement === model.id ? 'selected' : ''}" 
                 style="background: white; border-radius: 8px; padding: 1rem; border: 2px solid ${this.selectedModelForManagement === model.id ? '#004e89' : '#eee'}; margin-bottom: 1rem; transition: all 0.3s ease;">
                
                <!-- Merge Checkbox -->
                <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                    <input type="checkbox" id="merge-${model.id}" 
                           ${this.selectedModelsForMerge.has(model.id) ? 'checked' : ''}
                           onchange="window.ModelsManager.toggleMergeSelection('${model.id}', '${model.filename}')" 
                           style="margin-right: 0.5rem;">
                    <label for="merge-${model.id}" style="margin: 0; font-weight: bold; cursor: pointer;">Select for merge</label>
                </div>
                
                <!-- Model Info (clickable for management selection) -->
                <div onclick="window.ModelsManager.selectModelForManagement('${model.id}', '${model.filename}')" 
                     style="cursor: pointer;">
                    <h3>${model.filename}</h3>
                    <div style="margin: 1rem 0; font-size: 0.9rem; color: #666;">
                        <div>📅 ${new Date(model.created_at).toLocaleDateString()}</div>
                        <div>🆔 ID: ${model.id}</div>
                        <div>📍 Source: ${model.source}</div>
                    </div>
                </div>
                
                <!-- Model Actions -->
                <div class="model-actions" style="display: flex; gap: 0.5rem; margin-top: 1rem;" onclick="event.stopPropagation();">
                    <button onclick="window.ModelsManager.deleteModelFromList('${model.id}', '${model.filename}')" 
                            class="btn btn-danger">🗑️ Delete</button>
                </div>
                
                ${this.selectedModelForManagement === model.id ? '<div style="color: #004e89; font-weight: bold; margin-top: 1rem;">✓ Selected for Management</div>' : ''}
                ${this.selectedModelsForMerge.has(model.id) ? '<div style="color: #28a745; font-weight: bold; margin-top: 0.5rem;">✓ Selected for Merge</div>' : ''}
            </div>
        `).join('');
        
        this.updateMergeSelectionDisplay();
    }

    async selectModelForManagement(modelId, filename) {
        this.selectedModelForManagement = modelId;
        
        try {
            // Fetch detailed model data to get total rows
            const response = await fetch(`/api/models/${modelId}`);
            const result = await response.json();
            
            if (response.ok && result.success && result.data?.model) {
                const model = result.data.model;
                const totalRows = UIUtils.getNestedProperty(model, 'summary.total_rows') || 
                                UIUtils.getNestedProperty(model, 'work_items.length') || 0;
                
                // Update UI
                document.getElementById('selectedModelName').textContent = filename;
                document.getElementById('selectedModelStats').textContent = `${totalRows} items`;
                
                // Show management section
                document.getElementById('modelManagementImportedSection').style.display = 'block';
            } else {
                // Fallback if detailed data is not available
                document.getElementById('selectedModelName').textContent = filename;
                document.getElementById('selectedModelStats').textContent = 'Loading...';
                document.getElementById('modelManagementImportedSection').style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading model details:', error);
            // Still show the selection with basic info
            document.getElementById('selectedModelName').textContent = filename;
            document.getElementById('selectedModelStats').textContent = 'Details unavailable';
            document.getElementById('modelManagementImportedSection').style.display = 'block';
        }
        
        // Refresh the display to show selection
        this.loadModels();
    }

    async deleteModelFromList(modelId, filename) {
        if (!confirm(`Are you sure you want to permanently delete the model "${filename}"?\n\nThis action cannot be undone!`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/models/${modelId}`, { 
                method: 'DELETE' 
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                UIUtils.showStatus('modelsStatus', 'success', `Model "${filename}" deleted successfully`);
                
                // Clear selection if the deleted model was selected
                if (this.selectedModelForManagement === modelId) {
                    this.selectedModelForManagement = null;
                    document.getElementById('modelManagementImportedSection').style.display = 'none';
                }
                
                // Refresh the models list
                this.loadModels();
                
                // Also refresh bulk operations models list if it exists
                if (window.BulkOperations) {
                    window.BulkOperations.loadModels();
                }
            } else {
                UIUtils.showStatus('modelsStatus', 'error', result.error || result.detail || 'Delete failed');
            }
        } catch (error) {
            console.error('Delete error:', error);
            UIUtils.showStatus('modelsStatus', 'error', `Delete error: ${error.message}`);
        }
    }

    deleteSelectedModel() {
        if (!this.selectedModelForManagement) {
            UIUtils.showStatus('modelsStatus', 'warning', 'No model selected');
            return;
        }
        
        const modelName = document.getElementById('selectedModelName').textContent;
        this.deleteModelFromList(this.selectedModelForManagement, modelName);
    }

    // Model merge functionality
    toggleMergeSelection(modelId, filename) {
        console.log('toggleMergeSelection called with:', modelId, filename);
        if (this.selectedModelsForMerge.has(modelId)) {
            this.selectedModelsForMerge.delete(modelId);
        } else {
            this.selectedModelsForMerge.add(modelId);
        }
        
        console.log('selectedModelsForMerge after toggle:', this.selectedModelsForMerge);
        this.updateMergeSelectionDisplay();
        // Refresh display to show updated checkboxes
        this.displayModels(this.models);
    }

    updateMergeSelectionDisplay() {
        const container = document.getElementById('selectedModelsForMerge');
        if (!container) return;

        if (this.selectedModelsForMerge.size === 0) {
            container.innerHTML = '<span>No models selected</span>';
            return;
        }

        const selectedModelNames = Array.from(this.selectedModelsForMerge).map(modelId => {
            const model = this.models.find(m => m.id === modelId);
            return model ? model.filename : modelId;
        });

        container.innerHTML = `
            <div style="background: #e8f5e8; padding: 0.5rem; border-radius: 4px;">
                <strong>${this.selectedModelsForMerge.size} models selected:</strong>
                <ul style="margin: 0.5rem 0 0 1rem; padding: 0;">
                    ${selectedModelNames.map(name => `<li>${name}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    clearMergeSelection() {
        this.selectedModelsForMerge.clear();
        this.updateMergeSelectionDisplay();
        this.displayModels(this.models);
        document.getElementById('mergedModelName').value = '';
    }

    async performMerge() {
        console.log('performMerge called');
        console.log('selectedModelsForMerge:', this.selectedModelsForMerge);
        console.log('selectedModelsForMerge.size:', this.selectedModelsForMerge.size);
        
        if (this.selectedModelsForMerge.size < 2) {
            UIUtils.showStatus('modelsStatus', 'error', 'Please select at least 2 models to merge');
            return;
        }

        const mergedModelName = document.getElementById('mergedModelName').value.trim();
        if (!mergedModelName) {
            UIUtils.showStatus('modelsStatus', 'error', 'Please enter a name for the merged model');
            return;
        }

        const selectedModelIds = Array.from(this.selectedModelsForMerge);
        const selectedModelNames = selectedModelIds.map(modelId => {
            const model = this.models.find(m => m.id === modelId);
            return model ? model.filename : modelId;
        });

        if (!confirm(`Merge ${selectedModelIds.length} models into "${mergedModelName}"?\n\nModels to merge:\n${selectedModelNames.join('\n')}\n\nThis will create a new unified model. Original models will be preserved.`)) {
            return;
        }

        try {
            UIUtils.showStatus('modelsStatus', 'info', 'Merging models...');
            
            const response = await fetch('/api/models/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_ids: selectedModelIds,
                    merged_model_name: mergedModelName
                })
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                UIUtils.showStatus('modelsStatus', 'success', 
                    `Successfully merged ${selectedModelIds.length} models into "${mergedModelName}"`);
                
                // Clear merge selection
                this.clearMergeSelection();
                
                // Refresh models list
                this.loadModels();
                
                // Refresh other components that depend on models
                if (window.BulkOperations) {
                    window.BulkOperations.loadModels();
                }
                if (window.TreeViewManager) {
                    window.TreeViewManager.loadModels();
                }
            } else {
                throw new Error(result.error || result.detail || 'Merge operation failed');
            }
        } catch (error) {
            console.error('Merge error:', error);
            UIUtils.showStatus('modelsStatus', 'error', `Merge error: ${error.message}`);
        }
    }

    // Get models list for other components
    getModels() {
        return this.models;
    }

    // Get selected model for management
    getSelectedModel() {
        return this.selectedModelForManagement;
    }

    // Get selected models for merge
    getSelectedModelsForMerge() {
        return Array.from(this.selectedModelsForMerge);
    }
}

// Initialize and expose globally
window.ModelsManager = new ModelsManager();

// Global functions for backward compatibility (to be removed after full migration)
window.loadModels = () => window.ModelsManager.loadModels();
window.selectModelForManagement = (id, name) => window.ModelsManager.selectModelForManagement(id, name);
window.deleteModelFromList = (id, name) => window.ModelsManager.deleteModelFromList(id, name);
window.deleteSelectedModel = () => window.ModelsManager.deleteSelectedModel();
