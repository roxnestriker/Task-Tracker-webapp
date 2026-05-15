document.addEventListener('DOMContentLoaded', () => {
  const heatmapBody = document.getElementById('heatmapBody');
  const summaryList = document.getElementById('summaryList');
  const weekSelector = document.getElementById('week-selector');
  let tasks = [];
  
  try {
    tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  } catch (e) {
    tasks = [];
  }

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Create 24 Hour Time Slots (00:00 to 23:30)
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
      today.setDate(today.getDate() - today.getDay()); 
      today.setHours(0, 0, 0, 0);
      return today;
    }
    const [year, week] = value.split('-W');
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const weekStart = new Date(jan4);
    
    weekStart.setDate(jan4.getDate() - dayOfWeek + (parseInt(week) - 1) * 7);
    weekStart.setHours(0, 0, 0, 0); 
    return weekStart;
  }

  function renderDashboard(weekStart) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

    // 1. Set date headers
    days.forEach((day, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const el = document.getElementById(`date-${day}`);
      if (el) el.textContent = date.toLocaleDateString();
    });

    // 2. Build the Base 24-Hour Grid
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

    // 3. Global Clock Tracker: Find Absolute Login (First Task Start) for EVERY day
    const dailyShiftData = {};
    tasks.forEach(task => {
      if (!task.history) return;
      for (let i = 0; i < task.history.length; i++) {
        const entry = task.history[i];
        if (entry && entry.action && (entry.action.includes('Start') || entry.action === 'Resume')) {
          const d = new Date(entry.timestamp);
          if (isNaN(d.getTime())) continue;
          
          const dateKey = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
          const timeMs = d.getTime();

          if (!dailyShiftData[dateKey]) {
            dailyShiftData[dateKey] = {
                loginMs: timeMs,
                regularEndMs: timeMs + (8.5 * 60 * 60 * 1000) // Exactly 8.5 hours later
            };
          } else {
            if (timeMs < dailyShiftData[dateKey].loginMs) {
                dailyShiftData[dateKey].loginMs = timeMs;
                dailyShiftData[dateKey].regularEndMs = timeMs + (8.5 * 60 * 60 * 1000);
            }
          }
        }
      }
    });

    // Tracking Variables for active task time & OT
    const summaryTotals = {};
    const monthlyTotals = {};
    const dailyActiveMs = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; 
    const dailyOTMs = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; 
    let totalWeeklyActiveTime = 0;
    let totalWeeklyOvertimeMs = 0;
    let totalMonthlyOvertimeMs = 0;
    const MAX_MS_PER_SLOT = 30 * 60 * 1000;

    // 4. Process Tasks and Map to Grid
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
          const shiftEndMs = dailyShiftData[dateKey].regularEndMs;

          // Summaries & Grid for Current Week
          if (start >= weekStart && start < weekEnd) {
            summaryTotals[task.title] = (summaryTotals[task.title] || 0) + duration;
            dailyActiveMs[start.getDay()] += duration;
            totalWeeklyActiveTime += duration;

            // --- OT CALCULATION ---
            // If the task was worked on AFTER the 8.5 hour window closed, it's Overtime.
            let otForThisChunk = 0;
            if (start.getTime() >= shiftEndMs) {
                otForThisChunk = duration; // Entire task is OT
            } else if (end.getTime() > shiftEndMs) {
                otForThisChunk = end.getTime() - shiftEndMs; // Task crossed the border, only count time after border
            }
            dailyOTMs[start.getDay()] += otForThisChunk;
            totalWeeklyOvertimeMs += otForThisChunk;

            // --- DRAW ON GRID ---
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
                const day = currentStart.getDay();
                const hour = currentStart.getHours();
                const minute = currentStart.getMinutes();
                
                const slotStr = `${hour.toString().padStart(2, '0')}${minute < 30 ? '00' : '30'}`;
                const cell = document.getElementById(`cell-${day}-${slotStr}`);

                if (cell) {
                  const slotStart = new Date(currentStart);
                  slotStart.setMinutes(minute < 30 ? 0 : 30, 0, 0);
                  
                  const startOffsetPct = ((currentStart - slotStart) / MAX_MS_PER_SLOT) * 100;
                  const heightPct = (durationMs / MAX_MS_PER_SLOT) * 100;

                  const segment = document.createElement('div');
                  segment.className = 'task-segment';
                  segment.style.top = `${startOffsetPct}%`;
                  segment.style.height = `${heightPct}%`;
                  segment.style.zIndex = "50"; 
                  segment.textContent = task.title;
                  segment.title = `${task.title}\n⏱️ Active: ${formatMinutesToHHMM(durationMs)}`;
                  
                  cell.appendChild(segment);
                }
              }
              currentStart = chunkEnd;
            }
          }

          // Monthly summary tracking
          const now = new Date(weekStart);
          if (start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()) {
            monthlyTotals[task.title] = (monthlyTotals[task.title] || 0) + duration;
            
            // Calculate Monthly OT accurately using the same logic
            let otForThisChunk = 0;
            if (start.getTime() >= shiftEndMs) {
                otForThisChunk = duration;
            } else if (end.getTime() > shiftEndMs) {
                otForThisChunk = end.getTime() - shiftEndMs; 
            }
            totalMonthlyOvertimeMs += otForThisChunk;
          }
        }
      }
    });

    // 5. Draw Standard Work Hours (8.5 Hours from Absolute Login Time)
    for (let d = 0; d < 7; d++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(currentDay.getDate() + d);
      const dateKey = `${currentDay.getFullYear()}-${(currentDay.getMonth()+1).toString().padStart(2,'0')}-${currentDay.getDate().toString().padStart(2,'0')}`;
      
      if (dailyShiftData[dateKey]) {
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

    // 6. Render Summaries
    summaryList.innerHTML = '';

    // --- DAILY SUMMARY & OVERTIME (TASK-BASED AFTER 8.5H) ---
    const dailySection = document.createElement('div');
    dailySection.className = 'summary-card';
    dailySection.innerHTML = '<h3>📆 Daily Shift & Overtime</h3>';
    const dailyUl = document.createElement('ul');
    
    let hasDailyData = false;

    for (let d = 0; d < 7; d++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(currentDay.getDate() + d);
      const dateKey = `${currentDay.getFullYear()}-${(currentDay.getMonth()+1).toString().padStart(2,'0')}-${currentDay.getDate().toString().padStart(2,'0')}`;
      
      if (dailyShiftData[dateKey] && dailyActiveMs[d] > 0) {
        hasDailyData = true;
        const loginMs = dailyShiftData[dateKey].loginMs;
        const regularEndMs = dailyShiftData[dateKey].regularEndMs;
        const activeMs = dailyActiveMs[d] || 0;
        const overtimeMs = dailyOTMs[d] || 0;

        const li = document.createElement('li');
        li.style.flexDirection = "column";
        li.style.alignItems = "flex-start";
        li.style.gap = "4px";
        li.style.borderBottom = "1px solid #eee";
        li.style.paddingBottom = "8px";

        let html = `
          <div style="width: 100%; display: flex; justify-content: space-between;">
            <strong>${dayNames[d]} (${currentDay.toLocaleDateString()})</strong>
            ${overtimeMs > 0 ? `<span class="overtime-badge">⚠️ ${formatMinutesToHHMM(overtimeMs)} Active OT</span>` : `<span style="color: #27ae60; font-size: 0.8rem; font-weight: bold;">Standard Shift</span>`}
          </div>
          <div style="font-size: 0.85rem; color: #555; width: 100%; display: flex; justify-content: space-between;">
            <span>🕘 First Activity: <strong>${formatClockTime(new Date(loginMs))}</strong> &nbsp;&rarr;&nbsp; 🕔 Reg. Hours End: <strong>${formatClockTime(new Date(regularEndMs))}</strong></span>
            <span>Total Tracked Task Time: ${formatMinutesToHHMM(activeMs)}</span>
          </div>
        `;
        li.innerHTML = html;
        dailyUl.appendChild(li);
      }
    }
    
    if (!hasDailyData) {
        dailyUl.innerHTML = '<li style="color:#888; font-style:italic;">No tasks tracked this week.</li>';
    }
    dailySection.appendChild(dailyUl);
    summaryList.appendChild(dailySection);

    // --- WEEKLY & MONTHLY SUMMARIES ---
    const createSummaryCard = (title, totalsObj, totalActiveTime, overtimeMs) => {
      const card = document.createElement('div');
      card.className = 'summary-card';
      
      const header = document.createElement('h3');
      header.innerHTML = `${title} <br><span style="font-size:0.85rem; color:#e74c3c;">Total Tracked Overtime: ${formatMinutesToHHMM(overtimeMs)}</span>`;
      card.appendChild(header);

      if (Object.keys(totalsObj).length === 0) {
        card.innerHTML += '<p style="color:#888; font-style:italic;">No active tasks tracked.</p>';
        summaryList.appendChild(card);
        return;
      }

      const ul = document.createElement('ul');
      const sortedEntries = Object.entries(totalsObj).sort((a, b) => b[1] - a[1]);

      sortedEntries.forEach(([taskTitle, ms]) => {
        const li = document.createElement('li');
        li.style.flexDirection = 'column';
        li.style.alignItems = 'stretch';
        
        const percentage = totalActiveTime > 0 ? ((ms / totalActiveTime) * 100).toFixed(1) : 0;
        li.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-weight: 500;">
            <span>${taskTitle}</span>
            <span>${formatMinutesToHHMM(ms)} (${percentage}%)</span>
          </div>
          <div class="progress-container">
            <div class="progress-bar" style="width: ${percentage}%"></div>
          </div>
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

    weekSelector.addEventListener('change', () => {
      const weekStart = getWeekStartFromInput(weekSelector.value);
      renderDashboard(weekStart);
    });
  }
});
