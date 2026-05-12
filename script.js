// DOM Elements (Ab inko DOMContentLoaded ke andar define karenge)
let taskForm;
let searchInput;
let filterStartDate;
let filterEndDate;
let dashboardBtn;
let exportBtn;
let importBtn;
let importInput;

let taskLists = {}; // Initialize as empty object, will populate inside DOMContentLoaded

let tasks = []; // Initialize as empty array, will try to load from localStorage below
let editingTaskId = null;

// Function to load tasks from localStorage safely
function loadTasks() {
  try {
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
      const parsedTasks = JSON.parse(storedTasks);
      // Basic validation for loaded tasks
      if (Array.isArray(parsedTasks) && parsedTasks.every(task => typeof task === 'object' && task !== null && 'id' in task && 'title' in task)) {
        // Adapt old task formats if necessary
        tasks = parsedTasks.map(task => {
            // Ensure tags is a string
            if (Array.isArray(task.tags)) {
                task.tags = task.tags.join(',');
            } else if (typeof task.tags !== 'string') {
                task.tags = ''; // Default to empty string if not array or string
            }

            // Map timeSpent to timeTracked if timeTracked is missing
            if (typeof task.timeTracked === 'undefined' && typeof task.timeSpent === 'number') {
                task.timeTracked = task.timeSpent;
            } else if (typeof task.timeTracked !== 'number') {
                task.timeTracked = 0; // Default to 0 if not a number
            }

            // Ensure history array exists
            task.history = Array.isArray(task.history) ? task.history : [];

            return task;
        });
        console.log('Tasks loaded from localStorage successfully:', tasks);
      } else {
        console.warn('Stored tasks in localStorage are not in expected format. Resetting tasks.');
        showCustomAlert('Error: Saved tasks are corrupted. Resetting tasks. Please check your backup file.');
        tasks = [];
        localStorage.removeItem('tasks'); // Clear corrupted data
      }
    } else {
      tasks = [];
      console.log('No tasks found in localStorage. Starting with empty array.');
    }
  } catch (e) {
    console.error('Error loading tasks from localStorage:', e);
    showCustomAlert('Error loading your tasks. Your saved data might be corrupted. Starting fresh.');
    tasks = []; // Reset tasks if data is corrupted
    localStorage.removeItem('tasks'); // Remove corrupted data
  }
}

