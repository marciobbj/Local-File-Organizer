const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let isDev = process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    title: 'Local File Organizer',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Function to scan directory and create tree
function scanDirectory(dirPath, maxDepth = 3, currentDepth = 0) {
  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return null;
    }

    const items = fs.readdirSync(dirPath);
    const children = [];
    
            // Limit depth to avoid very large trees
        if (currentDepth < maxDepth) {
            for (const item of items) {
                // Ignore hidden files and system directories
                if (item.startsWith('.') || item === 'node_modules' || item === '.git') {
                    continue;
                }

                const fullPath = path.join(dirPath, item);
                try {
                    const itemStats = fs.statSync(fullPath);
                    
                    if (itemStats.isDirectory()) {
                        const childDir = scanDirectory(fullPath, maxDepth, currentDepth + 1);
                        if (childDir) {
                            children.push(childDir);
                        }
                    } else {
                        // Adicionar arquivo com caminho completo
                        children.push({
                            name: item,
                            type: 'file',
                            os: getOS(),
                            size: itemStats.size,
                            modified: itemStats.mtime,
                            path: fullPath // Caminho completo do arquivo
                        });
                    }
                } catch (err) {
                    // Ignore files that cannot be read
                    console.log(`Error reading item: ${fullPath}`, err.message);
                }
            }
        }

    return {
      name: path.basename(dirPath),
      type: 'folder',
      os: getOS(),
      path: dirPath,
      children: children.sort((a, b) => {
        // Pastas primeiro, depois arquivos
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        // Alphabetical order
        return a.name.localeCompare(b.name);
      })
    };
  } catch (err) {
            console.error(`Error scanning directory: ${dirPath}`, err.message);
    return null;
  }
}

// Function to get operating system
function getOS() {
    const platform = os.platform();
    console.log('Operating system: ', platform);
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'macos';
    if (platform === 'linux') return 'linux';
    return 'unknown';
}

