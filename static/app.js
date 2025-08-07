// Fasttrack Process Model Import Tool - Frontend JavaScript

// Tab management - moved to top to ensure it's always available
function showTab(tabName) {
    console.log('showTab called with:', tabName);
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
        console.log('Activated tab:', tabName + '-tab');
    } else {
        console.error('Tab not found:', tabName + '-tab');
    }
    
    // Add active class to the correct tab button
    const targetButton = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (targetButton) {
        targetButton.classList.add('active');
        console.log('Activated button for tab:', tabName);
    } else {
        console.error('Button not found for tab:', tabName);
    }
}

// Initialize showTab function as soon as possible
window.showTab = showTab;

class FasttrackImporter {
    constructor() {
        this.models = [];
        this.githubFiles = [];
        this.selectedFiles = new Set();
        this.azureConnected = false;
        this.currentPreviewModel = null;
        this.previewChanges = {
            workItemTypeReplacements: {},
            deletedStates: new Set(),
            filteredAreaPaths: null
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadModels();
        this.checkAzureStatus();
    }

    setupEventListeners() {
        // File upload
        const fileInput = document.getElementById('fileInput');
        const fileUpload = document.getElementById('fileUpload');

        fileUpload.addEventListener('click', () => fileInput.click());
        fileUpload.addEventListener('dragover', this.handleDragOver);
        fileUpload.addEventListener('drop', this.handleDrop);
        fileInput.addEventListener('change', this.handleFileSelect);

        // Auto-refresh models when switching to models tab
        document.querySelector('[onclick="showTab(\'models\')"]').addEventListener('click', () => {
            setTimeout(() => this.loadModels(), 100);
        });
    }

    handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.uploadFile(files[0]);
        }
    }

    handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        this.showUploadProgress(true);
        this.showStatus('uploadStatus', 'info', `Uploading ${file.name}...`);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('uploadStatus', 'success', result.message);
                this.loadModels(); // Refresh the models list
            } else {
                this.showStatus('uploadStatus', 'error', result.error || 'Upload failed');
            }
        } catch (error) {
            this.showStatus('uploadStatus', 'error', `Upload error: ${error.message}`);
        } finally {
            this.showUploadProgress(false);
        }
    }

    async loadGitHubFiles() {
        const button = document.querySelector('[onclick="loadGitHubFiles()"]');
        const icon = document.getElementById('githubLoadIcon');
        
        button.disabled = true;
        icon.className = 'loading';

        try {
            const response = await fetch('/api/github/files');
            const result = await response.json();

            if (result.success) {
                this.githubFiles = result.files;
                this.displayGitHubFiles();
                this.showStatus('githubStatus', 'success', `Found ${result.files.length} Excel files`);
            } else {
                this.showStatus('githubStatus', 'error', result.error || 'Failed to load files');
            }
        } catch (error) {
            this.showStatus('githubStatus', 'error', `Error: ${error.message}`);
        } finally {
            button.disabled = false;
            icon.className = '';
            icon.textContent = '🔄';
        }
    }

    displayGitHubFiles() {
        const container = document.getElementById('githubFiles');
        const filesList = document.getElementById('filesList');
        container.classList.remove('hidden');
        
        if (this.githubFiles.length === 0) {
            filesList.innerHTML = '<p>No Excel files found in the repository.</p>';
            return;
        }

        filesList.innerHTML = this.githubFiles.map(file => `
            <div class="github-file" id="file-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}">
                <div style="display: flex; align-items: center;">
                    <input type="checkbox" 
                           id="checkbox-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}"
                           onchange="toggleFileSelection('${file.path}')" />
                    <div>
                        <strong>${file.name}</strong>
                        <div class="file-info">${file.path}</div>
                    </div>
                </div>
                <div class="file-info">
                    ${this.formatFileSize(file.size)}
                </div>
            </div>
        `).join('');
        
        this.updateProcessButton();
    }

    toggleFileSelection(filePath) {
        if (this.selectedFiles.has(filePath)) {
            this.selectedFiles.delete(filePath);
        } else {
            this.selectedFiles.add(filePath);
        }
        
        const fileElement = document.getElementById(`file-${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`);
        if (this.selectedFiles.has(filePath)) {
            fileElement.classList.add('selected');
        } else {
            fileElement.classList.remove('selected');
        }
        
        this.updateProcessButton();
    }

    selectAllFiles() {
        this.githubFiles.forEach(file => {
            this.selectedFiles.add(file.path);
            const checkbox = document.getElementById(`checkbox-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`);
            const fileElement = document.getElementById(`file-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`);
            if (checkbox) checkbox.checked = true;
            if (fileElement) fileElement.classList.add('selected');
        });
        this.updateProcessButton();
    }

    clearAllFiles() {
        this.selectedFiles.clear();
        this.githubFiles.forEach(file => {
            const checkbox = document.getElementById(`checkbox-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`);
            const fileElement = document.getElementById(`file-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`);
            if (checkbox) checkbox.checked = false;
            if (fileElement) fileElement.classList.remove('selected');
        });
        this.updateProcessButton();
    }

    updateProcessButton() {
        const button = document.getElementById('processBtn');
        const icon = document.getElementById('processIcon');
        
        if (this.selectedFiles.size > 0) {
            button.disabled = false;
            icon.textContent = '⚡';
            button.innerHTML = `<span id="processIcon">⚡</span> Process ${this.selectedFiles.size} Selected Files`;
        } else {
            button.disabled = true;
            button.innerHTML = `<span id="processIcon">⚡</span> Process Selected Files`;
        }
    }

    async processSelectedFiles() {
        if (this.selectedFiles.size === 0) {
            this.showStatus('githubStatus', 'error', 'No files selected');
            return;
        }

        const button = document.getElementById('processBtn');
        const icon = document.getElementById('processIcon');
        
        button.disabled = true;
        icon.className = 'loading';

        let successCount = 0;
        let errorCount = 0;
        const totalFiles = this.selectedFiles.size;

        for (const filePath of this.selectedFiles) {
            try {
                this.showStatus('githubStatus', 'info', `Processing ${filePath} (${successCount + errorCount + 1}/${totalFiles})...`);
                
                const response = await fetch('/api/github/download', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ file_path: filePath })
                });

                const result = await response.json();

                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`Failed to process ${filePath}:`, result.error);
                }
            } catch (error) {
                errorCount++;
                console.error(`Error processing ${filePath}:`, error);
            }
        }

        // Show final results
        if (errorCount === 0) {
            this.showStatus('githubStatus', 'success', `Successfully processed all ${successCount} files!`);
        } else {
            this.showStatus('githubStatus', 'info', `Processed ${successCount} files successfully, ${errorCount} failed.`);
        }

        // Refresh models and reset selection
        this.loadModels();
        this.clearAllFiles();
        
        button.disabled = false;
        icon.className = '';
        icon.textContent = '⚡';
    }

    async downloadGitHubFile(filePath) {
        this.showStatus('githubStatus', 'info', `Downloading ${filePath}...`);

        try {
            const response = await fetch('/api/github/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ file_path: filePath })
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('githubStatus', 'success', result.message);
                this.loadModels(); // Refresh the models list
            } else {
                this.showStatus('githubStatus', 'error', result.error || 'Download failed');
            }
        } catch (error) {
            this.showStatus('githubStatus', 'error', `Download error: ${error.message}`);
        }
    }

    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const result = await response.json();

            if (result.success) {
                this.models = result.models;
                this.displayModels();
                this.updateModelSelect();
            } else {
                this.showStatus('modelsStatus', 'error', result.error || 'Failed to load models');
            }
        } catch (error) {
            this.showStatus('modelsStatus', 'error', `Error: ${error.message}`);
        }
    }

    displayModels() {
        const container = document.getElementById('modelsList');
        
        if (this.models.length === 0) {
            container.innerHTML = '<p>No models imported yet. Upload an Excel file or download from GitHub to get started.</p>';
            return;
        }

        container.innerHTML = this.models.map(model => `
            <div class="model-card">
                <h3>${model.filename}</h3>
                <div class="model-meta">
                    <div>📅 ${new Date(model.created_at).toLocaleDateString()}</div>
                    <div>📊 ${model.summary.total_sheets} sheets, ${model.summary.total_rows} rows</div>
                    <div>🏷️ ${model.summary.work_item_types.join(', ')}</div>
                    <div>📍 Source: ${model.source}</div>
                </div>
                <div class="model-actions">
                    <button class="btn" onclick="previewModel('${model.id}')">👁️ Preview & Edit</button>
                    <button class="btn btn-secondary" onclick="exportModelCSV('${model.id}')">📤 Export CSV</button>
                    <button class="btn btn-success" onclick="importModelToAzure('${model.id}')">☁️ Import to Azure</button>
                </div>
            </div>
        `).join('');
    }

    async previewModel(modelId) {
        try {
            const response = await fetch(`/api/models/${modelId}`);
            const result = await response.json();

            if (result.success) {
                this.currentPreviewModel = result.data.model;
                this.resetPreviewChanges();
                this.showModelPreview();
            } else {
                this.showStatus('modelsStatus', 'error', 'Failed to load model details');
            }
        } catch (error) {
            this.showStatus('modelsStatus', 'error', `Error: ${error.message}`);
        }
    }

    showModelPreview() {
        const previewDiv = document.getElementById('modelPreview');
        const contentDiv = document.getElementById('previewContent');
        
        if (!this.currentPreviewModel) return;

        const model = this.currentPreviewModel;
        
        // Populate work item type dropdowns
        this.populateWorkItemTypeDropdowns();
        this.populateAreaPathDropdown();
        
        // Show preview content
        contentDiv.innerHTML = `
            <div class="operation-summary">
                <h4>📊 Model: ${model.filename}</h4>
                <p><strong>Total Work Items:</strong> ${model.summary.total_rows}</p>
                <p><strong>Work Item Types:</strong> ${model.summary.work_item_types.join(', ')}</p>
                <p><strong>Process Areas:</strong> ${model.summary.process_areas.join(', ')}</p>
            </div>
            
            <div class="preview-table">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Type</th>
                            <th>State</th>
                            <th>Area Path</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.getPreviewWorkItems().slice(0, 20).map(item => `
                            <tr>
                                <td>${item.title || 'N/A'}</td>
                                <td>${this.getDisplayWorkItemType(item.type)}</td>
                                <td>${item.state || 'N/A'}</td>
                                <td>${item.area_path || 'N/A'}</td>
                                <td>${(item.description || '').substring(0, 100)}${(item.description || '').length > 100 ? '...' : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${model.summary.total_rows > 20 ? `<p>... and ${model.summary.total_rows - 20} more items</p>` : ''}
            </div>
        `;
        
        previewDiv.classList.remove('hidden');
        previewDiv.scrollIntoView({ behavior: 'smooth' });
    }

    populateWorkItemTypeDropdowns() {
        if (!this.currentPreviewModel) return;
        
        const replaceFromSelect = document.getElementById('replaceFromType');
        const workItemTypes = [...new Set(this.currentPreviewModel.process_hierarchy.map(item => item.type))];
        
        replaceFromSelect.innerHTML = '<option value="">Select type to replace...</option>' + 
            workItemTypes.map(type => `<option value="${type}">${type}</option>`).join('');
    }

    populateAreaPathDropdown() {
        if (!this.currentPreviewModel) return;
        
        const areaPathSelect = document.getElementById('filterAreaPath');
        const areaPaths = [...new Set(this.currentPreviewModel.process_hierarchy.map(item => item.area_path).filter(Boolean))];
        
        areaPathSelect.innerHTML = '<option value="">Show all areas...</option>' + 
            areaPaths.map(path => `<option value="${path}">${path}</option>`).join('');
    }

    getPreviewWorkItems() {
        if (!this.currentPreviewModel) return [];
        
        let workItems = [...this.currentPreviewModel.process_hierarchy];
        
        // Apply deletions by state
        workItems = workItems.filter(item => !this.previewChanges.deletedStates.has(item.state));
        
        // Apply area path filter
        if (this.previewChanges.filteredAreaPaths) {
            workItems = workItems.filter(item => item.area_path === this.previewChanges.filteredAreaPaths);
        }
        
        return workItems;
    }

    getDisplayWorkItemType(originalType) {
        return this.previewChanges.workItemTypeReplacements[originalType] || originalType;
    }

    replaceWorkItemType() {
        const fromType = document.getElementById('replaceFromType').value;
        const toType = document.getElementById('replaceToType').value;
        
        if (!fromType || !toType) {
            alert('Please select both source and target work item types');
            return;
        }
        
        this.previewChanges.workItemTypeReplacements[fromType] = toType;
        this.showModelPreview(); // Refresh preview
        this.showStatus('modelsStatus', 'success', `Will replace all "${fromType}" with "${toType}"`);
    }

    deleteByState() {
        const state = document.getElementById('deleteByState').value;
        
        if (!state) {
            alert('Please select a state to delete');
            return;
        }
        
        this.previewChanges.deletedStates.add(state);
        this.showModelPreview(); // Refresh preview
        this.showStatus('modelsStatus', 'success', `Will delete all items with state "${state}"`);
    }

    filterByAreaPath() {
        const areaPath = document.getElementById('filterAreaPath').value;
        
        this.previewChanges.filteredAreaPaths = areaPath || null;
        this.showModelPreview(); // Refresh preview
        
        if (areaPath) {
            this.showStatus('modelsStatus', 'info', `Filtered to show only "${areaPath}"`);
        } else {
            this.showStatus('modelsStatus', 'info', 'Showing all area paths');
        }
    }

    resetPreviewChanges() {
        this.previewChanges = {
            workItemTypeReplacements: {},
            deletedStates: new Set(),
            filteredAreaPaths: null
        };
    }

    resetPreview() {
        this.resetPreviewChanges();
        this.showModelPreview();
        this.showStatus('modelsStatus', 'info', 'Preview reset to original data');
    }

    closePreview() {
        document.getElementById('modelPreview').classList.add('hidden');
    }

    async applyChanges() {
        if (!this.currentPreviewModel) return;
        
        // This would need to be implemented in the backend
        // For now, just show what would be applied
        const changes = {
            modelId: this.currentPreviewModel.id,
            workItemTypeReplacements: this.previewChanges.workItemTypeReplacements,
            deletedStates: Array.from(this.previewChanges.deletedStates),
            filteredAreaPaths: this.previewChanges.filteredAreaPaths
        };
        
        console.log('Changes to apply:', changes);
        alert('Changes would be applied (backend implementation needed)');
    }

    updateModelSelect() {
        const select = document.getElementById('modelSelect');
        select.innerHTML = '<option value="">Choose a model...</option>' + 
            this.models.map(model => `
                <option value="${model.id}">${model.filename} (${new Date(model.created_at).toLocaleDateString()})</option>
            `).join('');
    }

    async viewModel(modelId) {
        try {
            const response = await fetch(`/api/models/${modelId}`);
            const result = await response.json();

            if (result.success) {
                this.showModelDetails(result.model);
            } else {
                alert('Failed to load model details');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    showModelDetails(model) {
        const details = `
            <h3>Model Details: ${model.filename}</h3>
            <p><strong>Created:</strong> ${new Date(model.created_at).toLocaleString()}</p>
            <p><strong>Sheets:</strong> ${model.summary.total_sheets}</p>
            <p><strong>Total Rows:</strong> ${model.summary.total_rows}</p>
            <p><strong>Work Item Types:</strong> ${model.summary.work_item_types.join(', ')}</p>
            <p><strong>Process Areas:</strong> ${model.summary.process_areas.join(', ')}</p>
            
            <h4>Work Items Preview:</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                ${model.work_items.slice(0, 10).map(item => `
                    <div style="border: 1px solid #ddd; margin: 5px; padding: 10px; border-radius: 5px;">
                        <strong>${item.title}</strong> (${item.type})<br>
                        <small>${item.description || 'No description'}</small>
                    </div>
                `).join('')}
                ${model.work_items.length > 10 ? `<p>... and ${model.work_items.length - 10} more items</p>` : ''}
            </div>
        `;

        // Create modal or update existing content area
        this.showModal('Model Details', details);
    }

    async exportModelCSV(modelId) {
        try {
            const response = await fetch(`/api/models/${modelId}/export/csv`);
            const result = await response.json();

            if (result.success) {
                // Trigger download
                window.open(`/api/models/${modelId}/download/csv`, '_blank');
                this.showStatus('modelsStatus', 'success', 'CSV export started');
            } else {
                this.showStatus('modelsStatus', 'error', result.error || 'Export failed');
            }
        } catch (error) {
            this.showStatus('modelsStatus', 'error', `Export error: ${error.message}`);
        }
    }

    async checkAzureStatus() {
        try {
            const response = await fetch('/api/azure-devops/status');
            const result = await response.json();

            if (result.success) {
                this.updateAzureStatus(result.status);
            }
        } catch (error) {
            console.warn('Could not check Azure DevOps status:', error);
        }
    }

    updateAzureStatus(status) {
        const indicator = document.getElementById('azureStatusIndicator');
        const text = document.getElementById('azureStatusText');
        const importSection = document.getElementById('importSection');

        if (status.configured && status.connection_test) {
            indicator.className = 'status-indicator status-connected';
            text.textContent = `Connected to ${status.organization}/${status.project}`;
            importSection.classList.remove('hidden');
            this.azureConnected = true;
        } else {
            indicator.className = 'status-indicator status-disconnected';
            text.textContent = 'Not Connected';
            importSection.classList.add('hidden');
            this.azureConnected = false;
        }
    }

    async configureAzureDevOps() {
        const org = document.getElementById('azureOrg').value;
        const project = document.getElementById('azureProject').value;
        const pat = document.getElementById('azurePat').value;

        if (!org || !project || !pat) {
            this.showStatus('azureStatus', 'error', 'Please fill in all Azure DevOps fields');
            return;
        }

        const button = document.querySelector('[onclick="configureAzureDevOps()"]');
        const icon = document.getElementById('azureConfigIcon');
        
        button.disabled = true;
        icon.className = 'loading';

        try {
            const response = await fetch('/api/azure-devops/configure', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    organization: org,
                    project: project,
                    pat_token: pat
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('azureStatus', 'success', result.message);
                this.checkAzureStatus();
            } else {
                this.showStatus('azureStatus', 'error', result.error || 'Configuration failed');
            }
        } catch (error) {
            this.showStatus('azureStatus', 'error', `Configuration error: ${error.message}`);
        } finally {
            button.disabled = false;
            icon.className = '';
            icon.textContent = '🔧';
        }
    }

    async testAzureConnection() {
        const button = document.querySelector('[onclick="testAzureConnection()"]');
        const icon = document.getElementById('azureTestIcon');
        
        button.disabled = true;
        icon.className = 'loading';

        try {
            const response = await fetch('/api/azure-devops/status');
            const result = await response.json();

            if (result.success && result.status.connection_test) {
                this.showStatus('azureStatus', 'success', 'Connection test successful!');
                this.updateAzureStatus(result.status);
            } else {
                this.showStatus('azureStatus', 'error', 'Connection test failed. Please check your credentials.');
            }
        } catch (error) {
            this.showStatus('azureStatus', 'error', `Connection test error: ${error.message}`);
        } finally {
            button.disabled = false;
            icon.className = '';
            icon.textContent = '🔍';
        }
    }

    async importToAzureDevOps() {
        const modelId = document.getElementById('modelSelect').value;

        if (!modelId) {
            this.showStatus('azureStatus', 'error', 'Please select a model to import');
            return;
        }

        const button = document.querySelector('[onclick="importToAzureDevOps()"]');
        const icon = document.getElementById('importIcon');
        
        button.disabled = true;
        icon.className = 'loading';

        try {
            const response = await fetch(`/api/azure-devops/import/${modelId}`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('azureStatus', 'success', result.message);
                this.showImportSummary(result.import_summary);
            } else {
                this.showStatus('azureStatus', 'error', result.error || 'Import failed');
            }
        } catch (error) {
            this.showStatus('azureStatus', 'error', `Import error: ${error.message}`);
        } finally {
            button.disabled = false;
            icon.className = '';
            icon.textContent = '📤';
        }
    }

    async importModelToAzure(modelId) {
        if (!this.azureConnected) {
            alert('Please configure Azure DevOps connection first');
            showTab('azure');
            return;
        }

        // Set the model in the select dropdown and trigger import
        document.getElementById('modelSelect').value = modelId;
        showTab('azure');
        setTimeout(() => this.importToAzureDevOps(), 500);
    }

    showImportSummary(summary) {
        const details = `
            <h3>Import Summary</h3>
            <p><strong>Total Items:</strong> ${summary.total_items}</p>
            <p><strong>Successfully Imported:</strong> ${summary.imported_count}</p>
            <p><strong>Failed:</strong> ${summary.failed_count}</p>
            <p><strong>Import Date:</strong> ${new Date(summary.import_date).toLocaleString()}</p>
            
            ${summary.failed_count > 0 ? `
                <h4>Failed Items:</h4>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${summary.failed_items.map(item => `
                        <div style="border: 1px solid #f5c6cb; margin: 5px; padding: 10px; border-radius: 5px; background: #f8d7da;">
                            <strong>${item.item.title || 'Unknown'}</strong><br>
                            <small>Error: ${item.error}</small>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;

        this.showModal('Import Summary', details);
    }

    showModal(title, content) {
        // Simple modal implementation
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); display: flex; align-items: center; 
            justify-content: center; z-index: 1000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 10px; max-width: 800px; max-height: 80vh; overflow-y: auto;">
                <h2>${title}</h2>
                ${content}
                <br>
                <button class="btn" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    showUploadProgress(show) {
        const progressBar = document.getElementById('uploadProgress');
        if (show) {
            progressBar.classList.remove('hidden');
            // Simulate progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                }
                document.getElementById('progressFill').style.width = progress + '%';
            }, 200);
        } else {
            progressBar.classList.add('hidden');
            document.getElementById('progressFill').style.width = '0%';
        }
    }

    showStatus(elementId, type, message) {
        const element = document.getElementById(elementId);
        element.className = `status ${type}`;
        element.textContent = message;
        element.style.display = 'block';

        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Global functions for onclick handlers
function loadGitHubFiles() {
    app.loadGitHubFiles();
}

function toggleFileSelection(filePath) {
    app.toggleFileSelection(filePath);
}

function selectAllFiles() {
    app.selectAllFiles();
}

function clearAllFiles() {
    app.clearAllFiles();
}

function processSelectedFiles() {
    app.processSelectedFiles();
}

function downloadGitHubFile(filePath) {
    app.downloadGitHubFile(filePath);
}

function loadModels() {
    app.loadModels();
}

function viewModel(modelId) {
    app.viewModel(modelId);
}

function previewModel(modelId) {
    app.previewModel(modelId);
}

function replaceWorkItemType() {
    app.replaceWorkItemType();
}

function deleteByState() {
    app.deleteByState();
}

function filterByAreaPath() {
    app.filterByAreaPath();
}

function resetPreview() {
    app.resetPreview();
}

function closePreview() {
    app.closePreview();
}

function applyChanges() {
    app.applyChanges();
}

function exportModelCSV(modelId) {
    app.exportModelCSV(modelId);
}

function importModelToAzure(modelId) {
    app.importModelToAzure(modelId);
}

function configureAzureDevOps() {
    app.configureAzureDevOps();
}

function testAzureConnection() {
    app.testAzureConnection();
}

function importToAzureDevOps() {
    app.importToAzureDevOps();
}

// Initialize the application
try {
    const app = new FasttrackImporter();
    window.app = app; // Make it globally available
} catch (error) {
    console.error('Error initializing FasttrackImporter:', error);
    // showTab function will still work even if app initialization fails
}
