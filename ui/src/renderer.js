// Estado global da aplicação
let appState = {
    selectedDirectory: null,
    selectedMode: null,
    currentTree: null,
    proposedTree: null,
    outputPath: null
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
    loadingOverlay: document.getElementById('loading-overlay')
};

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    showScreen('welcome-screen');
});

// Inicializar event listeners
function initializeEventListeners() {
    // Botão de seleção de diretório
    elements.buttons.selectDirectory.addEventListener('click', handleSelectDirectory);
    
    // Opções de modo
    elements.modeOptions.forEach(option => {
        option.addEventListener('click', () => handleModeSelection(option));
    });
    
    // Botão continuar
    elements.buttons.continue.addEventListener('click', handleContinue);
    
    // Botão refresh
    elements.buttons.refresh.addEventListener('click', handleRefresh);
    
    // Botão cancelar
    elements.buttons.cancel.addEventListener('click', handleCancel);
    
    // Botão prosseguir
    elements.buttons.proceed.addEventListener('click', handleProceed);
    
    // Botão nova organização
    elements.buttons.newOrganization.addEventListener('click', handleNewOrganization);
    
    // Botão abrir pasta
    elements.buttons.openFolder.addEventListener('click', handleOpenFolder);
    
    // Mudança de modo na tela de revisão
    elements.modeSelect.addEventListener('change', handleModeChange);
}

// Função para mostrar telas
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

// Manipular seleção de diretório
async function handleSelectDirectory() {
    try {
        showLoading('Selecionando diretório...');
        
        const selectedPath = await window.electronAPI.selectDirectory();
        
        if (selectedPath) {
            appState.selectedDirectory = selectedPath;
            elements.displays.selectedPath.textContent = selectedPath;
            
            // Gerar árvore atual
            await generateCurrentTree();
            
            hideLoading();
            showScreen('mode-selection-screen');
        } else {
            hideLoading();
        }
    } catch (error) {
        hideLoading();
        showError('Erro ao selecionar diretório: ' + error.message);
    }
}

// Manipular seleção de modo
function handleModeSelection(selectedOption) {
    // Remover seleção anterior
    elements.modeOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    // Selecionar nova opção
    selectedOption.classList.add('selected');
    
    // Atualizar estado
    appState.selectedMode = selectedOption.dataset.mode;
    
    // Habilitar botão continuar
    elements.buttons.continue.disabled = false;
}

// Manipular continuação para tela de revisão
async function handleContinue() {
    if (!appState.selectedMode) {
        showError('Por favor, selecione um modo de organização.');
        return;
    }
    
    try {
        showLoading('Gerando proposta de organização...');
        
        // Gerar proposta de organização
        await generateProposedTree();
        
        hideLoading();
        showScreen('review-screen');
    } catch (error) {
        hideLoading();
        showError('Erro ao gerar proposta: ' + error.message);
    }
}

// Gerar árvore atual
async function generateCurrentTree() {
    try {
        showLoading('Escaneando diretório...');
        
        // Escanear diretório real
        const result = await window.electronAPI.scanDirectory({
            dirPath: appState.selectedDirectory
        });
        
        hideLoading();
        
        if (result.success) {
            appState.currentTree = result.tree;
            renderTree(elements.displays.currentTree, result.tree, 'current');
            
            // Atualizar indicador de OS e estatísticas
            updateOSIndicator('current', result.tree.os);
            updateStats(result.tree);
        } else {
            throw new Error(result.error || 'Erro desconhecido');
        }
    } catch (error) {
        hideLoading();
        console.error('Erro ao gerar árvore atual:', error);
        appState.currentTree = { error: 'Erro ao carregar estrutura atual: ' + error.message };
        renderTree(elements.displays.currentTree, appState.currentTree, 'current');
    }
}

// Gerar árvore proposta
async function generateProposedTree() {
    try {
        showLoading('Gerando estrutura organizada...');
        
        const outputPath = generateOutputPath();
        appState.outputPath = outputPath;
        
        // Chamar API para gerar proposta organizada
        const result = await window.electronAPI.organizeFiles({
            inputPath: appState.selectedDirectory,
            outputPath: outputPath,
            mode: appState.selectedMode,
            dryRun: true
        });
        
        hideLoading();
        
        if (result.success) {
            appState.proposedTree = result.tree;
            renderTree(elements.displays.proposedTree, result.tree, 'proposed');
            
            // Atualizar indicador de OS e estatísticas
            updateOSIndicator('proposed', result.tree.os);
            updateStats(result.tree);
        } else {
            throw new Error(result.error || 'Erro desconhecido');
        }
    } catch (error) {
        hideLoading();
        console.error('Erro ao gerar árvore proposta:', error);
        appState.proposedTree = { error: 'Erro ao gerar proposta: ' + error.message };
        renderTree(elements.displays.proposedTree, appState.proposedTree, 'proposed');
    }
}

// Gerar caminho de saída
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



