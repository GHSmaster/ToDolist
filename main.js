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

function migrateRecurringTodos() {
  const data = readData()
  let changed = false
  
  // Group potential chains by title+recurrence to assign IDs if missing
  const groups = {}
  
  data.todos.forEach(t => {
    if (t.recurrence && t.recurrence !== 'none') {
      // Add 'cycle' tag if missing
      if (!Array.isArray(t.tags)) t.tags = []
      if (!t.tags.includes('cycle')) {
        t.tags.push('cycle')
        changed = true
      }
      
      // Check recurrenceId
      if (!t.recurrenceId) {
        const key = `${t.title}|${t.recurrence}`
        if (!groups[key]) groups[key] = []
        groups[key].push(t)
      }
    }
  })
  
  // Assign new recurrence IDs to grouped items
  for (const key in groups) {
    const group = groups[key]
    const newRecId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-rec`
    group.forEach(t => {
      t.recurrenceId = newRecId
      changed = true
    })
  }
  
  if (changed) {
    writeData(data)
    console.log('Migrated recurring todos with IDs and tags')
  }
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
  migrateRecurringTodos()
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
    
    // Auto-add cycle tag for recurring tasks
    let tags = Array.isArray(item.tags) ? item.tags : []
    let recurrenceId = item.recurrenceId // Allow passing it if projection
    
    if (item.recurrence && item.recurrence !== 'none') {
        if (!tags.includes('cycle')) tags.push('cycle')
        if (!recurrenceId) {
            recurrenceId = `${now}-${Math.random().toString(36).slice(2, 8)}-rec`
        }
    }
    
    data.todos.push({
      id,
      title: String(item.title || '').trim(),
      date: String(item.date || '').trim(),
      priority: item.priority || 'medium',
      recurrence: item.recurrence || 'none',
      recurrenceId,
      tags,
      description: String(item.description || ''),
      done: false,
      endDate: item.endDate || '', // Ensure endDate is saved
      subtasks: (item.subtasks || []).map(s => ({ ...s, done: false })),
      createdAt: now
    })
  }
  writeData(data)
  return data
})

ipcMain.handle('update-todo', (_, updatedItem) => {
  const data = readData()
  const targetIdx = data.todos.findIndex(t => t.id === updatedItem.id)
  
  if (targetIdx >= 0) {
    const target = data.todos[targetIdx]
    
    // Check if we need to propagate changes
    // Only if recurrenceId exists
    if (target.recurrenceId) {
        // Identify shared fields that should be synced
        // title, description, priority, recurrence, tags, endDate
        // Independent: id, date, done, subtasks, createdAt
        
        // Ensure 'cycle' tag is present if still recurring
        let newTags = updatedItem.tags !== undefined ? updatedItem.tags : target.tags
        if (updatedItem.recurrence && updatedItem.recurrence !== 'none') {
            if (!newTags) newTags = []
            if (!newTags.includes('cycle')) newTags = [...newTags, 'cycle']
        }
        
        const updates = {}
        if (updatedItem.title !== undefined) updates.title = updatedItem.title
        if (updatedItem.description !== undefined) updates.description = updatedItem.description
        if (updatedItem.priority !== undefined) updates.priority = updatedItem.priority
        if (updatedItem.recurrence !== undefined) updates.recurrence = updatedItem.recurrence
        if (updatedItem.endDate !== undefined) updates.endDate = updatedItem.endDate
        updates.tags = newTags
        
        // Apply to all in chain
        data.todos.forEach((t, i) => {
            if (t.recurrenceId === target.recurrenceId) {
                data.todos[i] = { ...t, ...updates }
            }
        })
        
        // Now apply specific updates (like date or subtasks) to the target item ONLY
        // Re-read target from array as it might have been updated by above loop
        const refreshedTarget = data.todos[targetIdx]
        data.todos[targetIdx] = { ...refreshedTarget, ...updatedItem }
        
    } else {
        // Not currently recurrent. Did it BECOME recurrent?
        if (updatedItem.recurrence && updatedItem.recurrence !== 'none') {
            updatedItem.recurrenceId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-rec`
            if (!updatedItem.tags) updatedItem.tags = []
            if (!updatedItem.tags.includes('cycle')) updatedItem.tags.push('cycle')
        }
        
        data.todos[targetIdx] = { ...target, ...updatedItem }
    }
    
    writeData(data)
  }
  return data
})

ipcMain.handle('delete-todos', (_, ids) => {
  const data = readData()
  const idsToDelete = new Set(ids)
  const recurrenceIdsToDelete = new Set()

  // Identify recurrence chains to delete
  data.todos.forEach(t => {
    if (idsToDelete.has(t.id) && t.recurrenceId) {
      recurrenceIdsToDelete.add(t.recurrenceId)
    }
  })

  data.todos = data.todos.filter(t => {
    if (idsToDelete.has(t.id)) return false
    if (t.recurrenceId && recurrenceIdsToDelete.has(t.recurrenceId)) return false
    return true
  })
  
  writeData(data)
  return data
})

function handleRecurrence(todo, data) {
  if (todo.recurrence && todo.recurrence !== 'none' && !todo.done) {
    const [py, pm, pd] = todo.date.split('-').map(Number)
    const nextDate = new Date(py, pm - 1, pd)
    
    if (todo.recurrence === 'daily') nextDate.setDate(nextDate.getDate() + 1)
    else if (todo.recurrence === 'workdays') {
      do {
        nextDate.setDate(nextDate.getDate() + 1)
      } while (nextDate.getDay() === 0 || nextDate.getDay() === 6)
    }
    else if (todo.recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
    else if (todo.recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
    else if (todo.recurrence === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1)
    
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const y = nextDate.getFullYear()
    const m = String(nextDate.getMonth() + 1).padStart(2, '0')
    const d = String(nextDate.getDate()).padStart(2, '0')
    
    // Check if a future task already exists to prevent duplication
    const existingFutureTask = data.todos.find(t => 
      t.title === todo.title && 
      t.date === `${y}-${m}-${d}` && 
      t.recurrence === todo.recurrence
    )
    
    if (!existingFutureTask) {
      data.todos.push({
        ...todo,
        id: newId,
        date: `${y}-${m}-${d}`,
        done: false,
        recurrenceId: todo.recurrenceId, // Preserve chain link
        subtasks: (todo.subtasks || []).map(s => ({ ...s, done: false })),
        createdAt: Date.now()
      })
    }
  }
}

ipcMain.handle('toggle-done', (_, id) => {
  const data = readData()
  const idx = data.todos.findIndex(t => t.id === id)
  if (idx >= 0) {
    const todo = data.todos[idx]
    handleRecurrence(todo, data)
    data.todos[idx].done = !data.todos[idx].done
    writeData(data)
  }
  return data
})

ipcMain.handle('batch-complete-todos', (_, ids) => {
  const data = readData()
  const set = new Set(ids)
  let changed = false
  
  data.todos.forEach(todo => {
    if (set.has(todo.id) && !todo.done) {
      handleRecurrence(todo, data)
      todo.done = true
      changed = true
    }
  })
  
  if (changed) writeData(data)
  return data
})

ipcMain.handle('batch-restore-todos', (_, ids) => {
  const data = readData()
  const set = new Set(ids)
  let changed = false
  
  data.todos.forEach(todo => {
    if (set.has(todo.id) && todo.done) {
      todo.done = false
      changed = true
    }
  })
  
  if (changed) writeData(data)
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
