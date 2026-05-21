document.addEventListener('DOMContentLoaded', () => {
  const heatmapBody = document.getElementById('heatmapBody');
  const summaryList = document.getElementById('summaryList');
  const weekSelector = document.getElementById('week-selector');
  let tasks = [];
  let holidays = [];
  
  try {
    tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    holidays = JSON.parse(localStorage.getItem('holidays')) || [];
  } catch (e) {
    tasks = [];
  }

  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MAX_MS_PER_SLOT = 30 * 60 * 1000;
  
  const timeSlots = [];
  for (let h = 0; h <= 23; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  function formatMinutesToHHMM(ms) {
    if (!ms || isNaN(ms)) return "00h 00m";
    const minutes = Math.floor(ms / 60000);
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }

  function formatClockTime(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  }

  function getWeekStartFromInput(value) {
    if (!value || !value.includes('-W')) {
      const today = new Date();
      const day = today.getDay(), diff = today.getDate() - day + (day == 0 ? -6:1);
      return new Date(today.setDate(diff));
    }
    const [year, week] = value.split('-W');
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const weekStart = new Date(jan4);
    weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (parseInt(week) - 1) * 7);
    weekStart.setHours(0, 0, 0, 0); 
    return weekStart;
  }

  function renderDashboard(weekStart) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
    const now = new Date(weekStart); 

    days.forEach((day, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const el = document.getElementById(`date-${day}`);
      if (el) el.textContent = date.toLocaleDateString();
    });

    heatmapBody.innerHTML = '';
    timeSlots.forEach(slot => {
      const row = document.createElement('tr');
      const timeCell = document.createElement('td');
      timeCell.className = 'time-label';
      timeCell.textContent = slot;
      row.appendChild(timeCell);
      
      for (let d = 0; d < 7; d++) {
        const cell = document.createElement('td');
        cell.className = 'heatmap-cell';
        cell.id = `cell-${d}-${slot.replace(':', '')}`;
        row.appendChild(cell);
      }
      heatmapBody.appendChild(row);
    });

    const dailyShiftData = {};
    
    // Find absolute Login Times
    tasks.forEach(task => {
      if (!task.history) return;
      for (let i = 0; i < task.history.length; i++) {
        const entry = task.history[i];
        if (entry && entry.action && (entry.action.includes('Start') || entry.action === 'Resume')) {
          const d = new Date(entry.timestamp);
          if (isNaN(d.getTime())) continue;
          
          const dateKey = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
          const timeMs = d.getTime();

          // HOLIDAY & WEEKEND LOGIC
          // 0 = Sunday, 6 = Saturday
          let isOvertimeDay = (d.getDay() === 0 || d.getDay() === 6 || holidays.includes(dateKey));

          if (!dailyShiftData[dateKey]) {
            dailyShiftData[dateKey] = {
                loginMs: timeMs,
                regularEndMs: isOvertimeDay ? timeMs : timeMs + (8.5 * 60 * 60 * 1000)
            };
          } else {
            if (timeMs < dailyShiftData[dateKey].loginMs) {
                dailyShiftData[dateKey].loginMs = timeMs;
                dailyShiftData[dateKey].regularEndMs = isOvertimeDay ? timeMs : timeMs + (8.5 * 60 * 60 * 1000);
            }
          }
        }
      }
    });

    const summaryTotals = {};
    const monthlyTotals = {};
    const dailyActiveMs = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; 
    const dailyOTMs = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; 
    let totalWeeklyActiveTime = 0;
    let totalWeeklyOvertimeMs = 0;
    let totalMonthlyOvertimeMs = 0;

    tasks.forEach(task => {
      if (!task || !Array.isArray(task.history)) return; 

      for (let i = 0; i < task.history.length; i++) {
        const entry = task.history[i];
        
        if (entry && entry.action && (entry.action.includes('Start') || entry.action === 'Resume')) {
          const start = new Date(entry.timestamp);
          const end = task.history[i + 1] && task.history[i + 1].timestamp 
                      ? new Date(task.history[i + 1].timestamp) 
                      : new Date();
          const duration = end - start;

          if (isNaN(duration) || duration <= 0) continue; 

          const dateKey = `${start.getFullYear()}-${(start.getMonth()+1).toString().padStart(2,'0')}-${start.getDate().toString().padStart(2,'0')}`;
          const shiftEndMs = dailyShiftData[dateKey] ? dailyShiftData[dateKey].regularEndMs : 0;

          if (start >= weekStart && start < weekEnd) {
            let sysDay = start.getDay();
            let colIndex = sysDay === 0 ? 6 : sysDay - 1;

            summaryTotals[task.title] = (summaryTotals[task.title] || 0) + duration;
            dailyActiveMs[colIndex] += duration;
            totalWeeklyActiveTime += duration;

            let otForThisChunk = 0;
            if (shiftEndMs > 0) {
              if (start.getTime() >= shiftEndMs) otForThisChunk = duration; 
              else if (end.getTime() > shiftEndMs) otForThisChunk = end.getTime() - shiftEndMs; 
            }
            dailyOTMs[colIndex] += otForThisChunk;
            totalWeeklyOvertimeMs += otForThisChunk;

            let currentStart = new Date(start);
            if (currentStart < weekStart) currentStart = new Date(weekStart);
            let finalEnd = new Date(end);
            if (finalEnd > weekEnd) finalEnd = new Date(weekEnd);

            while (currentStart < finalEnd) {
              const nextMidnight = new Date(currentStart);
              nextMidnight.setHours(24, 0, 0, 0); 
              const chunkEnd = finalEnd < nextMidnight ? finalEnd : nextMidnight;
              const durationMs = chunkEnd - currentStart;

              if (durationMs > 0) {
                let currentSysDay = currentStart.getDay();
                let currentColIndex = currentSysDay === 0 ? 6 : currentSysDay - 1;
                const hour = currentStart.getHours();
                const minute = currentStart.getMinutes();
                const slotStr = `${hour.toString().padStart(2, '0')}${minute < 30 ? '00' : '30'}`;
                const cell = document.getElementById(`cell-${currentColIndex}-${slotStr}`);

                if (cell) {
                  const slotStart = new Date(currentStart);
                  slotStart.setMinutes(minute < 30 ? 0 : 30, 0, 0);
                  
                  const startOffsetPct = ((currentStart - slotStart) / MAX_MS_PER_SLOT) * 100;
                  const heightPct = (durationMs / MAX_MS_PER_SLOT) * 100;

                  const segment = document.createElement('div');
                  segment.className = 'task-segment';
                  segment.style.top = `${startOffsetPct}%`;
                  segment.style.height = `${heightPct}%`;
                  segment.textContent = task.title;
                  segment.title = `${task.title}\n⏱️ Active: ${formatMinutesToHHMM(durationMs)}`;
                  
                  // GLASSMORPHISM DYNAMIC OVERTIME COLORS
                  const isWeekend = currentSysDay === 0 || currentSysDay === 6 || holidays.includes(dateKey);
                  
                  if (isWeekend || currentStart.getTime() >= shiftEndMs) {
                    // 100% OVERTIME (Red Glass)
                    segment.style.background = 'rgba(239, 68, 68, 0.4)';
                    segment.style.borderLeftColor = '#ef4444';
                  } else if (chunkEnd.getTime() <= shiftEndMs) {
                    // 100% REGULAR (Green Glass - Default)
                  } else {
                    // CROSSED THE BOUNDARY (Gradient Glass)
                    const regMs = shiftEndMs - currentStart.getTime();
                    const otPct = (regMs / durationMs) * 100;
                    segment.style.background = `linear-gradient(to bottom, rgba(52, 211, 153, 0.4) ${otPct}%, rgba(239, 68, 68, 0.4) ${otPct}%)`;
                  }

                  // CLICK TO EDIT (Requires Secret Mode)
                  segment.onclick = (e) => {
                      if(!document.body.classList.contains('edit-mode-active')) return;
                      if(e.target.classList.contains('resize-handle')) return; 
                      window.openEditModal(task.id, i, currentStart);
                  };

                  const topHandle = document.createElement('div');
                  topHandle.className = 'resize-handle top';
                  topHandle.onmousedown = (e) => startDragResize(e, task.id, i, 'top');

                  const bottomHandle = document.createElement('div');
                  bottomHandle.className = 'resize-handle bottom';
                  if (task.history[i + 1] && task.history[i + 1].timestamp) {
                      bottomHandle.onmousedown = (e) => startDragResize(e, task.id, i, 'bottom');
                      segment.appendChild(bottomHandle);
                  }
                  
                  segment.appendChild(topHandle);
                  cell.appendChild(segment);
                }
              }
              currentStart = chunkEnd;
            }
          }

          if (start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()) {
            monthlyTotals[task.title] = (monthlyTotals[task.title] || 0) + duration;
            let otForThisChunk = 0;
            if (shiftEndMs > 0) {
              if (start.getTime() >= shiftEndMs) otForThisChunk = duration;
              else if (end.getTime() > shiftEndMs) otForThisChunk = end.getTime() - shiftEndMs; 
            }
            totalMonthlyOvertimeMs += otForThisChunk;
          }
        }
      }
    });

    // Draw Background limits
    for (let d = 0; d < 7; d++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(currentDay.getDate() + d);
      const dateKey = `${currentDay.getFullYear()}-${(currentDay.getMonth()+1).toString().padStart(2,'0')}-${currentDay.getDate().toString().padStart(2,'0')}`;
      
      let sysDay = currentDay.getDay();
      const isWeekend = (sysDay === 0 || sysDay === 6 || holidays.includes(dateKey));

      if (dailyShiftData[dateKey] && !isWeekend) {
        const standardStartMs = dailyShiftData[dateKey].loginMs;
        const standardEndMs = dailyShiftData[dateKey].regularEndMs;

        timeSlots.forEach(slot => {
          const cell = document.getElementById(`cell-${d}-${slot.replace(':', '')}`);
          if (!cell) return;

          const [h, m] = slot.split(':').map(Number);
          const cellStartMs = new Date(weekStart).setHours(24 * d + h, m, 0, 0);
          const cellEndMs = cellStartMs + MAX_MS_PER_SLOT;

          if (cellEndMs > standardStartMs && cellStartMs < standardEndMs) {
            cell.classList.add('standard-hour-bg');
          }
          if (standardEndMs >= cellStartMs && standardEndMs < cellEndMs) {
            const offsetPct = ((standardEndMs - cellStartMs) / MAX_MS_PER_SLOT) * 100;
            const line = document.createElement('div');
            line.className = 'standard-end-line';
            line.style.top = `${offsetPct}%`;
            cell.appendChild(line);
          }
        });
      }
    }

    summaryList.innerHTML = '';
    const dailySection = document.createElement('div');
    dailySection.className = 'summary-card';
    dailySection.innerHTML = '<h3>📆 Daily Shift & Overtime</h3>';
    const dailyUl = document.createElement('ul');
    let hasDailyData = false;

    for (let d = 0; d < 7; d++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(currentDay.getDate() + d);
      const dateKey = `${currentDay.getFullYear()}-${(currentDay.getMonth()+1).toString().padStart(2,'0')}-${currentDay.getDate().toString().padStart(2,'0')}`;
      
      let sysDay = currentDay.getDay();
      const isWeekend = (sysDay === 0 || sysDay === 6 || holidays.includes(dateKey));

      if (dailyShiftData[dateKey] && dailyActiveMs[d] > 0) {
        hasDailyData = true;
        const loginMs = dailyShiftData[dateKey].loginMs;
        const regularEndMs = dailyShiftData[dateKey].regularEndMs;
        const activeMs = dailyActiveMs[d] || 0;
        const overtimeMs = dailyOTMs[d] || 0;

        const li = document.createElement('li');
        li.style.flexDirection = "column";
        li.style.alignItems = "flex-start";
        li.style.borderBottom = "1px solid #f1f5f9";
        li.style.paddingBottom = "12px";

        li.innerHTML = `
          <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 5px;">
            <strong style="color: #1e293b;">${dayNames[d]} (${currentDay.toLocaleDateString()})</strong>
            ${overtimeMs > 0 ? `<span class="overtime-badge">⚠️ ${formatMinutesToHHMM(overtimeMs)} Active OT</span>` : `<span style="color: #10b981; font-size: 0.75rem; font-weight: 700;">Standard Shift</span>`}
          </div>
          <div style="font-size: 0.85rem; color: #64748b; width: 100%; display: flex; justify-content: space-between;">
            <span>🕘 Login: <strong>${formatClockTime(new Date(loginMs))}</strong> &nbsp;&rarr;&nbsp; 🕔 Reg. End: <strong>${isWeekend ? 'N/A (Holiday)' : formatClockTime(new Date(regularEndMs))}</strong></span>
            <span>Task Time: ${formatMinutesToHHMM(activeMs)}</span>
          </div>
        `;
        dailyUl.appendChild(li);
      }
    }
    
    if (!hasDailyData) dailyUl.innerHTML = '<li style="color:#94a3b8; font-style:italic;">No tasks tracked this week.</li>';
    dailySection.appendChild(dailyUl);
    summaryList.appendChild(dailySection);

    const createSummaryCard = (title, totalsObj, totalActiveTime, overtimeMs) => {
      const card = document.createElement('div');
      card.className = 'summary-card';
      card.innerHTML = `<h3>${title} <br><span style="font-size:0.85rem; color:#ef4444;">Total Tracked Overtime: ${formatMinutesToHHMM(overtimeMs)}</span></h3>`;
      if (Object.keys(totalsObj).length === 0) {
        card.innerHTML += '<p style="color:#94a3b8; font-style:italic;">No active tasks tracked.</p>';
        summaryList.appendChild(card);
        return;
      }
      const ul = document.createElement('ul');
      Object.entries(totalsObj).sort((a, b) => b[1] - a[1]).forEach(([taskTitle, ms]) => {
        const li = document.createElement('li');
        li.style.flexDirection = 'column';
        li.style.alignItems = 'stretch';
        const percentage = totalActiveTime > 0 ? ((ms / totalActiveTime) * 100).toFixed(1) : 0;
        li.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-weight: 500;">
            <span style="color: #334155;">${taskTitle}</span><span style="color: #64748b;">${formatMinutesToHHMM(ms)} (${percentage}%)</span>
          </div>
          <div class="progress-container"><div class="progress-bar" style="width: ${percentage}%"></div></div>
        `;
        ul.appendChild(li);
      });
      card.appendChild(ul);
      summaryList.appendChild(card);
    };

    createSummaryCard(`📅 Weekly Task Breakdown (Active Time: ${formatMinutesToHHMM(totalWeeklyActiveTime)})`, summaryTotals, totalWeeklyActiveTime, totalWeeklyOvertimeMs);
    let totalMonthActive = 0;
    Object.values(monthlyTotals).forEach(v => totalMonthActive += v);
    createSummaryCard(`🗓️ Monthly Task Breakdown`, monthlyTotals, totalMonthActive, totalMonthlyOvertimeMs);
  }

  // --- UI CONTROLS ---

  document.getElementById('manageHolidaysBtn').onclick = () => {
    let dateStr = prompt("Enter a Holiday Date (YYYY-MM-DD): \n\nCurrently assigned holidays:\n" + (holidays.join(', ') || "None"));
    if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      if (!holidays.includes(dateStr)) {
        holidays.push(dateStr);
        localStorage.setItem('holidays', JSON.stringify(holidays));
        alert("Holiday added! Re-rendering dashboard.");
        const weekStart = getWeekStartFromInput(weekSelector.value);
        renderDashboard(weekStart); 
      }
    } else if (dateStr) {
      alert("Invalid format. Must be YYYY-MM-DD");
    }
  };

  // SECRET EDIT MODE (Ctrl + E)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      document.body.classList.toggle('edit-mode-active');
    }
  });

  function changeWeekBy(offset) {
    if(!weekSelector) return;
    const currentWeekStart = getWeekStartFromInput(weekSelector.value);
    currentWeekStart.setDate(currentWeekStart.getDate() + (offset * 7));
    weekSelector.value = `${currentWeekStart.getFullYear()}-W${getISOWeek(currentWeekStart).toString().padStart(2, '0')}`;
    renderDashboard(currentWeekStart);
  }

  const prevWeekBtn = document.getElementById('prevWeekBtn');
  if (prevWeekBtn) prevWeekBtn.onclick = () => changeWeekBy(-1);
  const nextWeekBtn = document.getElementById('nextWeekBtn');
  if (nextWeekBtn) nextWeekBtn.onclick = () => changeWeekBy(1);


  // --- DRAG TO RESIZE LOGIC ---
  let dragState = null;
  const dragGuide = document.getElementById('dragGuide');
  const dragGuideTime = document.getElementById('dragGuideTime');

  function startDragResize(e, taskId, historyIndex, edge) {
    if(!document.body.classList.contains('edit-mode-active')) return;
    e.preventDefault(); 
    e.stopPropagation();

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    dragState = {
      taskRef: task,
      index: historyIndex,
      edge: edge,
      startY: e.clientY,
      originalStartMs: new Date(task.history[historyIndex].timestamp).getTime(),
      originalEndMs: task.history[historyIndex + 1] ? new Date(task.history[historyIndex + 1].timestamp).getTime() : null
    };

    document.body.classList.add('is-dragging');
    dragGuide.style.display = 'block';
    dragGuide.style.top = e.clientY + 'px';
    
    document.addEventListener('mousemove', onDragResize);
    document.addEventListener('mouseup', stopDragResize);
  }

  function onDragResize(e) {
    if (!dragState) return;
    const deltaY = e.clientY - dragState.startY;
    const timeShiftMs = deltaY * 60 * 1000; 

    let previewMs;
    if (dragState.edge === 'top') {
        previewMs = dragState.originalStartMs + timeShiftMs;
    } else {
        previewMs = dragState.originalEndMs + timeShiftMs;
    }

    dragGuide.style.top = e.clientY + 'px';
    dragGuideTime.textContent = formatClockTime(new Date(previewMs));
  }

  function stopDragResize(e) {
    if (!dragState) return;
    document.body.classList.remove('is-dragging');
    dragGuide.style.display = 'none';
    
    document.removeEventListener('mousemove', onDragResize);
    document.removeEventListener('mouseup', stopDragResize);

    const deltaY = e.clientY - dragState.startY;
    const timeShiftMs = deltaY * 60 * 1000; 

    const startEntry = dragState.taskRef.history[dragState.index];
    const endEntry = dragState.taskRef.history[dragState.index + 1];

    if (dragState.edge === 'top') {
        const newStartMs = dragState.originalStartMs + timeShiftMs;
        if (!dragState.originalEndMs || newStartMs < dragState.originalEndMs) {
            startEntry.timestamp = new Date(newStartMs).toISOString();
        }
    } else if (dragState.edge === 'bottom' && endEntry) {
        const newEndMs = dragState.originalEndMs + timeShiftMs;
        if (newEndMs > dragState.originalStartMs) {
            endEntry.timestamp = new Date(newEndMs).toISOString();
        }
    }

    let newTotalMs = 0;
    for (let i = 0; i < dragState.taskRef.history.length; i++) {
      const entry = dragState.taskRef.history[i];
      if (entry.action.includes('Start') || entry.action === 'Resume') {
        const s = new Date(entry.timestamp);
        const eTime = dragState.taskRef.history[i+1] ? new Date(dragState.taskRef.history[i+1].timestamp) : new Date();
        newTotalMs += (eTime - s);
      }
    }
    dragState.taskRef.timeTracked = newTotalMs;
    dragState.taskRef.lastModified = Date.now();

    localStorage.setItem('tasks', JSON.stringify(tasks));
    
    const weekStart = getWeekStartFromInput(weekSelector.value);
    renderDashboard(weekStart); 
    
    dragState = null;
  }

  // --- MANUAL EDIT MODAL ---
  const modal = document.getElementById('editTimeModal');
  const startTimeInput = document.getElementById('editStartTime');
  const endTimeInput = document.getElementById('editEndTime');

  function toInputTime(date) { return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; }
  function applyTimeToDate(baseDate, timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(baseDate.getTime());
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  }

  window.openEditModal = function(taskId, historyIndex, blockDate) {
    if (!modal) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    window.editingTaskRef = task;
    window.editingHistoryIndex = historyIndex;
    window.editingBaseDate = new Date(blockDate);

    const startEntry = task.history[historyIndex];
    const endEntry = task.history[historyIndex + 1];

    document.getElementById('editModalTitle').textContent = `Edit: ${task.title}`;
    startTimeInput.value = toInputTime(new Date(startEntry.timestamp));

    if (endEntry && endEntry.timestamp) {
      endTimeInput.value = toInputTime(new Date(endEntry.timestamp));
      endTimeInput.disabled = false;
    } else {
      endTimeInput.value = "";
      endTimeInput.disabled = true;
    }
    modal.style.display = 'flex';
  };

  if (modal) {
      document.getElementById('cancelEditBtn').onclick = () => modal.style.display = 'none';
      document.getElementById('saveEditBtn').onclick = () => {
        if (!window.editingTaskRef || window.editingHistoryIndex === null) return;
        const startEntry = window.editingTaskRef.history[window.editingHistoryIndex];
        const endEntry = window.editingTaskRef.history[window.editingHistoryIndex + 1];

        if (startTimeInput.value) startEntry.timestamp = applyTimeToDate(window.editingBaseDate, startTimeInput.value).toISOString();
        if (endTimeInput.value && !endTimeInput.disabled && endEntry) endEntry.timestamp = applyTimeToDate(window.editingBaseDate, endTimeInput.value).toISOString();

        let newTotalMs = 0;
        for (let i = 0; i < window.editingTaskRef.history.length; i++) {
          const entry = window.editingTaskRef.history[i];
          if (entry.action.includes('Start') || entry.action === 'Resume') {
            const s = new Date(entry.timestamp);
            const eTime = window.editingTaskRef.history[i+1] ? new Date(window.editingTaskRef.history[i+1].timestamp) : new Date();
            newTotalMs += (eTime - s);
          }
        }
        window.editingTaskRef.timeTracked = newTotalMs;
        window.editingTaskRef.lastModified = Date.now();
        localStorage.setItem('tasks', JSON.stringify(tasks));
        modal.style.display = 'none';
        const weekStart = getWeekStartFromInput(weekSelector.value);
        renderDashboard(weekStart); 
      };
  }

  function getISOWeek(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const diff = target - firstThursday;
    return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  }

  const today = new Date();
  const week = getISOWeek(today);
  
  if (weekSelector) {
    weekSelector.value = `${today.getFullYear()}-W${week.toString().padStart(2, '0')}`;
    const weekStart = getWeekStartFromInput(weekSelector.value);
    renderDashboard(weekStart);

    weekSelector.addEventListener('input', () => {
      const newWeekStart = getWeekStartFromInput(weekSelector.value);
      renderDashboard(newWeekStart);
    });
    
    weekSelector.addEventListener('change', () => {
      const newWeekStart = getWeekStartFromInput(weekSelector.value);
      renderDashboard(newWeekStart);
    });
  }
});
