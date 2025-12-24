const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, Notification } = require('electron')
const path = require('path')
const fs = require('fs')

// 禁用硬件加速，解决透明窗口可能出现的黑屏或渲染问题
app.disableHardwareAcceleration()

let mainWindow
let tray = null
let dataFilePath

function ensureDataFile() {
  const dir = app.getPath('userData')
  dataFilePath = path.join(dir, 'todos.json')
  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify({ todos: [] }), 'utf-8')
  }
}

function readData() {
  try {
    const raw = fs.readFileSync(dataFilePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { todos: [] }
  }
}

function writeData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data), 'utf-8')
}

function createTray() {
  // Use a simple icon or generate one. For now we assume a default icon or no icon (it might show empty space on windows if no icon provided)
  // In a real app, we should provide a path to an icon file.
  // We'll try to use the app icon if available, or create a simple empty tray if not critical.
  // NOTE: In this environment I cannot create an .ico file easily. I will skip icon file creation and try to use empty/default.
  // Warning: Tray must have an icon on Windows usually.
  // I will try to use a simple approach or just omit if it crashes.
  // Let's assume we can run without icon or it shows default.
  
  try {
    tray = new Tray(path.join(__dirname, 'resources', 'icon.ico'))
    
    const contextMenu = Menu.buildFromTemplate([
      { label: '打开主界面', click: () => showMainWindow() },
      { label: '快速添加', click: () => {
          showMainWindow()
          mainWindow.webContents.send('focus-add-input')
        } 
      },
      { type: 'separator' },
      { label: '退出', click: () => {
          app.isQuiting = true
          app.quit()
        } 
      }
    ])
    
    tray.setToolTip('待办日历')
    tray.setContextMenu(contextMenu)
    
    tray.on('click', () => {
      showMainWindow()
    })
  } catch (e) {
    console.error('Tray creation failed:', e)
  }
}

function showMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  } else {
    createWindow()
  }
}

function checkReminders() {
  const data = readData()
  const today = new Date().toISOString().split('T')[0]
  const dueTodos = data.todos.filter(t => t.date === today && !t.done && !t.reminded)
  
  if (dueTodos.length > 0) {
    new Notification({
      title: '待办提醒',
      body: `今天有 ${dueTodos.length} 项任务待完成，加油！`
    }).show()
    
    // Mark as reminded to avoid spamming
    dueTodos.forEach(t => t.reminded = true)
    writeData(data)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 300,
    minHeight: 400,
    show: false,
    frame: false,
    transparent: true, // 开启透明
    backgroundColor: '#00000000', // 关键：透明背景
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'))
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    // Check reminders on launch
    checkReminders()
  })
  
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow.hide()
      return false
    }
  })
}

app.whenReady().then(() => {
  // Create a dummy icon file if not exists to avoid tray error
  const resourceDir = path.join(__dirname, 'resources')
  if (!fs.existsSync(resourceDir)) fs.mkdirSync(resourceDir)
  const iconPath = path.join(resourceDir, 'icon.ico')
  // We can't easily generate a real ico here, so we might have to rely on electron default or skip tray if it fails.
  // For safety, let's just proceed. The tray might be invisible but clickable if no icon.
  // Or better, let's try to not use Tray if icon is strict.
  // Windows usually requires an icon.
  
  ensureDataFile()
  createWindow()
  
  try {
     createTray() 
  } catch (e) {
    console.log('Tray creation failed, likely due to missing icon.', e)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  
  // Check reminders every hour
  setInterval(checkReminders, 60 * 60 * 1000)
})

app.on('window-all-closed', () => {
  // Do not quit on window all closed, keep tray running
})

ipcMain.handle('get-data', () => {
  return readData()
})

ipcMain.handle('add-todos', (_, items) => {
  const data = readData()
  const now = Date.now()
  for (const item of items) {
    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`
    data.todos.push({
      id,
      title: String(item.title || '').trim(),
      date: String(item.date || '').trim(),
      priority: item.priority || 'medium',
      recurrence: item.recurrence || 'none',
      tags: Array.isArray(item.tags) ? item.tags : [],
      description: String(item.description || ''),
      done: false,
      createdAt: now
    })
  }
  writeData(data)
  return data
})

ipcMain.handle('update-todo', (_, updatedItem) => {
  const data = readData()
  const idx = data.todos.findIndex(t => t.id === updatedItem.id)
  if (idx >= 0) {
    data.todos[idx] = { ...data.todos[idx], ...updatedItem }
    writeData(data)
  }
  return data
})

ipcMain.handle('delete-todos', (_, ids) => {
  const data = readData()
  const set = new Set(ids)
  data.todos = data.todos.filter(t => !set.has(t.id))
  writeData(data)
  return data
})

ipcMain.handle('toggle-done', (_, id) => {
  const data = readData()
  const idx = data.todos.findIndex(t => t.id === id)
  if (idx >= 0) {
    const todo = data.todos[idx]
    if (todo.recurrence && todo.recurrence !== 'none' && !todo.done) {
      // Handle recurrence logic upon completion
      const [py, pm, pd] = todo.date.split('-').map(Number)
      const nextDate = new Date(py, pm - 1, pd)
      
      if (todo.recurrence === 'daily') nextDate.setDate(nextDate.getDate() + 1)
      else if (todo.recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
      else if (todo.recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
      else if (todo.recurrence === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1)
      
      const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const y = nextDate.getFullYear()
      const m = String(nextDate.getMonth() + 1).padStart(2, '0')
      const d = String(nextDate.getDate()).padStart(2, '0')
      
      data.todos.push({
        ...todo,
        id: newId,
        date: `${y}-${m}-${d}`,
        done: false,
        createdAt: Date.now()
      })
    }
    data.todos[idx].done = !data.todos[idx].done
    writeData(data)
  }
  return data
})

ipcMain.handle('set-widget-mode', (_, enabled) => {
  if (!mainWindow) return
  if (enabled) {
    // 挂在桌面模式
    mainWindow.setAlwaysOnTop(true, 'screen-saver') 
    mainWindow.setMinimumSize(300, 400)
    mainWindow.setSize(320, 500)
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    // 恢复正常模式：必须取消鼠标穿透，否则可能无法交互
    mainWindow.setIgnoreMouseEvents(false)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setMinimumSize(840, 600)
    mainWindow.setSize(1024, 720)
    mainWindow.setVisibleOnAllWorkspaces(false)
  }
})

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.setIgnoreMouseEvents(ignore, options)
})

ipcMain.handle('window-control', (_, action) => {
  if (!mainWindow) return
  if (action === 'minimize') mainWindow.minimize()
  if (action === 'maximize') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  }
  if (action === 'close') mainWindow.close()
})

ipcMain.handle('export-data', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出数据',
    defaultPath: 'todos-export.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  if (filePath) {
    fs.copyFileSync(dataFilePath, filePath)
    return true
  }
  return false
})

ipcMain.handle('import-data', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '导入数据',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (filePaths && filePaths.length > 0) {
    const raw = fs.readFileSync(filePaths[0], 'utf-8')
    try {
      const data = JSON.parse(raw)
      if (Array.isArray(data.todos)) {
        writeData(data)
        return true
      }
    } catch {}
  }
  return false
})
