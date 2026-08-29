import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData, Mode, Task } from './types';
import { countdownLabel, daysLeft, fmtClock, fmtHMS, parseTags, todayTasks } from './lib';
import { IconCalendar, IconClock, IconClose, IconPlus, IconSliders, IconSwitch, IconTimer } from './icons';

const BASE = import.meta.env.BASE_URL;

type BtnDef = { id: string; icon: React.ReactNode; title: string; pos: string; act: () => void };

const NEXT: Record<Mode, Mode> = { pet: 'todo', todo: 'countdown', countdown: 'pet' };

type FxKind = 'bomb' | 'flower' | 'coins';
type Fx = { id: number; kind: FxKind; seed: number };

const FX_KINDS: FxKind[] = ['bomb', 'flower', 'coins'];

function CoinSvg({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges">
      <rect x="1" y="1" width="14" height="14" rx="7" fill="#e8b93f" stroke="#a67c1e" strokeWidth="1" />
      <rect x="4" y="4" width="8" height="8" rx="4" fill="#f2cd6b" stroke="#c99a2e" strokeWidth="1" />
      <rect x="6" y="6" width="2" height="2" fill="#fff6d8" />
    </svg>
  );
}

function BombSvg({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges">
      <rect x="3" y="5" width="10" height="10" rx="5" fill="#2c2c34" stroke="#17171c" strokeWidth="1" />
      <rect x="7" y="2" width="2" height="3" fill="#7a6a4d" />
      <rect x="9" y="0" width="3" height="2" fill="#f0d060" />
      <rect x="10" y="2" width="2" height="2" fill="#e08a3c" />
      <rect x="6" y="8" width="4" height="2" fill="#d9a09a" />
    </svg>
  );
}

function ExplodeSvg({ size = 52 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} shapeRendering="crispEdges">
      <rect x="20" y="20" width="8" height="8" fill="#fff6d8" />
      <rect x="22" y="10" width="4" height="4" fill="#f2cd6b" />
      <rect x="24" y="2" width="2" height="2" fill="#f2cd6b" />
      <rect x="30" y="12" width="5" height="5" fill="#e05561" />
      <rect x="36" y="20" width="4" height="4" fill="#e08a3c" />
      <rect x="42" y="23" width="2" height="2" fill="#e05561" />
      <rect x="32" y="30" width="5" height="5" fill="#f2cd6b" />
      <rect x="22" y="36" width="4" height="4" fill="#e08a3c" />
      <rect x="24" y="43" width="2" height="2" fill="#f2cd6b" />
      <rect x="12" y="30" width="5" height="5" fill="#e05561" />
      <rect x="8" y="22" width="4" height="4" fill="#f2cd6b" />
      <rect x="3" y="23" width="2" height="2" fill="#e05561" />
      <rect x="12" y="12" width="5" height="5" fill="#e08a3c" />
    </svg>
  );
}

function FlowerSvg({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} shapeRendering="crispEdges">
      <rect x="8" y="1" width="2" height="6" fill="#e05561" />
      <rect x="8" y="13" width="2" height="6" fill="#e05561" />
      <rect x="1" y="8" width="6" height="2" fill="#e05561" />
      <rect x="13" y="8" width="6" height="2" fill="#e05561" />
      <rect x="5" y="5" width="2" height="2" fill="#c93d4c" />
      <rect x="13" y="5" width="2" height="2" fill="#c93d4c" />
      <rect x="5" y="13" width="2" height="2" fill="#c93d4c" />
      <rect x="13" y="13" width="2" height="2" fill="#c93d4c" />
      <rect x="6" y="6" width="8" height="8" rx="4" fill="#f0d060" stroke="#c99a2e" strokeWidth="1" />
      <rect x="9" y="9" width="2" height="2" fill="#e8b93f" />
    </svg>
  );
}

function StemSvg({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 6 26" width="6" height={size} shapeRendering="crispEdges">
      <rect x="2" y="0" width="2" height="26" fill="#7c9a5c" />
      <rect x="0" y="8" width="3" height="2" fill="#7c9a5c" />
      <rect x="3" y="14" width="3" height="2" fill="#7c9a5c" />
    </svg>
  );
}

function BombFx() {
  const [phase, setPhase] = useState<'fly' | 'boom'>('fly');
  useEffect(() => {
    const t = setTimeout(() => setPhase('boom'), 800);
    return () => clearTimeout(t);
  }, []);
  if (phase === 'fly') return <span className="fx fx-bomb"><BombSvg /></span>;
  return <span className="fx fx-boom"><ExplodeSvg /></span>;
}

