const state = {
  month: new Date(),
  todos: [],
  selectedDate: formatDate(new Date()),
  selectedEndDate: formatDate(new Date()),
  selectedIds: new Set(),
  widgetMode: false,
  showCompleted: false,
  filterPriority: 'all',
  filterTags: new Set(),
  isCalendarOpen: false,
  isRangeMode: false
}

async function loadData() {
  const data = await window.api.getData()
  state.todos = data.todos || []
  renderSelectedDate() // Init header text
  updateTagFilterOptions()
  renderTodos()
  renderCalendar()
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function getMonthGrid(d) {
  const start = startOfMonth(d)
  const end = endOfMonth(d)
  const startWeekday = (start.getDay() + 6) % 7
  const days = []
  for (let i = 0; i < startWeekday; i++) days.push(null)
  for (let i = 1; i <= end.getDate(); i++) {
    days.push(new Date(d.getFullYear(), d.getMonth(), i))
  }
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function initCalendarControls() {
  const yearSelect = document.getElementById('calYear')
  const monthSelect = document.getElementById('calMonth')
  
  if (yearSelect.options.length > 0) return // Already initialized

  // Populate Years (Current +/- 10 years)
  const currentYear = new Date().getFullYear()
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    const opt = document.createElement('option')
    opt.value = i
    opt.textContent = i + '年'
    yearSelect.appendChild(opt)
  }
  
  // Populate Months
  for (let i = 0; i < 12; i++) {
    const opt = document.createElement('option')
    opt.value = i
    opt.textContent = (i + 1) + '月'
    monthSelect.appendChild(opt)
  }
}

function updateCalendarHeader() {
  const yearSelect = document.getElementById('calYear')
  const monthSelect = document.getElementById('calMonth')
  yearSelect.value = state.month.getFullYear()
  monthSelect.value = state.month.getMonth()
}

function renderSelectedDate() {
  // Update header trigger only
  const display = document.getElementById('currentDateDisplay')
  if (state.selectedEndDate && state.selectedEndDate !== state.selectedDate) {
    // Ensure correct order for display
    const start = state.selectedDate < state.selectedEndDate ? state.selectedDate : state.selectedEndDate
    const end = state.selectedDate < state.selectedEndDate ? state.selectedEndDate : state.selectedDate
    display.textContent = `${start} ~ ${end}`
  } else {
    display.textContent = `${state.selectedDate}`
  }
}

function renderCalendar() {
  initCalendarControls() // Ensure initialized
  updateCalendarHeader()
  
  // Bind Range Mode Checkbox
  const rangeToggle = document.getElementById('rangeSelectMode')
  if (rangeToggle) {
      rangeToggle.checked = state.isRangeMode
      rangeToggle.onchange = (e) => {
          state.isRangeMode = e.target.checked
          renderCalendar()
      }
  }
  
  const grid = document.getElementById('calendarGrid')
  grid.innerHTML = ''
  const days = getMonthGrid(state.month)
  const todayStr = formatDate(new Date())
  const counts = {}
  for (const t of state.todos) {
    if (!t.done) counts[t.date] = (counts[t.date] || 0) + 1
  }
  
  // Count projected todos for the visible grid
  const uniqueDays = new Set(days.filter(d => d).map(d => formatDate(d)))
  for (const ds of uniqueDays) {
    const projected = getProjectedTodos(ds)
    if (projected.length > 0) {
      counts[ds] = (counts[ds] || 0) + projected.length
    }
  }

  for (const d of days) {
    const cell = document.createElement('div')
    cell.className = 'cell'
    if (d) {
      const ds = formatDate(d)
      const dateEl = document.createElement('div')
      dateEl.className = 'date'
      dateEl.textContent = String(d.getDate())
      const dots = document.createElement('div')
      dots.className = 'dots'
      const c = counts[ds] || 0
      for (let i = 0; i < Math.min(c, 6); i++) {
        const dot = document.createElement('div')
        dot.className = 'dot'
        dots.appendChild(dot)
      }
      cell.appendChild(dateEl)
      cell.appendChild(dots)
      if (ds === todayStr) cell.classList.add('today')
      
      // Styling Logic
      const start = state.selectedDate < state.selectedEndDate ? state.selectedDate : state.selectedEndDate
      const end = state.selectedDate < state.selectedEndDate ? state.selectedEndDate : state.selectedDate
      
      if (start !== end) {
        if (ds === start) cell.classList.add('range-start')
        else if (ds === end) cell.classList.add('range-end')
        else if (ds > start && ds < end) cell.classList.add('in-range')
      } else {
        if (ds === start) cell.classList.add('selected')
      }
      
      cell.onclick = () => {
        if (!state.isRangeMode) {
            // Single Mode: Jump
            state.selectedDate = ds
            state.selectedEndDate = ds
        } else {
            // Range Mode
            if (state.selectedDate !== state.selectedEndDate) {
                // Has range -> Reset to start
                state.selectedDate = ds
                state.selectedEndDate = ds
            } else {
                // Has single -> Extend
                state.selectedEndDate = ds
                // Normalize logic handled in render/filter, but let's normalize state if we want consistent start/end
                // But keeping picked order might be useful? No, simpler to just set.
            }
        }
        
        // Normalize state for consistency
        if (state.selectedDate > state.selectedEndDate) {
            const temp = state.selectedDate
            state.selectedDate = state.selectedEndDate
            state.selectedEndDate = temp
        }
        
        renderSelectedDate()
        renderTodos()
        renderCalendar()
        
        if (!state.isRangeMode) {
             toggleCalendar(false)
        }
        // In range mode, keep open to allow user to see what they selected
      }
    }
    grid.appendChild(cell)
  }
}

function toggleCalendar(force) {
  state.isCalendarOpen = force !== undefined ? force : !state.isCalendarOpen
  const popup = document.getElementById('calendarPopup')
  popup.style.display = state.isCalendarOpen ? 'block' : 'none'
  if (state.isCalendarOpen) {
    renderCalendar()
  }
}

function getProjectedTodos(targetDateStr) {
  const targetDate = parseISO(targetDateStr)
  const projected = []
  
  for (const t of state.todos) {
    if (t.done || !t.recurrence || t.recurrence === 'none') continue
    
    const startDate = parseISO(t.date)
    // Only project if start date is strictly before target date
    // If it is same date, the real item exists
    if (startDate >= targetDate) continue 
    
    let matches = false
    const dayDiff = Math.floor((targetDate - startDate) / (1000 * 60 * 60 * 24))
    
    if (t.recurrence === 'daily') {
      matches = true
    } else if (t.recurrence === 'weekly') {
      matches = (dayDiff % 7 === 0)
    } else if (t.recurrence === 'monthly') {
      matches = (startDate.getDate() === targetDate.getDate())
    } else if (t.recurrence === 'yearly') {
      matches = (startDate.getDate() === targetDate.getDate() && startDate.getMonth() === targetDate.getMonth())
    }
    
    if (matches) {
      projected.push({
        ...t,
        date: targetDateStr,
        id: `virtual-${t.id}-${targetDateStr}`,
        isVirtual: true,
        originalDate: t.date,
        originalId: t.id
      })
    }
  }
  return projected
}

function updateTagFilterOptions() {
  const optionsContainer = document.getElementById('tagFilterOptions')
  const allTags = new Set()
  state.todos.forEach(t => {
    if (t.tags && t.tags.length) {
      t.tags.forEach(tag => allTags.add(tag))
    }
  })
  
  optionsContainer.innerHTML = ''
  
  const createOption = (value, label) => {
    const div = document.createElement('div')
    div.className = 'select-option'
    
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = state.filterTags.has(value)
    
    const toggle = () => {
       if (checkbox.checked) state.filterTags.add(value)
       else state.filterTags.delete(value)
       updateTriggerText()
       renderTodos()
    }
    
    checkbox.onchange = toggle
    div.onclick = (e) => {
        if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked
            toggle()
        }
    }
    
    const span = document.createElement('span')
    span.textContent = label
    
    div.appendChild(checkbox)
    div.appendChild(span)
    optionsContainer.appendChild(div)
  }
  
  createOption('__empty__', '无标签')
  
  Array.from(allTags).sort().forEach(tag => {
    createOption(tag, tag)
  })
  
  updateTriggerText()
}

