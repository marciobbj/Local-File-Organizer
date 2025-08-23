// Global application state
let appState = {
    selectedDirectory: null,
    selectedMode: null,
    currentTree: null,
    proposedTree: null,
    outputPath: null,
    recursiveSearch: true
};

// Elementos DOM
const elements = {
    screens: {
        welcome: document.getElementById('welcome-screen'),
        modeSelection: document.getElementById('mode-selection-screen'),
        review: document.getElementById('review-screen'),
        success: document.getElementById('success-screen')
    },
    buttons: {
        selectDirectory: document.getElementById('select-directory-btn'),
        continue: document.getElementById('continue-btn'),
        refresh: document.getElementById('refresh-btn'),
        cancel: document.getElementById('cancel-btn'),
        proceed: document.getElementById('proceed-btn'),
        newOrganization: document.getElementById('new-organization-btn'),
        openFolder: document.getElementById('open-folder-btn')
    },
    displays: {
        selectedPath: document.getElementById('selected-path-text'),
        currentTree: document.getElementById('current-tree'),
        proposedTree: document.getElementById('proposed-tree'),
        outputPath: document.getElementById('output-path-text'),
        loadingText: document.getElementById('loading-text')
    },
    modeOptions: document.querySelectorAll('.mode-option'),
    modeSelect: document.getElementById('mode-select'),
    loadingOverlay: document.getElementById('loading-overlay'),
    recursiveSearchToggle: document.getElementById('recursive-search-toggle')
};

// Application initialization
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeProgressListener();
    showScreen('welcome-screen');
});

// Inicializar event listeners
function initializeEventListeners() {
    // Directory selection button
    elements.buttons.selectDirectory.addEventListener('click', handleSelectDirectory);
    
    // Mode options
    elements.modeOptions.forEach(option => {
        option.addEventListener('click', () => handleModeSelection(option));
    });
    
    // Continue button
    elements.buttons.continue.addEventListener('click', handleContinue);
    
    // Refresh button
    elements.buttons.refresh.addEventListener('click', handleRefresh);
    
    // Cancel button
    elements.buttons.cancel.addEventListener('click', handleCancel);
    
    // Proceed button
    elements.buttons.proceed.addEventListener('click', handleProceed);
    
    // New organization button
    elements.buttons.newOrganization.addEventListener('click', handleNewOrganization);
    
    // Open folder button
    elements.buttons.openFolder.addEventListener('click', handleOpenFolder);
    
    // Mode change in review screen
    elements.modeSelect.addEventListener('change', handleModeChange);
    
    // Recursive search toggle
    elements.recursiveSearchToggle.addEventListener('change', handleRecursiveSearchToggle);
}

// Initialize progress listener
function initializeProgressListener() {
    if (window.electronAPI && window.electronAPI.onOrganizationProgress) {
        window.electronAPI.onOrganizationProgress((event, data) => {
            if (data && typeof data.progress === 'number') {
                updateProgress(data.progress, data.message);
            }
        });
    }
}

