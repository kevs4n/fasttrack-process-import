/**
 * GitHub Integration Manager - Handle repository access and file downloads
 * Part of FastTrack Process Import Tool modularization
 */

class GitHubManager {
    constructor() {
        this.selectedRepo = null;
        this.selectedFile = null;
        this.init();
    }

    init() {
        console.log('GitHubManager initialized');
        this.loadRepositories();
    }

    async loadRepositories() {
        try {
            UIUtils.showStatus('githubStatus', 'info', 'Loading repositories...');
            
            const response = await fetch('/api/github/repos');
            const result = await response.json();
            
            if (result.success) {
                this.populateRepositorySelect(result.data.repos);
                UIUtils.showStatus('githubStatus', 'success', 'Repositories loaded');
            } else {
                throw new Error(result.error || 'Failed to load repositories');
            }
        } catch (error) {
            console.error('Repository loading error:', error);
            UIUtils.showStatus('githubStatus', 'error', `Error: ${error.message}`);
        }
    }

    populateRepositorySelect(repos) {
        const select = document.getElementById('repoSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select a repository...</option>';
        
        repos.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo.name;
            option.textContent = `${repo.name} - ${repo.description || 'No description'}`;
            select.appendChild(option);
        });

        // Set up change handler
        select.onchange = (e) => this.selectRepository(e.target.value);
    }

    async selectRepository(repoName) {
        if (!repoName) {
            this.clearRepositoryData();
            return;
        }

        this.selectedRepo = repoName;
        
        try {
            UIUtils.showStatus('githubStatus', 'info', 'Loading repository files...');
            
            const response = await fetch(`/api/github/repos/${encodeURIComponent(repoName)}/files`);
            const result = await response.json();
            
            if (result.success) {
                this.displayRepositoryFiles(result.data.files);
                UIUtils.showStatus('githubStatus', 'success', 'Repository files loaded');
                document.getElementById('repoFilesSection').style.display = 'block';
            } else {
                throw new Error(result.error || 'Failed to load repository files');
            }
        } catch (error) {
            console.error('Repository files loading error:', error);
            UIUtils.showStatus('githubStatus', 'error', `Error: ${error.message}`);
            this.clearRepositoryData();
        }
    }

    clearRepositoryData() {
        this.selectedRepo = null;
        this.selectedFile = null;
        document.getElementById('repoFilesSection').style.display = 'none';
        
        const container = document.getElementById('repoFiles');
        if (container) {
            container.innerHTML = '';
        }
    }

    displayRepositoryFiles(files) {
        const container = document.getElementById('repoFiles');
        if (!container) return;

        // Filter for Excel files
        const excelFiles = files.filter(file => 
            file.name.toLowerCase().endsWith('.xlsx') || 
            file.name.toLowerCase().endsWith('.xls')
        );

        if (excelFiles.length === 0) {
            container.innerHTML = `
                <div class="no-files-message">
                    <p>No Excel files found in this repository.</p>
                    <p>The system looks for .xlsx and .xls files that can be imported as process models.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="files-header">
                <h4>Excel Files Available for Download</h4>
                <p>Found ${excelFiles.length} Excel file(s) in ${this.selectedRepo}</p>
            </div>
            <div class="files-grid">
                ${excelFiles.map(file => `
                    <div class="file-card ${this.selectedFile === file.path ? 'selected' : ''}" 
                         onclick="window.GitHubManager.selectFile('${file.path}', '${file.name}')"
                         style="background: white; border-radius: 8px; padding: 1rem; border: 2px solid ${this.selectedFile === file.path ? '#004e89' : '#eee'}; margin-bottom: 1rem; cursor: pointer; transition: all 0.3s ease;">
                        <div class="file-icon">📊</div>
                        <h5>${file.name}</h5>
                        <div class="file-details">
                            <div>📁 ${file.path}</div>
                            <div>📏 ${this.formatFileSize(file.size)}</div>
                            <div>🕒 ${new Date(file.last_modified).toLocaleDateString()}</div>
                        </div>
                        <div class="file-actions" style="margin-top: 1rem;" onclick="event.stopPropagation();">
                            <button onclick="window.GitHubManager.downloadFile('${file.path}', '${file.name}')" 
                                    class="btn btn-primary">⬇️ Download & Import</button>
                        </div>
                        ${this.selectedFile === file.path ? '<div style="color: #004e89; font-weight: bold; margin-top: 1rem;">✓ Selected</div>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    selectFile(filePath, fileName) {
        this.selectedFile = filePath;
        
        // Update the display to show selection
        const container = document.getElementById('repoFiles');
        if (container && this.selectedRepo) {
            // Re-fetch and display files to update selection state
            this.selectRepository(this.selectedRepo);
        }
        
        UIUtils.showStatus('githubStatus', 'info', `Selected: ${fileName}`);
    }

    async downloadFile(filePath, fileName) {
        if (!this.selectedRepo) {
            UIUtils.showStatus('githubStatus', 'error', 'No repository selected');
            return;
        }

        if (!confirm(`Download and import "${fileName}" from ${this.selectedRepo}?\n\nThis will create a new model in your workspace.`)) {
            return;
        }

        try {
            UIUtils.showStatus('githubStatus', 'info', 'Downloading file...');
            this.updateDownloadProgress(0);

            const response = await fetch('/api/github/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repo_name: this.selectedRepo,
                    file_path: filePath,
                    file_name: fileName
                })
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                this.updateDownloadProgress(100);
                UIUtils.showStatus('githubStatus', 'success', 
                    `Successfully downloaded and imported "${fileName}"`);
                
                // Refresh models in other components
                if (window.ModelsManager) {
                    window.ModelsManager.loadModels();
                }
                if (window.BulkOperations) {
                    window.BulkOperations.loadModels();
                }
                
                // Show success details
                UIUtils.showOperationResult(
                    `File "${fileName}" has been downloaded from GitHub and imported as a new model. You can now find it in the Models tab for management or Bulk Operations tab for processing.`,
                    'success'
                );
            } else {
                throw new Error(result.error || result.detail || 'Download failed');
            }
        } catch (error) {
            console.error('Download error:', error);
            UIUtils.showStatus('githubStatus', 'error', `Download error: ${error.message}`);
            this.updateDownloadProgress(0);
        }
    }

    updateDownloadProgress(percentage) {
        const progressBar = document.getElementById('githubProgress');
        const progressFill = document.getElementById('githubProgressFill');
        
        if (progressBar && progressFill) {
            if (percentage > 0) {
                progressBar.classList.remove('hidden');
                progressFill.style.width = `${percentage}%`;
                
                if (percentage >= 100) {
                    setTimeout(() => {
                        progressBar.classList.add('hidden');
                    }, 2000);
                }
            } else {
                progressBar.classList.add('hidden');
            }
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    downloadSelectedFile() {
        if (!this.selectedFile) {
            UIUtils.showStatus('githubStatus', 'warning', 'No file selected');
            return;
        }
        
        // Extract filename from path
        const fileName = this.selectedFile.split('/').pop();
        this.downloadFile(this.selectedFile, fileName);
    }

    // Get repositories for other components
    getSelectedRepository() {
        return this.selectedRepo;
    }

    // Get selected file for other components
    getSelectedFile() {
        return this.selectedFile;
    }
}

// Initialize and expose globally
window.GitHubManager = new GitHubManager();

// Global functions for backward compatibility (to be removed after full migration)
window.loadRepositories = () => window.GitHubManager.loadRepositories();
window.selectRepository = (name) => window.GitHubManager.selectRepository(name);
window.downloadFile = (path, name) => window.GitHubManager.downloadFile(path, name);
