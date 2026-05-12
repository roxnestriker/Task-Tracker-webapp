// --- DOM Elements & Global Variables ---
let taskForm;
let searchInput;
let filterStartDate;
let filterEndDate;
let dashboardBtn;
let exportBtn;
let importBtn;
let importInput;

let taskLists = {}; 
let tasks = []; 
let editingTaskId = null;
let lastAutoPausedTaskId = null; // Stores the ID of the task we auto-paused

// --- Data Loading & Saving ---
function loadTasks() {
  try {
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
      const parsedTasks = JSON.parse(storedTasks);
      if (Array.isArray(parsedTasks) && parsedTasks.every(task => typeof task === 'object' && task !== null && 'id' in task && 'title' in task)) {
        tasks = parsedTasks.map(task => {
            if (Array.isArray(task.tags)) {
                task.tags = task.tags.join(',');
            } else if (typeof task.tags !== 'string') {
                task.tags = ''; 
            }
            if (typeof task.timeTracked === 'undefined' && typeof task.timeSpent === 'number') {
                task.timeTracked = task.timeSpent;
            } else if (typeof task.timeTracked !== 'number') {
                task.timeTracked = 0; 
            }
            task.history = Array.isArray(task.history) ? task.history : [];
            task.lastModified = task.lastModified || 0;
            return task;
        });
      } else {
        showCustomAlert('Error: Saved tasks are corrupted. Resetting tasks.');
        tasks = [];
        localStorage.removeItem('tasks'); 
      }
    }
  } catch (e) {
    showCustomAlert('Error loading your tasks. Starting fresh.');
    tasks = []; 
    localStorage.removeItem('tasks'); 
  }
}

function saveTasks() {
  try {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  } catch (e) {
    showCustomAlert('Error saving your tasks.');
  }
}

function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return ''; 
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// --- Rendering & UI ---
function renderTasks() {
  if (Object.keys(taskLists).length === 0) return;

  const taskCounts = { Upcoming: 0, Running: 0, Paused: 0, Completed: 0, OnHold: 0, Canceled: 0 };

  Object.values(taskLists).forEach(list => {
    if (list) list.innerHTML = '';
  });

  const query = searchInput.value.toLowerCase();
  const startFilter = filterStartDate.value;
  const endFilter = filterEndDate.value;

  if (tasks.length === 0) {
      updateSectionHeaders(taskCounts);
      return;
  }

  // Sort tasks so recently modified ones appear at the top
  const sortedTasks = [...tasks].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

  sortedTasks.forEach(task => {
    const taskTitle = (task.title || '').toLowerCase();
    const taskDescription = (task.description || '').toLowerCase();
    const taskTags = (Array.isArray(task.tags) ? task.tags.join(',') : (task.tags || '')).toLowerCase();

    const matchesSearch = [taskTitle, taskDescription, taskTags].some(field => field.includes(query));
    const matchesDate =
      (!startFilter || (task.dueDate && task.dueDate >= startFilter)) &&
      (!endFilter || (task.dueDate && task.dueDate <= endFilter));

    if (!matchesSearch || !matchesDate) return;

    const card = document.createElement('div');
    card.className = `task-card ${task.status ? task.status.toLowerCase() : 'upcoming'}`;
    card.dataset.taskId = task.id; 
    card.innerHTML = `
      <h4>${task.title || 'Untitled Task'}</h4>
      <p>${task.description || 'No description'}</p>
      <p class="tags">Tags: ${task.tags || 'None'}</p>
      <p>Due: ${task.dueDate || 'No due date'}</p>
      <p class="timer">${formatDuration(task.timeTracked || 0)}</p>
      ${task.status === 'Completed' && task.completedAt ? `<p class="completed-date">Completed: ${formatDateTime(task.completedAt)}</p>` : ''}
      <div class="actions"></div>
    `;

    const actions = card.querySelector('.actions');
    const addButton = (label, handler, color = '#0078d4') => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.backgroundColor = color;
      btn.onclick = () => handler(task.id);
      actions.appendChild(btn);
    };

    switch (task.status) {
      case 'Upcoming':
        addButton('Start', startTask, 'orange');
        break;
      case 'Running':
        addButton('Pause', pauseTask, 'goldenrod');
        addButton('Complete', completeTask, 'green');
        break;
      case 'Paused':
        addButton('Resume', resumeTask, 'orange');
        addButton('Complete', completeTask, 'green'); 
        break;
      case 'Completed':
        addButton('Restart', restartTask, 'red');
        break;
      case 'OnHold': 
        addButton('Resume', resumeTask, 'orange');
        addButton('Complete', completeTask, 'green');
        break;
      default: 
        addButton('Start', startTask, 'orange');
        break;
    }

    if (task.status !== 'Completed' && task.status !== 'Canceled') {
        addButton('Hold', holdTask, 'purple'); 
        addButton('Cancel', cancelTask, 'gray'); 
    }

    addButton('Edit', editTask, '#6c757d');
    addButton('Delete', deleteTask, '#dc3545');

    if (taskLists[task.status]) {
      taskLists[task.status].appendChild(card);
      taskCounts[task.status]++;
    } else {
      taskLists.Upcoming.appendChild(card);
      taskCounts.Upcoming++; 
    }
  });

  updateSectionHeaders(taskCounts);
}

