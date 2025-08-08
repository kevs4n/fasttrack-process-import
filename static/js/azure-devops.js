/**
 * Azure DevOps Manager - Handle Azure DevOps integration and work item creation
 * Part of FastTrack Process Import Tool modularization
 * FUTURE: Will support creating work items in Azure DevOps from imported models
 */

class AzureDevOpsManager {
    constructor() {
        this.selectedModel = null;
        this.azureConfig = null;
        this.isConnected = false;
        this.init();
    }

    init() {
        console.log('AzureDevOpsManager initialized - Preparation for Phase 10');
        this.loadModels();
        this.setupConnectionForm();
    }

    setupConnectionForm() {
        // Set up Azure DevOps connection form validation
        const form = document.getElementById('azureConnectionForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.testConnection();
            });
        }
    }

    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const result = await response.json();
            
            if (result.success) {
                this.populateModelSelect(result.data.models);
            } else {
                UIUtils.showStatus('azureStatus', 'error', result.error || 'Failed to load models');
            }
        } catch (error) {
            UIUtils.showStatus('azureStatus', 'error', `Error: ${error.message}`);
        }
    }

    populateModelSelect(models) {
        const select = document.getElementById('azureModelSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select a model to create work items from...</option>';
        
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
            this.clearModelPreview();
            return;
        }

        this.selectedModel = modelId;
        
        try {
            UIUtils.showStatus('azureStatus', 'info', 'Loading model preview...');
            
            const response = await fetch(`/api/models/${modelId}`);
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.displayModelPreview(result.data.model);
                UIUtils.showStatus('azureStatus', 'success', 'Model loaded for Azure DevOps creation');
            } else {
                throw new Error(result.error || result.detail || 'Failed to load model');
            }
        } catch (error) {
            console.error('Model loading error:', error);
            UIUtils.showStatus('azureStatus', 'error', `Error loading model: ${error.message}`);
            this.clearModelPreview();
        }
    }

    clearModelPreview() {
        this.selectedModel = null;
        document.getElementById('azureModelPreview').style.display = 'none';
        document.getElementById('azureCreateSection').style.display = 'none';
    }

    displayModelPreview(model) {
        const container = document.getElementById('azureModelPreview');
        if (!container) return;

        const workItems = model.work_items || [];
        
        container.innerHTML = `
            <div class="azure-model-summary">
                <h4>Model Ready for Azure DevOps Creation</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h5>Total Work Items</h5>
                        <div class="stat-number">${workItems.length}</div>
                    </div>
                    <div class="stat-card">
                        <h5>Work Item Types</h5>
                        <div class="stat-number">${this.getUniqueTypes(workItems).length}</div>
                    </div>
                    <div class="stat-card">
                        <h5>Area Paths</h5>
                        <div class="stat-number">${this.getUniqueAreaPaths(workItems).length}</div>
                    </div>
                </div>
                
                <div class="preview-table">
                    <h5>Work Items Preview (First 10)</h5>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Type</th>
                                    <th>State</th>
                                    <th>Area Path</th>
                                    <th>Iteration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${workItems.slice(0, 10).map(item => `
                                    <tr>
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
                
                <div class="ready-notice">
                    <h5>✅ Ready for Azure DevOps Import</h5>
                    <p>This model is ready to be imported into Azure DevOps. The import will:</p>
                    <ul>
                        <li>Create work items with all field data preserved</li>
                        <li>Map Excel columns to proper Azure DevOps work item fields</li>
                        <li>Maintain hierarchical relationships and area paths</li>
                        <li>Include custom fields like Process Sequence ID, Catalog Status, etc.</li>
                        <li>Preserve source tracking information for traceability</li>
                        <li>Support both demo mode and real Azure DevOps imports</li>
                    </ul>
                    <p><strong>Test with Demo Mode:</strong> Use organization="demo", project="demo", pat_token="demo-token" to test without affecting real Azure DevOps data.</p>
                </div>
            </div>
        `;
        
        container.style.display = 'block';
        document.getElementById('azureCreateSection').style.display = 'block';
    }

    async testConnection() {
        const organization = document.getElementById('azureOrganization').value;
        const project = document.getElementById('azureProject').value;
        const pat = document.getElementById('azurePAT').value;

        if (!organization || !project || !pat) {
            UIUtils.showStatus('azureStatus', 'error', 'Please fill in all connection fields');
            return;
        }

        UIUtils.showStatus('azureStatus', 'info', 'Testing Azure DevOps connection...');

        try {
            const response = await fetch('/api/azure-devops/configure', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    organization: organization,
                    project: project,
                    pat_token: pat
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                UIUtils.showStatus('azureStatus', 'success', result.message || 'Azure DevOps connection successful');
                this.isConnected = true;
                this.azureConfig = { organization, project };
                
                // Update status indicators
                await this.checkStatus();
                
                // Show the create section if a model is selected
                if (this.selectedModel) {
                    document.getElementById('azureCreateSection').style.display = 'block';
                }
            } else {
                throw new Error(result.error || result.detail || 'Connection failed');
            }
        } catch (error) {
            console.error('Azure DevOps connection error:', error);
            UIUtils.showStatus('azureStatus', 'error', `Connection failed: ${error.message}`);
            this.isConnected = false;
        }
    }

    async checkStatus() {
        try {
            const response = await fetch('/api/azure-devops/status');
            const result = await response.json();
            
            if (result.success) {
                this.updateStatus(result.data.status);
            }
        } catch (error) {
            console.warn('Could not check Azure DevOps status:', error);
        }
    }
    
    updateStatus(status) {
        const indicator = document.getElementById('azureStatusIndicator');
        const text = document.getElementById('azureStatusText');
        
        if (status.configured && status.connection_test) {
            if (indicator) indicator.className = 'status-indicator status-connected';
            if (text) text.textContent = `Connected to ${status.organization}/${status.project}`;
            this.isConnected = true;
        } else if (status.configured && !status.connection_test) {
            if (indicator) indicator.className = 'status-indicator status-error';
            if (text) text.textContent = `Configuration error - ${status.organization}/${status.project}`;
            this.isConnected = false;
        } else {
            if (indicator) indicator.className = 'status-indicator status-disconnected';
            if (text) text.textContent = 'Not connected - Click "Test Connection" to connect';
            this.isConnected = false;
        }
    }

    async createWorkItems() {
        if (!this.selectedModel) {
            UIUtils.showStatus('azureStatus', 'error', 'No model selected');
            return;
        }

        if (!this.isConnected) {
            UIUtils.showStatus('azureStatus', 'error', 'Azure DevOps not connected. Please test connection first.');
            return;
        }

        // Confirm with user
        const confirmMessage = `This will create work items in Azure DevOps from your selected model.
        
Are you sure you want to proceed?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        UIUtils.showStatus('azureStatus', 'info', 'Creating work items in Azure DevOps...');

        try {
            const response = await fetch(`/api/azure-devops/import/${this.selectedModel}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                const summary = result.data.import_summary;
                
                let statusMessage = `Successfully created ${summary.imported_count} work items in Azure DevOps!`;
                if (summary.failed_count > 0) {
                    statusMessage += ` (${summary.failed_count} failed)`;
                }

                UIUtils.showStatus('azureStatus', 'success', statusMessage);

                // Show detailed results
                this.showImportResults(summary);
                
            } else {
                throw new Error(result.error || result.detail || 'Import failed');
            }
        } catch (error) {
            console.error('Azure DevOps import error:', error);
            UIUtils.showStatus('azureStatus', 'error', `Import failed: ${error.message}`);
        }
    }

    showImportResults(summary) {
        const isDemo = summary.demo_mode;
        const demoNote = isDemo ? ' (Demo Mode - No actual work items were created)' : '';
        
        const resultHtml = `
            <div class="import-results">
                <h4>🎉 Import Results${demoNote}</h4>
                <div class="stats-grid">
                    <div class="stat-card ${summary.imported_count > 0 ? 'success' : ''}">
                        <h5>Imported</h5>
                        <div class="stat-number">${summary.imported_count}</div>
                    </div>
                    <div class="stat-card ${summary.failed_count > 0 ? 'error' : ''}">
                        <h5>Failed</h5>
                        <div class="stat-number">${summary.failed_count}</div>
                    </div>
                    <div class="stat-card">
                        <h5>Total</h5>
                        <div class="stat-number">${summary.total_items}</div>
                    </div>
                </div>
                
                ${summary.work_items.length > 0 ? `
                <div class="preview-table">
                    <h5>Created Work Items (First 10)</h5>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Title</th>
                                    <th>Type</th>
                                    <th>State</th>
                                    <th>Area Path</th>
                                    ${isDemo ? '<th>Demo URL</th>' : '<th>Azure DevOps URL</th>'}
                                </tr>
                            </thead>
                            <tbody>
                                ${summary.work_items.slice(0, 10).map(item => `
                                    <tr>
                                        <td>${item.id}</td>
                                        <td title="${item.title}">${item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}</td>
                                        <td>${item.type}</td>
                                        <td>${item.state}</td>
                                        <td>${item.area_path || 'N/A'}</td>
                                        <td>${item.url ? `<a href="${item.url}" target="_blank">Open</a>` : 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}
                
                <div class="import-info">
                    <p><strong>Import Date:</strong> ${new Date(summary.import_date).toLocaleString()}</p>
                    ${isDemo ? `
                    <div class="demo-notice">
                        <h5>💡 Demo Mode Active</h5>
                        <p>This was a demo import. To create actual work items in Azure DevOps:</p>
                        <ul>
                            <li>Enter your real Azure DevOps organization name</li>
                            <li>Enter your real project name</li>
                            <li>Enter a valid Personal Access Token with Work Items (read & write) permissions</li>
                            <li>Test the connection and then run the import again</li>
                        </ul>
                    </div>
                    ` : `
                    <div class="success-notice">
                        <h5>✅ Real Import Complete</h5>
                        <p>Work items have been successfully created in your Azure DevOps project!</p>
                    </div>
                    `}
                </div>
            </div>
        `;

        UIUtils.showOperationResult(resultHtml, 'success');
    }

    // Helper methods
    getUniqueTypes(workItems) {
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

    // Prepare configuration for future implementation
    setConfiguration(config) {
        this.azureConfig = config;
        this.isConnected = true;
    }

    getConfiguration() {
        return this.azureConfig;
    }

    isConnectionEstablished() {
        return this.isConnected;
    }
}

// Initialize and expose globally
window.AzureDevOpsManager = new AzureDevOpsManager();

// Global functions for backward compatibility (to be removed after full migration)
window.testAzureConnection = () => window.AzureDevOpsManager.testConnection();
window.createWorkItems = () => window.AzureDevOpsManager.createWorkItems();
window.selectAzureModel = (id) => window.AzureDevOpsManager.selectModel(id);
