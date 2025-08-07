/**
 * Models Manager - Handle model operations and prepare for merge functionality
 * Part of FastTrack Process Import Tool modularization
 */

class ModelsManager {
    constructor() {
        this.selectedModelForManagement = null;
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
            return;
        }
        
        container.innerHTML = models.map(model => `
            <div class="model-card ${this.selectedModelForManagement === model.id ? 'selected' : ''}" 
                 onclick="window.ModelsManager.selectModelForManagement('${model.id}', '${model.filename}')"
                 style="background: white; border-radius: 8px; padding: 1rem; border: 2px solid ${this.selectedModelForManagement === model.id ? '#004e89' : '#eee'}; margin-bottom: 1rem; cursor: pointer; transition: all 0.3s ease;">
                <h3>${model.filename}</h3>
                <div style="margin: 1rem 0; font-size: 0.9rem; color: #666;">
                    <div>📅 ${new Date(model.created_at).toLocaleDateString()}</div>
                    <div>🆔 ID: ${model.id}</div>
                    <div>📍 Source: ${model.source}</div>
                </div>
                <div class="model-actions" style="display: flex; gap: 0.5rem;" onclick="event.stopPropagation();">
                    <button onclick="window.ModelsManager.deleteModelFromList('${model.id}', '${model.filename}')" 
                            class="btn btn-danger">🗑️ Delete</button>
                    <button onclick="window.ModelsManager.prepareForMerge('${model.id}', '${model.filename}')" 
                            class="btn btn-secondary" disabled title="Merge functionality coming soon">🔄 Merge</button>
                </div>
                ${this.selectedModelForManagement === model.id ? '<div style="color: #004e89; font-weight: bold; margin-top: 1rem;">✓ Selected for Management</div>' : ''}
            </div>
        `).join('');
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

    // FUTURE: Model merge functionality will be implemented here
    async prepareForMerge(modelId, filename) {
        UIUtils.showOperationResult(`Model merge functionality is planned for Phase 9. Model "${filename}" will support merging with other models to combine work items and create unified process maps.`, 'info');
        
        // TODO: Implement merge functionality
        // - Select target model for merge
        // - Handle hierarchy conflicts
        // - Merge work items with duplicate detection
        // - Update area paths and iterations
        // - Create merged model with combined data
        console.log('Merge preparation for model:', modelId, filename);
    }

    // Get models list for other components
    getModels() {
        return this.models;
    }

    // Get selected model for management
    getSelectedModel() {
        return this.selectedModelForManagement;
    }
}

// Initialize and expose globally
window.ModelsManager = new ModelsManager();

// Global functions for backward compatibility (to be removed after full migration)
window.loadModels = () => window.ModelsManager.loadModels();
window.selectModelForManagement = (id, name) => window.ModelsManager.selectModelForManagement(id, name);
window.deleteModelFromList = (id, name) => window.ModelsManager.deleteModelFromList(id, name);
window.deleteSelectedModel = () => window.ModelsManager.deleteSelectedModel();
