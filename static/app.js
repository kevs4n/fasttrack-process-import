// Fasttrack Process Model Import Tool - Frontend JavaScript

class FasttrackImporter {
    constructor() {
        this.models = [];
        this.githubFiles = [];
        this.azureConnected = false;
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
        container.classList.remove('hidden');
        
        if (this.githubFiles.length === 0) {
            container.innerHTML = '<p>No Excel files found in the repository.</p>';
            return;
        }

        container.innerHTML = this.githubFiles.map(file => `
            <div class="github-file" onclick="downloadGitHubFile('${file.path}')">
                <div>
                    <strong>${file.name}</strong>
                    <div class="file-info">${file.path}</div>
                </div>
                <div class="file-info">
                    ${this.formatFileSize(file.size)}
                </div>
            </div>
        `).join('');
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
                    <button class="btn" onclick="viewModel('${model.id}')">👁️ View</button>
                    <button class="btn btn-secondary" onclick="exportModelCSV('${model.id}')">📤 Export CSV</button>
                    <button class="btn btn-success" onclick="importModelToAzure('${model.id}')">☁️ Import to Azure</button>
                </div>
            </div>
        `).join('');
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

// Tab management
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Add active class to clicked tab button
    event.target.classList.add('active');
}

// Global functions for onclick handlers
function loadGitHubFiles() {
    app.loadGitHubFiles();
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
const app = new FasttrackImporter();