function saveTasks() {
  try {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    console.log('Tasks saved to localStorage:', tasks);
  } catch (e) {
    console.error('Error saving tasks to localStorage:', e);
    showCustomAlert('Error saving your tasks. Please check your browser settings or disk space.');
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

// Helper to format a date object to a readable string (e.g., "YYYY-MM-DD HH:MM")
function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return ''; // Invalid date

    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}


function renderTasks() {
  // Ensure taskLists is populated before use
  if (Object.keys(taskLists).length === 0) {
      console.warn('taskLists is not yet populated. Skipping renderTasks.');
      return;
  }

  // Har list ko pehle khali karo
  // Aur count ke liye ek object banayein
  const taskCounts = {
    Upcoming: 0,
    Running: 0,
    Paused: 0,
    Completed: 0,
    OnHold: 0,
    Canceled: 0
  };

  Object.values(taskLists).forEach(list => {
    if (list) { // Check if list element exists
      list.innerHTML = '';
    }
  });

  const query = searchInput.value.toLowerCase();
  const startFilter = filterStartDate.value;
  const endFilter = filterEndDate.value;

  console.log('Rendering tasks. Total tasks:', tasks.length, 'Filters:', { query, startFilter, endFilter });

  if (tasks.length === 0) {
      console.log('No tasks to render.');
      // Agar koi tasks nahi hain toh bhi counts update karein
      updateSectionHeaders(taskCounts);
      return;
  }

  tasks.forEach(task => {
    // Ensure task properties exist and are converted to string before toLowerCase()
    const taskTitle = (task.title || '').toLowerCase();
    const taskDescription = (task.description || '').toLowerCase();
    // FIX: Ensure task.tags is a string before calling toLowerCase()
    const taskTags = (Array.isArray(task.tags) ? task.tags.join(',') : (task.tags || '')).toLowerCase();

    const matchesSearch = [taskTitle, taskDescription, taskTags].some(field =>
      field.includes(query)
    );
    const matchesDate =
      (!startFilter || (task.dueDate && task.dueDate >= startFilter)) &&
      (!endFilter || (task.dueDate && task.dueDate <= endFilter));

    if (!matchesSearch || !matchesDate) {
      console.log(`Task "${task.title}" filtered out. Matches search: ${matchesSearch}, Matches date: ${matchesDate}`);
      return;
    }

    const card = document.createElement('div');
    card.className = `task-card ${task.status ? task.status.toLowerCase() : 'upcoming'}`; // Default to upcoming if status is missing
    card.dataset.taskId = task.id; // Task ID ko data attribute mein store karo
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

    // Button banane ka helper function
    const addButton = (label, handler, color = '#0078d4') => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.backgroundColor = color;
      btn.onclick = () => handler(task.id);
      actions.appendChild(btn);
    };

    // Task status ke hisaab se buttons dikhana
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
        addButton('Complete', completeTask, 'green'); // Ab Paused task bhi direct complete ho sakta hai
        break;
      case 'Completed':
        addButton('Restart', restartTask, 'red');
        break;
      case 'OnHold': // Naya: On Hold tasks ke liye buttons
        addButton('Resume', resumeTask, 'orange');
        addButton('Complete', completeTask, 'green');
        break;
      default: // Agar status unknown hai toh bhi buttons dikhao
        addButton('Start', startTask, 'orange');
        break;
    }

    // "Hold" aur "Cancel" buttons, jo Completed aur Canceled tasks par nahi dikhenge
    if (task.status !== 'Completed' && task.status !== 'Canceled') {
        addButton('Hold', holdTask, 'purple'); // Naya Hold button
        addButton('Cancel', cancelTask, 'gray'); // Naya Cancel button
    }

    // Common buttons jo har task par dikhenge
    addButton('Edit', editTask, '#6c757d');
    addButton('Delete', deleteTask, '#dc3545');

    // Task ko uski sahi category mein add karo
    if (taskLists[task.status]) {
      taskLists[task.status].appendChild(card);
      // Count update karein
      taskCounts[task.status]++;
      console.log(`Task "${task.title}" added to "${task.status}" list.`);
    } else {
      // Agar status unknown hai, toh Upcoming mein add karein
      taskLists.Upcoming.appendChild(card);
      taskCounts.Upcoming++; // Upcoming count update karein
      console.warn(`Unknown status "${task.status}" for task: "${task.title}". Added to Upcoming.`);
    }
  });

  // Sabhi section headers ko update karein counts ke saath
  updateSectionHeaders(taskCounts);
}