function updateTriggerText() {
  const trigger = document.getElementById('tagFilterTrigger')
  const count = state.filterTags.size
  if (count === 0) {
    trigger.textContent = '筛选标签'
  } else {
    trigger.textContent = `已选 ${count} 项`
  }
}

function renderTodos() {
  const list = document.getElementById('todoList')
  list.innerHTML = ''
  
  // Filter logic
  let items = state.todos.filter(t => {
    // Determine if the item matches the current filter mode (active vs completed)
    const matchesStatus = state.showCompleted ? t.done : !t.done;
    if (!matchesStatus) return false;

    // Check date range for both active and completed items
    const selStart = state.selectedDate;
    const selEnd = state.selectedEndDate || state.selectedDate;
    
    let matchesDate = false;
    
    // Check if item has a specific end date (range item)
    if (t.endDate) {
      // Logic for item with date range: overlap with selected range
      matchesDate = t.date <= selEnd && t.endDate >= selStart;
    } else {
      // Standard single date item
      matchesDate = t.date >= selStart && t.date <= selEnd;
    }
    
    return matchesDate;
  })

  // Add projected items (only if viewing active todos)
  if (!state.showCompleted) {
    let curr = parseISO(state.selectedDate)
    const end = parseISO(state.selectedEndDate || state.selectedDate)
    while (curr <= end) {
       const dStr = formatDate(curr)
       const projected = getProjectedTodos(dStr)
       items.push(...projected)
       curr.setDate(curr.getDate() + 1)
    }
  }
  
  if (state.filterPriority !== 'all') {
    items = items.filter(t => (t.priority || 'medium') === state.filterPriority)
  }
  
  if (state.filterTags.size > 0) {
    items = items.filter(t => {
      const tags = t.tags || []
      // Check for empty tag selection
      if (state.filterTags.has('__empty__') && tags.length === 0) return true
      // Check for intersection
      return tags.some(tag => state.filterTags.has(tag))
    })
  }
  
  // Sort: High priority first, then medium, then low. Done items last.
  const pMap = { high: 0, medium: 1, low: 2 }
  items.sort((a, b) => {
    // If viewing completed, sort by date desc, else by priority
    if (state.showCompleted) return b.createdAt - a.createdAt
    const pa = pMap[a.priority || 'medium']
    const pb = pMap[b.priority || 'medium']
    return pa - pb
  })

  for (const t of items) {
    const li = document.createElement('li')
    li.className = 'todo-item' + (t.done ? ' done' : '') + ` p-${t.priority || 'medium'}`
    if (t.isVirtual) li.classList.add('virtual-item')
    
    // Header Row (Checkbox + Title + Meta)
    const headerRow = document.createElement('div')
    headerRow.className = 'todo-header-row'
    
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = state.selectedIds.has(t.id)
    if (t.isVirtual) {
        checkbox.disabled = true
        checkbox.title = "这是重复事项的预览，请先完成前置任务或当天任务"
    }
    checkbox.onchange = e => {
      e.stopPropagation()
      if (e.target.checked) state.selectedIds.add(t.id)
      else state.selectedIds.delete(t.id)
    }
    
    const content = document.createElement('div')
    content.className = 'todo-content'
    
    const title = document.createElement('div')
    title.className = 'title'
    title.textContent = t.title
    
    const meta = document.createElement('div')
    meta.className = 'meta'
    const pText = { high: '🔴', medium: '🔵', low: '⚪' }[t.priority || 'medium']
    const rText = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年', none: '' }[t.recurrence || 'none']
    
    let metaText = `${pText} ${rText ? '↻ ' + rText : ''}`
    if (state.showCompleted) metaText += ` ${t.date}`
    if (t.isVirtual) metaText = `[预览] ${metaText}`
    meta.textContent = metaText.trim()
    
    const tagsDiv = document.createElement('div')
    tagsDiv.className = 'tags'
    if (t.tags && t.tags.length) {
      t.tags.forEach(tag => {
        const span = document.createElement('span')
        span.className = 'tag'
        span.textContent = tag
        tagsDiv.appendChild(span)
      })
    }
    
    content.appendChild(title)
    if (meta.textContent) content.appendChild(meta)
    if (t.tags && t.tags.length) content.appendChild(tagsDiv)
    
    // Actions
    const doneBtn = document.createElement('button')
    doneBtn.className = 'todo-done-btn' // Specific class
    doneBtn.style.marginLeft = 'auto'
    doneBtn.textContent = t.done ? '↩' : '✓'
    doneBtn.title = t.done ? '标记为未完成' : '完成'
    if (t.isVirtual) {
        doneBtn.disabled = true
        doneBtn.style.opacity = '0.5'
        doneBtn.title = "请先完成前置任务"
    }
    doneBtn.onclick = async (e) => {
      e.stopPropagation()
      await window.api.toggleDone(t.id)
      await loadData()
    }

    headerRow.appendChild(checkbox)
    headerRow.appendChild(content)
    headerRow.appendChild(doneBtn)
    
    // Details Section
    const details = document.createElement('div')
    details.className = 'todo-details'
    
    const descText = document.createElement('div')
    descText.className = 'todo-desc-text'
    descText.textContent = t.description || '无详细描述'
    
    const editBtn = document.createElement('button')
    editBtn.className = 'edit-btn-small'
    editBtn.textContent = '编辑详情'
    if (t.isVirtual) {
        editBtn.disabled = true
        editBtn.textContent = '预览模式不可编辑'
    }
    editBtn.onclick = (e) => {
      e.stopPropagation()
      openModal(t)
    }
    
    details.appendChild(descText)
    details.appendChild(editBtn)
    
    li.appendChild(headerRow)
    li.appendChild(details)
    
    // Toggle Expand
    headerRow.onclick = () => {
      li.classList.toggle('expanded')
    }
    
    list.appendChild(li)
  }
}

