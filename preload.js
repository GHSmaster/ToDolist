const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getData: () => ipcRenderer.invoke('get-data'),
  addTodos: items => ipcRenderer.invoke('add-todos', items),
  updateTodo: item => ipcRenderer.invoke('update-todo', item),
  deleteTodos: ids => ipcRenderer.invoke('delete-todos', ids),
  toggleDone: id => ipcRenderer.invoke('toggle-done', id),
  setWidgetMode: enabled => ipcRenderer.invoke('set-widget-mode', enabled),
  windowControl: action => ipcRenderer.invoke('window-control', action),
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  onFocusAddInput: (callback) => ipcRenderer.on('focus-add-input', callback),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options)
})
