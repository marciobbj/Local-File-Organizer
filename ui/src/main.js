const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

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
function scanDirectory(dirPath, maxDepth = 3, currentDepth = 0, recursive = true) {
  try {
    if (currentDepth > maxDepth) {
      return null;
    }

    const items = fs.readdirSync(dirPath);
    const children = [];
    const detectedOS = getOS();
    
    // Limit depth to avoid very large trees
    if (currentDepth < maxDepth) {
      for (const item of items) {
        // Ignore hidden files and system directories
        if (item.startsWith('.') || item === 'node_modules' || item === '.git') {
          continue;
        }

        const fullPath = path.join(dirPath, item);
        try {
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            // Only scan subdirectories if recursive search is enabled
            if (recursive) {
              const childTree = scanDirectory(fullPath, maxDepth, currentDepth + 1, recursive);
              if (childTree) {
                children.push(childTree);
              }
            }
            // If not recursive, skip subdirectories entirely
          } else if (stat.isFile()) {
            children.push({
              name: item,
              type: 'file',
              path: fullPath,
              size: stat.size,
              modified: stat.mtime,
              os: detectedOS
            });
          }
        } catch (err) {
          // Ignore files that cannot be read
          console.log(`Error reading item: ${fullPath}`, err.message);
        }
      }
    }

    // Sort: folders first, then files
    children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      // Alphabetical order
      return a.name.localeCompare(b.name);
    });

    return {
      name: path.basename(dirPath),
      type: 'folder',
      path: dirPath,
      children: children,
      os: detectedOS
    };
  } catch (err) {
    console.error(`Error scanning directory: ${dirPath}`, err.message);
    return null;
  }
}

// Function to get operating system
function getOS() {
    const platform = os.platform();
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'macos';
    if (platform === 'linux') return 'linux';
    return 'unknown';
}

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

ipcMain.handle('scan-directory', async (event, { dirPath, recursive = true }) => {
  return new Promise((resolve, reject) => {
    try {
      const tree = scanDirectory(dirPath, 3, 0, recursive);
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

ipcMain.handle('organize-files', async (event, { inputPath, outputPath, mode, dryRun = true, recursive = true }) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Generating organized structure using Python CLI...');
      console.log('Input directory:', inputPath);
      console.log('Mode:', mode);
      
      // Send initial progress for structure generation
      mainWindow.webContents.send('organization-progress', { 
        progress: 10, 
        message: 'Initializing structure generation...' 
      });
      
      // Execute Python command in dry-run mode to get proposed structure
      const { spawn } = require('child_process');
      
      // Determine Python command based on system
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      
      // Arguments for Python script (dry-run mode)
      const args = [
        path.join(__dirname, '..', '..', 'main_ui_compatible.py'),
        '--input', inputPath,
        '--output', outputPath,
        '--mode', mode,
        '--dry-run', 'true',
        '--json-output',
        '--recursive', recursive.toString()
      ];
      
      console.log('Executing Python command (dry-run):', pythonCmd, args.join(' '));
      
      // Send progress for command start
      mainWindow.webContents.send('organization-progress', { 
        progress: 20, 
        message: 'Starting structure analysis...' 
      });
      
      const pythonProcess = spawn(pythonCmd, args, {
        cwd: path.join(__dirname, '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      let progress = 30;
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Python stdout:', data.toString());
        
        // Update progress during structure generation
        progress = Math.min(progress + 15, 80);
        mainWindow.webContents.send('organization-progress', { 
          progress: progress, 
          message: 'Analyzing files and generating structure...' 
        });
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Python stderr:', data.toString());
      });
      
      pythonProcess.on('close', (code) => {
        console.log(`Python process finished with code: ${code}`);
        
        // Send completion progress
        mainWindow.webContents.send('organization-progress', { 
          progress: 100, 
          message: 'Structure generation completed!' 
        });
        
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
              resolve({ 
                success: false, 
                error: 'No output received from Python CLI' 
              });
            }
          } catch (parseError) {
            console.log('Error parsing JSON from Python CLI:', parseError.message);
            resolve({ 
              success: false, 
              error: 'Invalid output format from Python CLI' 
            });
          }
        } else {
          resolve({ 
            success: false, 
            error: `Python CLI failed with code ${code}: ${stderr || 'Unknown error'}` 
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error('Error executing Python:', error);
        resolve({ 
          success: false, 
          error: `Error executing Python CLI: ${error.message}` 
        });
      });
      
    } catch (error) {
      resolve({ success: false, error: 'Error generating organized structure: ' + error.message });
    }
  });
});

ipcMain.handle('execute-organization', async (event, { inputPath, outputPath, mode, recursive = true }) => {
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
      
      // Execute real Python command
      const { spawn } = require('child_process');
      
      // Determine Python command based on system
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      
      // Arguments for Python script
      const args = [
        path.join(__dirname, '..', '..', 'main_ui_compatible.py'),
        '--input', inputPath,
        '--output', outputPath,
        '--mode', mode,
        '--dry-run', 'false',
        '--recursive', recursive.toString()
      ];
      
      console.log('Executing command:', pythonCmd, args.join(' '));
      
      const pythonProcess = spawn(pythonCmd, args, {
        cwd: path.join(__dirname, '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      let progress = 0;
      
      // Send initial progress
      mainWindow.webContents.send('organization-progress', { progress: 0, message: 'Starting organization...' });
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Python stdout:', data.toString());
        
        // Update progress based on output
        progress = Math.min(progress + 10, 90);
        mainWindow.webContents.send('organization-progress', { 
          progress: progress, 
          message: 'Processing files...' 
        });
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Python stderr:', data.toString());
      });
      
      pythonProcess.on('close', (code) => {
        console.log(`Python process finished with code: ${code}`);
        
        // Send completion progress
        mainWindow.webContents.send('organization-progress', { 
          progress: 100, 
          message: 'Organization completed!' 
        });
        
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
          error: `Error executing Python CLI: ${error.message}` 
        });
      });
      
    } catch (error) {
      resolve({ success: false, error: 'Error executing organization: ' + error.message });
    }
  });
});

ipcMain.handle('open-folder', async (event, { folderPath }) => {
  try {
    // Check if the folder exists
    if (fs.existsSync(folderPath)) {
      // Open the folder in the file manager
      await shell.openPath(folderPath);
      return { success: true, message: 'Folder opened successfully' };
    } else {
      return { success: false, error: 'Folder does not exist' };
    }
  } catch (error) {
    console.error('Error opening folder:', error);
    return { success: false, error: 'Error opening folder: ' + error.message };
  }
});
