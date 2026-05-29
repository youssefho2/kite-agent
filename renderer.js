// Kite Agent Renderer Logic

// State management
let appState = {
  currentFile: null,        // { path, name, type, data }
  selectedRect: null,       // { x, y, width, height }
  croppedImageBase64: null, // Cropped selection base64 data
  settings: {
    apiKey: '',
    model: 'google/gemini-2.5-flash:free',
    visionModel: 'google/gemini-2.5-flash:free',
    smtpProvider: 'gmail',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '465',
    smtpUser: '',
    smtpPass: '',
    recipient: ''
  },
  reminders: []             // List of registered reminders
};

// DOM elements
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const btnOpenFile = document.getElementById('btn-open-file');
const btnOcrSpreadsheet = document.getElementById('btn-ocr-spreadsheet');
const btnCircleSearch = document.getElementById('btn-circle-search');
const btnSaveExcel = document.getElementById('btn-save-excel');
const fileTitle = document.getElementById('file-title');
const viewerBody = document.getElementById('viewer-body');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const imageViewerContainer = document.getElementById('image-viewer-container');
const spreadsheetViewerContainer = document.getElementById('spreadsheet-viewer-container');
const documentViewerContainer = document.getElementById('document-viewer-container');
const loadedImage = document.getElementById('loaded-image');
const selectorCanvas = document.getElementById('selector-canvas');
const tableContainer = document.getElementById('table-container');
const textDocumentView = document.getElementById('text-document-view');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSendMessage = document.getElementById('btn-send-message');
const selectionPreview = document.getElementById('selection-preview');
const selectionThumb = document.getElementById('selection-thumb');
const btnCloseSelection = document.getElementById('btn-close-selection');

const btnScanAudits = document.getElementById('btn-scan-audits');
const smtpStatusBox = document.getElementById('smtp-status-box');
const smtpStatusText = document.getElementById('smtp-status-text');
const auditSpreadsheetContainer = document.getElementById('audit-spreadsheet-container');
const alertBadge = document.getElementById('alert-badge');
let auditSpreadsheetInstance = null;

// Settings DOM
const inputApiKey = document.getElementById('setting-api-key');
const inputModel = document.getElementById('setting-model');
const inputVisionModel = document.getElementById('setting-vision-model');
const selectSmtpProvider = document.getElementById('setting-smtp-provider');
const smtpHostPortRow = document.getElementById('smtp-host-port-row');
const labelSmtpUser = document.getElementById('label-smtp-user');
const labelSmtpPass = document.getElementById('label-smtp-pass');
const gmailHelpText = document.getElementById('gmail-help-text');
const inputSmtpHost = document.getElementById('setting-smtp-host');
const inputSmtpPort = document.getElementById('setting-smtp-port');
const inputSmtpUser = document.getElementById('setting-smtp-user');
const inputSmtpPass = document.getElementById('setting-smtp-pass');
const inputSenderEmail = document.getElementById('setting-sender-email');
const senderEmailRow = document.getElementById('sender-email-row');
const inputRecipient = document.getElementById('setting-recipient-email');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnResetSettings = document.getElementById('btn-reset-settings');

// Canvas context
const ctx = selectorCanvas.getContext('2d');
let isDrawing = false;
let startX, startY;

// Toggle provider settings view
function toggleProviderView() {
  const provider = selectSmtpProvider.value;
  if (provider === 'gmail') {
    smtpHostPortRow.classList.add('hidden');
    senderEmailRow.classList.add('hidden');
    labelSmtpUser.textContent = 'Gmail Address (Send From)';
    labelSmtpPass.textContent = 'Gmail App Password';
    gmailHelpText.classList.remove('hidden');
    inputSmtpHost.value = 'smtp.gmail.com';
    inputSmtpPort.value = '465';
  } else {
    smtpHostPortRow.classList.remove('hidden');
    senderEmailRow.classList.remove('hidden');
    labelSmtpUser.textContent = 'SMTP User (Send From)';
    labelSmtpPass.textContent = 'SMTP Password';
    gmailHelpText.classList.add('hidden');
  }
}

// Initialize app
async function init() {
  // Load saved settings
  const savedSettings = await window.api.loadAppData('settings.json');
  if (savedSettings) {
    appState.settings = { ...appState.settings, ...savedSettings };
    // Populate form
    inputApiKey.value = appState.settings.apiKey;
    inputModel.value = appState.settings.model || 'google/gemini-2.5-flash:free';
    inputVisionModel.value = appState.settings.visionModel || 'google/gemini-2.5-flash:free';
    selectSmtpProvider.value = appState.settings.smtpProvider || 'gmail';
    inputSmtpHost.value = appState.settings.smtpHost || 'smtp.gmail.com';
    inputSmtpPort.value = appState.settings.smtpPort || '465';
    inputSmtpUser.value = appState.settings.smtpUser;
    inputSmtpPass.value = appState.settings.smtpPass;
    inputSenderEmail.value = appState.settings.senderEmail || '';
    inputRecipient.value = appState.settings.recipient;
  }
  
  toggleProviderView();
  selectSmtpProvider.addEventListener('change', toggleProviderView);
  updateSmtpIndicator();

  // Load saved reminders
  const savedReminders = await window.api.loadAppData('reminders.json');
  if (savedReminders) {
    appState.reminders = savedReminders;
    renderReminders();
  }

  // Setup tab routing
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      item.classList.add('active');
      const tabId = `tab-${item.getAttribute('data-tab')}`;
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Setup file open event
  btnOpenFile.addEventListener('click', () => handleOpenFile());
  
  // Drag and drop setup on workspace viewer
  viewerBody.addEventListener('dragover', (e) => e.preventDefault());
  viewerBody.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      addSystemMessage("Loading dropped file...");
      // For simplicity, trigger dialog to avoid sandbox/file access path issues
      handleOpenFile();
    }
  });

  // Photo-to-spreadsheet OCR button
  btnOcrSpreadsheet.addEventListener('click', handleOcrToSpreadsheet);

  // Circle search toggle button
  btnCircleSearch.addEventListener('click', toggleCircleSearch);

  // Save excel export button
  btnSaveExcel.addEventListener('click', handleExportExcel);

  // Send Chat message
  btnSendMessage.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });

  // Close selection preview
  btnCloseSelection.addEventListener('click', clearSelection);

  // Scan for audits button
  btnScanAudits.addEventListener('click', handleScanForAudits);

  // Add reminder row button
  const btnAddReminder = document.getElementById('btn-add-reminder');
  if (btnAddReminder) {
    btnAddReminder.addEventListener('click', () => {
      appState.reminders.push({
        id: 'reminder-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        title: 'New International Audit',
        location: 'New Location',
        date: new Date(Date.now() + 45*24*60*60*1000).toISOString().split('T')[0],
        notifiedVisa: false,
        notifiedPreAudit: false
      });
      window.api.saveAppData({ filename: 'reminders.json', data: appState.reminders });
      renderReminders();
    });
  }

  // Settings buttons
  btnSaveSettings.addEventListener('click', saveSettings);
  btnResetSettings.addEventListener('click', resetSettings);

  // Window controls
  document.getElementById('win-btn-minimize').addEventListener('click', () => window.api.minimizeWindow());
  document.getElementById('win-btn-maximize').addEventListener('click', () => window.api.maximizeWindow());
  document.getElementById('win-btn-close').addEventListener('click', () => window.api.closeWindow());

  // Run periodic reminder check
  setInterval(checkRemindersScheduler, 60000); // check every minute
}