// Naya function: Section headers ko update karna
function updateSectionHeaders(counts) {
  document.querySelectorAll('.task-column h3').forEach(header => {
    const sectionId = header.parentElement.id; // task-column ki ID
    const sectionTitleTextSpan = header.querySelector('.section-title-text'); // Naya span element
    const collapseIcon = header.querySelector('.collapse-icon'); // + / - icon

    if (!sectionTitleTextSpan || !collapseIcon) {
        console.warn('Section title text span or collapse icon not found for header:', header);
        return; // Agar elements nahi mile toh skip karein
    }

    // Original text (emoji ke bina)
    let originalBaseText = '';
    if (sectionId === 'upcomingTasks') originalBaseText = 'Upcoming';
    else if (sectionId === 'runningTasks') originalBaseText = 'Running';
    else if (sectionId === 'pausedTasks') originalBaseText = 'Paused';
    else if (sectionId === 'onHoldTasks') originalBaseText = 'On Hold';
    else if (sectionId === 'completedTasks') originalBaseText = 'Completed';
    else if (sectionId === 'canceledTasks') originalBaseText = 'Canceled';

    // Add emoji back based on sectionId
    let emoji = '';
    if (sectionId === 'upcomingTasks') emoji = '🔴';
    else if (sectionId === 'runningTasks') emoji = '🟠';
    else if (sectionId === 'pausedTasks') emoji = '🟡';
    else if (sectionId === 'onHoldTasks') emoji = '🟣';
    else if (sectionId === 'completedTasks') emoji = '🟢';
    else if (sectionId === 'canceledTasks') emoji = '⚫';

    const count = counts[Object.keys(taskLists).find(key => taskLists[key].parentElement.id === sectionId)] || 0;
    
    // section-title-text span ke content ko update karein
    sectionTitleTextSpan.textContent = `${originalBaseText} - (${count} Tasks)`;

    // Emoji ko h3 ke first child node mein rakhein
    // Agar h3 ka first child text node hai, toh use update karein, warna naya text node banayein
    if (header.firstChild && header.firstChild.nodeType === Node.TEXT_NODE) {
        header.firstChild.nodeValue = `${emoji} `;
    } else {
        const emojiNode = document.createTextNode(`${emoji} `);
        header.insertBefore(emojiNode, sectionTitleTextSpan);
    }

    // Collapse icon ki state ko maintain karein
    const taskList = header.nextElementSibling;
    if (taskList && taskList.classList.contains('collapsed')) {
        collapseIcon.textContent = '+';
    } else {
        collapseIcon.textContent = '-';
    }
  });
}


function startTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = 'Running';
  task.lastStart = Date.now();
  task.history = task.history || []; // Ensure history array exists
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
  task.history = task.history || []; // Ensure history array exists
  task.history.push({ action: 'Pause', timestamp: new Date().toISOString() });
  saveTasks();
  renderTasks();
}

function resumeTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = 'Running';
  task.lastStart = Date.now();
  task.history = task.history || []; // Ensure history array exists
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
  task.completedAt = new Date().toISOString(); // Set completion date and time
  task.history = task.history || []; // Ensure history array exists
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
  task.history = task.history || []; // Ensure history array exists
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
  task.history = task.history || []; // Ensure history array exists
  task.history.push({ action: 'Cancel', timestamp: new Date().toISOString() });
  saveTasks();
  renderTasks();
}

function restartTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || task.status !== 'Completed') return;
  task.status = 'Running';
  task.lastStart = Date.now();
  task.history = task.history || []; // Ensure history array exists
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
  // FIX: Ensure task.tags is a string when setting value to input
  document.getElementById('tags').value = Array.isArray(task.tags) ? task.tags.join(',') : (task.tags || '');
  document.getElementById('startDate').value = task.startDate || '';
  document.getElementById('dueDate').value = task.dueDate || '';
}