// Function to generate organized structure based on mode
function generateOrganizedStructure(inputTree, mode, os) {
    const organizedTree = {
        name: '', // Empty name to avoid creating extra directory
        type: 'folder',
        os: os,
        children: []
    };

    // Function to collect all files from the tree
    function collectFiles(node, files = []) {
        if (node.type === 'file') {
            files.push({
                name: node.name,
                type: 'file',
                os: os,
                size: node.size,
                modified: node.modified,
                originalPath: node.path
            });
        } else if (node.children) {
            node.children.forEach(child => collectFiles(child, files));
        }
        return files;
    }

    const allFiles = collectFiles(inputTree);

    if (mode === 'ai_content') {
        // AI organization (simulated)
        organizedTree.children = [
            {
                name: 'Documents',
                type: 'folder',
                os: os,
                children: allFiles.filter(file => 
                    /\.(pdf|docx?|txt|md|rtf)$/i.test(file.name)
                ).map(file => ({ ...file, name: file.name }))
            },
            {
                name: 'Images',
                type: 'folder',
                os: os,
                children: allFiles.filter(file => 
                    /\.(jpg|jpeg|png|gif|bmp|tiff|svg)$/i.test(file.name)
                ).map(file => ({ ...file, name: file.name }))
            },
            {
                name: 'Videos',
                type: 'folder',
                os: os,
                children: allFiles.filter(file => 
                    /\.(mp4|avi|mov|wmv|flv|mkv|webm)$/i.test(file.name)
                ).map(file => ({ ...file, name: file.name }))
            },
            {
                name: 'Audio',
                type: 'folder',
                os: os,
                children: allFiles.filter(file => 
                    /\.(mp3|wav|flac|aac|ogg|wma)$/i.test(file.name)
                ).map(file => ({ ...file, name: file.name }))
            },
            {
                name: 'Archives',
                type: 'folder',
                os: os,
                children: allFiles.filter(file => 
                    /\.(zip|rar|7z|tar|gz|bz2)$/i.test(file.name)
                ).map(file => ({ ...file, name: file.name }))
            },
            {
                name: 'Other',
                type: 'folder',
                os: os,
                children: allFiles.filter(file => 
                    !/\.(pdf|docx?|txt|md|rtf|jpg|jpeg|png|gif|bmp|tiff|svg|mp4|avi|mov|wmv|flv|mkv|webm|mp3|wav|flac|aac|ogg|wma|zip|rar|7z|tar|gz|bz2)$/i.test(file.name)
                ).map(file => ({ ...file, name: file.name }))
            }
        ];
    } else if (mode === 'date') {
        // Date organization
        const filesByDate = {};
        allFiles.forEach(file => {
            if (file.modified) {
                const date = new Date(file.modified);
                const year = date.getFullYear().toString();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
                
                if (!filesByDate[year]) {
                    filesByDate[year] = {};
                }
                if (!filesByDate[year][month]) {
                    filesByDate[year][month] = [];
                }
                filesByDate[year][month].push(file);
            }
        });

        Object.keys(filesByDate).sort().forEach(year => {
            const yearFolder = {
                name: year,
                type: 'folder',
                os: os,
                children: []
            };

            Object.keys(filesByDate[year]).sort().forEach(month => {
                const monthFolder = {
                    name: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long' }),
                    type: 'folder',
                    os: os,
                    children: filesByDate[year][month].map(file => ({ ...file, name: file.name }))
                };
                yearFolder.children.push(monthFolder);
            });

            organizedTree.children.push(yearFolder);
        });
    } else if (mode === 'type') {
        // Type organization
        const filesByType = {};
        allFiles.forEach(file => {
            const ext = path.extname(file.name).toLowerCase();
            let category = 'Other';
            
            if (/\.(pdf|docx?|txt|md|rtf)$/i.test(ext)) {
                category = 'Documents';
            } else if (/\.(jpg|jpeg|png|gif|bmp|tiff|svg)$/i.test(ext)) {
                category = 'Images';
            } else if (/\.(mp4|avi|mov|wmv|flv|mkv|webm)$/i.test(ext)) {
                category = 'Videos';
            } else if (/\.(mp3|wav|flac|aac|ogg|wma)$/i.test(ext)) {
                category = 'Audio';
            } else if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(ext)) {
                category = 'Archives';
            } else if (/\.(xlsx?|csv)$/i.test(ext)) {
                category = 'Spreadsheets';
            } else if (/\.(pptx?)$/i.test(ext)) {
                category = 'Presentations';
            }

            if (!filesByType[category]) {
                filesByType[category] = [];
            }
            filesByType[category].push(file);
        });

        Object.keys(filesByType).forEach(category => {
            const categoryFolder = {
                name: category,
                type: 'folder',
                os: os,
                children: filesByType[category].map(file => ({ ...file, name: file.name }))
            };
            organizedTree.children.push(categoryFolder);
        });
    }

            // Remove empty folders
    organizedTree.children = organizedTree.children.filter(folder => 
        folder.children && folder.children.length > 0
    );

    return organizedTree;
}

  // Function removed - now uses Python CLI
  
  // Function removed - now uses Python CLI

// Fallback function to generate structure when Python fails
function generateFallbackStructure(inputPath, mode) {
    const os = getOS();
    
            // Basic fallback structure
    const fallbackTree = {
        name: '',
        type: 'folder',
        os: os,
        children: []
    };
    
    if (mode === 'ai_content' || mode === 'type') {
        fallbackTree.children = [
            {
                name: 'Documents',
                type: 'folder',
                os: os,
                children: []
            },
            {
                name: 'Images',
                type: 'folder',
                os: os,
                children: []
            },
            {
                name: 'Videos',
                type: 'folder',
                os: os,
                children: []
            },
            {
                name: 'Other',
                type: 'folder',
                os: os,
                children: []
            }
        ];
    } else if (mode === 'date') {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long' });
        
        fallbackTree.children = [
            {
                name: currentYear.toString(),
                type: 'folder',
                os: os,
                children: [
                    {
                        name: currentMonth,
                        type: 'folder',
                        os: os,
                        children: []
                    }
                ]
            }
        ];
    }
    
    return fallbackTree;
}

// Function removed - now uses Python CLI

// IPC handlers for communication with renderer
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
            title: 'Select directory to organize'
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('scan-directory', async (event, { dirPath }) => {
  return new Promise((resolve, reject) => {
    try {
      const tree = scanDirectory(dirPath);
      if (tree) {
        resolve({
          success: true,
          tree: tree,
          message: 'Directory scanned successfully'
        });
      } else {
        resolve({ success: false, error: 'Could not scan the directory' });
      }
    } catch (error) {
              resolve({ success: false, error: 'Error scanning directory: ' + error.message });
    }
  });
});

