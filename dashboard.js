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
    if (!ms || isNaN(ms)) return "00:00";
    const minutes = Math.floor(ms / 60000);
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }

  function getWeekStartFromInput(value) {
    if (!value || !value.includes('-W')) {
      const today = new Date();
      today.setDate(today.getDate() - today.getDay()); // Force fallback to Sunday
      today.setHours(0, 0, 0, 0);
      return today;
    }
    const [year, week] = value.split('-W');
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const weekStart = new Date(jan4);
    
    // FIX: Removed the "+ 1" to shift the ISO Monday back to Sunday!
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

    // Tracking Variables
    const summaryTotals = {};
    const monthlyTotals = {};
    const dailyTotals = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; 
    const firstTaskMsOfDay = {}; 

    let totalWeeklyTime = 0;
    const MAX_MS_PER_SLOT = 30 * 60 * 1000;

    // 3. Process Tasks and Map to Grid
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

          const dIndex = start.getDay();
          if (!firstTaskMsOfDay[dIndex] || start.getTime() < firstTaskMsOfDay[dIndex]) {
              firstTaskMsOfDay[dIndex] = start.getTime();
          }

          // Summaries
          if (start >= weekStart && start < weekEnd) {
            summaryTotals[task.title] = (summaryTotals[task.title] || 0) + duration;
            dailyTotals[dIndex] += duration;
            totalWeeklyTime += duration;

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
                  segment.title = `${task.title}\n⏱️ ${formatMinutesToHHMM(durationMs)}`;
                  
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
          }
        }
      }
    });

    // 4. Draw Standard Work Hours (8.5 Hours from first task)
    for (let d = 0; d < 7; d++) {
      if (firstTaskMsOfDay[d]) {
        const standardStartMs = firstTaskMsOfDay[d];
        const standardEndMs = standardStartMs + (8.5 * 60 * 60 * 1000); // +8.5 Hours

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

    // 5. Render Summaries
    summaryList.innerHTML = '';

    const dailySection = document.createElement('div');
    dailySection.className = 'summary-card';
    dailySection.innerHTML = '<h3>📆 Daily Summary & Overtime</h3>';
    const dailyUl = document.createElement('ul');
    
    let hasDailyData = false;
    for (let d = 0; d < 7; d++) {
      if (dailyTotals[d] > 0) {
        hasDailyData = true;
        const li = document.createElement('li');
        const totalActiveMs = dailyTotals[d];
        
        const standardMs = 8 * 60 * 60 * 1000;
        const overtimeMs = totalActiveMs > standardMs ? totalActiveMs - standardMs : 0;
        
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + d);

        let html = `<span><strong>${dayNames[d]}</strong> (${dayDate.toLocaleDateString()}): ${formatMinutesToHHMM(totalActiveMs)}</span>`;
        if (overtimeMs > 0) {
          html += `<span class="overtime-badge">⚠️ ${formatMinutesToHHMM(overtimeMs)} Overtime</span>`;
        }
        li.innerHTML = html;
        dailyUl.appendChild(li);
      }
    }
    
    if (!hasDailyData) {
        dailyUl.innerHTML = '<li style="color:#888; font-style:italic;">No tasks tracked this week.</li>';
    }
    dailySection.appendChild(dailyUl);
    summaryList.appendChild(dailySection);

    const createSummaryCard = (title, totalsObj, totalTime) => {
      const card = document.createElement('div');
      card.className = 'summary-card';
      const header = document.createElement('h3');
      header.textContent = title;
      card.appendChild(header);

      if (Object.keys(totalsObj).length === 0) {
        card.innerHTML += '<p style="color:#888; font-style:italic;">No time tracked.</p>';
        summaryList.appendChild(card);
        return;
      }

      const ul = document.createElement('ul');
      const sortedEntries = Object.entries(totalsObj).sort((a, b) => b[1] - a[1]);

      sortedEntries.forEach(([taskTitle, ms]) => {
        const li = document.createElement('li');
        li.style.flexDirection = 'column';
        li.style.alignItems = 'stretch';
        
        const percentage = totalTime > 0 ? ((ms / totalTime) * 100).toFixed(1) : 0;
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

    createSummaryCard(`📅 Weekly Task Breakdown (Total: ${formatMinutesToHHMM(totalWeeklyTime)})`, summaryTotals, totalWeeklyTime);
    
    let totalMonth = 0;
    Object.values(monthlyTotals).forEach(v => totalMonth += v);
    createSummaryCard('🗓️ Monthly Task Breakdown', monthlyTotals, totalMonth);
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
