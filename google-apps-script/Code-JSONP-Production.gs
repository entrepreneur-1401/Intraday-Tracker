/**
 * IntraDay Trading Dashboard - JSONP PRODUCTION Google Apps Script
 * SUPPORTS BOTH JSONP AND POST REQUESTS FOR NETLIFY STATIC DEPLOYMENT
 * 
 * Version: 7.0.0 - JSONP Production
 * Last Updated: 2025-07-27 , in this code you need to copy the headers in the respective sheets then only data goes in there.
 */

// Configuration - Update SPREADSHEET_ID with your actual Google Sheets ID
const CONFIG = {
  SPREADSHEET_ID: '1RXg9THvQd2WMwVgWH6G4tDuuoGOC59mf5pJGko51mVo', // Your actual Sheet ID
  SHEETS: {
    TRADES: 'Trades',
    STRATEGIES: 'Strategies', 
    PSYCHOLOGY: 'Psychology'
  }
};

// CORRECT Headers that match UI exactly
const TRADES_HEADERS = [
  'ID', 'Trade Date', 'Stock Name', 'Quantity', 'Entry Price', 'Exit Price', 
  'Stop Loss', 'Target Price', 'P&L', 'Setup Followed', 'Strategy', 'Emotion', 
  'Trade Notes', 'Psychology Reflections', 'Screenshot Link', 'Created At'
];

const STRATEGIES_HEADERS = [
  'ID', 'Name', 'Description', 'Screenshot URL', 'Tags', 'Status', 'Created At'
];

const PSYCHOLOGY_HEADERS = [
  'ID', 'Month', 'Year', 'Monthly P&L', 'Best Trade ID', 'Worst Trade ID',
  'Mental Reflections', 'Improvement Areas', 'Created At'
];

/**
 * INDIAN TIMEZONE FUNCTIONS
 */
