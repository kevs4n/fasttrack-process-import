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
        console.log('Building hierarchy for', workItems.length, 'work items');
        
        // First, deduplicate items by ID
        const uniqueItems = this.deduplicateItems(workItems);
        console.log('After deduplication:', uniqueItems.length, 'unique items');
        
        // Build parent-child relationships
        const itemsById = {};
        const rootItems = [];
        
        // Index all items by ID
        uniqueItems.forEach(item => {
            const itemId = item.ID || item.id || `item_${Math.random().toString(36).substr(2, 9)}`;
            itemsById[itemId] = {
                ...item,
                id: itemId,
                children: []
            };
        });
        
        // Build parent-child relationships
        uniqueItems.forEach(item => {
            const itemId = item.ID || item.id || `item_${Math.random().toString(36).substr(2, 9)}`;
            const parentId = item['Parent ID'] || item.parent_id || item.parentId;
            
            if (parentId && itemsById[parentId]) {
                // Add to parent's children
                itemsById[parentId].children.push(itemsById[itemId]);
            } else {
                // Root level item
                rootItems.push(itemsById[itemId]);
            }
        });
        
        console.log('Found', rootItems.length, 'root items');
        return rootItems; // Return root items directly, no area path grouping
    }
    
    deduplicateItems(workItems) {
        const seen = new Set();
        const unique = [];
        
        workItems.forEach(item => {
            // Create a unique key based on ID, Title, and Work Item Type
            const itemId = item.ID || item.id;
            const title = item.Title || item.title || '';
            const type = item['Work Item Type'] || item.type || '';
            const state = item.State || item.state || '';
            
            const uniqueKey = `${itemId}_${title}_${type}_${state}`.toLowerCase();
            
            if (!seen.has(uniqueKey)) {
                seen.add(uniqueKey);
                unique.push(item);
            } else {
                console.log('Duplicate found:', title, '-', type, '-', state);
            }
        });
        
        return unique;
    }
    
    buildAreaPathHierarchy(rootItems) {
        const hierarchy = {};
        
        // Group root items by Area Path for better organization
        rootItems.forEach(item => {
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

    generateTreeHTML(rootItems, level = 0) {
        if (!Array.isArray(rootItems)) {
            return '<p>No items to display</p>';
        }
        
        let html = '';
        
        rootItems.forEach(item => {
            const itemId = item.ID || item.id || 'N/A';
            const title = item.Title || item.title || 'Untitled';
            const workItemType = item['Work Item Type'] || item.type || 'Unknown';
            const state = item.State || item.state || 'No State';
            const priority = item.Priority || item.priority || '';
            const assignedTo = item['Assigned To'] || item.assigned_to || '';
            const hasChildren = item.children && item.children.length > 0;
            
            // Choose icon based on work item type
            let icon = '📋';
            switch(workItemType.toLowerCase()) {
                case 'user story': icon = '📖'; break;
                case 'task': icon = '✅'; break;
                case 'bug': icon = '🐛'; break;
                case 'feature': icon = '⭐'; break;
                case 'epic': icon = '🎯'; break;
                case 'scenario': icon = '🎬'; break;
                case 'use case': icon = '🎭'; break;
                case 'process': icon = '⚙️'; break;
                case 'end to end': icon = '🔄'; break;
                default: icon = '📋';
            }
            
            html += `
                <div class="tree-node" style="margin-left: ${level * 20}px;">
                    <div class="tree-item enhanced-item ${hasChildren ? 'has-children' : ''}" 
                         onclick="window.TreeViewManager.showItemDetails('${itemId}')" 
                         title="Click to view details">
                        <div class="item-header">
                            ${hasChildren ? `<span class="tree-toggle expandable" onclick="event.stopPropagation(); window.TreeViewManager.toggleChildren(this)">▼</span>` : '<span class="tree-toggle">•</span>'}
                            <span class="item-icon">${icon}</span>
                            <span class="item-id">#${itemId}</span>
                            <span class="item-type type-${workItemType.toLowerCase().replace(/\s+/g, '-')}">[${workItemType}]</span>
                            <span class="item-state state-${state.toLowerCase().replace(/\s+/g, '-')}">${state}</span>
                        </div>
                        <div class="item-title">${title}</div>
                        ${priority ? `<div class="item-meta">Priority: ${priority}</div>` : ''}
                        ${assignedTo ? `<div class="item-meta">Assigned: ${assignedTo}</div>` : ''}
                    </div>
                    
                    ${hasChildren ? `
                        <div class="tree-children">
                            ${this.generateTreeHTML(item.children, level + 1)}
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        return html;
    }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        return html;
    }
    
    renderChildItems(children, level) {
        let html = '';
        
        children.forEach(child => {
            const itemId = child.ID || child.id || 'N/A';
            const title = child.Title || child.title || 'Untitled';
            const workItemType = child['Work Item Type'] || child.type || 'Unknown';
            const state = child.State || child.state || 'No State';
            
            let icon = '📋';
            switch(workItemType.toLowerCase()) {
                case 'user story': icon = '📖'; break;
                case 'task': icon = '✅'; break;
                case 'bug': icon = '🐛'; break;
                case 'feature': icon = '⭐'; break;
                case 'epic': icon = '🎯'; break;
                case 'scenario': icon = '🎬'; break;
                case 'use case': icon = '🎭'; break;
                case 'process': icon = '⚙️'; break;
                case 'end to end': icon = '🔄'; break;
                default: icon = '📋';
            }
            
            html += `
                <div class="tree-item child-item enhanced-item" style="margin-left: ${level * 15}px;"
                     onclick="window.TreeViewManager.showItemDetails('${itemId}')" 
                     title="Child item - Click to view details">
                    <div class="item-header">
                        <span class="item-icon">${icon}</span>
                        <span class="item-id">#${itemId}</span>
                        <span class="item-type type-${workItemType.toLowerCase().replace(/\s+/g, '-')}">[${workItemType}]</span>
                        <span class="item-state state-${state.toLowerCase().replace(/\s+/g, '-')}">${state}</span>
                    </div>
                    <div class="item-title">${title}</div>
                </div>
            `;
            
            // Recursively render grandchildren
            if (child.children && child.children.length > 0) {
                html += this.renderChildItems(child.children, level + 1);
            }
        });
        
        return html;
    }
    
    renderChildItems(children, level) {
        let html = '';
        
        children.forEach(child => {
            const itemId = child.ID || child.id || 'N/A';
            const title = child.Title || child.title || 'Untitled';
            const workItemType = child['Work Item Type'] || child.type || 'Unknown';
            const state = child.State || child.state || 'No State';
            
            let icon = '📋';
            switch(workItemType.toLowerCase()) {
                case 'user story': icon = '📖'; break;
                case 'task': icon = '✅'; break;
                case 'bug': icon = '🐛'; break;
                case 'feature': icon = '⭐'; break;
                case 'epic': icon = '🎯'; break;
                case 'scenario': icon = '🎬'; break;
                case 'use case': icon = '🎭'; break;
                case 'process': icon = '⚙️'; break;
                case 'end to end': icon = '🔄'; break;
                default: icon = '📋';
            }
            
            html += `
                <div class="tree-item child-item enhanced-item" style="margin-left: ${level * 15}px;"
                     onclick="window.TreeViewManager.showItemDetails('${itemId}')" 
                     title="Child item - Click to view details">
                    <div class="item-header">
                        <span class="item-icon">${icon}</span>
                        <span class="item-id">#${itemId}</span>
                        <span class="item-type type-${workItemType.toLowerCase().replace(/\s+/g, '-')}">[${workItemType}]</span>
                        <span class="item-state state-${state.toLowerCase().replace(/\s+/g, '-')}">${state}</span>
                    </div>
                    <div class="item-title">${title}</div>
                </div>
            `;
            
            // Recursively render grandchildren
            if (child.children && child.children.length > 0) {
                html += this.renderChildItems(child.children, level + 1);
            }
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
    
    // New methods to support restored HTML functionality
    async loadModelTree() {
        const select = document.getElementById('treeModelSelect');
        if (!select || !select.value) {
            this.clearTreeView();
            this.hideTreeInfo();
            return;
        }
        
        const modelId = select.value;
        await this.selectTreeModel(modelId);
        
        if (this.loadedTreeData) {
            this.showTreeInfo();
        }
    }
    
    expandAllNodes() {
        const treeContent = document.querySelectorAll('.tree-content');
        const toggles = document.querySelectorAll('.tree-toggle.expandable');
        
        treeContent.forEach(content => {
            content.style.display = 'block';
        });
        
        toggles.forEach(toggle => {
            toggle.textContent = '▼';
        });
        
        UIUtils.showStatus('treeStatus', 'info', 'All nodes expanded');
    }
    
    collapseAllNodes() {
        const treeContent = document.querySelectorAll('.tree-content');
        const toggles = document.querySelectorAll('.tree-toggle.expandable');
        
        treeContent.forEach(content => {
            content.style.display = 'none';
        });
        
        toggles.forEach(toggle => {
            toggle.textContent = '▶';
        });
        
        UIUtils.showStatus('treeStatus', 'info', 'All nodes collapsed');
    }
    
    exportTreeData() {
        if (!this.loadedTreeData) {
            UIUtils.showStatus('treeStatus', 'warning', 'No tree data to export');
            return;
        }
        
        const treeData = {
            model: this.loadedTreeData,
            exported_at: new Date().toISOString(),
            total_items: this.loadedTreeData.work_items ? this.loadedTreeData.work_items.length : 0
        };
        
        const dataStr = JSON.stringify(treeData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `tree-export-${this.loadedTreeData.filename || 'model'}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        UIUtils.showStatus('treeStatus', 'success', 'Tree data exported successfully');
    }
    
    showTreeInfo() {
        const treeInfo = document.getElementById('treeInfo');
        const modelNameSpan = document.getElementById('treeModelName');
        const totalItemsSpan = document.getElementById('treeTotalItems');
        const totalFoldersSpan = document.getElementById('treeTotalFolders');
        const structureTypeSpan = document.getElementById('treeStructureType');
        
        if (treeInfo && this.loadedTreeData) {
            treeInfo.style.display = 'block';
            
            if (modelNameSpan) {
                modelNameSpan.textContent = this.loadedTreeData.filename || 'Unknown';
            }
            
            if (totalItemsSpan && this.loadedTreeData.work_items) {
                totalItemsSpan.textContent = this.loadedTreeData.work_items.length;
            }
            
            if (totalFoldersSpan && this.loadedTreeData.work_items) {
                const uniqueAreaPaths = new Set(
                    this.loadedTreeData.work_items.map(item => 
                        item['Area Path'] || item.area_path || 'Root'
                    )
                );
                totalFoldersSpan.textContent = uniqueAreaPaths.size;
            }
            
            if (structureTypeSpan) {
                structureTypeSpan.textContent = 'Hierarchical';
            }
        }
    }
    
    hideTreeInfo() {
        const treeInfo = document.getElementById('treeInfo');
        if (treeInfo) {
            treeInfo.style.display = 'none';
        }
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
            UIUtils.showStatus('treeStatus', 'warning', 'Item details not found');
            return;
        }
        
        const treeDetails = document.getElementById('treeDetails');
        const selectedItemDetails = document.getElementById('selectedItemDetails');
        
        if (treeDetails && selectedItemDetails) {
            treeDetails.style.display = 'block';
            
            selectedItemDetails.innerHTML = `
                <div class="item-details-card">
                    <h4>${item.Title || item.title || 'Untitled Work Item'}</h4>
                    <div class="item-details-grid">
                        <div class="detail-item">
                            <strong>ID:</strong> ${item.ID || item.id || 'N/A'}
                        </div>
                        <div class="detail-item">
                            <strong>Type:</strong> ${item['Work Item Type'] || item.type || 'Unknown'}
                        </div>
                        <div class="detail-item">
                            <strong>State:</strong> ${item.State || item.state || 'No State'}
                        </div>
                        <div class="detail-item">
                            <strong>Area Path:</strong> ${item['Area Path'] || item.area_path || 'Root'}
                        </div>
                        <div class="detail-item">
                            <strong>Iteration:</strong> ${item['Iteration Path'] || item.iteration_path || 'N/A'}
                        </div>
                        <div class="detail-item">
                            <strong>Assigned To:</strong> ${item['Assigned To'] || item.assigned_to || 'Unassigned'}
                        </div>
                        ${item.Description || item.description ? `
                            <div class="detail-item full-width">
                                <strong>Description:</strong><br>
                                <div class="description-content">${item.Description || item.description}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    }
}

// Initialize and expose globally
window.TreeViewManager = new TreeViewManager();

// Global functions for backward compatibility
window.loadTreeModels = () => window.TreeViewManager.loadModels();
window.selectTreeModel = (id) => window.TreeViewManager.selectTreeModel(id);
window.refreshTreeModels = () => window.TreeViewManager.loadModels();
window.loadModelTree = () => window.TreeViewManager.loadModelTree();
window.expandAllNodes = () => window.TreeViewManager.expandAllNodes();
window.collapseAllNodes = () => window.TreeViewManager.collapseAllNodes();
window.exportTreeData = () => window.TreeViewManager.exportTreeData();
