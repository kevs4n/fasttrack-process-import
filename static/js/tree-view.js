/**
 * Tree View Manager - Handle hierarchical data visualization
 * Part of FastTrack Process Import Tool modularization
 */

class TreeViewManager {
    constructor() {
        this.selectedTreeModel = null;
        this.loadedTreeData = null;
        this.treeContainer = null;
        this.init();
    }

    init() {
        console.log('TreeViewManager initialized');
        this.loadModels();
        this.setupTreeContainer();
    }

    setupTreeContainer() {
        this.treeContainer = document.getElementById('treeContainer');
        if (this.treeContainer) {
            this.treeContainer.innerHTML = '<p>Select a model to view its hierarchical structure.</p>';
        }
    }

    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const result = await response.json();
            
            if (result.success) {
                this.populateTreeModelSelect(result.data.models);
            } else {
                UIUtils.showStatus('treeStatus', 'error', result.error || 'Failed to load models');
            }
        } catch (error) {
            UIUtils.showStatus('treeStatus', 'error', `Error: ${error.message}`);
        }
    }

    populateTreeModelSelect(models) {
        const select = document.getElementById('treeModelSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select a model to visualize...</option>';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.filename} (${model.id})`;
            select.appendChild(option);
        });

        // Set up change handler
        select.onchange = (e) => this.selectTreeModel(e.target.value);
    }

    async selectTreeModel(modelId) {
        if (!modelId) {
            this.clearTreeView();
            return;
        }

        this.selectedTreeModel = modelId;
        
        try {
            UIUtils.showStatus('treeStatus', 'info', 'Loading model data...');
            
            const response = await fetch(`/api/models/${modelId}`);
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.loadedTreeData = result.data.model;
                this.buildTreeView(this.loadedTreeData);
                UIUtils.showStatus('treeStatus', 'success', 'Tree view generated successfully');
            } else {
                throw new Error(result.error || result.detail || 'Failed to load model');
            }
        } catch (error) {
            console.error('Tree model loading error:', error);
            UIUtils.showStatus('treeStatus', 'error', `Error loading model: ${error.message}`);
            this.clearTreeView();
        }
    }

    clearTreeView() {
        this.selectedTreeModel = null;
        this.loadedTreeData = null;
        
        if (this.treeContainer) {
            this.treeContainer.innerHTML = '<p>Select a model to view its hierarchical structure.</p>';
        }
    }

    buildTreeView(model) {
        if (!this.treeContainer || !model.work_items) {
            return;
        }

        const workItems = model.work_items;
        
        // Build hierarchy based on area paths
        const hierarchy = this.buildHierarchy(workItems);
        
        // Generate tree HTML
        const treeHTML = this.generateTreeHTML(hierarchy);
        
        this.treeContainer.innerHTML = `
            <div class="tree-view-header">
                <h4>Hierarchical View</h4>
                <div class="tree-controls">
                    <button onclick="window.TreeViewManager.expandAll()" class="btn btn-sm">Expand All</button>
                    <button onclick="window.TreeViewManager.collapseAll()" class="btn btn-sm">Collapse All</button>
                </div>
            </div>
            <div class="tree-statistics">
                <div class="stat-item">Total Items: ${workItems.length}</div>
                <div class="stat-item">Root Areas: ${Object.keys(hierarchy).length}</div>
                <div class="stat-item">Max Depth: ${this.calculateMaxDepth(hierarchy)}</div>
            </div>
            <div class="tree-view">
                ${treeHTML}
            </div>
        `;

        // Set up tree interaction
        this.setupTreeInteraction();
    }

    buildHierarchy(workItems) {
        const hierarchy = {};
        
        workItems.forEach(item => {
            const areaPath = item['Area Path'] || item.area_path || 'Root';
            const pathParts = areaPath.split('\\').filter(part => part.trim());
            
            // If no path parts, use 'Root'
            if (pathParts.length === 0) {
                pathParts.push('Root');
            }
            
            let currentLevel = hierarchy;
            
            // Build nested structure
            pathParts.forEach((part, index) => {
                if (!currentLevel[part]) {
                    currentLevel[part] = {
                        items: [],
                        children: {}
                    };
                }
                
                // Add item to the deepest level
                if (index === pathParts.length - 1) {
                    currentLevel[part].items.push(item);
                }
                
                currentLevel = currentLevel[part].children;
            });
        });
        
        return hierarchy;
    }

    generateTreeHTML(hierarchy, level = 0) {
        let html = '';
        
        Object.keys(hierarchy).forEach(key => {
            const node = hierarchy[key];
            const hasChildren = Object.keys(node.children).length > 0;
            const hasItems = node.items.length > 0;
            
            html += `
                <div class="tree-node" style="margin-left: ${level * 20}px;">
                    <div class="tree-node-header" onclick="window.TreeViewManager.toggleNode(this)">
                        <span class="tree-toggle ${hasChildren || hasItems ? 'expandable' : ''}">${hasChildren || hasItems ? '▼' : '•'}</span>
                        <span class="tree-label">${key}</span>
                        <span class="tree-count">(${node.items.length + this.countTotalItems(node.children)})</span>
                    </div>
                    <div class="tree-content">
            `;
            
            // Add direct items
            if (hasItems) {
                html += '<div class="tree-items">';
                node.items.forEach(item => {
                    html += `
                        <div class="tree-item" onclick="window.TreeViewManager.showItemDetails('${item.ID || item.id || 'N/A'}')">
                            <span class="item-icon">📋</span>
                            <span class="item-title">${item.Title || item.title || 'Untitled'}</span>
                            <span class="item-type">[${item['Work Item Type'] || item.type || 'Unknown'}]</span>
                            <span class="item-state">${item.State || item.state || 'No State'}</span>
                        </div>
                    `;
                });
                html += '</div>';
            }
            
            // Add children recursively
            if (hasChildren) {
                html += this.generateTreeHTML(node.children, level + 1);
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    countTotalItems(children) {
        let count = 0;
        Object.keys(children).forEach(key => {
            count += children[key].items.length;
            count += this.countTotalItems(children[key].children);
        });
        return count;
    }

    calculateMaxDepth(hierarchy, currentDepth = 0) {
        let maxDepth = currentDepth;
        
        Object.keys(hierarchy).forEach(key => {
            const childDepth = this.calculateMaxDepth(hierarchy[key].children, currentDepth + 1);
            maxDepth = Math.max(maxDepth, childDepth);
        });
        
        return maxDepth;
    }

    setupTreeInteraction() {
        // All interaction is handled through onclick attributes for simplicity
        // This ensures the tree remains functional even as we modularize
    }

    toggleNode(headerElement) {
        const node = headerElement.parentElement;
        const content = node.querySelector('.tree-content');
        const toggle = headerElement.querySelector('.tree-toggle');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggle.textContent = '▼';
            node.classList.remove('collapsed');
        } else {
            content.style.display = 'none';
            toggle.textContent = '▶';
            node.classList.add('collapsed');
        }
    }

    expandAll() {
        const contents = this.treeContainer.querySelectorAll('.tree-content');
        const toggles = this.treeContainer.querySelectorAll('.tree-toggle');
        
        contents.forEach(content => {
            content.style.display = 'block';
        });
        
        toggles.forEach(toggle => {
            if (toggle.classList.contains('expandable')) {
                toggle.textContent = '▼';
            }
        });
        
        // Remove collapsed class from all nodes
        const nodes = this.treeContainer.querySelectorAll('.tree-node');
        nodes.forEach(node => node.classList.remove('collapsed'));
    }

    collapseAll() {
        const contents = this.treeContainer.querySelectorAll('.tree-content');
        const toggles = this.treeContainer.querySelectorAll('.tree-toggle');
        
        contents.forEach(content => {
            content.style.display = 'none';
        });
        
        toggles.forEach(toggle => {
            if (toggle.classList.contains('expandable')) {
                toggle.textContent = '▶';
            }
        });
        
        // Add collapsed class to all nodes
        const nodes = this.treeContainer.querySelectorAll('.tree-node');
        nodes.forEach(node => node.classList.add('collapsed'));
    }

    showItemDetails(itemId) {
        if (!this.loadedTreeData || !this.loadedTreeData.work_items) {
            return;
        }
        
        const item = this.loadedTreeData.work_items.find(wi => 
            (wi.ID && wi.ID.toString() === itemId) || 
            (wi.id && wi.id.toString() === itemId)
        );
        
        if (!item) {
            UIUtils.showOperationResult('Work item not found.', 'warning');
            return;
        }
        
        // Create detailed view
        const details = Object.keys(item)
            .filter(key => item[key] !== null && item[key] !== undefined && item[key] !== '')
            .map(key => `<div><strong>${key}:</strong> ${item[key]}</div>`)
            .join('');
        
        UIUtils.showOperationResult(`
            <h4>Work Item Details</h4>
            <div style="max-height: 400px; overflow-y: auto; text-align: left;">
                ${details}
            </div>
        `, 'info');
    }

    // Get current tree data for other components
    getTreeData() {
        return this.loadedTreeData;
    }

    // Get selected model for tree view
    getSelectedTreeModel() {
        return this.selectedTreeModel;
    }
}

// Initialize and expose globally
window.TreeViewManager = new TreeViewManager();

// Global functions for backward compatibility (to be removed after full migration)
window.loadTreeModels = () => window.TreeViewManager.loadModels();
window.selectTreeModel = (id) => window.TreeViewManager.selectTreeModel(id);