let editingId = null

function openModal(todo = null) {
  const modal = document.getElementById('todoModal')
  const titleInput = document.getElementById('editTitle')
  const descInput = document.getElementById('editDescription')
  const dateInput = document.getElementById('editDate')
  const endDateInput = document.getElementById('editEndDate')
  const priorityInput = document.getElementById('editPriority')
  const recurrenceInput = document.getElementById('editRecurrence')
  const tagsInput = document.getElementById('editTags')
  const modalTitle = document.getElementById('modalTitle')

  if (todo) {
    editingId = todo.id
    modalTitle.textContent = '编辑待办'
    titleInput.value = todo.title
    descInput.value = todo.description || ''
    dateInput.value = todo.date
    endDateInput.value = todo.endDate || ''
    priorityInput.value = todo.priority || 'medium'
    recurrenceInput.value = todo.recurrence || 'none'
    tagsInput.value = (todo.tags || []).join(', ')
  } else {
    editingId = null
    modalTitle.textContent = '添加待办'
    titleInput.value = ''
    descInput.value = ''
    dateInput.value = state.selectedDate
    if (state.selectedDate !== state.selectedEndDate) {
        endDateInput.value = state.selectedEndDate
    } else {
        endDateInput.value = ''
    }
    priorityInput.value = 'medium'
    recurrenceInput.value = 'none'
    tagsInput.value = ''
  }
  
  modal.style.display = 'flex'
  titleInput.focus()
}