function updateSectionHeaders(counts) {
  document.querySelectorAll('.task-column h3').forEach(header => {
    const sectionId = header.parentElement.id;
    const sectionTitleTextSpan = header.querySelector('.section-title-text');
    const collapseIcon = header.querySelector('.collapse-icon');

    if (!sectionTitleTextSpan || !collapseIcon) return;

    let originalBaseText = '';
    let emoji = '';
    
    if (sectionId === 'upcomingTasks') { originalBaseText = 'Upcoming'; emoji = '🔴'; }
    else if (sectionId === 'runningTasks') { originalBaseText = 'Running'; emoji = '🟠'; }
    else if (sectionId === 'pausedTasks') { originalBaseText = 'Paused'; emoji = '🟡'; }
    else if (sectionId === 'onHoldTasks') { originalBaseText = 'On Hold'; emoji = '🟣'; }
    else if (sectionId === 'completedTasks') { originalBaseText = 'Completed'; emoji = '🟢'; }
    else if (sectionId === 'canceledTasks') { originalBaseText = 'Canceled'; emoji = '⚫'; }

    const count = counts[Object.keys(taskLists).find(key => taskLists[key].parentElement.id === sectionId)] || 0;
    sectionTitleTextSpan.textContent = `${originalBaseText} - (${count} Tasks)`;

    if (header.firstChild && header.firstChild.nodeType === Node.TEXT_NODE) {
        header.firstChild.nodeValue = `${emoji} `;
    } else {
        const emojiNode = document.createTextNode(`${emoji} `);
        header.insertBefore(emojiNode, sectionTitleTextSpan);
    }

    const taskList = header.nextElementSibling;
    if (taskList && taskList.classList.contains('collapsed')) {
        collapseIcon.textContent = '+';
    } else {
        collapseIcon.textContent = '-';
    }
  });
}

// --- Task Actions ---
function startTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = 'Running';
  task.lastStart = Date.now();
  task.lastModified = Date.now();
  task.history = task.history || []; 
  task.history.push({ action: 'Start', timestamp: new Date().toISOString() });
  saveTasks();
  renderTasks();
}

function pauseTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = 'Paused';
  if (task.lastStart) {
    task.timeTracked = (task.timeTracked || 0) + (Date.now() - task.lastStart);
    task.lastStart = null; 
  }
  task.lastModified = Date.now();
  task.history = task.history || []; 
  task.history.push({ action: 'Pause', timestamp: new Date().toISOString() });
  saveTasks();
  renderTasks();
}

function resumeTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = 'Running';
  task.lastStart = Date.now();
  task.lastModified = Date.now();
  task.history = task.history || []; 
  task.history.push({ action: 'Resume', timestamp: new Date().toISOString() });
  saveTasks();
  renderTasks();
}

function completeTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = 'Completed';
  if (task.lastStart) {
    task.timeTracked = (task.timeTracked || 0) + (Date.now() - task.lastStart);
    task.lastStart = null; 
  }
  task.completedAt = new Date().toISOString(); 
  task.lastModified = Date.now();
  task.history = task.history || []; 
  task.history.push({ action: 'Complete', timestamp: task.completedAt });
  saveTasks();
  renderTasks();
}

function holdTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (task.status === 'Running') {
    task.timeTracked = (task.timeTracked || 0) + (Date.now() - task.lastStart);
    task.lastStart = null; 
  }
  task.status = 'OnHold';
  task.lastModified = Date.now();
  task.history = task.history || []; 
  task.history.push({ action: 'Hold', timestamp: new Date().toISOString() });
  saveTasks();
  renderTasks();
}

function cancelTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (task.status === 'Running') {
    task.timeTracked = (task.timeTracked || 0) + (Date.now() - task.lastStart);
    task.lastStart = null; 
  }
  task.status = 'Canceled';
  task.lastModified = Date.now();
  task.history = task.history || []; 
  task.history.push({ action: 'Cancel', timestamp: new Date().toISOString() });
  saveTasks();
  renderTasks();
}

function restartTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || task.status !== 'Completed') return;
  task.status = 'Running';
  task.lastStart = Date.now();
  task.lastModified = Date.now();
  task.history = task.history || []; 
  task.history.push({ action: 'Restart', timestamp: new Date().toISOString() });
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingTaskId = id;
  document.getElementById('title').value = task.title || '';
  document.getElementById('description').value = task.description || '';
  document.getElementById('tags').value = Array.isArray(task.tags) ? task.tags.join(',') : (task.tags || '');
  document.getElementById('startDate').value = task.startDate || '';
  document.getElementById('dueDate').value = task.dueDate || '';
}