// Function to show screens
function showScreen(screenId) {
    // Esconder todas as telas
    Object.values(elements.screens).forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Mostrar a tela selecionada
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

// Handle directory selection
async function handleSelectDirectory() {
    try {
        showLoading('Selecting directory...');
        
        const selectedPath = await window.electronAPI.selectDirectory();
        
        if (selectedPath) {
            appState.selectedDirectory = selectedPath;
            elements.displays.selectedPath.textContent = selectedPath;
            
            // Generate current tree
            await generateCurrentTree();
            
            hideLoading();
            showScreen('mode-selection-screen');
        } else {
            hideLoading();
        }
    } catch (error) {
        hideLoading();
        showError('Error selecting directory: ' + error.message);
    }
}

// Handle mode selection
function handleModeSelection(selectedOption) {
    // Remove previous selection
    elements.modeOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    // Select new option
    selectedOption.classList.add('selected');
    
    // Update state
    appState.selectedMode = selectedOption.dataset.mode;
    
    // Enable continue button
    elements.buttons.continue.disabled = false;
}

// Handle continuation to review screen
async function handleContinue() {
    if (!appState.selectedMode) {
        showError('Please select an organization mode.');
        return;
    }
    
    try {
        showLoading('Generating organization proposal...');
        
        // Generate organization proposal
        await generateProposedTree();
        
        hideLoading();
        showScreen('review-screen');
    } catch (error) {
        hideLoading();
        showError('Error generating proposal: ' + error.message);
    }
}

// Generate current tree
async function generateCurrentTree() {
    try {
        showLoading('Scanning directory...');
        
        // Scan real directory with recursive search option
        const result = await window.electronAPI.scanDirectory({
            dirPath: appState.selectedDirectory,
            recursive: appState.recursiveSearch
        });
        
        hideLoading();
        
        if (result.success) {
            appState.currentTree = result.tree;
            renderTree(elements.displays.currentTree, result.tree, 'current');
            
            // Update OS indicator and statistics
            updateOSIndicator('current', result.tree.os);
            updateStats(result.tree);
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error generating current tree:', error);
        appState.currentTree = { error: 'Error loading current structure: ' + error.message };
        renderTree(elements.displays.currentTree, appState.currentTree, 'current');
    }
}

// Generate proposed tree
async function generateProposedTree() {
    try {
        showLoading('Generating organized structure...');
        showProgress();
        
        const outputPath = generateOutputPath();
        appState.outputPath = outputPath;
        
        // Chamar API para gerar proposta organizada
        const result = await window.electronAPI.organizeFiles({
            inputPath: appState.selectedDirectory,
            outputPath: outputPath,
            mode: appState.selectedMode,
            dryRun: true,
            recursive: appState.recursiveSearch
        });
        
        hideLoading();
        hideProgress();
        
        if (result.success) {
            appState.proposedTree = result.tree;
            renderTree(elements.displays.proposedTree, result.tree, 'proposed');
            
            // Update OS indicator and statistics
            updateOSIndicator('proposed', result.tree.os);
            updateStats(result.tree);
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        hideLoading();
        hideProgress();
        console.error('Error generating proposed tree:', error);
        appState.proposedTree = { error: 'Error generating proposal: ' + error.message };
        renderTree(elements.displays.proposedTree, appState.proposedTree, 'proposed');
    }
}

// Generate output path
function generateOutputPath() {
    const inputDir = appState.selectedDirectory;
    const parentDir = inputDir.substring(0, inputDir.lastIndexOf('/') || inputDir.lastIndexOf('\\'));
    return `${parentDir}/organized_folder`;
}

// Detectar sistema operacional
function detectOS() {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux')) return 'linux';
    return 'unknown';
}



// Render tree
function renderTree(container, treeData, type) {
    if (treeData.error) {
        container.innerHTML = `<div class="error">${treeData.error}</div>`;
        return;
    }
    
    container.innerHTML = '';
    
    const os = treeData.os || detectOS();
            const osClass = os !== 'unknown' ? os : 'macos';
    
    if (type === 'current') {
        container.innerHTML = `<div class="tree-item folder ${osClass}">📁 ${treeData.name || 'Directory'}</div>`;
    } else {
        container.innerHTML = `<div class="tree-item folder ${osClass}">📁 ${treeData.name || 'Organized Directory'}</div>`;
    }
    
    if (treeData.children) {
        renderTreeChildren(container, treeData.children, 1);
    }
}

// Render tree children
function renderTreeChildren(container, children, level) {
    children.forEach((child, index) => {
        const isLast = index === children.length - 1;
        const prefix = '│   '.repeat(level - 1) + (isLast ? '└── ' : '├── ');
        let icon;
        if (child.type === 'folder') {
            icon = '📁';
        } else if (child.type === 'ignored_folder') {
            icon = '📁'; // Same icon but will be styled differently
        } else {
            icon = '📄';
        }
        const os = child.os || detectOS();
        const osClass = os !== 'unknown' ? os : 'macos';
        
        const treeItem = document.createElement('div');
        let className = `tree-item ${child.type} ${osClass}`;
        if (child.type === 'ignored_folder') {
            className += ' ignored-folder';
        }
        treeItem.className = className;
        
        // Add extra information for files
        let extraInfo = '';
        if (child.type === 'file') {
            if (child.size) {
                extraInfo += ` (${formatFileSize(child.size)})`;
            }
            if (child.modified) {
                extraInfo += ` - ${formatDate(child.modified)}`;
            }
        }
        
        treeItem.innerHTML = prefix + icon + ' ' + child.name + extraInfo;
        container.appendChild(treeItem);
        
        if (child.children && child.children.length > 0) {
            renderTreeChildren(container, child.children, level + 1);
        }
    });
}

// Manipular refresh
async function handleRefresh() {
    try {
        showLoading('Updating proposal...');
        
        // Update selected mode
        appState.selectedMode = elements.modeSelect.value;
        
        // Regenerate proposed tree with new mode
        await generateProposedTree();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Error updating: ' + error.message);
    }
}

// Manipular cancelamento
function handleCancel() {
    showScreen('welcome-screen');
    resetAppState();
}

// Manipular prosseguimento
async function handleProceed() {
    try {
        showLoading('Executing organization...');
        showProgress();
        
        
        
        // Execute real organization
        const result = await window.electronAPI.executeOrganization({
            inputPath: appState.selectedDirectory,
            outputPath: appState.outputPath,
            mode: appState.selectedMode,
            recursive: appState.recursiveSearch
        });
        
        if (result.success) {
            hideLoading();
            hideProgress();
            elements.displays.outputPath.textContent = appState.outputPath;
            
            // Show additional information about the organization
            if (result.processedFiles !== undefined && result.totalFiles !== undefined) {
                console.log(`Organization completed: ${result.processedFiles} of ${result.totalFiles} files processed`);
            }
            
            showScreen('success-screen');
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        hideLoading();
        hideProgress();
        showError('Error executing organization: ' + error.message);
    }
}

        // Handle new organization
function handleNewOrganization() {
    resetAppState();
    showScreen('welcome-screen');
}

// Handle opening folder
async function handleOpenFolder() {
    if (!appState.outputPath) {
        showError('No output path available');
        return;
    }

    try {
        const result = await window.electronAPI.openFolder({
            folderPath: appState.outputPath
        });

        if (result.success) {
            console.log('Folder opened successfully:', appState.outputPath);
        } else {
            showError(result.error || 'Failed to open folder');
        }
    } catch (error) {
        console.error('Error opening folder:', error);
        showError('Error opening folder: ' + error.message);
    }
}

        // Handle mode change
function handleModeChange() {
    appState.selectedMode = elements.modeSelect.value;
}

// Handle recursive search toggle
function handleRecursiveSearchToggle() {
    appState.recursiveSearch = elements.recursiveSearchToggle.checked;
    
    // Update description based on toggle state
    const description = elements.recursiveSearchToggle.parentElement.querySelector('.toggle-description');
    if (description) {
        if (appState.recursiveSearch) {
            description.textContent = 'Search in all subfolders';
        } else {
            description.textContent = 'Search only in root folder';
        }
    }
    
    // If we already have a current tree, regenerate it with new search depth
    if (appState.currentTree) {
        generateCurrentTree();
    }
}

// Reset application state
function resetAppState() {
    appState = {
        selectedDirectory: null,
        selectedMode: null,
        currentTree: null,
        proposedTree: null,
        outputPath: null,
        recursiveSearch: true
    };
    
    // Resetar UI
    elements.displays.selectedPath.textContent = '';
    elements.displays.currentTree.innerHTML = '';
    elements.displays.proposedTree.innerHTML = '';
    elements.buttons.continue.disabled = true;
    
            // Reset statistics
    updateStats({ children: [] });
    
            // Reset selections
    elements.modeOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    elements.modeSelect.value = 'ai_content';
    
    // Reset recursive search toggle
    if (elements.recursiveSearchToggle) {
        elements.recursiveSearchToggle.checked = true;
        appState.recursiveSearch = true;
    }
    
    // Esconder barra de progresso
    hideProgress();
}

// Mostrar loading
    function showLoading(message = 'Processing...') {
    elements.displays.loadingText.textContent = message;
    elements.loadingOverlay.classList.remove('hidden');
    hideProgress(); // Esconder barra de progresso ao mostrar loading
}

// Esconder loading
function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

// Show progress bar
function showProgress() {
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        progressContainer.classList.remove('hidden');
        // Reset progress
        updateProgress(0, 'Starting...');
    }
}

// Hide progress bar
function hideProgress() {
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        progressContainer.classList.add('hidden');
    }
}

// Update progress bar
function updateProgress(progress, message) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill && progressText) {
        progressFill.style.width = progress + '%';
        progressText.textContent = Math.round(progress) + '%';
        
        // Update loading text if available
        const loadingText = document.getElementById('loading-text');
        if (loadingText && message) {
            loadingText.textContent = message;
        }
    }
}



