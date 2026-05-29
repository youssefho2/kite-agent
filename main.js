const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  
  // Open devtools in development if needed
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for Custom Window Controls
ipcMain.handle('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow.close();
});

// IPC Handler for Show Notification
ipcMain.handle('show-notification', async (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
    return true;
  }
  return false;
});

// IPC Handler to Select a File (Docs, Spreadsheet, Image)
ipcMain.handle('open-file-dialog', async (event, type) => {
  let filters = [];
  if (type === 'image') {
    filters = [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }];
  } else if (type === 'spreadsheet') {
    filters = [{ name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] }];
  } else {
    filters = [{ name: 'All Supported', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'xlsx', 'xls', 'xlsm', 'csv', 'txt', 'md', 'json'] }];
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const extension = path.extname(filePath).toLowerCase();
    
    // For images, we want to return base64 or file protocol url
    if (['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(extension)) {
      const data = fs.readFileSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        type: 'image',
        data: `data:image/${extension.replace('.', '')};base64,${data.toString('base64')}`
      };
    } else if (['.xlsx', '.xls', '.xlsm', '.csv'].includes(extension)) {
      const data = fs.readFileSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        type: 'spreadsheet',
        data: data // returns buffer/Uint8Array transfer representation
      };
    } else {
      const text = fs.readFileSync(filePath, 'utf-8');
      return {
        path: filePath,
        name: path.basename(filePath),
        type: 'text',
        data: text
      };
    }
  }
  return null;
});

// IPC Handler to Save a Spreadsheet
ipcMain.handle('save-file-dialog', async (event, { data, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'spreadsheet.xlsx',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, Buffer.from(data));
    return result.filePath;
  }
  return null;
});

// IPC Handler to Send Email via SMTP
ipcMain.handle('send-email', async (event, { smtpConfig, mailOptions }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port),
      secure: smtpConfig.port == 465, // true for 465, false for other ports
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });

    const info = await transporter.sendMail({
      from: `"${smtpConfig.senderName || 'Kite Agent'}" <${smtpConfig.senderEmail || smtpConfig.user}>`,
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send failure:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler to persist and load settings/scheduler lists in user data directory
ipcMain.handle('save-app-data', (event, { filename, data }) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
});

ipcMain.handle('load-app-data', (event, filename) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(e);
  }
  return null;
});