// Custom Alert Box (alert() ki jagah)
function showCustomAlert(message) {
  const alertBox = document.createElement('div');
  alertBox.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    text-align: center;
    font-family: 'Segoe UI', sans-serif;
    color: #333;
    border: 1px solid #ddd;
  `;
  alertBox.innerHTML = `
    <p>${message}</p>
    <button style="margin-top: 15px; padding: 8px 15px; background-color: #0078d4; color: white; border: none; border-radius: 5px; cursor: pointer;">OK</button>
  `;
  document.body.appendChild(alertBox);

  alertBox.querySelector('button').onclick = () => {
    document.body.removeChild(alertBox);
  };
}


window.addEventListener('DOMContentLoaded', () => {
  
  // --- 1. THE PHANTOM TAB LOGIC (START) ---
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'autopause') {
    // This is the phantom tab opened by Windows!
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
    
    // Force the phantom tab to close itself instantly
    setTimeout(() => {
      window.open('', '_self', ''); 
      window.close(); 
    }, 500);
    
    return; // Stop the rest of the app from loading in this hidden tab
  }

  // --- 2. THE MAIN TAB LISTENER ---
  // Detects when the Phantom Tab updates the local storage
  window.addEventListener('storage', (e) => {
    if (e.key === 'tasks') {
      console.log("Update detected from Phantom Tab. Refreshing...");
      loadTasks();
      renderTasks();
    }
  });
  // --- THE PHANTOM TAB LOGIC (END) ---
  // DOM Elements ko yahan initialize karein
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

  loadTasks(); // Load tasks when DOM is ready
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('startDate').value = today;
  document.getElementById('dueDate').value = today;
  renderTasks(); // Initial render after loading tasks

  // Event Listeners ko yahan attach karein
  taskForm.onsubmit = e => {
    e.preventDefault();

    const currentToday = new Date().toISOString().split('T')[0]; // Use a fresh 'today' for each submission

    if (editingTaskId) {
      const task = tasks.find(t => t.id === editingTaskId);
      if (task) {
        task.title = taskForm.title.value;
        task.description = taskForm.description.value;
        task.tags = taskForm.tags.value; // Tags are taken directly from input value (string)
        task.startDate = taskForm.startDate.value || currentToday;
        task.dueDate = taskForm.dueDate.value || currentToday;
      }
    } else {
      const newTask = {
        id: generateId(),
        title: taskForm.title.value,
        description: taskForm.description.value,
        tags: taskForm.tags.value, // Tags are taken directly from input value (string)
        startDate: taskForm.startDate.value || currentToday,
        dueDate: taskForm.dueDate.value || currentToday,
        status: 'Upcoming',
        timeTracked: 0,
        history: []
      };
      tasks.push(newTask);
      console.log('New task added:', newTask);
    }

    editingTaskId = null;
    saveTasks();
    taskForm.reset();
    // Default dates set karein
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
    console.log('Export button clicked. Blob created for download.');
    URL.revokeObjectURL(url); // Clean up the URL object
  };

  importBtn.onclick = () => importInput.click();

  importInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) {
      console.log('No file selected for import.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      console.log('File read complete. Raw content:', reader.result);
      try {
        const imported = JSON.parse(reader.result);
        console.log('Parsed imported data:', imported);

        // Validate imported data structure, but be more adaptive for older formats
        if (Array.isArray(imported) && imported.every(item => typeof item === 'object' && item !== null)) {
            // Map imported items to the expected task structure
            tasks = imported.map(task => {
                const newTask = {
                    id: task.id || generateId(), // Use existing ID or generate new
                    title: task.title || 'Untitled Task',
                    description: task.description || '',
                    // Adapt tags: if array, join; otherwise, use as is (expecting string)
                    tags: Array.isArray(task.tags) ? task.tags.join(',') : (task.tags || ''),
                    startDate: task.startDate || '',
                    dueDate: task.dueDate || '',
                    status: task.status || 'Upcoming',
                    // Adapt timeTracked: use timeTracked, or timeSpent, or default to 0
                    timeTracked: typeof task.timeTracked === 'number' ? task.timeTracked : (typeof task.timeSpent === 'number' ? task.timeSpent : 0),
                    history: Array.isArray(task.history) ? task.history : [],
                    completedAt: task.completedAt || undefined // Preserve completedAt if exists
                };
                return newTask;
            });

            saveTasks();
            renderTasks();
            showCustomAlert('Tasks imported successfully!');
            console.log('Tasks imported successfully and rendered:', tasks);
        } else {
          showCustomAlert('Invalid file format. Expected an array of task objects.');
          console.error('Import failed: Imported data is not an array of objects.', imported);
        }
      } catch (err) {
        showCustomAlert('Invalid file content. Please upload a valid JSON file.');
        console.error('Error parsing imported file:', err);
      }
    };
    reader.onerror = (err) => {
      console.error('FileReader error:', err);
      showCustomAlert('Error reading file. Please try again.');
    };
    reader.readAsText(file);
  };

  // Section Collapse/Expand functionality with + / - icon
  document.querySelectorAll('.task-column h3').forEach(header => {
    const taskList = header.nextElementSibling; // h3 ke baad wala div.task-list
    const collapseIcon = header.querySelector('.collapse-icon'); // + / - icon

    // Initial state set karein (all expanded by default)
    if (taskList && collapseIcon) {
      taskList.style.display = 'flex';
      taskList.style.flexDirection = 'column';
      taskList.classList.remove('collapsed');
      collapseIcon.textContent = '-'; // Show minus for expanded state
    }

    header.style.cursor = 'pointer'; // Cursor ko pointer banao
    header.style.userSelect = 'none'; // Text selection roko
    header.onclick = () => {
      if (taskList && collapseIcon) { // Ensure both elements exist
        if (taskList.classList.contains('collapsed')) {
          // If currently collapsed, expand it
          taskList.style.display = 'flex';
          taskList.style.flexDirection = 'column';
          taskList.classList.remove('collapsed');
          collapseIcon.textContent = '-'; // Change icon to minus
        } else {
          // If currently expanded, collapse it
          taskList.style.display = 'none';
          taskList.classList.add('collapsed');
          collapseIcon.textContent = '+'; // Change icon to plus
        }
      }
    };
  });
});

setInterval(() => {
  const now = Date.now();
  tasks.forEach(task => {
    // Sirf Running tasks ke liye timer update karo
    if (task.status === 'Running') {
      const elapsed = now - task.lastStart;
      const total = (task.timeTracked || 0) + elapsed; // Ensure timeTracked is initialized
      // Task ID se specific card ko dhoondo
      const card = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
      if (card) {
        const timerEl = card.querySelector('.timer');
        if (timerEl) {
          timerEl.textContent = formatDuration(total);
        }
      }
    }
  });
}, 1000);

// --- SYSTEM LOCK & IDLE DETECTION ---

// --- TIMER & BULLETPROOF LOCK DETECTION ---

// --- BULLETPROOF LOCK DETECTION (No Server/Permissions Needed) ---

// --- PROPER SYSTEM LOCK & IDLE DETECTION ---

let lastAutoPausedTask = null;

function forceAutoPause(reason) {
  const runningTask = tasks.find(t => t.status === 'Running');
  if (runningTask && runningTask.lastStart) {
    runningTask.timeTracked = (runningTask.timeTracked || 0) + (Date.now() - runningTask.lastStart);
    runningTask.lastStart = null; 
    runningTask.status = 'Paused';
    runningTask.lastModified = Date.now();
    runningTask.history = runningTask.history || [];
    runningTask.history.push({ action: `Pause (${reason})`, timestamp: new Date().toISOString() });
    
    lastAutoPausedTask = runningTask; 
    saveTasks();
    renderTasks();
  }
}

// 1. Normal Timer Update
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

// 2. The Official Idle API (Detects Win+L and Walking Away)
// 2. The Official Idle API (Detects Win+L and Walking Away)
// 2. The Official Idle API (Detects Win+L and Walking Away)
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
      // 1. If screen locks or you walk away -> AUTO PAUSE
      if (idleDetector.screenState === 'locked' || idleDetector.userState === 'idle') {
        forceAutoPause("System Locked");
      } 
      // 2. If screen unlocks and you are back -> SILENT AUTO RESUME
      else if (idleDetector.screenState === 'unlocked' && idleDetector.userState === 'active') {
        if (lastAutoPausedTask) {
          // Instantly resume the task without any prompts!
          resumeTask(lastAutoPausedTask.id);
          
          // Silently log it to the background console instead of a visual popup
          console.log(`Welcome back! Auto-resumed: "${lastAutoPausedTask.title}"`);
          
          lastAutoPausedTask = null; // Clear it out
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

window.addEventListener('DOMContentLoaded', () => {
  const enableBtn = document.getElementById('enableAutoPauseBtn');
  if (enableBtn) enableBtn.addEventListener('click', setupIdleDetection);
});

// Auto-pause if tab is closed
window.addEventListener('beforeunload', () => {
  forceAutoPause("App Closed");
});