// Mostrar erro
function showError(message) {
            alert('Error: ' + message);
}

// Formatar tamanho de arquivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Formatar data
function formatDate(date) {
    if (!date) {
        return 'Unknown';
    }
    
    // Convert to Date object if needed
    if (typeof date === 'string') {
        date = new Date(date);
    } else if (typeof date === 'number') {
        // Unix timestamp (in seconds) - convert to milliseconds
        date = new Date(date * 1000);
    }
    
    // Validate date object
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Calculate tree statistics
function calculateStats(tree) {
    let folderCount = 0;
    let fileCount = 0;
    let totalSize = 0;

    function traverse(node) {
        if (node.type === 'folder') {
            folderCount++;
            if (node.children) {
                node.children.forEach(traverse);
            }
        } else if (node.type === 'ignored_folder') {
            // Count ignored folders but don't include their size
            folderCount++;
        } else if (node.type === 'file') {
            fileCount++;
            if (node.size) {
                totalSize += node.size;
            }
        }
    }

    traverse(tree);
    return { folderCount, fileCount, totalSize };
}

        // Update statistics in interface
function updateStats(tree) {
    const stats = calculateStats(tree);
    
    const folderCountEl = document.getElementById('folder-count');
    const fileCountEl = document.getElementById('file-count');
    const totalSizeEl = document.getElementById('total-size');
    
    if (folderCountEl) folderCountEl.textContent = stats.folderCount;
    if (fileCountEl) fileCountEl.textContent = stats.fileCount;
    if (totalSizeEl) totalSizeEl.textContent = formatFileSize(stats.totalSize);
}

// Atualizar indicador de sistema operacional
function updateOSIndicator(type, os) {
    const indicator = document.getElementById(`${type}-os-indicator`);
    const text = document.getElementById(`${type}-os-text`);
    
    if (indicator && text) {
        // Remover classes anteriores
        indicator.className = 'os-indicator';
        
        // Add OS-specific class
        if (os && os !== 'unknown') {
            indicator.classList.add(os);
            text.textContent = os.charAt(0).toUpperCase() + os.slice(1);
        } else {
            text.textContent = 'Unknown';
        }
    }
}

// Global function for navigation between screens (used in HTML)
window.showScreen = showScreen;