ipcMain.handle('organize-files', async (event, { inputPath, outputPath, mode, dryRun = true }) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Gerando estrutura proposta usando Python CLI...');
              console.log('Input directory:', inputPath);
      console.log('Modo:', mode);
      
      // Executar o comando Python em modo dry-run para obter a estrutura proposta
      const { spawn } = require('child_process');
      
      // Determinar o comando Python baseado no sistema
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      
      // Argumentos para o script Python (modo dry-run)
      const args = [
        path.join(__dirname, '..', '..', 'main_ui_compatible.py'),
        '--input', inputPath,
        '--output', outputPath,
        '--mode', mode,
        '--dry-run', 'true',
        '--json-output'
      ];
      
      console.log('Executando comando Python (dry-run):', pythonCmd, args.join(' '));
      
      const pythonProcess = spawn(pythonCmd, args, {
        cwd: path.join(__dirname, '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Python stdout:', data.toString());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Python stderr:', data.toString());
      });
      
      pythonProcess.on('close', (code) => {
        console.log(`Python process finished with code: ${code}`);
        
        if (code === 0) {
          try {
            // Try to parse the output JSON
            const lines = stdout.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            
            if (lastLine && lastLine.trim()) {
              const result = JSON.parse(lastLine);
              resolve({
                success: true,
                tree: result.tree || result.proposedStructure,
                message: 'Organized structure generated successfully using Python CLI'
              });
            } else {
              // Fallback: generate simulated structure if there's no JSON
              const fallbackTree = generateFallbackStructure(inputPath, mode);
              resolve({
                success: true,
                tree: fallbackTree,
                message: 'Organized structure generated (fallback)'
              });
            }
          } catch (parseError) {
            console.log('Error parsing JSON, using fallback:', parseError.message);
            const fallbackTree = generateFallbackStructure(inputPath, mode);
            resolve({
              success: true,
              tree: fallbackTree,
              message: 'Organized structure generated (fallback)'
            });
          }
        } else {
          // If Python fails, use simulated structure
          console.log('Python failed, using simulated structure');
          const fallbackTree = generateFallbackStructure(inputPath, mode);
          resolve({
            success: true,
            tree: fallbackTree,
            message: 'Organized structure generated (fallback)'
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error('Error executing Python:', error);
        // Use simulated structure in case of error
        const fallbackTree = generateFallbackStructure(inputPath, mode);
        resolve({
          success: true,
          tree: fallbackTree,
          message: 'Organized structure generated (fallback)'
        });
      });
      
    } catch (error) {
              resolve({ success: false, error: 'Error generating organized structure: ' + error.message });
    }
  });
});

ipcMain.handle('execute-organization', async (event, { inputPath, outputPath, mode }) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting organization using Python CLI...');
      console.log('Input directory:', inputPath);
      console.log('Output directory:', outputPath);
      console.log('Mode:', mode);
      
      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }
      
      // Executar o comando Python real
      const { spawn } = require('child_process');
      
      // Determinar o comando Python baseado no sistema
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      
      // Argumentos para o script Python
      const args = [
        path.join(__dirname, '..', '..', 'main_ui_compatible.py'),
        '--input', inputPath,
        '--output', outputPath,
        '--mode', mode,
        '--dry-run', 'false'
      ];
      
      console.log('Executing command:', pythonCmd, args.join(' '));
      
      const pythonProcess = spawn(pythonCmd, args, {
        cwd: path.join(__dirname, '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Python stdout:', data.toString());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Python stderr:', data.toString());
      });
      
      pythonProcess.on('close', (code) => {
        console.log(`Python process finished with code: ${code}`);
        
        if (code === 0) {
          resolve({
            success: true,
            message: 'Organization executed successfully using Python CLI!',
            outputPath: outputPath,
            pythonOutput: stdout
          });
        } else {
          resolve({ 
            success: false, 
            error: `Error in Python CLI (code ${code}): ${stderr || 'Unknown error'}` 
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error('Error executing Python:', error);
        resolve({ 
          success: false, 
          error: `Error executing Python: ${error.message}` 
        });
      });
      
    } catch (error) {
              resolve({ success: false, error: 'Error executing organization: ' + error.message });
    }
  });
});