function closeModal() {
  document.getElementById('todoModal').style.display = 'none'
  editingId = null
}

async function saveModal() {
  const title = document.getElementById('editTitle').value.trim()
  const description = document.getElementById('editDescription').value.trim()
  
  if (!title) {
    alert('请输入标题')
    return
  }
  
  // Validation removed for description
  
  const date = document.getElementById('editDate').value
  const endDate = document.getElementById('editEndDate').value
  const priority = document.getElementById('editPriority').value
  const recurrence = document.getElementById('editRecurrence').value
  const tags = document.getElementById('editTags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  
  if (editingId) {
    // Update
    await window.api.updateTodo({
      id: editingId,
      title,
      description,
      date,
      endDate,
      priority,
      recurrence,
      tags
    })
  } else {
    // Add
    await window.api.addTodos([{
      title,
      description,
      date,
      endDate,
      priority,
      recurrence,
      tags
    }])
  }
  
  closeModal()
  await loadData()
}

async function deleteSelected() {
  const ids = Array.from(state.selectedIds)
  if (ids.length === 0) return
  await window.api.deleteTodos(ids)
  state.selectedIds.clear()
  await loadData()
}

function selectAll() {
  // Select visible items
  const list = document.getElementById('todoList')
  // Filter logic mirrors renderTodos but only for real items (we can't select virtuals)
  let items = state.todos.filter(t => {
    const matchesStatus = state.showCompleted ? t.done : !t.done
    if (!matchesStatus) return false
    
    const selStart = state.selectedDate
    const selEnd = state.selectedEndDate || state.selectedDate
    
    let matchesDate = false
    if (t.endDate) {
      matchesDate = t.date <= selEnd && t.endDate >= selStart
    } else {
      matchesDate = t.date >= selStart && t.date <= selEnd
    }
    
    return matchesDate
  })
  
  if (state.filterPriority !== 'all') {
    items = items.filter(t => (t.priority || 'medium') === state.filterPriority)
  }
  
  if (state.filterTags.size > 0) {
    items = items.filter(t => {
      const tags = t.tags || []
      if (state.filterTags.has('__empty__') && tags.length === 0) return true
      return tags.some(tag => state.filterTags.has(tag))
    })
  }
  
  state.selectedIds = new Set(items.map(t => t.id))
  renderTodos()
}

function bindControls() {
  document.getElementById('calYear').onchange = (e) => {
    state.month.setFullYear(parseInt(e.target.value))
    renderCalendar()
  }
  document.getElementById('calMonth').onchange = (e) => {
    state.month.setMonth(parseInt(e.target.value))
    renderCalendar()
  }
  
  document.getElementById('deleteSelected').onclick = deleteSelected
  document.getElementById('selectAll').onclick = selectAll
  
  // FAB Add
  document.getElementById('fabAdd').onclick = () => openModal()
  
  // Modal Controls
  document.getElementById('modalClose').onclick = closeModal
  document.getElementById('modalSave').onclick = saveModal
  // Close modal on outside click
  document.getElementById('todoModal').onclick = (e) => {
    if (e.target === document.getElementById('todoModal')) closeModal()
  }
  
  // Date Picker Trigger
  document.getElementById('dateTrigger').onclick = (e) => {
    e.stopPropagation()
    toggleCalendar()
  }
  
  // Close calendar when clicking outside
  document.addEventListener('click', (e) => {
    if (state.isCalendarOpen && !e.target.closest('#calendarPopup') && !e.target.closest('#dateTrigger')) {
      toggleCalendar(false)
    }
    
    // Also close tag dropdown if clicking outside
    const tagOptions = document.getElementById('tagFilterOptions')
    if (tagOptions.classList.contains('open') && !e.target.closest('#tagFilter')) {
      tagOptions.classList.remove('open')
    }
  })
  
  document.getElementById('widgetToggle').onchange = async e => {
    state.widgetMode = e.target.checked
    if (state.widgetMode) {
      document.body.classList.add('widget-mode')
    } else {
      document.body.classList.remove('widget-mode')
    }
    await window.api.setWidgetMode(state.widgetMode)
  }

  document.getElementById('winMin').onclick = () => window.api.windowControl('minimize')
  document.getElementById('winMax').onclick = () => window.api.windowControl('maximize')
  document.getElementById('winClose').onclick = () => window.api.windowControl('close')
  
  document.getElementById('btnExport').onclick = async () => {
    const res = await window.api.exportData()
    if (res) alert('导出成功')
  }
  document.getElementById('btnImport').onclick = async () => {
    const res = await window.api.importData()
    if (res) {
      await loadData()
      alert('导入成功')
    }
  }

  // New controls
  document.getElementById('viewToggle').onclick = () => {
    state.showCompleted = !state.showCompleted
    document.getElementById('viewToggle').textContent = state.showCompleted ? '待办' : '已完成'
    document.getElementById('viewToggle').classList.toggle('active', state.showCompleted)
    // Hide add button in completed view
    document.querySelector('.bottom-area').style.display = state.showCompleted ? 'none' : 'flex'
    renderTodos()
  }
  
  document.getElementById('filterPriority').onchange = e => {
    state.filterPriority = e.target.value
    renderTodos()
  }
  
  // Tag Filter Dropdown
  const tagTrigger = document.getElementById('tagFilterTrigger')
  const tagOptions = document.getElementById('tagFilterOptions')
  
  tagTrigger.onclick = (e) => {
    e.stopPropagation()
    tagOptions.classList.toggle('open')
  }
  
  // Shortcut
  if (window.api.onFocusAddInput) {
    window.api.onFocusAddInput(() => {
      openModal()
    })
  }
  
  // Mouse through logic for widget mode
  window.addEventListener('mousemove', event => {
    if (state.widgetMode) {
      const el = document.elementFromPoint(event.clientX, event.clientY)
      // If hovering over interactive elements or their containers, capture mouse
      // Otherwise let it pass through
      if (el && (
          el.closest('.todo-item') || 
          el.closest('.toolbar') || 
          el.closest('.list-controls') || 
          el.closest('.bottom-area') ||
          el.closest('.calendar-popup') ||
          el.closest('.modal') ||
          el.tagName === 'BUTTON' ||
          el.tagName === 'INPUT' ||
          el.tagName === 'SELECT' || 
          el.tagName === 'TEXTAREA' ||
          el.closest('.custom-select')
        )) {
        window.api.setIgnoreMouseEvents(false)
      } else {
        window.api.setIgnoreMouseEvents(true, { forward: true })
      }
    }
  })
}

window.addEventListener('DOMContentLoaded', () => {
  bindControls()
  loadData()
})
