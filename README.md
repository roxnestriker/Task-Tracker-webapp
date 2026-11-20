# Task Tracker 2.2

Created by Firozkhan Pathan (fpathan@bechtel.com)

The whole app is **one file: `index.html`**. Open it in **Microsoft Edge** or **Google Chrome** on your Windows PC, **from its web address** (your Netlify site).

---

## New in 2.2

### Auto-Pause on lock: back to the original method

- **The Windows lock helper is gone.** It needed Windows Task Scheduler, which your PC does not allow.
- **Auto-Pause works the same way as the original tracker.** Click **Enable Auto-Pause** at the top and choose **Allow**. Edge then tells the tracker when Windows is locked or unlocked. A running task pauses at that moment and carries on when you unlock.
- **Use the web address.** Edge remembers "Allow" only for a web address (https://…). If you open the tracker as a downloaded file, Edge forgets the answer straight away. That is why "Allow" did not work in the downloaded copy, and why the original tracker on Netlify could pause on lock. See *How to put it on your Netlify site* below.
- **Stronger than the original:**
  - It switches itself on every time you open the tracker. The original needed the button after every reload.
  - It checks itself again after sleep, hibernate or a sleeping tab, and once every hour. If a lock was missed, the task is still paused.
  - It notices straight away when you allow it in Edge's site settings, or when it gets blocked.
  - Only one tab can run the tracker, so a lock is never counted twice.
- **Sleep, hibernate and closing are always covered**, even in a downloaded copy. The task is paused back to the second the PC went to sleep or the tracker stopped.
- In a downloaded copy, the tracker explains all this and shows the steps. It also has an **Export my tasks now** button, so you can move your tasks to the web version.

---

## What was new in 2.1

### Import and Export buttons in the top bar

- **Export** saves everything (tasks, all time entries and holidays) to a .json file in your Downloads folder in one click. The small arrow next to it has more choices: a file for the old tracker (version 1), and Excel (.csv) lists.
- **Import** loads a .json file from this tracker, from the old tracker, or from the OneDrive *backups* folder. You can also **drop the file anywhere on the page**.
- Before anything changes you see a **preview**: how many tasks and hours are in the file, which tasks are new, which are newer in the file, and which exist only in this tracker.
- **Merge** (recommended) adds the new tasks and updates the older ones; nothing is removed. **Replace** makes the tracker an exact copy of the file; tasks that are not in the file go to the Trash, where you can restore them.
- If a task was **running** in the file, you choose whether it carries on timing here.
- A safety copy is saved first, and **Ctrl + Z** (or **Undo** in the message) undoes the whole import.

### Old totals kept exactly

Every task total from the old tracker is now carried over to the millisecond, including tasks whose times were edited in the old dashboard. The Timeline shows the same blocks the old dashboard showed.

### Very long time entries

*Insights › Very long time entries* lists every entry of 10 hours or more. These are almost always a PC that was locked, asleep or left on overnight while the old tracker kept counting. Data from the old tracker often has several, some of them hundreds of hours long. After an import the tracker tells you how many there are. Click **Edit** to type the real end time. Nothing is changed unless you do.

---

## What was new in 2.0

### 1. Auto-pause and auto-resume you can rely on

The tracker uses these safety layers:

| Situation | What happens now |
|---|---|
| You lock Windows (Win + L, or the screen locks by itself) | The running task pauses straight away. When you unlock, the same task carries on. |
| The PC goes to **sleep** or **hibernate**, or you close the laptop lid | The tracker checks itself every second in the background. When it wakes up and sees the gap, it pauses the task **back to the exact second the PC went to sleep**, so sleep time is never counted. It carries on once you have unlocked. |
| The browser or PC was closed, crashed or switched off while a task was running | Next time you open the tracker, the task is paused at the moment the tracker was last running. It does **not** restart by itself; press **Resume** when you are ready. |
| The browser put the tab to sleep to save memory | Treated as away time. A tip explains how to stop this (see setup step 3). |
| Optional: no keyboard or mouse activity for N minutes | Off by default. Can be switched on in Settings. The pause is back-dated to your last key press. |

Other improvements:

- **Auto-Pause switches on by itself** every time you open the tracker. You only allow it once.
- If the tracker pauses while you were actually working, you can press **"I was working"** in the top bar, or **Count it** in *Insights › Auto-pause log*. The time is added back.
- **Only one copy can run at a time.** A second tab shows *"Task Tracker is already open"* with a **Use this tab instead** button. This stops time being counted twice.

### 2. Tasks saved in OneDrive, so nothing is lost

- You choose a folder in your OneDrive once, for example **OneDrive - Bechtel › Documents › TaskTracker**.
- Every change is written to **TaskTracker-data.json** in that folder within about a second. The OneDrive app then copies it to the cloud.
- A **daily backup copy** is kept in the **backups** sub-folder. Copies are kept for 30 days by default. OneDrive also keeps its own version history.
- A copy is also kept in the browser. If the browser data is cleared, everything is loaded back from OneDrive.
- **Deleted tasks go to the Trash first.** You can restore them later. **Ctrl + Z** undoes the last change.
- Before every import or reset, a full safety copy is saved.
- **Using two PCs?** Choose the same OneDrive folder on both and changes are merged automatically. If a task was left running on the other PC, it is closed at that PC's last sign of activity.

### 3. Modern look and quick task switching

- **Now-tracking bar:** a big live timer with **Pause**, **Done** and **Switch** buttons. Below it are quick-switch buttons for your recent tasks.
- **Ctrl + K quick switcher:** type a few letters and press **Enter**. The current task pauses and the new one starts. If no task matches, type a new name and press Enter to create and start it.
- **Pop-out mini timer:** a small window that stays on top of Revit and other programs. You can pause, finish or switch tasks from it.
- **Board** (drag cards between columns) and **List** (sortable table).
- **Timeline:** your week hour by hour, with overtime shown in red stripes. Click a block to type exact times. Use **Adjust times** (Ctrl + E) to drag block edges. To mark a holiday, click the palm icon on a day.
- **Timesheet:** hours per task per day, rounded to 0.25 h by default. Use **Copy for Excel**, or export CSV files.
- **Insights:** total hours, overtime, average per day, a daily chart, and time by task, tag and project/job. It also shows the auto-pause log and the tasks you completed.
- **Tasks now have more detail:** priority, project/job code, estimate with progress bar, checklist, time log and activity history.
- **Quick-add words:** `#revit` (tag), `@26497` (job), `!high` (priority), `due:fri` (due date), `~2h` (estimate).
- Light and dark theme, accent colours, compact mode and a 12/24-hour clock.

The overtime rule has not changed. Your regular day is your first start of the day plus 8.5 hours, and time after that is overtime. Weekends and holidays count as overtime from the first minute. You can change the hours in *Settings › Work day & holidays*.

---

## How to put it on your Netlify site

Do this once. Then always open the tracker from your Netlify address. Bookmark it.

**If your Netlify site is linked to GitHub** (it updates by itself when the repository changes):

1. Open your **Task-Tracker-webapp** repository on GitHub.
2. Click **Add file › Upload files**.
3. Drag in **index.html** and **dashboard.html** from the unzipped download, then click **Commit changes**. They replace the old ones.
4. Wait a minute or two. Netlify publishes it by itself.
5. You can delete **script.js**, **style.css**, **dashboard.js** and **dashboard.css** later. They are no longer used.

**If your site is not linked to GitHub:**

1. Unzip the download.
2. In Netlify, open your site and go to **Deploys**.
3. Drag the **Task-Tracker-webapp-main** folder onto the page.

**Then, in Edge:**

1. Close any old tracker tabs.
2. Open your Netlify address. Press **Ctrl + F5** once so Edge loads the new version.
3. Click **Enable Auto-Pause** and choose **Allow**. You are asked only this once.

**Your existing tasks move over automatically.** Use the same site address as before. The first time you open the new version, all tasks, tracked time and holidays are copied into the new format. A welcome note confirms it, and the old copy is left untouched as a safety net.

*Did you also use a downloaded copy?* Browsers keep data separately for each address. To bring those tasks across:

1. In the downloaded copy, click **Export**. It is also inside the Auto-Pause window.
2. On your Netlify address, click **Import** at the top (or drop the file on the page), check the preview, choose **Merge** and click **Import**.

The same works between two copies of the new version. Even simpler: choose the same OneDrive folder in both, and they share the tasks automatically.

---

## First-time setup (about 2 minutes)

**Step 1: Connect OneDrive**

1. Click **Connect OneDrive** at the top right.
2. Go to **OneDrive - Bechtel › Documents**, click **New folder** and name it **TaskTracker**.
3. Click **Select folder**, then **Edit files** or **Allow**.
4. After the browser restarts, the button changes to **Reconnect OneDrive**. Click it once. If **Allow on every visit** is offered, choose it.

**Step 2: Enable Auto-Pause**

On your Netlify address, click **Enable Auto-Pause** in the blue note or the top bar, then choose **Allow**. Edge remembers your answer for that address. From then on it switches on by itself. The button then reads **Auto-Pause Active**.

**Step 3: Keep the tracker awake**

- **Edge:** *Settings › System and performance › Never put these sites to sleep › Add*, then add your tracker address.
- **Chrome:** *Settings › Performance › Always keep these sites active › Add*.

*Settings › Auto-pause & resume* has a **Copy** button for the address.

---

## Keyboard shortcuts

| Keys | Action |
|---|---|
| Ctrl + K or / | Find a task and start it (quick switch) |
| Space or P | Pause or resume the current task |
| D | Mark the running task as done |
| N | Add a new task |
| 1 – 5 | Board · List · Timeline · Timesheet · Insights |
| Ctrl + E | Timeline: adjust times by dragging |
| Ctrl + Z | Undo the last change |
| Shift + Enter | In the add box: add and start straight away |

---

## Troubleshooting

- **"Reconnect OneDrive" appears:** browsers ask for your OK again after a restart. Click it once. Your changes are kept in the browser meanwhile and saved as soon as you allow it.
- **I clicked "Allow" but Auto-Pause stays off:** you most likely opened the tracker as a downloaded file (the address starts with *C:/…* or *file:///*). Edge does not keep "Allow" for files. Open it from your Netlify address instead. In an InPrivate window Edge does not keep it either, so use a normal window.
- **"Auto-Pause blocked":**
  1. Click the padlock in the address bar.
  2. Open *Permissions for this site › Idle detection* and choose *Allow*.
  3. The tracker switches on by itself. If not, reload the page.

  Sleep, hibernate and closing are still covered without it.
- **A task paused while you were working:** press **I was working** in the top bar, or **Count it** in *Insights › Auto-pause log*.
- **Where are my files?** In OneDrive, open the folder you chose:
  - Main file: **TaskTracker-data.json**
  - Daily copies: **backups › TaskTracker-backup-date.json**
  - Safety copies made before an import: **TaskTracker-before-import-…**
- **Restore an older copy:** click **Import** at the top, pick a file from the **backups** folder, then choose **Merge** or **Replace**.