function showCustomAlert(message) {
  const alertBox = document.createElement('div');
  alertBox.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background-color: #fff; padding: 20px; border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); z-index: 1000;
    text-align: center; font-family: 'Segoe UI', sans-serif; color: #333; border: 1px solid #ddd;
  `;
  alertBox.innerHTML = `
    <p>${message}</p>
    <button style="margin-top: 15px; padding: 8px 15px; background-color: #0078d4; color: white; border: none; border-radius: 5px; cursor: pointer;">OK</button>
  `;
  document.body.appendChild(alertBox);
  alertBox.querySelector('button').onclick = () => document.body.removeChild(alertBox);
}


// --- Main Application Logic ---
window.addEventListener('DOMContentLoaded', () => {
  
  // Phantom Tab Handler
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'autopause') {
    document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px;'>Lock Detected. Pausing Task...</h2>";
    loadTasks();
    const runningTask = tasks.find(t => t.status === 'Running');
    if (runningTask) {
      if (runningTask.lastStart) {
        runningTask.timeTracked = (runningTask.timeTracked || 0) + (Date.now() - runningTask.lastStart);
        runningTask.lastStart = null; 
      }
      runningTask.status = 'Paused';
      runningTask.lastModified = Date.now();
      runningTask.history = runningTask.history || [];
      runningTask.history.push({ action: 'Pause (System Locked)', timestamp: new Date().toISOString() });
      saveTasks();
    }
    setTimeout(() => { window.open('', '_self', ''); window.close(); }, 500);
    return; 
  }

  // Cross-tab synchronization
  window.addEventListener('storage', (e) => {
    if (e.key === 'tasks') {
      loadTasks();
      renderTasks();
    }
  });

  // Init DOM Elements
  taskForm = document.getElementById('taskForm');
  searchInput = document.getElementById('searchInput');
  filterStartDate = document.getElementById('filterStartDate');
  filterEndDate = document.getElementById('filterEndDate');
  dashboardBtn = document.getElementById('dashboardBtn');
  exportBtn = document.getElementById('exportBtn');
  importBtn = document.getElementById('importBtn');
  importInput = document.getElementById('importInput');

  taskLists = {
    Upcoming: document.getElementById('upcomingList'),
    Running: document.getElementById('runningList'),
    Paused: document.getElementById('pausedList'),
    Completed: document.getElementById('completedList'),
    OnHold: document.getElementById('onHoldList'),
    Canceled: document.getElementById('canceledList')
  };

  loadTasks(); 
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('startDate').value = today;
  document.getElementById('dueDate').value = today;
  renderTasks(); 

  // Auto-Pause Setup Hook
  const enableBtn = document.getElementById('enableAutoPauseBtn');
  if (enableBtn) {
    enableBtn.addEventListener('click', setupIdleDetection);
  }

  taskForm.onsubmit = e => {
    e.preventDefault();
    const currentToday = new Date().toISOString().split('T')[0];

    if (editingTaskId) {
      const task = tasks.find(t => t.id === editingTaskId);
      if (task) {
        task.title = taskForm.title.value;
        task.description = taskForm.description.value;
        task.tags = taskForm.tags.value; 
        task.startDate = taskForm.startDate.value || currentToday;
        task.dueDate = taskForm.dueDate.value || currentToday;
        task.lastModified = Date.now();
      }
    } else {
      const newTask = {
        id: generateId(),
        title: taskForm.title.value,
        description: taskForm.description.value,
        tags: taskForm.tags.value, 
        startDate: taskForm.startDate.value || currentToday,
        dueDate: taskForm.dueDate.value || currentToday,
        status: 'Upcoming',
        timeTracked: 0,
        lastModified: Date.now(),
        history: []
      };
      tasks.push(newTask);
    }

    editingTaskId = null;
    saveTasks();
    taskForm.reset();
    document.getElementById('startDate').value = currentToday;
    document.getElementById('dueDate').value = currentToday;
    renderTasks();
  };

  searchInput.oninput = renderTasks;
  filterStartDate.onchange = renderTasks;
  filterEndDate.onchange = renderTasks;

  dashboardBtn.onclick = () => {
    if (window.electronAPI?.openDashboard) {
      window.electronAPI.openDashboard();
    } else {
      window.open('dashboard.html', '_blank');
    }
  };

  exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks.json';
    a.click();
    URL.revokeObjectURL(url); 
  };

  importBtn.onclick = () => importInput.click();

  importInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (Array.isArray(imported) && imported.every(item => typeof item === 'object' && item !== null)) {
            tasks = imported.map(task => {
                return {
                    id: task.id || generateId(),
                    title: task.title || 'Untitled Task',
                    description: task.description || '',
                    tags: Array.isArray(task.tags) ? task.tags.join(',') : (task.tags || ''),
                    startDate: task.startDate || '',
                    dueDate: task.dueDate || '',
                    status: task.status || 'Upcoming',
                    timeTracked: typeof task.timeTracked === 'number' ? task.timeTracked : (typeof task.timeSpent === 'number' ? task.timeSpent : 0),
                    history: Array.isArray(task.history) ? task.history : [],
                    lastModified: task.lastModified || Date.now(),
                    completedAt: task.completedAt || undefined 
                };
            });
            saveTasks();
            renderTasks();
            showCustomAlert('Tasks imported successfully!');
        } else {
          showCustomAlert('Invalid file format. Expected an array of task objects.');
        }
      } catch (err) {
        showCustomAlert('Invalid file content. Please upload a valid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Section Collapse Logic
  document.querySelectorAll('.task-column h3').forEach(header => {
    const taskList = header.nextElementSibling; 
    const collapseIcon = header.querySelector('.collapse-icon'); 

    if (taskList && collapseIcon) {
      taskList.style.display = 'flex';
      taskList.style.flexDirection = 'column';
      taskList.classList.remove('collapsed');
      collapseIcon.textContent = '-'; 
    }

    header.style.cursor = 'pointer'; 
    header.style.userSelect = 'none'; 
    header.onclick = () => {
      if (taskList && collapseIcon) { 
        if (taskList.classList.contains('collapsed')) {
          taskList.style.display = 'flex';
          taskList.style.flexDirection = 'column';
          taskList.classList.remove('collapsed');
          collapseIcon.textContent = '-'; 
        } else {
          taskList.style.display = 'none';
          taskList.classList.add('collapsed');
          collapseIcon.textContent = '+'; 
        }
      }
    };
  });
});

// --- System Timers & Automation ---

// 1. Core Timer Update (Runs every 1 second)
setInterval(() => {
  const now = Date.now();
  tasks.forEach(task => {
    if (task.status === 'Running') {
      const elapsed = now - task.lastStart;
      const total = (task.timeTracked || 0) + elapsed; 
      const card = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
      if (card) {
        const timerEl = card.querySelector('.timer');
        if (timerEl) timerEl.textContent = formatDuration(total);
      }
    }
  });
}, 1000);

// Helper function to safely pause the task
function forceAutoPause(reason) {
  const runningTask = tasks.find(t => t.status === 'Running');
  if (runningTask && runningTask.lastStart) {
    runningTask.timeTracked = (runningTask.timeTracked || 0) + (Date.now() - runningTask.lastStart);
    runningTask.lastStart = null; 
    runningTask.status = 'Paused';
    runningTask.lastModified = Date.now();
    runningTask.history = runningTask.history || [];
    runningTask.history.push({ action: `Pause (${reason})`, timestamp: new Date().toISOString() });
    
    // Store the ID so we can resume it automatically later
    lastAutoPausedTaskId = runningTask.id; 
    
    saveTasks();
    renderTasks();
  }
}

// 2. The Official Idle API for Netlify Hosted Version
async function setupIdleDetection() {
  if (!('IdleDetector' in window)) {
    showCustomAlert("Your browser does not support Idle Detection.");
    return;
  }

  const state = await IdleDetector.requestPermission();
  if (state !== 'granted') {
    showCustomAlert("Permission denied. Auto-Pause requires permission.");
    return;
  }

  try {
    const idleDetector = new IdleDetector();
    idleDetector.addEventListener('change', () => {
      // System Locked or User Walked Away -> AUTO PAUSE
      if (idleDetector.screenState === 'locked' || idleDetector.userState === 'idle') {
        forceAutoPause("System Locked");
      } 
      // System Unlocked and User Active -> SILENT AUTO RESUME
      else if (idleDetector.screenState === 'unlocked' && idleDetector.userState === 'active') {
        if (lastAutoPausedTaskId) {
          // Instantly resume the task
          resumeTask(lastAutoPausedTaskId);
          console.log(`Auto-resumed task ID: ${lastAutoPausedTaskId}`);
          lastAutoPausedTaskId = null; // Clear it out
        }
      }
    });

    // Start detector (60 seconds threshold for inactivity)
    await idleDetector.start({ threshold: 60000 });
    
    const btn = document.getElementById('enableAutoPauseBtn');
    if (btn) {
      btn.textContent = "✅ Auto-Pause Active";
      btn.style.backgroundColor = "#27ae60";
      btn.disabled = true;
    }
  } catch (err) {
    console.error("Idle detection failed:", err);
  }
}

// 3. Tab Closure Auto-Pause
window.addEventListener('beforeunload', () => {
  forceAutoPause("App Closed");
});
