import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, screen, globalShortcut, Notification, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import type { Mode, PanelShow, View } from '../src/types';

// 自定义上传图片协议：dev(http) 页面无法加载 file:// 资源，统一走 petodo-img://
protocol.registerSchemesAsPrivileged([{ scheme: 'petodo-img', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

// 软件渲染：透明小窗口无复杂 GPU 内容，关掉硬件加速可省下 GPU 进程内存
app.disableHardwareAcceleration();

const ICON = 56;
const PET_HEAD = 64; // 桌宠头顶预留空间（气泡+特效可同时显示）
const PET_H = ICON + PET_HEAD;
const STAGE = 200;
const GAP = 8;
const HOVER_DELAY = 400;
const COLLAPSE_DELAY = 600;

// 非桌宠模式：iconWin 直接作为固定方形组件展示内容
const WIDGET: Record<Exclude<Mode, 'pet'>, { w: number; h: number }> = {
  todo: { w: 280, h: 340 },
  countdown: { w: 280, h: 200 },
};
const PANEL_SIZE = { w: 320, h: 480 };

let iconWin: BrowserWindow | null = null;
let panelWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let mode: Mode = 'pet';
let anchor = { x: 0, y: 0 };
let expanded = false;
let panelVisible = false;
let panelKind: 'hover' | 'full' = 'hover';
let panelView: View = 'todo';
let expandTimer: NodeJS.Timeout | undefined;
let collapseTimer: NodeJS.Timeout | undefined;
let dragState: { winX: number; winY: number; sx: number; sy: number } | null = null;
let persistTimer: NodeJS.Timeout | undefined;
// 拖动期间（及结束后短暂窗口）抑制 hover 展开/收起，避免拖动被 expand/collapse 打断回弹
let dragActive = false;
let dragGrace = false;
let dragGraceTimer: NodeJS.Timeout | undefined;

const file = () => path.join(app.getPath('userData'), 'petodo-data.json');
type DataFile = import('../src/types').AppData & { ui?: { position?: { x: number; y: number }; mode?: Mode; widget?: Partial<Record<Exclude<Mode, 'pet'>, { w: number; h: number }>> } };
const defaults = (): DataFile => ({ tasks: [], settings: { pet: '🐱', countdownBg: 'bg-0', autoSync: false, feishu: { appId: '', appSecret: '', tableId: '' }, theme: 'light' }, countdowns: [], courses: [], marks: {}, moods: {}, stopwatch: { running: false, elapsed: 0 }, timerRecords: [] });

function load(): DataFile {
  try {
    if (!fs.existsSync(file())) return defaults();
    const d = JSON.parse(fs.readFileSync(file(), 'utf8'));
    const base = defaults();
    const migrate = (u?: string) => u?.startsWith('file:') ? u.replace(/^file:\/\//, 'petodo-img://') : u;
    d.settings = { ...base.settings, ...(d.settings ?? {}), countdownBg: migrate(d.settings?.countdownBg), petImage: migrate(d.settings?.petImage) };
    // 旧版心情是字符串颜色键，迁移为 { cat, emoji, note? }
    const moodLegacy: Record<string, string> = { happy: '😊', calm: '😌', tired: '😪', frustrated: '😤', sad: '😢' };
    d.moods = Object.fromEntries(Object.entries(d.moods ?? {}).map(([k, v]) => [k, typeof v === 'string' ? { cat: v, emoji: moodLegacy[v] ?? '😶' } : v]));
    return {
      ...base,
      ...d,
      settings: d.settings,
      stopwatch: { ...base.stopwatch, ...(d.stopwatch ?? {}) },
      ui: d.ui,
    };
  } catch {
    return defaults();
  }
}
const write = (d: unknown) => { fs.writeFileSync(file(), JSON.stringify(d, null, 2), 'utf8'); };
const save = (d: unknown) => { write(d); broadcast('data:changed'); };
const broadcast = (ch: string, payload?: unknown) => { iconWin?.webContents.send(ch, payload); panelWin?.webContents.send(ch, payload); };

const url = (role: 'icon' | 'panel') =>
  (process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, '../../web-dist/index.html')}`) + `?role=${role}`;

function top(w: BrowserWindow) {
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function persistNow() {
  const d = load();
  write({ ...d, ui: { position: { x: anchor.x, y: anchor.y }, mode, widget: widgetSize } });
}
// 拖动过程中 move 事件很频繁，写入做 300ms 防抖
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 300);
}
let widgetSize: Partial<Record<Exclude<Mode, 'pet'>, { w: number; h: number }>> = {};

function createIcon() {
  const d = load();
  const a = screen.getPrimaryDisplay().workArea;
  const p = d.ui?.position || { x: a.x + a.width - ICON - 24, y: a.y + 24 };
  anchor = p;
  iconWin = new BrowserWindow({
    x: p.x, y: p.y - PET_HEAD, width: ICON, height: PET_H,
    frame: false, transparent: true, resizable: false, skipTaskbar: true, focusable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, spellcheck: false, backgroundThrottling: false },
  });
  top(iconWin);
  iconWin.setResizable(false);
  iconWin.on('will-resize', e => { if (mode === 'pet') e.preventDefault(); });
  iconWin.loadURL(url('icon'));
  iconWin.webContents.on('did-finish-load', () => iconWin?.webContents.send('mode:change', mode));
  if (process.env.PETODO_DEBUG) {
    iconWin.webContents.on('console-message', (_, _level, msg) => console.log('[icon]', msg));
    iconWin.webContents.on('did-fail-load', (_e, code, desc) => console.log('[icon] load fail', code, desc));
  }
  iconWin.on('move', () => {
    const b = iconWin?.getBounds();
    if (!b) return;
    console.log('[main] move ->', b.x, b.y, b.width + 'x' + b.height, 'expanded=' + expanded);
    anchor = expanded ? { x: b.x + (STAGE - ICON) / 2, y: b.y + (STAGE - ICON) / 2 } : mode === 'pet' ? { x: b.x, y: b.y + PET_HEAD } : { x: b.x, y: b.y };
    if (panelVisible) placePanel();
    persist();
  });
  iconWin.on('resize', () => {
    if (mode === 'pet' || !iconWin) return;
    const b = iconWin.getBounds();
    widgetSize[mode] = { w: b.width, h: b.height };
    persist();
  });
  iconWin.on('close', e => { if (!quitting) { e.preventDefault(); iconWin?.hide(); } });
}

function createPanel(): Promise<BrowserWindow> {
  return new Promise(resolve => {
    const w = new BrowserWindow({
      width: PANEL_SIZE.w, height: PANEL_SIZE.h, frame: false, transparent: true, resizable: false, show: false, skipTaskbar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, spellcheck: false },
    });
    panelWin = w;
    top(w);
    w.setResizable(false);
    w.on('will-resize', e => e.preventDefault());
    w.loadURL(url('panel'));
    w.webContents.on('did-finish-load', () => { w.webContents.send('mode:change', mode); resolve(w); });
    if (process.env.PETODO_DEBUG) {
      w.webContents.on('console-message', (_, _level, msg) => console.log('[panel]', msg));
      w.webContents.on('did-fail-load', (_e, code, desc) => console.log('[panel] load fail', code, desc));
    }
    w.on('closed', () => { if (panelWin === w) panelWin = null; });
  });
}

// 面板按需创建、隐藏后销毁，避免常驻两个渲染进程占用内存
let panelLoading: Promise<BrowserWindow> | null = null;
function ensurePanel(): Promise<BrowserWindow | null> {
  if (panelWin) return Promise.resolve(panelWin);
  if (panelLoading) return panelLoading;
  panelLoading = createPanel().finally(() => { panelLoading = null; });
  return panelLoading;
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(v, max)); }

function placePanel() {
  if (!panelWin) return;
  const { w, h } = PANEL_SIZE;
  const a = screen.getDisplayNearestPoint({ x: anchor.x, y: anchor.y }).workArea;
  // 图标右侧展开（左对齐图标顶部），右侧放不下时放左侧
  const right = anchor.x + ICON + GAP + w <= a.x + a.width;
  let x = right ? anchor.x + ICON + GAP : anchor.x - GAP - w;
  x = clamp(x, a.x, a.x + a.width - w);
  const y = clamp(anchor.y, a.y, a.y + a.height - h);
  panelWin.setBounds({ x, y, width: w, height: h });
}

async function showPanel(kind: 'hover' | 'full', view?: View, focus?: boolean) {
  const w = await ensurePanel();
  if (!w) return;
  console.log('[main] showPanel kind=' + kind + ' destroyed=' + w.isDestroyed() + ' visible=' + w.isVisible() + ' bounds=' + JSON.stringify(w.getBounds()));
  clearTimeout(collapseTimer);
  panelKind = kind;
  if (view) panelView = view;
  panelVisible = true;
  placePanel();
  const payload: PanelShow = { kind, mode, view: view ?? panelView, focus };
  w.show();
  if (focus) w.focus();
  w.webContents.send('panel:show', payload);
  w.moveTop();
}

function applyIconSize() {
  if (!iconWin) return;
  const widget = mode === 'pet' ? undefined : widgetSize[mode] ?? WIDGET[mode];
  if (mode === 'pet') {
    console.log('[main] applyIconSize pet anchor=', anchor.x, anchor.y);
    iconWin.setBounds({ x: anchor.x, y: anchor.y - PET_HEAD, width: ICON, height: PET_H });
    iconWin.setResizable(false);
    iconWin.setFocusable(false);
  } else {
    // 切到组件形态时清掉桌宠展开态，保证 anchor 按 56px 窗口计算
    expanded = false;
    console.log('[main] applyIconSize widget', mode, widget!.w, widget!.h, 'anchor=', anchor.x, anchor.y);
    iconWin.setBounds({ x: anchor.x, y: anchor.y, width: widget!.w, height: widget!.h });
    iconWin.setResizable(true);
    iconWin.setFocusable(true);
  }
}

function expand() {
  console.log('[main] expand() called, expanded=' + expanded);
  clearTimeout(expandTimer);
  if (dragActive || expanded || !iconWin || mode !== 'pet') return;
  expanded = true;
  const b = iconWin.getBounds();
  iconWin.setBounds({ x: b.x - (STAGE - ICON) / 2, y: b.y + PET_HEAD - (STAGE - ICON) / 2, width: STAGE, height: STAGE });
  iconWin.webContents.send('icon:expand', mode);
}

function collapse() {
  console.log('[main] collapse() called, expanded=' + expanded + ' panelVisible=' + panelVisible);
  clearTimeout(expandTimer);
  clearTimeout(collapseTimer);
  if (dragActive || (!expanded && !panelVisible)) return;
  expanded = false;
  panelVisible = false;
  iconWin?.webContents.send('icon:collapse');
  panelWin?.webContents.send('panel:hide');
}

function setMode(m: Mode) {
  if (m === mode) return;
  mode = m;
  persist();
  broadcast('mode:change', m);
  applyIconSize();
  if (panelVisible) {
    if (m === 'pet') collapse();
    else showPanel(panelKind, panelView);
  }
}

function buildTrayMenu() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: '切换形态', submenu: [
      { label: '桌宠', type: 'radio', checked: mode === 'pet', click: () => setMode('pet') },
      { label: 'Todo', type: 'radio', checked: mode === 'todo', click: () => setMode('todo') },
      { label: '倒数日', type: 'radio', checked: mode === 'countdown', click: () => setMode('countdown') },
    ]},
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } },
  ]));
}

function showContextMenu() {
  if (!iconWin) return;
  const extra: Electron.MenuItemConstructorOptions[] = mode === 'pet'
    ? [{ label: '快速添加任务', click: () => showPanel('full', 'todo', true) }]
    : mode === 'todo'
      ? [{ label: '添加任务', click: () => showPanel('full', 'todo', true) }]
      : [
          { label: '添加倒数日', click: () => showPanel('full', 'countdown', true) },
          { label: '设置计时器', click: () => showPanel('full', 'timer') },
        ];
  Menu.buildFromTemplate([
    { label: '切换形态', submenu: [
      { label: '桌宠', type: 'radio', checked: mode === 'pet', click: () => setMode('pet') },
      { label: 'Todo', type: 'radio', checked: mode === 'todo', click: () => setMode('todo') },
      { label: '倒数日', type: 'radio', checked: mode === 'countdown', click: () => setMode('countdown') },
    ]},
    { type: 'separator' },
    ...extra,
    { label: '设置', click: () => showPanel('full', 'settings') },
  ]).popup({ window: iconWin });
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.petodo.desktop');
  protocol.handle('petodo-img', (request) => {
    const u = new URL(request.url);
    const name = decodeURIComponent(u.host + u.pathname.replace(/\/+$/, '')).replace(/[^\w.-]/g, '');
    return net.fetch(pathToFileURL(path.join(app.getPath('userData'), name)).href);
  });
  const saved = load();
  mode = saved?.ui?.mode || 'pet';
  widgetSize = saved?.ui?.widget ?? {};
  createIcon();
  if (mode !== 'pet') applyIconSize();
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('Petodo');
  buildTrayMenu();
  tray.on('click', () => iconWin?.showInactive());
  for (const [key, m] of [['Control+1', 'pet'], ['Control+2', 'todo'], ['Control+3', 'countdown']] as const) {
    try { globalShortcut.register(key, () => setMode(m)); } catch { /* 快捷键冲突时忽略 */ }
  }
  checkReminders();
  setInterval(checkReminders, 15000);
});

// 日程提醒：到达 开始时间 - 提前分钟 时弹通知（只提醒一次）
function checkReminders() {
  const d = load();
  const now = Date.now();
  let changed = false;
  for (const t of d.tasks) {
    if (t.status !== 'active' || !t.due || !t.remindMinutes || t.reminded) continue;
    const due = +new Date(t.due);
    if (!Number.isFinite(due)) continue;
    const at = due - t.remindMinutes * 60000;
    if (now >= at && now < due) {
      t.reminded = true;
      changed = true;
      const n = new Notification({ title: '待办提醒', body: `「${t.title}」将在 ${t.remindMinutes} 分钟后开始`, silent: false });
      n.on('click', () => showPanel('full', 'todo'));
      n.show();
    }
  }
  if (changed) write(d);
}

ipcMain.handle('data:load', () => load());
ipcMain.handle('data:save', (_, d: unknown) => { save(d); return true; });
ipcMain.on('icon:hover', () => {
  console.log('[main] hover dragActive=' + dragActive + ' grace=' + dragGrace);
  if (mode !== 'pet' || dragActive || dragGrace) return;
  clearTimeout(collapseTimer);
  if (!expanded) { clearTimeout(expandTimer); expandTimer = setTimeout(expand, HOVER_DELAY); }
});
ipcMain.on('icon:leave', () => {
  console.log('[main] leave dragActive=' + dragActive + ' grace=' + dragGrace);
  if (mode !== 'pet' || dragActive || dragGrace) return;
  // 窗口 setBounds 移动瞬间 Chromium 会触发幽灵 mouseleave，但鼠标实际仍在窗口内；
  // 用真实光标位置校验（getCursorScreenPoint 返回物理坐标，需转 DIP 再与 getBounds 比较）
  if (iconWin && !iconWin.isDestroyed()) {
    const p = screen.screenToDipPoint(screen.getCursorScreenPoint());
    const b = iconWin.getBounds();
    console.log('[main] leave cursor=' + JSON.stringify(p) + ' win=' + JSON.stringify(b));
    if (p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height) return;
  }
  clearTimeout(expandTimer);
  if (expanded || panelVisible) { clearTimeout(collapseTimer); collapseTimer = setTimeout(collapse, COLLAPSE_DELAY); }
});
ipcMain.on('panel:hover', () => clearTimeout(collapseTimer));
ipcMain.on('panel:leave', () => { clearTimeout(collapseTimer); collapseTimer = setTimeout(collapse, COLLAPSE_DELAY); });
ipcMain.on('icon:collapsed', () => { if (!expanded && iconWin && mode === 'pet') iconWin.setBounds({ x: anchor.x, y: anchor.y - PET_HEAD, width: ICON, height: PET_H }); });
ipcMain.on('panel:hidden', () => { if (!panelVisible) panelWin?.destroy(); });
ipcMain.on('panel:full', (_, view?: View, focus?: boolean) => showPanel('full', view, focus));
ipcMain.on('panel:close', () => collapse());
ipcMain.on('mode:set', (_, m: Mode) => setMode(m));
ipcMain.on('menu:show', () => showContextMenu());
ipcMain.on('app:quit', () => { quitting = true; app.quit(); });
ipcMain.on('icon:drag-start', (_, sx: number, sy: number) => {
  console.log('[main] drag-start', sx, sy, 'bounds=', iconWin?.getBounds().x, iconWin?.getBounds().y, iconWin?.getBounds().width, iconWin?.getBounds().height);
  clearTimeout(expandTimer);
  clearTimeout(collapseTimer);
  clearTimeout(dragGraceTimer);
  dragGrace = false;
  dragActive = true;
  if (!iconWin) return;
  const b = iconWin.getBounds();
  dragState = { winX: b.x, winY: b.y, sx, sy };
});
ipcMain.on('icon:drag-move', (_, sx: number, sy: number) => {
  if (!dragState || !iconWin) return;
  console.log('[main] drag-move', sx, sy, '->', dragState.winX + sx - dragState.sx, dragState.winY + sy - dragState.sy);
  iconWin.setPosition(Math.round(dragState.winX + sx - dragState.sx), Math.round(dragState.winY + sy - dragState.sy));
  if (panelVisible) placePanel();
});
ipcMain.on('icon:drag-end', () => {
  console.log('[main] drag-end');
  dragState = null;
  dragActive = false;
  dragGrace = true;
  clearTimeout(dragGraceTimer);
  dragGraceTimer = setTimeout(() => { dragGrace = false; }, 800);
  // 松手时指针不在窗口内：主动收起，避免一直展开；指针在窗口内则由后续 mouseleave 触发收起
  if (mode === 'pet' && expanded && iconWin) {
    const p = screen.getCursorScreenPoint();
    const b = iconWin.getBounds();
    const over = p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
    console.log('[main] drag-end cursor', p.x, p.y, 'window', b.x, b.y, b.width, b.height, 'over=' + over);
    if (!over) collapseTimer = setTimeout(collapse, COLLAPSE_DELAY);
  }
});
ipcMain.handle('file:export', async (_, c: string, n: string) => {
  const opts = { defaultPath: n };
  const r = panelWin ? await dialog.showSaveDialog(panelWin, opts) : await dialog.showSaveDialog(opts);
  if (!r.canceled && r.filePath) fs.writeFileSync(r.filePath, c, 'utf8');
  return !r.canceled;
});
ipcMain.handle('file:import', async () => {
  const opts = { filters: [{ name: 'Petodo 数据', extensions: ['json'] }], properties: ['openFile'] as ['openFile'] };
  const r = panelWin ? await dialog.showOpenDialog(panelWin, opts) : await dialog.showOpenDialog(opts);
  return r.canceled ? null : fs.readFileSync(r.filePaths[0], 'utf8');
});
ipcMain.handle('image:upload', async (_, kind: 'pet' | 'bg' = 'pet') => {
  const opts = {
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile'] as ['openFile'],
  };
  console.log('[main] image:upload dialog opening, kind=' + kind);
  const r = panelWin ? await dialog.showOpenDialog(panelWin, opts) : await dialog.showOpenDialog(opts);
  console.log('[main] image:upload dialog result canceled=' + r.canceled + ' file=' + (r.filePaths?.[0] ?? ''));
  if (r.canceled || !r.filePaths[0]) return null;
  const ext = path.extname(r.filePaths[0]).toLowerCase();
  const dest = path.join(app.getPath('userData'), `petodo-${kind}${ext}`);
  fs.copyFileSync(r.filePaths[0], dest);
  return `petodo-img://${path.basename(dest)}`;
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  clearTimeout(persistTimer);
  persistNow();
});
app.on('window-all-closed', () => {});
