document.addEventListener('DOMContentLoaded', () => {
  const heatmapBody = document.getElementById('heatmapBody');
  const summaryList = document.getElementById('summaryList');
  const weekSelector = document.getElementById('week-selector');
  let tasks = [];
  
  // Safely load tasks
  try {
    tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  } catch (e) {
    console.error("Error loading tasks for dashboard:", e);
    tasks = [];
  }

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const timeSlots = [];
  for (let h = 8; h <= 19; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 19) timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  function formatMinutesToHHMM(ms) {
    if (!ms || isNaN(ms)) return "00:00";
    const minutes = Math.floor(ms / 60000);
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  function getWeekStartFromInput(value) {
    if (!value || !value.includes('-W')) {
      const today = new Date();
      return today; // Fallback to today if input is broken
    }
    const [year, week] = value.split('-W');
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const weekStart = new Date(jan4);
    weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (parseInt(week) - 1) * 7);
    return weekStart;
  }

  function renderDashboard(weekStart) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

    // Set date headers
    days.forEach((day, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const el = document.getElementById(`date-${day}`);
      if (el) el.textContent = date.toLocaleDateString();
    });

    // Initialize Grid Data [day][slot]
    const gridData = {};
    for (let d = 0; d < 7; d++) {
      gridData[d] = {};
      timeSlots.forEach(slot => {
        // Added minStart and maxEnd to track exact minute offsets (0.0 to 1.0)
        gridData[d][slot] = { timeMs: 0, tasks: new Set(), minStart: 1.0, maxEnd: 0.0 };
      });
    }

    heatmapBody.innerHTML = '';
    
    // Create base table rows
    timeSlots.forEach(slot => {
      const row = document.createElement('tr');
      const timeCell = document.createElement('td');
      timeCell.textContent = slot;
      row.appendChild(timeCell);
      for (let i = 0; i < 7; i++) {
        const cell = document.createElement('td');
        cell.className = 'heatmap-cell';
        cell.id = `cell-${i}-${slot.replace(':', '')}`;
        row.appendChild(cell);
      }
      heatmapBody.appendChild(row);
    });

    const summaryTotals = {};
    const monthlyTotals = {};
    let totalWeeklyTime = 0;
    let totalMonthlyTime = 0;
    const MAX_MS_PER_SLOT = 30 * 60 * 1000;

    // Process Tasks
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

          if (isNaN(duration) || duration < 0) continue; 

          // Weekly summary tracking
          if (start >= weekStart && start < weekEnd) {
            summaryTotals[task.title] = (summaryTotals[task.title] || 0) + duration;
            totalWeeklyTime += duration;

            // Fill Heatmap Grid chunks
            let current = new Date(start);
            while (current < end && current < weekEnd) {
              const day = current.getDay();
              const hour = current.getHours();
              const minute = current.getMinutes();
              if (hour >= 8 && hour <= 19) {
                const slot = `${hour.toString().padStart(2, '0')}:${minute < 30 ? '00' : '30'}`;
                
                const chunkEnd = new Date(current);
                chunkEnd.setMinutes(minute < 30 ? 30 : 60, 0, 0);
                const actualEnd = chunkEnd < end ? chunkEnd : end;
                const msInSlot = actualEnd - current;

                // NEW: Calculate exact fraction of the 30-min slot used
                const slotStart = new Date(current);
                slotStart.setMinutes(minute < 30 ? 0 : 30, 0, 0);
                const startFraction = (current - slotStart) / MAX_MS_PER_SLOT;
                const endFraction = (actualEnd - slotStart) / MAX_MS_PER_SLOT;

                if (gridData[day] && gridData[day][slot]) {
                    gridData[day][slot].timeMs += msInSlot;
                    gridData[day][slot].tasks.add(task.title);
                    // Update boundaries for the gradient
                    gridData[day][slot].minStart = Math.min(gridData[day][slot].minStart, startFraction);
                    gridData[day][slot].maxEnd = Math.max(gridData[day][slot].maxEnd, endFraction);
                }
              }
              current.setMinutes(minute < 30 ? 30 : 60, 0, 0);
            }
          }

          // Monthly summary tracking
          const now = new Date(weekStart);
          if (start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()) {
            monthlyTotals[task.title] = (monthlyTotals[task.title] || 0) + duration;
            totalMonthlyTime += duration;
          }
        }
      }
    });

    // --- Apply exact percentage fills, merge contiguous tasks, and add text ---
    const BORDER_COLOR = '#27ae60'; // Darker green for boundary box
    const TEXT_COLOR = '#145a32';   // Deep forest green for readability
    
    for (let d = 0; d < 7; d++) {
      let previousTask = null;
      let previousCell = null;

      timeSlots.forEach(slot => {
        const data = gridData[d][slot];
        const currentTask = data.timeMs > 0 ? Array.from(data.tasks)[0] : null;
        const cell = document.getElementById(`cell-${d}-${slot.replace(':', '')}`);

        if (!cell) return;

        if (currentTask) {
          // 1. Calculate color and exact fill percentages
          const intensity = Math.min(0.2 + (data.timeMs / MAX_MS_PER_SLOT) * 0.8, 1);
          const fillColor = `rgba(46, 204, 113, ${intensity})`; 
          
          let startPct = data.minStart * 100;
          let endPct = data.maxEnd * 100;
          
          // Safety snapping
          if (startPct < 1) startPct = 0;
          if (endPct > 99) endPct = 100;

          // Apply the exact gradient fill!
          cell.style.background = `linear-gradient(to bottom, transparent ${startPct}%, ${fillColor} ${startPct}%, ${fillColor} ${endPct}%, transparent ${endPct}%)`;
          
          const taskList = Array.from(data.tasks).join('\n• ');
          cell.setAttribute('data-tooltip', `⏱️ ${formatMinutesToHHMM(data.timeMs)}\n• ${taskList}`);

          // 2. Border Logic
          cell.style.borderLeft = `2px solid ${BORDER_COLOR}`;
          cell.style.borderRight = `2px solid ${BORDER_COLOR}`;

          if (currentTask === previousTask) {
            cell.style.borderTop = 'none';
            if (previousCell) previousCell.style.borderBottom = 'none';
            cell.innerHTML = ''; 
          } else {
            cell.style.borderTop = `2px solid ${BORDER_COLOR}`;
            
            // Add Text
            cell.innerHTML = ''; 
            const labelDiv = document.createElement('div');
            labelDiv.style.cssText = `font-size: 0.85rem; font-weight: bold; color: ${TEXT_COLOR}; padding: 2px 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; box-sizing: border-box; text-align: center;`;
            
            // Push text down slightly if the task starts late in the 30-min block
            if (startPct > 0) {
                labelDiv.style.marginTop = `${(startPct / 100) * 35}px`; 
            }
            
            labelDiv.textContent = currentTask;
            cell.appendChild(labelDiv);

            if (previousTask && previousCell) {
              previousCell.style.borderBottom = `2px solid ${BORDER_COLOR}`;
            }
          }
        } else {
          // Empty cell
          cell.style.background = '';
          cell.style.border = '';
          cell.removeAttribute('data-tooltip');
          cell.innerHTML = '';

          if (previousTask && previousCell) {
            previousCell.style.borderBottom = `2px solid ${BORDER_COLOR}`;
          }
        }

        previousTask = currentTask;
        previousCell = cell;
      });

      if (previousTask && previousCell) {
        previousCell.style.borderBottom = `2px solid ${BORDER_COLOR}`;
      }
    }

    // --- Render Summaries ---
    summaryList.innerHTML = '';

    const createSummarySection = (title, totalsObj, totalTime) => {
      const header = document.createElement('h3');
      header.textContent = title;
      summaryList.appendChild(header);

      if (Object.keys(totalsObj).length === 0) {
        const noData = document.createElement('p');
        noData.textContent = "No time tracked for this period.";
        noData.style.color = "#888";
        noData.style.fontStyle = "italic";
        noData.style.marginTop = "5px";
        summaryList.appendChild(noData);
        return;
      }

      const ul = document.createElement('ul');
      const sortedEntries = Object.entries(totalsObj).sort((a, b) => b[1] - a[1]);

      sortedEntries.forEach(([taskTitle, ms]) => {
        const li = document.createElement('li');
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
      summaryList.appendChild(ul);
    };

    createSummarySection('📅 Weekly Summary', summaryTotals, totalWeeklyTime);
    createSummarySection('🗓️ Monthly Summary', monthlyTotals, totalMonthlyTime);
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