function FlowerFx() {
  return (
    <span className="fx fx-flower">
      <span className="fx-bloom"><FlowerSvg size={18} /></span>
      <span className="fx-stem"><StemSvg size={12} /></span>
    </span>
  );
}

function CoinsFx({ seed }: { seed: number }) {
  return (
    <span className="fx fx-coins">
      {Array.from({ length: 10 }, (_, i) => {
        const side = (i + Math.floor(seed * 10)) % 2 === 0 ? 1 : -1;
        const dx = side * (6 + ((i * 13 + Math.floor(seed * 31)) % 20));
        const dy = -(16 + ((i * 17 + Math.floor(seed * 23)) % 32));
        const rot = side * (140 + ((i * 61 + Math.floor(seed * 47)) % 260));
        const dur = 1.15 + ((i * 7 + Math.floor(seed * 13)) % 7) / 10;
        const delay = (i % 4) * 0.05;
        return (
          <span key={i} className="fx-coin" style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`, ['--rot' as string]: `${rot}deg`, ['--dur' as string]: `${dur}s`, ['--delay' as string]: `${delay}s` }}>
            <CoinSvg size={14} />
          </span>
        );
      })}
    </span>
  );
}

function FxView({ fx, onDone }: { fx: Fx; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, fx.kind === 'flower' ? 4300 : fx.kind === 'bomb' ? 2000 : 2100);
    return () => clearTimeout(t);
  }, []);
  if (fx.kind === 'bomb') return <BombFx />;
  if (fx.kind === 'flower') return <FlowerFx />;
  return <CoinsFx seed={fx.seed} />;
}

const bgUrl = (b: string | undefined) => {
  if (!b) return null;
  if (b.startsWith('petodo-img:') || b.startsWith('file:')) return b;
  if (b === 'bg-0' || b === 'bg-1' || b === 'bg-2' || b === 'bg-3' || b === 'bg-4') return `${BASE}bg/${b}.jpg`;
  return null;
};

function petButtons(): BtnDef[] {
  return [
    { id: 'cycle', icon: <IconSwitch />, title: '切换形态', pos: 'pos-N', act: () => window.desktop.setMode(NEXT.pet) },
    { id: 'add', icon: <IconPlus />, title: '快速添加', pos: 'pos-E', act: () => window.desktop.full('todo', true) },
    { id: 'settings', icon: <IconSliders />, title: '设置', pos: 'pos-W', act: () => window.desktop.full('settings') },
    { id: 'quit', icon: <IconClose />, title: '退出应用', pos: 'pos-S', act: () => window.desktop.quit() },
  ];
}

function IconApp() {
  const [data, setData] = useState<AppData | null>(null);
  const [mode, setMode] = useState<Mode>('pet');
  const [expanded, setExpanded] = useState(false);
  const [fading, setFading] = useState(false);
  const [bounceKey, setBounceKey] = useState(0);
  const [input, setInput] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [fx, setFx] = useState<Fx[]>([]);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fxId = useRef(0);
  const drag = useRef<{ sx: number; sy: number } | null>(null);
  const dragging = useRef(false);
  const wasDragged = useRef(false);
  const downHead = useRef(false);

  const reload = useCallback(() => { window.desktop.load().then(x => { if (x) setData(x); }); }, []);
  useEffect(() => {
    reload();
    window.desktop.onData(reload);
    window.desktop.onMode(m => setMode(m));
    window.desktop.onIconExpand(m => {
      if (fadeTimer.current) { clearTimeout(fadeTimer.current); fadeTimer.current = null; }
      setMode(m);
      setFading(false);
      setExpanded(true);
      setBounceKey(k => k + 1);
    });
    window.desktop.onIconCollapse(() => {
      setFading(true);
      fadeTimer.current = setTimeout(() => {
        fadeTimer.current = null;
        setExpanded(false);
        setFading(false);
        window.desktop.iconCollapsed();
      }, 200);
    });
  }, [reload]);

  // 秒表/时钟只在组件模式用到，桌宠模式不跑定时器省内存
  useEffect(() => {
    if (mode === 'pet') return;
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.theme = data?.settings.theme === 'dark' ? 'dark' : 'light';
  }, [data?.settings.theme]);

  const save = (next: AppData) => { setData(next); window.desktop.save(next); };
  const count = data ? todayTasks(data.tasks).length : 0;
  const isCoal = data?.settings.petArt === 'pixel-3' && !data?.settings.petImage;
  const petSrc = (() => {
    const s = data?.settings;
    if (!s) return null;
    if (s.petImage) return s.petImage;
    if (s.petArt) return `${BASE}pictures/${s.petArt}.png`;
    return null;
  })();
  const triggerFun = () => {
    const kind = FX_KINDS[Math.floor(Math.random() * FX_KINDS.length)];
    const id = ++fxId.current;
    setFx(fs => [...fs, { id, kind, seed: Math.random() }]);
  };

  const addTask = () => {
    if (!data) return;
    const title = input.trim();
    if (!title) return;
    save({ ...data, tasks: [...data.tasks, { id: crypto.randomUUID(), title, tags: parseTags(title), status: 'active', createdAt: new Date().toISOString(), totalSeconds: 0, timers: [], source: 'local', order: Date.now() }] });
    setInput('');
  };
  const toggleComplete = (id: string) => {
    if (!data) return;
    save({
      ...data,
      tasks: data.tasks.map(t => t.id === id
        ? t.status === 'completed' ? { ...t, status: 'active', completedAt: undefined, order: Date.now() } : { ...t, status: 'completed', completedAt: new Date().toISOString() }
        : t),
    });
  };
  const cyclePriority = (t: Task) => {
    if (!data) return;
    const next = t.priority === undefined ? 'low' : t.priority === 'low' ? 'medium' : t.priority === 'medium' ? 'high' : undefined;
    save({ ...data, tasks: data.tasks.map(x => x.id === t.id ? { ...x, priority: next } : x) });
  };

  const pointerDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement;
    // head 空白区点击用于打开完整面板；按钮/输入框等交互元素不进入拖动分支
    downHead.current = !!el.closest('.widget-head') && !el.closest('button');
    if (el.closest('input, button, label')) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 合成事件无活动指针时忽略 */ }
    dragging.current = true;
    wasDragged.current = false;
    drag.current = { sx: e.screenX, sy: e.screenY };
    window.desktop.dragStart(e.screenX, e.screenY);
  };
  const pointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !e.buttons) return;
    if (Math.abs(e.screenX - drag.current.sx) + Math.abs(e.screenY - drag.current.sy) > 2) wasDragged.current = true;
    window.desktop.dragMove(e.screenX, e.screenY);
  };
  const pointerUp = () => {
    console.log('[evt] pointerup downHead=' + downHead.current + ' wasDragged=' + wasDragged.current + ' mode=' + mode);
    dragging.current = false;
    drag.current = null;
    window.desktop.dragEnd();
    // 指针捕获会吞掉 click，head 空白点击改在这里分发
    if (downHead.current && !wasDragged.current) {
      if (mode === 'todo') window.desktop.full('todo');
      else if (mode === 'countdown') window.desktop.full('countdown');
    }
    downHead.current = false;
    wasDragged.current = false;
  };
  const widgetProps = {
    onPointerDown: pointerDown,
    onPointerMove: pointerMove,
    onPointerUp: pointerUp,
    onPointerCancel: pointerUp,
  };

  if (mode !== 'pet') {
    const s = data?.settings;
    const bg = bgUrl(s?.countdownBg);
    if (mode === 'todo') {
      const today = data ? todayTasks(data.tasks) : [];
      const active = today.filter(t => t.status === 'active');
      const done = today.filter(t => t.status === 'completed');
      const priTitle = (p: Task['priority']) => p === 'high' ? '高优先级' : p === 'medium' ? '中优先级' : p === 'low' ? '低优先级' : '设置优先级';
      return (
        <div className={`widget${bg ? ' with-bg' : ''}`} {...widgetProps} title="拖动空白处移动；边缘可缩放">
          {bg && <div className="dash-bg" style={{ backgroundImage: `url("${bg}")` }} />}
          <div className="widget-head">
            <b>今日待办</b>
            <span className="widget-count">{done.length}/{today.length}</span>
            <button className="widget-btn" title="切换形态" onClick={e => { e.stopPropagation(); window.desktop.setMode('countdown'); }}><IconSwitch /></button>
            <button className="widget-btn" title="完整日历" onClick={e => { e.stopPropagation(); window.desktop.full('history'); }}><IconCalendar /></button>
            <button className="widget-btn" title="设置" onClick={e => { e.stopPropagation(); window.desktop.full('settings'); }}><IconSliders /></button>
            <button className="widget-btn" title="退出应用" onClick={e => { e.stopPropagation(); window.desktop.quit(); }}><IconClose /></button>
          </div>
          <div className="widget-list">
            {[...active, ...done].map(t => (
              <label key={t.id} className={`todo-item${t.status === 'completed' ? ' done' : ''}${t.priority ? ' pri-' + t.priority : ''}`}>
                <input type="checkbox" checked={t.status === 'completed'} onChange={() => toggleComplete(t.id)} />
                <span className="todo-title">{t.title}</span>
                {t.due && <small className="due-badge" title="日程时间"><IconClock width={10} height={10} />{t.due.slice(5, 16).replace('T', ' ')}</small>}
                <button className="pri-dot" title={priTitle(t.priority)} onClick={e => { e.preventDefault(); e.stopPropagation(); cyclePriority(t); }} />
              </label>
            ))}
            {!today.length && <p className="empty">今天还没有待办</p>}
          </div>
          <div className="widget-add">
            <input className="input" placeholder="添加任务..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
            <button className="btn-primary" onClick={addTask}>添加</button>
          </div>
        </div>
      );
    }
    const nearest = (() => {
      if (!data) return null;
      const cds = [...data.countdowns].sort((a, b) => +new Date(a.target) - +new Date(b.target));
      return cds.find(c => +new Date(c.target) >= Date.now()) ?? cds[0] ?? null;
    })();
    const swSeconds = data ? data.stopwatch.elapsed + (data.stopwatch.running && data.stopwatch.start ? Math.max(0, (tick - +new Date(data.stopwatch.start)) / 1000) : 0) : 0;
    return (
      <div className={`widget dash${bg ? ' with-bg' : ''}`} {...widgetProps} title="拖动空白处移动；边缘可缩放">
        {bg && <div className="dash-bg" style={{ backgroundImage: `url("${bg}")` }} />}
        <div className="widget-head">
          <b>倒数日</b>
          <button className="widget-btn" title="切换形态" onClick={e => { e.stopPropagation(); window.desktop.setMode('pet'); }}><IconSwitch /></button>
          <button className="widget-btn" title="添加倒数日" onClick={e => { e.stopPropagation(); window.desktop.full('countdown', true); }}><IconPlus /></button>
          <button className="widget-btn" title="计时器" onClick={e => { e.stopPropagation(); window.desktop.full('timer'); }}><IconTimer /></button>
          <button className="widget-btn" title="设置" onClick={e => { e.stopPropagation(); window.desktop.full('settings'); }}><IconSliders /></button>
          <button className="widget-btn" title="退出应用" onClick={e => { e.stopPropagation(); window.desktop.quit(); }}><IconClose /></button>
        </div>
        <div className="dash-content">
          {nearest ? (() => {
            const d = daysLeft(nearest.target);
            return (
              <div className="dash-main">
                <div className={`dash-num${d < 0 ? ' overdue' : ''}`}>{Math.abs(d)}<small>天</small></div>
                <div className="dash-meta">
                  <div className="dash-title">{nearest.title}</div>
                  <div className="dash-label">{countdownLabel(nearest.target)}</div>
                </div>
              </div>
            );
          })() : <p className="dash-empty">暂无倒数日</p>}
          <div className="dash-time">
            <span className="str"><i /><i /><i /></span>
            {fmtClock(new Date(tick))}
          </div>
          <div className="dash-sw">
            <IconTimer width={11} height={11} />{data?.stopwatch.running ? ` 计时中 ${fmtHMS(swSeconds)}` : swSeconds > 0 ? ` 已暂停 ${fmtHMS(swSeconds)}` : ' 秒表未开始'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`stage${expanded ? ' expanded' : ''}${fading ? ' fading' : ''}`}
      onMouseEnter={() => { if (!dragging.current) window.desktop.iconHover(); }}
      onMouseLeave={() => { if (!dragging.current) window.desktop.iconLeave(); }}
    >
      {expanded && <div className="bubble">今日 {count} 项待办</div>}
      {expanded && petButtons().map(b => (
        <button key={b.id} className={`btn ${b.pos}`} title={b.title} onClick={b.act}>{b.icon}</button>
      ))}
      {fx.map(f => <FxView key={f.id} fx={f} onDone={() => setFx(fs => fs.filter(x => x.id !== f.id))} />)}
      <div
        key={bounceKey}
        className={`icon${expanded && mode === 'pet' ? ' bounce' : ' float'}${isCoal ? ' coal' : ''}`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onClick={() => { if (!wasDragged.current) triggerFun(); wasDragged.current = false; }}
        onDoubleClick={() => { if (!wasDragged.current) window.desktop.full('todo'); wasDragged.current = false; }}
        onContextMenu={e => { e.preventDefault(); window.desktop.menu(); }}
        title="单击互动；双击打开待办；按住拖动可移动；右键快捷菜单"
      >
        {petSrc ? <img draggable={false} className="pixel" src={petSrc} alt="" /> : <span className="icon-emoji">{data?.settings.pet ?? '🐱'}</span>}
      </div>
    </div>
  );
}

export default IconApp;