// Update settings UI indicator
function updateSmtpIndicator() {
  const config = appState.settings;
  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    smtpStatusBox.className = "status-indicator-box success";
    smtpStatusText.textContent = `SMTP Email active (${config.smtpUser})`;
  } else {
    smtpStatusBox.className = "status-indicator-box warning";
    smtpStatusText.textContent = "SMTP config incomplete. Email notifications disabled.";
  }
}

// File opening handler
async function handleOpenFile() {
  const file = await window.api.openFileDialog('all');
  if (!file) return;

  appState.currentFile = file;
  fileTitle.textContent = `${file.name} (${(file.path)})`;
  uploadPlaceholder.style.display = 'none';
  imageViewerContainer.style.display = 'none';
  spreadsheetViewerContainer.style.display = 'none';
  documentViewerContainer.style.display = 'none';
  btnSaveExcel.style.display = 'none';
  clearSelection();

  if (file.type === 'image') {
    imageViewerContainer.style.display = 'flex';
    loadedImage.src = file.data;
    loadedImage.onload = () => {
      // Set canvas dimension matching image display
      selectorCanvas.width = loadedImage.clientWidth;
      selectorCanvas.height = loadedImage.clientHeight;
    };
    addSystemMessage(`Opened image file: ${file.name}. Click 'Circle Search' to draw selection query.`);
  } else if (file.type === 'spreadsheet') {
    spreadsheetViewerContainer.style.display = 'block';
    renderSpreadsheet(file.data);
    addSystemMessage(`Opened spreadsheet: ${file.name}. Loaded workbook successfully.`);
  } else {
    documentViewerContainer.style.display = 'block';
    textDocumentView.textContent = file.data;
    addSystemMessage(`Opened document: ${file.name}. Read contents successfully.`);
  }
}

// Render JSpreadsheet Grid
let loadedWorkbook = null;
let jspreadsheetInstance = null;

function renderSpreadsheet(data, isRawArray = false) {
  try {
    let dataArray;
    if (isRawArray) {
      dataArray = data;
    } else {
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
      loadedWorkbook = workbook;
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      // Convert sheet to 2D array preserving blank cells
      dataArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    }

    // Fallback if no data
    if (!dataArray || dataArray.length === 0) {
      dataArray = [['', '', ''], ['', '', '']];
    }

    // Check if JSpreadsheet/jexcel is available
    const initSpreadsheet = (typeof jspreadsheet === 'function') ? jspreadsheet : (typeof jexcel === 'function' ? jexcel : null);
    
    if (!initSpreadsheet) {
      console.warn("JSpreadsheet CE not loaded. Falling back to static HTML table.");
      let htmlTable;
      if (isRawArray) {
        const tempWs = XLSX.utils.aoa_to_sheet(dataArray);
        htmlTable = XLSX.utils.sheet_to_html(tempWs, { header: '', footer: '' });
      } else {
        const firstSheetName = loadedWorkbook.SheetNames[0];
        const worksheet = loadedWorkbook.Sheets[firstSheetName];
        htmlTable = XLSX.utils.sheet_to_html(worksheet, { header: '', footer: '' });
      }
      
      tableContainer.innerHTML = htmlTable;
      const tables = tableContainer.getElementsByTagName('table');
      if (tables.length > 0) {
        tables[0].className = 'data-table';
      }
      
      jspreadsheetInstance = null;
      btnSaveExcel.style.display = 'inline-flex';
      return;
    }

    // Reset container
    tableContainer.innerHTML = '';
    
    // Initialize JSpreadsheet Instance
    jspreadsheetInstance = initSpreadsheet(tableContainer, {
      data: dataArray,
      minDimensions: [12, 18],
      allowInsertRow: true,
      allowInsertColumn: true,
      allowDeleteRow: true,
      allowDeleteColumn: true,
      columnDrag: true,
      rowDrag: true
    });

    // Expose Save Button
    btnSaveExcel.style.display = 'inline-flex';
  } catch (error) {
    console.error('Spreadsheet load failed:', error);
    addSystemMessage(`Error reading spreadsheet: ${error.message}`);
  }
}

