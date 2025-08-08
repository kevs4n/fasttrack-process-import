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
                
                <div class="phase-notice">
                    <h5>⚠️ Azure DevOps Integration - Phase 10 Feature</h5>
                    <p>This functionality is planned for Phase 10 of the modularization roadmap. When implemented, it will:</p>
                    <ul>
                        <li>Connect to your Azure DevOps organization</li>
                        <li>Map Excel columns to Azure DevOps work item fields</li>
                        <li>Create work items with proper hierarchies and relationships</li>
                        <li>Handle area paths, iterations, and custom fields</li>
                        <li>Provide bulk creation with progress tracking</li>
                        <li>Support both new projects and existing project updates</li>
                    </ul>
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

        // FUTURE: Implement actual Azure DevOps connection test
        UIUtils.showStatus('azureStatus', 'info', 'Azure DevOps connection testing is planned for Phase 10');
        
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
        } else {
            if (indicator) indicator.className = 'status-indicator status-disconnected';
            if (text) text.textContent = 'Phase 10 Feature - Coming Soon';
        }
    }

    async createWorkItems() {
        if (!this.selectedModel) {
            UIUtils.showStatus('azureStatus', 'error', 'No model selected');
            return;
        }

        // FUTURE: Implement work item creation
        UIUtils.showOperationResult(`
            Azure DevOps Work Item Creation (Phase 10 Feature)
            
            This will create work items in Azure DevOps from your selected model:
            
            📋 Process Overview:
            1. Map Excel columns to Azure DevOps fields
            2. Validate work item types and states
            3. Create area paths and iterations if needed
            4. Bulk create work items with proper hierarchy
            5. Link related work items
            6. Provide detailed creation report
            
            🔄 Benefits:
            • Seamless transition from Excel to Azure DevOps
            • Preserve work item relationships
            • Maintain process hierarchy
            • Enable team collaboration
            
            This feature will be available after Phase 9 (Model Merge) completion.
        `, 'info');
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