function getISTDateTime() {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return istTime.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function formatIndianDate(date) {
  if (!date) return getISTDateTime().split(',')[0];
  const istDate = new Date(typeof date === 'string' ? date : date.getTime() + (5.5 * 60 * 60 * 1000));
  return istDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
}

/**
 * FAST CACHING - 30 second cache for speed
 */
const CACHE = {
  data: new Map(),
  timestamps: new Map(),
  CACHE_DURATION: 30000 // 30 seconds
};

function getCachedSheet(sheetName) {
  const cached = CACHE.data.get(sheetName);
  const timestamp = CACHE.timestamps.get(sheetName);
  
  if (cached && timestamp && (Date.now() - timestamp) < CACHE.CACHE_DURATION) {
    return cached;
  }
  
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
  CACHE.data.set(sheetName, sheet);
  CACHE.timestamps.set(sheetName, Date.now());
  
  return sheet;
}

/**
 * MAIN ENTRY POINTS - SUPPORTS BOTH GET (JSONP) AND POST
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const data = e.parameter.data ? JSON.parse(e.parameter.data) : {};
    const callback = e.parameter.callback;
    
    let result;
    
    switch (action) {
      case 'test':
        result = { success: true, message: 'JSONP Connection successful!', timestamp: getISTDateTime() };
        break;
      case 'getTrades':
        result = handleGetTrades();
        break;
      case 'getStrategies':
        result = handleGetStrategies();
        break;
      case 'getPsychologyEntries':
        result = handleGetPsychologyEntries();
        break;
      case 'addTrade':
        result = handleAddTrade({ data });
        break;
      case 'addStrategy':
        result = handleAddStrategy({ data });
        break;
      case 'addPsychologyEntry':
        result = handleAddPsychologyEntry({ data });
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    
    // Handle JSONP callback
    if (callback) {
      const jsonpResponse = callback + '(' + JSON.stringify(result) + ');';
      return ContentService
        .createTextOutput(jsonpResponse)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    // Regular JSON response
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    const errorResult = { success: false, error: error.message, timestamp: getISTDateTime() };
    
    if (e.parameter.callback) {
      const jsonpError = e.parameter.callback + '(' + JSON.stringify(errorResult) + ');';
      return ContentService
        .createTextOutput(jsonpError)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    
    let result;
    
    switch (action) {
      case 'test':
        result = { success: true, message: 'POST Connection successful!', timestamp: getISTDateTime() };
        break;
      case 'getTrades':
        result = handleGetTrades();
        break;
      case 'getStrategies':
        result = handleGetStrategies();
        break;
      case 'getPsychologyEntries':
        result = handleGetPsychologyEntries();
        break;
      case 'addTrade':
        result = handleAddTrade(requestData);
        break;
      case 'addStrategy':
        result = handleAddStrategy(requestData);
        break;
      case 'addPsychologyEntry':
        result = handleAddPsychologyEntry(requestData);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: getISTDateTime()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * DATA HANDLERS
 */
function handleGetTrades() {
  try {
    const sheet = getCachedSheet(CONFIG.SHEETS.TRADES);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { success: true, data: [] };
    }
    
    const trades = data.slice(1).map(row => ({
      id: row[0] || Date.now() + Math.random(),
      tradeDate: formatIndianDate(row[1]),
      stockName: row[2] || '',
      quantity: parseInt(row[3]) || 0,
      entryPrice: row[4] || '0',
      exitPrice: row[5] || '',
      stopLoss: row[6] || '',
      targetPrice: row[7] || '',
      profitLoss: row[8] || '0',
      setupFollowed: row[9] === 'Yes' || row[9] === true,
      strategy: row[10] || '',
      emotion: row[11] || '',
      tradeNotes: row[12] || '',
      psychologyReflections: row[13] || '',
      screenshotUrl: row[14] || '',
      createdAt: row[15] || getISTDateTime()
    }));
    
    return { success: true, data: trades };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function handleGetStrategies() {
  try {
    const sheet = getCachedSheet(CONFIG.SHEETS.STRATEGIES);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { success: true, data: [] };
    }
    
    const strategies = data.slice(1).map(row => ({
      id: row[0] || Date.now() + Math.random(),
      name: row[1] || '',
      description: row[2] || '',
      screenshotUrl: row[3] || '',
      tags: row[4] || '',
      status: row[5] || 'active',
      createdAt: row[6] || getISTDateTime()
    }));
    
    return { success: true, data: strategies };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function handleGetPsychologyEntries() {
  try {
    const sheet = getCachedSheet(CONFIG.SHEETS.PSYCHOLOGY);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { success: true, data: [] };
    }
    
    const entries = data.slice(1).map(row => ({
      id: row[0] || Date.now() + Math.random(),
      month: parseInt(row[1]) || new Date().getMonth() + 1,
      year: parseInt(row[2]) || new Date().getFullYear(),
      monthlyPnL: row[3] || '0',
      bestTradeId: row[4] || '',
      worstTradeId: row[5] || '',
      mentalReflections: row[6] || '',
      improvementAreas: row[7] || '',
      createdAt: row[8] || getISTDateTime()
    }));
    
    return { success: true, data: entries };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function handleAddTrade(requestData) {
  try {
    const sheet = getCachedSheet(CONFIG.SHEETS.TRADES);
    
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, TRADES_HEADERS.length).setValues([TRADES_HEADERS]);
      sheet.getRange(1, 1, 1, TRADES_HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    const trade = requestData.data || requestData;
    
    // Check for duplicates
    const existingData = sheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (row[2] === trade.stockName && 
          row[1] && formatIndianDate(row[1]) === formatIndianDate(trade.tradeDate) &&
          row[4] === trade.entryPrice) {
        return { success: true, message: 'Duplicate prevented', data: trade };
      }
    }
    
    // Create row
    const row = [
      trade.id || Date.now(),
      formatIndianDate(trade.tradeDate),
      trade.stockName || '',
      trade.quantity || 0,
      trade.entryPrice || '0',
      trade.exitPrice || '',
      trade.stopLoss || '',
      trade.targetPrice || '',
      trade.profitLoss || '0',
      trade.setupFollowed ? 'Yes' : 'No',
      trade.strategy || '',
      trade.emotion || '',
      trade.tradeNotes || '',
      trade.psychologyReflections || '',
      trade.screenshotUrl || '',
      getISTDateTime()
    ];
    
    sheet.appendRow(row);
    
    return { success: true, data: trade, timestamp: getISTDateTime() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function handleAddStrategy(requestData) {
  try {
    const sheet = getCachedSheet(CONFIG.SHEETS.STRATEGIES);
    
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, STRATEGIES_HEADERS.length).setValues([STRATEGIES_HEADERS]);
      sheet.getRange(1, 1, 1, STRATEGIES_HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    const strategy = requestData.data || requestData;
    
    // Check for duplicates
    const existingData = sheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (row[1] === strategy.name) {
        return { success: true, message: 'Duplicate prevented', data: strategy };
      }
    }
    
    const row = [
      strategy.id || Date.now(),
      strategy.name || '',
      strategy.description || '',
      strategy.screenshotUrl || '',
      strategy.tags || '',
      strategy.status || 'active',
      getISTDateTime()
    ];
    
    sheet.appendRow(row);
    
    return { success: true, data: strategy, timestamp: getISTDateTime() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function handleAddPsychologyEntry(requestData) {
  try {
    const sheet = getCachedSheet(CONFIG.SHEETS.PSYCHOLOGY);
    
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, PSYCHOLOGY_HEADERS.length).setValues([PSYCHOLOGY_HEADERS]);
      sheet.getRange(1, 1, 1, PSYCHOLOGY_HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    const entry = requestData.data || requestData;
    
    // Check for duplicates
    const existingData = sheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (row[1] === entry.month && row[2] === entry.year) {
        return { success: true, message: 'Duplicate prevented', data: entry };
      }
    }
    
    const row = [
      entry.id || Date.now(),
      entry.month || new Date().getMonth() + 1,
      entry.year || new Date().getFullYear(),
      entry.monthlyPnL || '0',
      entry.bestTradeId || '',
      entry.worstTradeId || '',
      entry.mentalReflections || '',
      entry.improvementAreas || '',
      getISTDateTime()
    ];
    
    sheet.appendRow(row);
    
    return { success: true, data: entry, timestamp: getISTDateTime() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * TEST FUNCTION
 */
function testConfiguration() {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    console.log('✅ Spreadsheet connection successful');
    console.log('✅ Configuration is correct');
    console.log('✅ Ready for deployment');
    return true;
  } catch (error) {
    console.error('❌ Configuration error:', error.message);
    return false;
  }
}