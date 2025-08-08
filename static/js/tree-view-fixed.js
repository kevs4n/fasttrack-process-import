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
        
        // Build hierarchy based on parent-child relationships only
        const rootItems = this.buildHierarchy(workItems);
        
        // Generate tree HTML
        const treeHTML = this.generateTreeHTML(rootItems);
        
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
                <div class="stat-item">Root Items: ${rootItems.length}</div>
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

    setupTreeInteraction() {
        // Tree interaction is handled by onclick events in the HTML
        console.log('Tree interaction set up');
    }

    toggleChildren(toggleElement) {
        const treeNode = toggleElement.closest('.tree-node');
        const childrenDiv = treeNode.querySelector('.tree-children');
        
        if (childrenDiv) {
            const isExpanded = childrenDiv.style.display !== 'none';
            childrenDiv.style.display = isExpanded ? 'none' : 'block';
            toggleElement.textContent = isExpanded ? '▶' : '▼';
        }
    }

    expandAll() {
        const childrenDivs = this.treeContainer.querySelectorAll('.tree-children');
        const toggles = this.treeContainer.querySelectorAll('.tree-toggle.expandable');
        
        childrenDivs.forEach(div => {
            div.style.display = 'block';
        });
        
        toggles.forEach(toggle => {
            toggle.textContent = '▼';
        });
    }

    collapseAll() {
        const childrenDivs = this.treeContainer.querySelectorAll('.tree-children');
        const toggles = this.treeContainer.querySelectorAll('.tree-toggle.expandable');
        
        childrenDivs.forEach(div => {
            div.style.display = 'none';
        });
        
        toggles.forEach(toggle => {
            toggle.textContent = '▶';
        });
    }

    showItemDetails(itemId) {
        if (!this.loadedTreeData || !this.loadedTreeData.work_items) {
            return;
        }

        const item = this.loadedTreeData.work_items.find(i => 
            (i.ID || i.id) == itemId
        );

        if (!item) {
            UIUtils.showStatus('treeStatus', 'error', 'Item not found');
            return;
        }

        // Create and show modal with item details
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Work Item Details</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="item-details">
                        <p><strong>ID:</strong> ${item.ID || item.id || 'N/A'}</p>
                        <p><strong>Title:</strong> ${item.Title || item.title || 'N/A'}</p>
                        <p><strong>Type:</strong> ${item['Work Item Type'] || item.type || 'N/A'}</p>
                        <p><strong>State:</strong> ${item.State || item.state || 'N/A'}</p>
                        <p><strong>Priority:</strong> ${item.Priority || item.priority || 'N/A'}</p>
                        <p><strong>Assigned To:</strong> ${item['Assigned To'] || item.assigned_to || 'Unassigned'}</p>
                        <p><strong>Area Path:</strong> ${item['Area Path'] || item.area_path || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Export functionality
    exportTreeData() {
        if (!this.loadedTreeData) {
            UIUtils.showStatus('treeStatus', 'error', 'No tree data to export');
            return;
        }

        const dataStr = JSON.stringify(this.loadedTreeData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `tree-data-${this.selectedTreeModel}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // API methods for external access
    getTreeData() {
        return this.loadedTreeData;
    }

    getSelectedTreeModel() {
        return this.selectedTreeModel;
    }

    async loadModelTree() {
        if (this.selectedTreeModel) {
            await this.selectTreeModel(this.selectedTreeModel);
        }
    }

    // Additional tree manipulation methods
    expandAllNodes() {
        this.expandAll();
    }

    collapseAllNodes() {
        this.collapseAll();
    }
}

// Initialize and expose globally
window.TreeViewManager = new TreeViewManager();