// Renderizar árvore
function renderTree(container, treeData, type) {
    if (treeData.error) {
        container.innerHTML = `<div class="error">${treeData.error}</div>`;
        return;
    }
    
    container.innerHTML = '';
    
    const os = treeData.os || detectOS();
    const osClass = os !== 'unknown' ? os : 'macos'; // Fallback para macOS
    
    if (type === 'current') {
        container.innerHTML = `<div class="tree-item folder ${osClass}">📁 ${treeData.name || 'Diretório'}</div>`;
    } else {
        container.innerHTML = `<div class="tree-item folder ${osClass}">📁 ${treeData.name || 'Diretório Organizado'}</div>`;
    }
    
    if (treeData.children) {
        renderTreeChildren(container, treeData.children, 1);
    }
}

// Renderizar filhos da árvore
function renderTreeChildren(container, children, level) {
    children.forEach((child, index) => {
        const isLast = index === children.length - 1;
        const prefix = '│   '.repeat(level - 1) + (isLast ? '└── ' : '├── ');
        const icon = child.type === 'folder' ? '📁' : '📄';
        const os = child.os || detectOS();
        const osClass = os !== 'unknown' ? os : 'macos'; // Fallback para macOS
        
        const treeItem = document.createElement('div');
        treeItem.className = `tree-item ${child.type} ${osClass}`;
        
        // Adicionar informações extras para arquivos
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
        showLoading('Atualizando proposta...');
        
        // Atualizar modo selecionado
        appState.selectedMode = elements.modeSelect.value;
        
        // Regenerar árvore proposta com novo modo
        await generateProposedTree();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Erro ao atualizar: ' + error.message);
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
        showLoading('Executando organização...');
        showProgress();
        
        // Simular progresso durante a organização
        simulateProgress();
        
        // Executar organização real
        const result = await window.electronAPI.executeOrganization({
            inputPath: appState.selectedDirectory,
            outputPath: appState.outputPath,
            mode: appState.selectedMode
        });
        
        if (result.success) {
            hideLoading();
            hideProgress();
            elements.displays.outputPath.textContent = appState.outputPath;
            
            // Mostrar informações adicionais sobre a organização
            if (result.processedFiles !== undefined && result.totalFiles !== undefined) {
                console.log(`Organização concluída: ${result.processedFiles} de ${result.totalFiles} arquivos processados`);
            }
            
            showScreen('success-screen');
        } else {
            throw new Error(result.error || 'Erro desconhecido');
        }
    } catch (error) {
        hideLoading();
        hideProgress();
        showError('Erro ao executar organização: ' + error.message);
    }
}

// Manipular nova organização
function handleNewOrganization() {
    resetAppState();
    showScreen('welcome-screen');
}

// Manipular abertura de pasta
function handleOpenFolder() {
    // Implementar abertura da pasta no explorador de arquivos
    console.log('Abrindo pasta:', appState.outputPath);
}

// Manipular mudança de modo
function handleModeChange() {
    appState.selectedMode = elements.modeSelect.value;
}

// Resetar estado da aplicação
function resetAppState() {
    appState = {
        selectedDirectory: null,
        selectedMode: null,
        currentTree: null,
        proposedTree: null,
        outputPath: null
    };
    
    // Resetar UI
    elements.displays.selectedPath.textContent = '';
    elements.displays.currentTree.innerHTML = '';
    elements.displays.proposedTree.innerHTML = '';
    elements.buttons.continue.disabled = true;
    
    // Resetar estatísticas
    updateStats({ children: [] });
    
    // Resetar seleções
    elements.modeOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    elements.modeSelect.value = 'ai_content';
    
    // Esconder barra de progresso
    hideProgress();
}

// Mostrar loading
function showLoading(message = 'Processando...') {
    elements.displays.loadingText.textContent = message;
    elements.loadingOverlay.classList.remove('hidden');
    hideProgress(); // Esconder barra de progresso ao mostrar loading
}

// Esconder loading
function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

// Mostrar barra de progresso
function showProgress() {
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        progressContainer.classList.remove('hidden');
    }
}

// Esconder barra de progresso
function hideProgress() {
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        progressContainer.classList.add('hidden');
    }
}

// Simular progresso durante a organização
function simulateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill && progressText) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90; // Não chegar a 100% até a conclusão
            
            progressFill.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
            
            if (progress >= 90) {
                clearInterval(interval);
            }
        }, 200);
    }
}

// Mostrar erro
function showError(message) {
    alert('Erro: ' + message);
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
    if (typeof date === 'string') {
        date = new Date(date);
    }
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Calcular estatísticas da árvore
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

// Atualizar estatísticas na interface
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
        
        // Adicionar classe específica do OS
        if (os && os !== 'unknown') {
            indicator.classList.add(os);
            text.textContent = os.charAt(0).toUpperCase() + os.slice(1);
        } else {
            text.textContent = 'Desconhecido';
        }
    }
}

// Função global para navegação entre telas (usada no HTML)
window.showScreen = showScreen;