// Convert parsed array back to export workbook
function exportCurrentTableToExcel(rowsArray) {
  try {
    const worksheet = XLSX.utils.json_to_sheet(rowsArray);
    const workbook = XLSX.utils.book_new();
    XLSX.book_append_sheet(workbook, worksheet, "Converted Data");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return excelBuffer;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Canvas Visual Selection Drawer
let searchModeActive = false;
function toggleCircleSearch() {
  if (appState.currentFile?.type !== 'image') {
    addSystemMessage("Please open an image file first to use Circle Search selection.");
    return;
  }
  searchModeActive = !searchModeActive;
  if (searchModeActive) {
    btnCircleSearch.classList.add('active');
    btnCircleSearch.style.boxShadow = '0 0 15px var(--accent-color)';
    addSystemMessage("Circle Search Active: Click and drag your mouse on the image to circle any portion.");
    setupCanvasListeners();
  } else {
    btnCircleSearch.classList.remove('active');
    btnCircleSearch.style.boxShadow = '';
    removeCanvasListeners();
  }
}

function setupCanvasListeners() {
  selectorCanvas.addEventListener('mousedown', startSelection);
  selectorCanvas.addEventListener('mousemove', drawSelection);
  selectorCanvas.addEventListener('mouseup', endSelection);
}

function removeCanvasListeners() {
  selectorCanvas.removeEventListener('mousedown', startSelection);
  selectorCanvas.removeEventListener('mousemove', drawSelection);
  selectorCanvas.removeEventListener('mouseup', endSelection);
  ctx.clearRect(0, 0, selectorCanvas.width, selectorCanvas.height);
}

function startSelection(e) {
  isDrawing = true;
  const rect = selectorCanvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
}

function drawSelection(e) {
  if (!isDrawing) return;
  const rect = selectorCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  ctx.clearRect(0, 0, selectorCanvas.width, selectorCanvas.height);
  
  // Draw sleek circular highlight ring (circle search style)
  const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
  
  ctx.beginPath();
  ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
  
  // Custom glowing dashed style
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.shadowColor = '#6366f1';
  ctx.shadowBlur = 10;
  ctx.stroke();
  
  // Subtle overlay mask outside circle
  ctx.shadowBlur = 0; // reset
  ctx.setLineDash([]); // reset
}

function endSelection(e) {
  if (!isDrawing) return;
  isDrawing = false;
  
  const rect = selectorCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
  
  if (radius < 5) return; // Too small

  // Crop region inside bounding box of circle
  const cropX = Math.max(0, startX - radius);
  const cropY = Math.max(0, startY - radius);
  const cropWidth = Math.min(selectorCanvas.width - cropX, radius * 2);
  const cropHeight = Math.min(selectorCanvas.height - cropY, radius * 2);

  // Perform crop logic using hidden canvas matching image natural resolution
  const scaleX = loadedImage.naturalWidth / loadedImage.clientWidth;
  const scaleY = loadedImage.naturalHeight / loadedImage.clientHeight;
  
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropWidth * scaleX;
  cropCanvas.height = cropHeight * scaleY;
  const cropCtx = cropCanvas.getContext('2d');
  
  cropCtx.drawImage(
    loadedImage,
    cropX * scaleX, cropY * scaleY, cropWidth * scaleX, cropHeight * scaleY,
    0, 0, cropCanvas.width, cropCanvas.height
  );
  
  const dataUrl = cropCanvas.toDataURL('image/png');
  appState.croppedImageBase64 = dataUrl.split(',')[1];
  
  // Display thumbnail in sidebar
  selectionPreview.style.display = 'flex';
  selectionThumb.src = dataUrl;
  
  addSystemMessage("Selected region captured! Ask anything below or query the selection.");
  toggleCircleSearch(); // deactivate draw mode once done
}

function clearSelection() {
  appState.croppedImageBase64 = null;
  selectionPreview.style.display = 'none';
  ctx.clearRect(0, 0, selectorCanvas.width, selectorCanvas.height);
}

// OpenRouter API Fetch Helper
async function queryOpenRouter(messages, isVision = false) {
  if (!appState.settings.apiKey) {
    addSystemMessage("Warning: No OpenRouter API key found. Configure it in Settings to enable AI responses.");
    return null;
  }

  const model = isVision 
    ? (appState.settings.visionModel || 'google/gemini-2.5-flash')
    : (appState.settings.model || 'google/gemini-2.5-flash');
  
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${appState.settings.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kiteagent.app",
        "X-Title": "Kite Agent"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("OpenRouter request failure:", error);
    addSystemMessage(`AI Query Failed: ${error.message}`);
    return null;
  }
}

// Convert Photo to Spreadsheet using Multimodal LLM
async function handleOcrToSpreadsheet() {
  if (!appState.currentFile || appState.currentFile.type !== 'image') {
    addSystemMessage("Please open an image of a table/spreadsheet to convert.");
    return;
  }

  addSystemMessage("Converting photo to spreadsheet table format... Please wait.");
  
  const base64Data = appState.currentFile.data.split(',')[1];
  const messages = [
    {
      role: "system",
      content: "You are a professional OCR document helper. Extract data from the table/image and return it strictly as a JSON array of arrays or array of objects. Do not include markdown formatting like ```json, return ONLY the raw JSON string directly. E.g. [{\"Column1\": \"Value1\", ...}]"
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Parse all tabular cells from this image. Output JSON structured row-by-row data."
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Data}`
          }
        }
      ]
    }
  ];

  const responseContent = await queryOpenRouter(messages, true);
  if (!responseContent) return;

  try {
    // Strip markdown wrappers if LLM returned them despite system prompt
    let cleanJson = responseContent.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }

    const parsedData = JSON.parse(cleanJson);
    let dataArray;
    if (Array.isArray(parsedData)) {
      if (parsedData.length > 0 && Array.isArray(parsedData[0])) {
        dataArray = parsedData;
      } else if (parsedData.length > 0 && typeof parsedData[0] === 'object') {
        const headers = Object.keys(parsedData[0]);
        const rows = parsedData.map(obj => headers.map(key => obj[key] !== undefined ? obj[key] : ''));
        dataArray = [headers, ...rows];
      } else {
        dataArray = [['OCR Output'], ...parsedData.map(val => [String(val)])];
      }
    } else if (typeof parsedData === 'object') {
      const headers = Object.keys(parsedData);
      const row = headers.map(key => parsedData[key]);
      dataArray = [headers, row];
    } else {
      dataArray = [[String(parsedData)]];
    }

    // Render table
    spreadsheetViewerContainer.style.display = 'block';
    imageViewerContainer.style.display = 'none';
    
    renderSpreadsheet(dataArray, true);
    
    addSystemMessage("Successfully converted photo to interactive spreadsheet! You can now edit/review or save it as an Excel (.xlsx) file.");
  } catch (error) {
    console.error("OCR parse/convert error:", error);
    addSystemMessage("Failed to structure the OCR output into standard JSON format. Raw output shown in sidebar.");
    addAgentMessage(`Raw Response:\n\n${responseContent}`);
  }
}

// Export current worksheet to XLSX
async function handleExportExcel() {
  if (!jspreadsheetInstance && !loadedWorkbook) {
    addSystemMessage("No spreadsheet data available to export.");
    return;
  }
  
  try {
    let excelBuffer;
    if (jspreadsheetInstance) {
      const currentData = jspreadsheetInstance.getData();
      const worksheet = XLSX.utils.aoa_to_sheet(currentData);
      const workbook = XLSX.utils.book_new();
      XLSX.book_append_sheet(workbook, worksheet, "Sheet1");
      excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    } else {
      excelBuffer = XLSX.write(loadedWorkbook, { bookType: 'xlsx', type: 'array' });
    }

    const savedPath = await window.api.saveFileDialog({
      data: excelBuffer,
      defaultName: `kite-agent-${Date.now()}.xlsx`
    });

    if (savedPath) {
      addSystemMessage(`Spreadsheet saved successfully to: ${savedPath}`);
    }
  } catch (error) {
    console.error("Export failed:", error);
    addSystemMessage(`Failed to export spreadsheet: ${error.message}`);
  }
}

// Scan file contents for international audits & auto register reminders
async function handleScanForAudits() {
  let contentToScan = '';

  if (!appState.currentFile && !jspreadsheetInstance) {
    addSystemMessage("Please load a file or convert a photo first.");
    return;
  }

  addSystemMessage("Scanning document for international audits...");

  if (jspreadsheetInstance) {
    const currentData = jspreadsheetInstance.getData();
    if (currentData.length > 0) {
      const headers = currentData[0];
      const rows = currentData.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, idx) => {
          if (header) obj[header] = row[idx];
        });
        return obj;
      });
      contentToScan = JSON.stringify(rows);
    }
  } else if (appState.currentFile && appState.currentFile.type === 'spreadsheet' && loadedWorkbook) {
    const firstSheetName = loadedWorkbook.SheetNames[0];
    const worksheet = loadedWorkbook.Sheets[firstSheetName];
    contentToScan = JSON.stringify(XLSX.utils.sheet_to_json(worksheet));
  } else if (appState.currentFile && appState.currentFile.type === 'text') {
    contentToScan = appState.currentFile.data;
  } else {
    addSystemMessage("Currently opened file is an image. Use 'Convert Image to Excel' first, or use AI chat to parse audits from it.");
    return;
  }

  const prompt = `
  Analyze this document data and extract all scheduled audits.
  Identify:
  1. Audit Title/Company name
  2. Location (City, Country)
  3. Scheduled Date (format YYYY-MM-DD)
  
  Return strictly a JSON array of objects with keys: "title", "location", "date" (e.g. [{"title": "API Petroleum HSE", "location": "Houston, USA", "date": "2026-08-15"}]). 
  Return ONLY raw JSON, no markdown.
  Document Data:
  ${contentToScan}
  `;

  let responseContent = await queryOpenRouter([{ role: "user", content: prompt }]);
  let audits = [];
  let parsedSuccessfully = false;

  if (responseContent) {
    try {
      let cleanJson = responseContent.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }
      audits = JSON.parse(cleanJson);
      parsedSuccessfully = true;
    } catch (error) {
      console.error("Failed to parse LLM response, falling back to local scan:", error);
    }
  }

  if (!parsedSuccessfully) {
    addSystemMessage("AI scanning unavailable or rate-limited. Running local heuristic scanner as fallback...");
    audits = scanAuditsLocally(contentToScan);
  }
  
  let addedCount = 0;
  audits.forEach(audit => {
    // Validate audit is outside Egypt (case insensitive check)
    const location = audit.location || '';
    const isOutsideEgypt = location && !location.toLowerCase().includes('egypt');
    
    if (isOutsideEgypt && audit.date) {
      // Normalize date format
      const normalizedDate = normalizeDate(audit.date);
      
      // Avoid duplicate dates and titles
      const exists = appState.reminders.some(r => r.title === audit.title && r.date === normalizedDate);
      if (!exists) {
        appState.reminders.push({
          id: 'reminder-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          title: audit.title,
          location: audit.location,
          date: normalizedDate,
          notifiedVisa: false,
          notifiedPreAudit: false
        });
        addedCount++;
      }
    }
  });

  if (addedCount > 0) {
    await window.api.saveAppData({ filename: 'reminders.json', data: appState.reminders });
    renderReminders();
    addSystemMessage(`Scan Complete! Found and registered ${addedCount} upcoming international audits outside Egypt.`);
  } else {
    addSystemMessage("Scan Complete. No new international audits (outside Egypt) were found.");
  }
}

// Local helper to parse audits heuristic-style
function scanAuditsLocally(contentToScan) {
  let audits = [];
  try {
    const data = JSON.parse(contentToScan);
    if (Array.isArray(data)) {
      data.forEach((row, idx) => {
        let location = '';
        let dateVal = '';
        let title = '';

        // Examine key-value pairs
        Object.entries(row).forEach(([key, val]) => {
          const kLower = key.toLowerCase();
          const valStr = String(val || '').trim();
          if (!valStr) return;

          // Check if key is location
          if (kLower.includes('location') || kLower.includes('country') || kLower.includes('city') || kLower.includes('destination') || kLower.includes('site') || kLower.includes('address')) {
            if (!location) location = valStr;
          }
          // Check if key is date
          if (kLower.includes('date') || kLower.includes('sched') || kLower.includes('target') || kLower.includes('time') || kLower.includes('deadline')) {
            if (!dateVal) dateVal = valStr;
          }
          // Check if key is title or program
          if (kLower.includes('title') || kLower.includes('audit') || kLower.includes('program') || kLower.includes('company') || kLower.includes('name') || kLower.includes('facility') || kLower.includes('type')) {
            if (!title) {
              title = valStr;
            } else if (kLower.includes('program') || kLower.includes('audit') || kLower.includes('type')) {
              title = title + ' (' + valStr + ')';
            }
          }
        });

        // Fallback checks for cell formats
        if (!location || !dateVal || !title) {
          Object.entries(row).forEach(([key, val]) => {
            const valStr = String(val || '').trim();
            if (!valStr) return;

            // Simple regex for dates like YYYY-MM-DD, DD-MMM-YYYY, DD/MM/YYYY
            if (!dateVal && (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$|^\d{1,2}-\w{3}-\d{4}$/.test(valStr) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(valStr))) {
              dateVal = valStr;
            } else if (!location && (valStr.includes(',') && !valStr.toLowerCase().includes('egypt') && isNaN(valStr))) {
              // Heuristic for city/country like "Houston, USA"
              location = valStr;
            }
          });
        }

        // Final fallbacks
        if (!title) {
          title = row['Audit ID'] || row['Facility ID'] || `Audit Row ${idx + 1}`;
        }
        if (!location) {
          // If there's no location column but we found a date, check if any cell might be a location
          Object.values(row).forEach(val => {
            const valStr = String(val || '').trim();
            if (valStr && valStr.length > 3 && isNaN(valStr) && !/^\d/.test(valStr) && !valStr.toLowerCase().includes('scheduled') && !valStr.toLowerCase().includes('initial')) {
              if (!location) location = valStr;
            }
          });
        }

        if (dateVal) {
          audits.push({
            title: title,
            location: location || 'International Site',
            date: dateVal
          });
        }
      });
    }
  } catch (err) {
    // If text file
    const lines = contentToScan.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('egypt')) return;
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}-\w{3}-\d{4})|(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/);
      if (dateMatch) {
        const dateVal = dateMatch[0];
        let remainingText = line.replace(dateVal, '').replace(/[,;:]/g, ' ').replace(/\s+/g, ' ').trim();
        audits.push({
          title: remainingText || 'Scheduled Audit',
          location: 'International Location',
          date: dateVal
        });
      }
    });
  }
  return audits;
}

// Helper to normalize date string to YYYY-MM-DD
function normalizeDate(dateStr) {
  try {
    const cleanDateStr = String(dateStr).trim();

    // Check if it's an Excel serial date number
    if (!isNaN(cleanDateStr) && cleanDateStr.length >= 5 && parseInt(cleanDateStr) > 30000) {
      const serial = parseInt(cleanDateStr);
      // Excel bug: 1900 is treated as leap year, so offset is off by 1 day
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const d = new Date(utc_value * 1000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayVal = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayVal}`;
    }

    // Parse manually for DD-MMM-YYYY (e.g., 7-Jun-2026) because Date.parse behavior can be platform specific
    const parts = cleanDateStr.split('-');
    if (parts.length === 3 && isNaN(parts[1])) {
      const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
      const day = parseInt(parts[0]);
      const monthStr = parts[1].toLowerCase().substring(0, 3);
      const year = parseInt(parts[2]);
      if (months[monthStr] !== undefined && !isNaN(day) && !isNaN(year)) {
        return `${year}-${String(months[monthStr] + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    const d = new Date(cleanDateStr);
    if (!isNaN(d.getTime())) {
      // Use local date parts to prevent timezone shifts (e.g. to previous day)
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayVal = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayVal}`;
    }
  } catch (e) {
    console.error("Error normalizing date:", e);
  }
  return dateStr;
}



// Render reminders page table using JSpreadsheet CE
function renderReminders() {
  if (!auditSpreadsheetContainer) return;
  auditSpreadsheetContainer.innerHTML = '';

  if (appState.reminders.length === 0) {
    auditSpreadsheetContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 0; border: 1px dashed var(--border-color); border-radius: 8px;">
        No registered reminders. Click "+ Add Reminder Row" or scan file contents to add reminders.
      </div>
    `;
    alertBadge.textContent = '0';
    return;
  }

  let criticalCount = 0;
  
  // Sort reminders by date
  appState.reminders.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Prepare 2D data array for jspreadsheet
  const data = appState.reminders.map(reminder => {
    const daysLeft = Math.ceil((new Date(reminder.date) - new Date()) / (1000 * 60 * 60 * 24));
    
    // Status tag determine
    let statusText = '';
    if (daysLeft <= 0) {
      statusText = 'Passed';
    } else if (daysLeft <= 16) {
      statusText = 'Needs Pre-Audit (<16d)';
      criticalCount++;
    } else if (daysLeft <= 30) {
      statusText = 'Needs Visa! (<30d)';
      criticalCount++;
    } else {
      statusText = 'Monitored';
    }

    return [
      reminder.title,
      reminder.location,
      reminder.date,
      daysLeft > 0 ? `${daysLeft} days` : 'Past',
      statusText,
      reminder.id
    ];
  });

  // Calculate critical count
  alertBadge.textContent = criticalCount;

  const initSpreadsheet = (typeof jspreadsheet === 'function') ? jspreadsheet : (typeof jexcel === 'function' ? jexcel : null);
  
  if (!initSpreadsheet) {
    auditSpreadsheetContainer.innerHTML = '<p style="color: var(--text-muted);">Failed to load JSpreadsheet.</p>';
    return;
  }

  auditSpreadsheetInstance = initSpreadsheet(auditSpreadsheetContainer, {
    data: data,
    columns: [
      { type: 'text', title: 'Audit Title', width: 250 },
      { type: 'text', title: 'Location', width: 200 },
      { type: 'calendar', title: 'Date', width: 140, options: { format: 'YYYY-MM-DD' } },
      { type: 'text', title: 'Days Until Audit', width: 120, readOnly: true },
      { type: 'text', title: 'Alert Status', width: 180, readOnly: true },
      { type: 'hidden', title: 'ID' }
    ],
    allowInsertRow: true,
    allowDeleteRow: true,
    contextMenu: function(obj, x, y, e) {
      const items = [];
      const rowId = obj.getValueFromCoords(5, y);
      
      if (rowId) {
        items.push({
          title: 'Test Alert Notification',
          onclick: function() {
            testNotificationMail(rowId);
          }
        });
        items.push({
          type: 'line'
        });
        items.push({
          title: 'Delete Reminder Row',
          onclick: function() {
            deleteReminder(rowId);
          }
        });
      }
      items.push({
        title: 'Insert New Row',
        onclick: function() {
          obj.insertRow(1, y);
        }
      });
      return items;
    },
    onchange: async function() {
      await saveSpreadsheetToDatabase();
    },
    oninsertrow: async function() {
      await saveSpreadsheetToDatabase();
    },
    ondeleterow: async function() {
      await saveSpreadsheetToDatabase();
    }
  });
}

async function saveSpreadsheetToDatabase() {
  if (!auditSpreadsheetInstance) return;
  const currentData = auditSpreadsheetInstance.getData();
  
  const updatedReminders = [];
  currentData.forEach(row => {
    const title = row[0] || '';
    const location = row[1] || '';
    const dateVal = row[2] || '';
    const id = row[5] || '';

    // Ignore fully empty rows
    if (!title && !location && !dateVal) return;

    // Find existing to preserve notifications
    const existing = appState.reminders.find(r => r.id === id);

    updatedReminders.push({
      id: id || 'reminder-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title: title || 'Scheduled Audit',
      location: location || 'International Location',
      date: normalizeDate(dateVal || new Date().toISOString().split('T')[0]),
      notifiedVisa: existing ? (existing.notifiedVisa ?? false) : false,
      notifiedPreAudit: existing ? (existing.notifiedPreAudit ?? false) : false
    });
  });

  appState.reminders = updatedReminders;
  await window.api.saveAppData({ filename: 'reminders.json', data: appState.reminders });
  
  // Calculate critical count without rebuilding spreadsheet
  let criticalCount = 0;
  appState.reminders.forEach(reminder => {
    const daysLeft = Math.ceil((new Date(reminder.date) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0 && daysLeft <= 30) {
      criticalCount++;
    }
  });
  alertBadge.textContent = criticalCount;
}

// Global functions for inline actions (registered to window to allow simple onclick calls)
window.deleteReminder = async function(id) {
  appState.reminders = appState.reminders.filter(r => r.id !== id);
  await window.api.saveAppData({ filename: 'reminders.json', data: appState.reminders });
  renderReminders();
};

window.testNotificationMail = async function(id) {
  const reminder = appState.reminders.find(r => r.id === id);
  if (!reminder) return;
  
  addSystemMessage(`Triggering test alert check for: ${reminder.title}...`);
  triggerAlert(reminder, 'visa', true);
};

// Alert runner (triggers email + system popup)
async function triggerAlert(reminder, alertType = 'visa', isTest = false) {
  // 1. Native desktop popup notification
  await window.api.showNotification({
    title: alertType === 'visa' ? `Travel Visa Notice: ${reminder.title}` : `Pre-Audit Reminder: ${reminder.title}`,
    body: alertType === 'visa' 
      ? `Audit in ${reminder.location} scheduled for ${reminder.date}. Make visa arrangements soon (30 days or less)!`
      : `Audit in ${reminder.location} scheduled for ${reminder.date} is in less than 16 days!`
  });

  // 2. Email Notification
  if (appState.settings.smtpHost && appState.settings.smtpUser && appState.settings.smtpPass && appState.settings.recipient) {
    addSystemMessage(`Sending travel reminder email to ${appState.settings.recipient}...`);
    
    const isVisa = alertType === 'visa';
    const subject = isVisa 
      ? `[KITE TRAVEL WARNING] Visa Required: Audit in ${reminder.location} (${reminder.title})`
      : `[KITE TRAVEL ALERT] Pre-Audit Reminder: ${reminder.title} in ${reminder.location}`;
    
    const text = isVisa
      ? `Hello API Petroleum team,\n\nThis is an automated alert from Kite Agent.\n\nAn upcoming international audit has been detected:\nAudit: ${reminder.title}\nLocation: ${reminder.location}\nDate: ${reminder.date}\n\nSince this audit is outside Egypt and scheduled in approximately 30 days, please check and apply for a visa as soon as possible.\n\nSafe travels,\nKite Agent`
      : `Hello API Petroleum team,\n\nThis is an automated alert from Kite Agent.\n\nAn upcoming international audit is scheduled soon:\nAudit: ${reminder.title}\nLocation: ${reminder.location}\nDate: ${reminder.date}\n\nThis is a friendly reminder that this audit is now less than 16 days away. Please ensure all preparations are complete.\n\nSafe travels,\nKite Agent`;
       
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px;">${isVisa ? 'Visa Preparation Required' : 'Pre-Audit Alert'}</h2>
        <p>Hello <strong>API Petroleum team</strong>,</p>
        <p>This is an automated warning alert from your everyday tasks copilot, <strong>Kite Agent</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: bold;">Audit Title</td><td style="padding: 8px;">${reminder.title}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Destination</td><td style="padding: 8px; color: #ef4444; font-weight: bold;">${reminder.location}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px; font-weight: bold;">Scheduled Date</td><td style="padding: 8px;">${reminder.date}</td></tr>
        </table>
        <p style="background: #fef3c7; color: #92400e; padding: 12px; border-left: 4px solid #f59e0b; border-radius: 4px;">
          <strong>Important Notice:</strong> ${isVisa ? 'Since this destination is outside Egypt, you must arrange travel documentation/visas immediately to avoid delay.' : 'This audit is scheduled in less than 16 days. Please finalize all requirements.'}
        </p>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">Kite Agent Desktop Workspace App Alert</p>
      </div>
    `;

    const emailResult = await window.api.sendEmail({
      smtpConfig: {
        host: appState.settings.smtpHost,
        port: appState.settings.smtpPort,
        user: appState.settings.smtpUser,
        pass: appState.settings.smtpPass,
        senderEmail: appState.settings.senderEmail || appState.settings.smtpUser,
        senderName: 'Kite Travel Agent'
      },
      mailOptions: {
        to: appState.settings.recipient,
        subject: subject,
        text: text,
        html: html
      }
    });

    if (emailResult.success) {
      addSystemMessage(`Email warning successfully dispatched! MsgId: ${emailResult.messageId}`);
    } else {
      addSystemMessage(`Email send failed: ${emailResult.error}`);
    }
  } else {
    addSystemMessage("Email skipped: Complete SMTP profile configuration in Settings tab first to receive email notifications.");
  }
}

// Background scheduler checker
async function checkRemindersScheduler() {
  let remindersChanged = false;
  
  appState.reminders.forEach(reminder => {
    // Migrate old format
    if (reminder.notified !== undefined) {
      reminder.notifiedVisa = reminder.notified ?? false;
      reminder.notifiedPreAudit = reminder.notified ?? false;
      delete reminder.notified;
      remindersChanged = true;
    }
    
    if (reminder.notifiedVisa === undefined) reminder.notifiedVisa = false;
    if (reminder.notifiedPreAudit === undefined) reminder.notifiedPreAudit = false;

    const daysLeft = Math.ceil((new Date(reminder.date) - new Date()) / (1000 * 60 * 60 * 24));
    
    // Threshold 1: <= 30 days visa warning
    if (daysLeft > 0 && daysLeft <= 30 && !reminder.notifiedVisa) {
      triggerAlert(reminder, 'visa');
      reminder.notifiedVisa = true;
      remindersChanged = true;
    }
    
    // Threshold 2: <= 16 days pre-audit reminder
    if (daysLeft > 0 && daysLeft <= 16 && !reminder.notifiedPreAudit) {
      triggerAlert(reminder, 'preaudit');
      reminder.notifiedPreAudit = true;
      remindersChanged = true;
    }
  });

  if (remindersChanged) {
    await window.api.saveAppData({ filename: 'reminders.json', data: appState.reminders });
    renderReminders();
  }
}

// Helper to extract JSON array data from text
function extractTableData(text) {
  // Check for markdown code blocks containing JSON
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);
  let potentialJson = match ? match[1].trim() : '';

  if (!potentialJson) {
    // Fallback: look for JSON array bracket patterns
    const arrayRegex = /(\[\s*\{[\s\S]*\}\s*\]|\[\s*\[[\s\S]*\]\s*\])/;
    const arrayMatch = text.match(arrayRegex);
    if (arrayMatch) {
      potentialJson = arrayMatch[1].trim();
    }
  }

  if (potentialJson) {
    try {
      const parsed = JSON.parse(potentialJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      // Not a valid JSON array
    }
  }
  return null;
}

// Helper to extract email command JSON from text
function extractEmailCommand(text) {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);
  let potentialJson = match ? match[1].trim() : '';

  if (!potentialJson) {
    const objectRegex = /(\{\s*["']action["']\s*:\s*["']send_email["'][\s\S]*\})/;
    const objectMatch = text.match(objectRegex);
    if (objectMatch) {
      potentialJson = objectMatch[1].trim();
    }
  }

  if (potentialJson) {
    try {
      const parsed = JSON.parse(potentialJson);
      if (parsed && parsed.action === 'send_email') {
        return parsed;
      }
    } catch (e) {
      // Not a valid JSON object or not an email action
    }
  }
  return null;
}

// Helper to extract reminders command JSON from text
function extractRemindersCommand(text) {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);
  let potentialJson = match ? match[1].trim() : '';

  if (!potentialJson) {
    const objectRegex = /(\{\s*["']action["']\s*:\s*["']update_reminders["'][\s\S]*\})/;
    const objectMatch = text.match(objectRegex);
    if (objectMatch) {
      potentialJson = objectMatch[1].trim();
    }
  }

  if (potentialJson) {
    try {
      const parsed = JSON.parse(potentialJson);
      if (parsed && parsed.action === 'update_reminders') {
        return parsed;
      }
    } catch (e) {
      // Not a valid JSON
    }
  }
  return null;
}

// Handler to execute update reminders command from chat assistant
async function handleUpdateRemindersCommand(cmd) {
  if (Array.isArray(cmd.reminders)) {
    let newReminders = cmd.reminders.map(r => {
      const existing = appState.reminders.find(ex => ex.id === r.id);
      return {
        id: r.id || 'reminder-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        title: r.title || 'Scheduled Audit',
        location: r.location || 'International Site',
        date: normalizeDate(r.date),
        notifiedVisa: existing ? (existing.notifiedVisa ?? false) : false,
        notifiedPreAudit: existing ? (existing.notifiedPreAudit ?? false) : false
      };
    });

    appState.reminders = newReminders;
    await window.api.saveAppData({ filename: 'reminders.json', data: appState.reminders });
    renderReminders();
    addSystemMessage("Successfully updated travel reminders database from Copilot instruction.");
  }
}

// Handler to execute send email command from chat assistant
async function handleSendEmailCommand(cmd) {
  const recipient = cmd.to || appState.settings.recipient;
  if (!recipient) {
    addSystemMessage("Email failed: No recipient specified. Set a Recipient Email in Settings first or specify one in your message.");
    return;
  }

  if (!appState.settings.smtpHost || !appState.settings.smtpUser || !appState.settings.smtpPass) {
    addSystemMessage("Email failed: Please complete your SMTP configuration in the Settings tab before sending emails.");
    return;
  }

  addSystemMessage(`Sending email to ${recipient}...`);

  const emailResult = await window.api.sendEmail({
    smtpConfig: {
      host: appState.settings.smtpHost,
      port: appState.settings.smtpPort,
      user: appState.settings.smtpUser,
      pass: appState.settings.smtpPass,
      senderEmail: appState.settings.senderEmail || appState.settings.smtpUser,
      senderName: 'Kite Copilot'
    },
    mailOptions: {
      to: recipient,
      subject: cmd.subject || 'Message from Kite Copilot',
      text: cmd.body || '',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-bottom: 16px;">Message from Kite Copilot</h2>
          <p>${(cmd.body || '').replace(/\n/g, '<br>')}</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 10px;">Sent via Kite Agent Copilot Assistant</p>
        </div>
      `
    }
  });

  if (emailResult.success) {
    addSystemMessage(`Email successfully sent! Message ID: ${emailResult.messageId}`);
  } else {
    addSystemMessage(`Email send failed: ${emailResult.error}`);
  }
}

// Chat Send Message
async function handleSendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  chatInput.value = '';

  let prompt = text;
  let fileContext = '';

  if (appState.currentFile || jspreadsheetInstance) {
    if (jspreadsheetInstance) {
      const currentData = jspreadsheetInstance.getData();
      if (currentData.length > 0) {
        const headers = currentData[0];
        const rows = currentData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, idx) => {
            if (header) obj[header] = row[idx];
          });
          return obj;
        });
        fileContext = `Currently opened spreadsheet table rows (live edited):\n${JSON.stringify(rows)}`;
      }
    } else if (appState.currentFile && appState.currentFile.type === 'spreadsheet' && loadedWorkbook) {
      const sheet = loadedWorkbook.Sheets[loadedWorkbook.SheetNames[0]];
      fileContext = `Currently opened spreadsheet table rows:\n${JSON.stringify(XLSX.utils.sheet_to_json(sheet))}`;
    } else if (appState.currentFile && appState.currentFile.type === 'text') {
      fileContext = `Currently opened text document content:\n${appState.currentFile.data}`;
    }
  }

  // Get current reminders list for context
  const remindersContext = appState.reminders.length > 0
    ? `\n\nRegistered Travel/Audit Reminders database (live persistent table):\n${JSON.stringify(appState.reminders.map(r => ({ id: r.id, title: r.title, location: r.location, date: r.date })), null, 2)}`
    : '\n\nRegistered Travel/Audit Reminders database is currently empty.';

  // Construct message payload
  const messages = [
    {
      role: "system",
      content: `You are Kite Agent, an expert assistant for API Petroleum. 
You can understand spreadsheets, text files, and cropped images.
Answer questions accurately based on document content.

If the user requests to create, format, extract, or generate a spreadsheet, table, or log listing, you MUST format the tabular data strictly as a JSON array of objects or JSON array of arrays within a standard \`\`\`json markdown block. This allows the system to automatically load it into the app's interactive spreadsheet.
Example:
\`\`\`json
[
  { "Facility ID": "123", "Audit ID": "456", "Status": "Scheduled" }
]
\`\`\`

If the user requests you to send an email or message (e.g., "send an email to X saying Y" or "email the team about..."), you MUST output a JSON object containing the email details strictly inside a \`\`\`json code block.
Example:
\`\`\`json
{
  "action": "send_email",
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "body": "Email body content"
}
\`\`\`
If you do not know the recipient, leave the "to" field blank or omit it, and the app will use the default recipient configured in the settings.

If the user asks you to add, edit, or delete travel/audit reminders in their database, you can rewrite or modify the reminders database directly. To do this, you MUST output a JSON object containing the updated reminders list inside a \`\`\`json code block.
Example to add/modify/delete reminders:
\`\`\`json
{
  "action": "update_reminders",
  "reminders": [
    { "id": "reminder-1", "title": "Houston HSE", "location": "Houston, USA", "date": "2026-08-15" }
  ]
}
\`\`\`
Always list all reminders that should remain in the database (to delete one, simply omit it from this list; to edit one, keep its ID and change fields; to add one, provide a new unique ID or omit the ID and it will be generated).

${fileContext}
${remindersContext}`
    }
  ];

  // Check if we have cropped selection image
  if (appState.croppedImageBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: `Here is my question about the circled mouse selection: ${prompt}` },
        { type: "image_url", image_url: { url: `data:image/png;base64,${appState.croppedImageBase64}` } }
      ]
    });
  } else {
    messages.push({
      role: "user",
      content: prompt
    });
  }

  addMessage("Kite Agent is thinking...", 'agent', true);
  
  const isVisionMsg = !!appState.croppedImageBase64;
  const aiResponse = await queryOpenRouter(messages, isVisionMsg);
  
  // Remove typing indicator
  removeTypingIndicator();

  if (aiResponse) {
    addMessage(aiResponse, 'agent');
    
    // Attempt to extract and auto-render tabular data
    const tableData = extractTableData(aiResponse);
    if (tableData) {
      try {
        let dataArray;
        if (Array.isArray(tableData[0])) {
          dataArray = tableData;
        } else if (typeof tableData[0] === 'object') {
          const headers = Object.keys(tableData[0]);
          const rows = tableData.map(obj => headers.map(key => obj[key] !== undefined ? obj[key] : ''));
          dataArray = [headers, ...rows];
        }

        if (dataArray && dataArray.length > 0) {
          // Switch view container visibility to spreadsheet
          uploadPlaceholder.style.display = 'none';
          imageViewerContainer.style.display = 'none';
          documentViewerContainer.style.display = 'none';
          spreadsheetViewerContainer.style.display = 'block';
          
          renderSpreadsheet(dataArray, true);
          addSystemMessage("Detected tabular data in response. Automatically loaded into interactive spreadsheet!");
        }
      } catch (err) {
        console.error("Auto-render failed:", err);
      }
    }

    // Attempt to extract and send custom email if requested
    const emailCmd = extractEmailCommand(aiResponse);
    if (emailCmd) {
      await handleSendEmailCommand(emailCmd);
    }

    // Attempt to extract and update reminders if requested
    const remindersCmd = extractRemindersCommand(aiResponse);
    if (remindersCmd) {
      await handleUpdateRemindersCommand(remindersCmd);
    }
  } else {
    addMessage("I couldn't reach the AI assistant. Please check your OpenRouter API Key in the Settings tab.", 'agent');
  }
}

// Chat UI utilities
function addMessage(text, sender, isTyping = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  if (isTyping) msgDiv.id = 'typing-indicator';
  
  // Convert markdown-like headers/newlines to HTML quickly
  msgDiv.innerHTML = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
    
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

function addSystemMessage(text) {
  addMessage(text, 'system');
}

function addAgentMessage(text) {
  addMessage(text, 'agent');
}

// Settings load & save
async function saveSettings() {
  const provider = selectSmtpProvider.value;
  const smtpHost = provider === 'gmail' ? 'smtp.gmail.com' : inputSmtpHost.value.trim();
  const smtpPort = provider === 'gmail' ? '465' : inputSmtpPort.value.trim();
  const senderEmail = provider === 'gmail' ? inputSmtpUser.value.trim() : inputSenderEmail.value.trim();

  appState.settings = {
    apiKey: inputApiKey.value.trim(),
    model: inputModel.value.trim() || 'google/gemini-2.5-flash:free',
    visionModel: inputVisionModel.value.trim() || 'google/gemini-2.5-flash:free',
    smtpProvider: provider,
    smtpHost: smtpHost,
    smtpPort: smtpPort,
    smtpUser: inputSmtpUser.value.trim(),
    smtpPass: inputSmtpPass.value.trim(),
    senderEmail: senderEmail,
    recipient: inputRecipient.value.trim()
  };

  const success = await window.api.saveAppData({ filename: 'settings.json', data: appState.settings });
  if (success) {
    addSystemMessage("Settings successfully saved locally.");
    updateSmtpIndicator();
  } else {
    addSystemMessage("Failed to save settings to disk.");
  }
}

async function resetSettings() {
  inputApiKey.value = '';
  inputModel.value = 'google/gemini-2.5-flash:free';
  inputVisionModel.value = 'google/gemini-2.5-flash:free';
  selectSmtpProvider.value = 'gmail';
  inputSmtpHost.value = 'smtp.gmail.com';
  inputSmtpPort.value = '465';
  inputSmtpUser.value = '';
  inputSmtpPass.value = '';
  inputSenderEmail.value = '';
  inputRecipient.value = '';
  
  appState.settings = {
    apiKey: '',
    model: 'google/gemini-2.5-flash:free',
    visionModel: 'google/gemini-2.5-flash:free',
    smtpProvider: 'gmail',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '465',
    smtpUser: '',
    smtpPass: '',
    senderEmail: '',
    recipient: ''
  };

  await window.api.saveAppData({ filename: 'settings.json', data: appState.settings });
  addSystemMessage("Settings reset to default.");
  toggleProviderView();
  updateSmtpIndicator();
}

// Run init
document.addEventListener('DOMContentLoaded', init);
