/**
 * UI Utilities - Common functions for user interface operations
 * Part of FastTrack Process Import Tool modularization
 */

// Tab management
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
    }
    
    // Add active class to the correct tab button
    const targetButton = document.querySelector(`[onclick="UIUtils.showTab('${tabName}')"]`);
    if (targetButton) {
        targetButton.classList.add('active');
    }
    
    // Load content when switching to specific tabs
    if (tabName === 'models') {
        if (window.ModelsManager) {
            window.ModelsManager.loadModels();
        }
    } else if (tabName === 'azure') {
        if (window.AzureDevOpsManager) {
            window.AzureDevOpsManager.checkStatus();
        }
    } else if (tabName === 'bulk') {
        if (window.BulkOperations) {
            window.BulkOperations.loadModels();
        }
    } else if (tabName === 'tree') {
        if (window.TreeViewManager) {
            window.TreeViewManager.loadModels();
        }
    }
}

// Status display utility
function showStatus(elementId, type, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.className = `status ${type}`;
        element.textContent = message;
        element.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => element.style.display = 'none', 5000);
        }
    }
}

// File size formatting utility
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Enhanced operation result display with multiple fallback strategies
function showOperationResult(message, type) {
    // Try to find the results section, but don't fail if it doesn't exist
    const resultsSection = document.getElementById('bulkResults');
    const resultsContent = document.getElementById('bulkResultsContent');
    
    if (resultsSection && resultsContent) {
        // If bulk results section exists, use it
        const html = `
            <div class="operation-result ${type}">
                <strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ${message}
            </div>
        `;
        
        resultsContent.innerHTML = html;
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    
    // Fallback 1: Try to use models status
    const modelsStatus = document.getElementById('modelsStatus');
    if (modelsStatus) {
        showStatus('modelsStatus', type, message);
        return;
    }
    
    // Fallback 2: Try to use any existing status element
    const statusElements = document.querySelectorAll('[id$="Status"]');
    if (statusElements.length > 0) {
        const statusId = statusElements[0].id;
        showStatus(statusId, type, message);
        return;
    }
    
    // Fallback 3: Create a temporary notification
    const notification = document.createElement('div');
    notification.className = `operation-result ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#fff3cd'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#ffeaa7'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#856404'};
        padding: 1rem;
        border-radius: 5px;
        z-index: 9999;
        max-width: 400px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    notification.innerHTML = `<strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ${message}`;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Loading state management
function setLoadingState(elementId, isLoading, loadingText = 'Loading...') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (isLoading) {
        element.disabled = true;
        element.innerHTML = `<span class="loading"></span> ${loadingText}`;
    } else {
        element.disabled = false;
        // Restore original content - you might want to store this beforehand
        element.innerHTML = element.getAttribute('data-original-text') || 'Complete';
    }
}

// Utility for safe property access
function getNestedProperty(obj, path, defaultValue = null) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : defaultValue;
    }, obj);
}

// Common API call wrapper
async function apiCall(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, finalOptions);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || result.detail || 'API call failed');
        }
        
        return { success: true, data: result };
    } catch (error) {
        console.error('API call error:', error);
        return { success: false, error: error.message };
    }
}

// Debounce utility for search/input fields
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Confirmation dialog utility
function confirmAction(message, onConfirm, onCancel = null) {
    if (confirm(message)) {
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    } else {
        if (typeof onCancel === 'function') {
            onCancel();
        }
    }
}

// Initialize UI utilities
window.UIUtils = {
    showTab,
    showStatus,
    formatFileSize,
    showOperationResult,
    setLoadingState,
    getNestedProperty,
    apiCall,
    debounce,
    confirmAction
};
