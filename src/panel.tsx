import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { AppData, Countdown, Course, Mode, Mood, PanelShow, PetArt, Task, View } from './types';
import { countdownLabel, day, dayText, daysLeft, fmtDur, fmtHMS, parseTags, todayTasks, MOOD_PRESETS, moodOf, moodPresetOf, SPEECHES } from './lib';
import { IconCalendar, IconCheck, IconClock, IconClose, IconEdit, IconGift, IconHistory, IconPlay, IconSliders, IconStop, IconTimer } from './icons';
import { ReviewView } from './review';

const BASE = import.meta.env.BASE_URL;
const bgUrl = (b: string | undefined) => {
  if (!b) return null;
  if (b.startsWith('petodo-img:') || b.startsWith('file:')) return b;
  if (b === 'bg-0' || b === 'bg-1' || b === 'bg-2' || b === 'bg-3' || b === 'bg-4') return `${BASE}bg/${b}.jpg`;
  return null;
};

function PanelApp() {
  const [data, setData] = useState<AppData | null>(null);
  const [show, setShow] = useState<PanelShow | null>(null);
  const [hiding, setHiding] = useState(false);
  const [view, setView] = useState<View>('todo');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('all');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('new');
  const [cdTitle, setCdTitle] = useState('');
  const [cdDate, setCdDate] = useState('');
  const [cdTime, setCdTime] = useState('');
  const [swLabel, setSwLabel] = useState('');
  const [tick, setTick] = useState(Date.now());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cdTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const reload = () => window.desktop.load().then(x => { if (x) setData(x); });
    reload();
    window.desktop.onData(reload);
    window.desktop.onPanelShow(v => {
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
      setHiding(false);
      setShow(v);
      if (v.kind === 'full' && v.view) setView(v.view);
    });
    window.desktop.onPanelHide(() => {
      setHiding(true);
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        setShow(null);
        setHiding(false);
        window.desktop.panelHidden();
      }, 200);
    });
    window.desktop.onMode(m => setShow(s => (s ? { ...s, mode: m } : s)));
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = data?.settings.theme === 'dark' ? 'dark' : 'light';
  }, [data?.settings.theme]);

  useEffect(() => {
    if (!show?.focus || show.mode !== 'countdown') return;
    const t = setTimeout(() => cdTitleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [show]);

  if (!data) return null;

  const save = (next: AppData) => { setData(next); window.desktop.save(next); };
  const updateTasks = (fn: (t: Task[]) => Task[]) => save({ ...data, tasks: fn(data.tasks) });
  const addTask = () => {
    const title = input.trim();
    if (!title) return;
    updateTasks(ts => [...ts, { id: crypto.randomUUID(), title, tags: parseTags(title), status: 'active', createdAt: new Date().toISOString(), totalSeconds: 0, timers: [], source: 'local', order: Date.now() }]);
    setInput('');
  };
  const toggleComplete = (id: string) =>
    updateTasks(ts => ts.map(t => t.id === id
      ? t.status === 'completed' ? { ...t, status: 'active', completedAt: undefined, order: Date.now() } : { ...t, status: 'completed', completedAt: new Date().toISOString() }
      : t));
  const toggleTimer = (id: string) =>
    updateTasks(ts => ts.map(t => {
      if (t.id !== id) return t;
      const last = t.timers.at(-1);
      return { ...t, timers: !last || last.end ? [...t.timers, { start: new Date().toISOString() }] : [...t.timers.slice(0, -1), { ...last, end: new Date().toISOString() }] };
    }));
  const deleteTask = (id: string) => { if (confirm('删除此待办？')) updateTasks(ts => ts.filter(x => x.id !== id)); };
  const cyclePriority = (t: Task) => {
    const next = t.priority === undefined ? 'low' : t.priority === 'low' ? 'medium' : t.priority === 'medium' ? 'high' : undefined;
    updateTasks(ts => ts.map(x => x.id === t.id ? { ...x, priority: next } : x));
  };
  const setReminder = (t: Task) => {
    const a = prompt('设置日程开始时间 YYYY-MM-DD HH:MM（留空清除提醒）', t.due ? t.due.slice(0, 16).replace('T', ' ') : '');
    if (a === null) return;
    const dueStr = a.trim();
    if (!dueStr) {
      updateTasks(ts => ts.map(x => x.id === t.id ? { ...x, due: undefined, remindMinutes: undefined, reminded: false } : x));
      return;
    }
    const dueDate = new Date(dueStr.replace(' ', 'T'));
    if (Number.isNaN(+dueDate)) { alert('时间格式无效，示例：2026-09-01 09:30'); return; }
    const b = prompt('提前多少分钟提醒？（默认 10）', String(t.remindMinutes ?? 10));
    if (b === null) return;
    const mins = Math.max(0, parseInt(b, 10) || 0);
    updateTasks(ts => ts.map(x => x.id === t.id ? { ...x, due: dueDate.toISOString(), remindMinutes: mins, reminded: false } : x));
  };
  const editTask = (t: Task) => {
    const a = prompt('编辑任务（留空不修改）', t.title);
    if (a) updateTasks(ts => ts.map(x => x.id === t.id ? { ...x, title: a, tags: parseTags(a) } : x));
  };
  const elapsedOf = (t: Task) => t.totalSeconds + t.timers.filter(x => !x.end).reduce((n, x) => n + Math.max(0, (tick - +new Date(x.start)) / 1000), 0);
  const swSeconds = () => data.stopwatch.elapsed + (data.stopwatch.running && data.stopwatch.start ? Math.max(0, (tick - +new Date(data.stopwatch.start)) / 1000) : 0);
  const toggleSw = () => {
    const sw = data.stopwatch;
    if (sw.running) save({ ...data, stopwatch: { ...sw, running: false, elapsed: sw.elapsed + Math.max(0, (Date.now() - +new Date(sw.start!)) / 1000) } });
    else save({ ...data, stopwatch: { ...sw, running: true, start: new Date().toISOString() } });
  };
  const resetSw = () => save({ ...data, stopwatch: { running: false, elapsed: 0, start: undefined } });
  const saveRecord = () => {
    const seconds = Math.round(swSeconds());
    if (seconds <= 0) return;
    const now = new Date();
    save({
      ...data,
      timerRecords: [{ id: crypto.randomUUID(), label: swLabel.trim() || '未命名计时', start: new Date(now.getTime() - seconds * 1000).toISOString(), end: now.toISOString(), seconds }, ...data.timerRecords],
      stopwatch: { running: false, elapsed: 0, start: undefined },
    });
    setSwLabel('');
  };
  const addCountdown = () => {
    const title = cdTitle.trim();
    if (!title || !cdDate) return;
    const target = cdTime ? `${cdDate}T${cdTime}:00` : `${cdDate}T23:59:59`;
    save({ ...data, countdowns: [...data.countdowns, { id: crypto.randomUUID(), title, target, createdAt: new Date().toISOString() }] });
    setCdTitle('');
    setCdTime('');
  };
  const deleteCountdown = (id: string) => { if (confirm('删除该倒数日？')) save({ ...data, countdowns: data.countdowns.filter(c => c.id !== id) }); };
  const editCountdown = (c: Countdown) => {
    const a = prompt('修改事件名称', c.title);
    if (a) save({ ...data, countdowns: data.countdowns.map(x => x.id === c.id ? { ...x, title: a } : x) });
  };
  const today = todayTasks(data.tasks);
  const active = today.filter(t => t.status === 'active');
  const done = today.filter(t => t.status === 'completed');
  const allActive = data.tasks.filter(t => t.status === 'active').sort((a, b) => a.order - b.order);
  const nearest = () => {
    const cds = [...data.countdowns].sort((a, b) => +new Date(a.target) - +new Date(b.target));
    return cds.find(c => +new Date(c.target) >= Date.now()) ?? cds[0] ?? null;
  };

  return (
    <div className="panel-root" onMouseEnter={() => window.desktop.panelHover()} onMouseLeave={() => window.desktop.panelLeave()}>
      <div className={`card${hiding ? ' hiding' : ''}`}>
        {show?.kind === 'full' && (
          <FullPanel
            data={data} save={save} view={view} setView={setView} mode={show.mode}
            input={input} setInput={setInput} addTask={addTask} allActive={allActive} today={today} done={done}
            toggleComplete={toggleComplete} toggleTimer={toggleTimer} deleteTask={deleteTask} editTask={editTask} elapsedOf={elapsedOf}
            cyclePriority={cyclePriority} setReminder={setReminder}
            tick={tick} query={query} setQuery={setQuery} range={range} setRange={setRange} tag={tag} setTag={setTag} sort={sort} setSort={setSort}
            cdTitle={cdTitle} setCdTitle={setCdTitle} cdDate={cdDate} setCdDate={setCdDate} cdTime={cdTime} setCdTime={setCdTime}
            addCountdown={addCountdown} deleteCountdown={deleteCountdown} editCountdown={editCountdown}
            swSeconds={swSeconds} toggleSw={toggleSw} resetSw={resetSw} saveRecord={saveRecord} swLabel={swLabel} setSwLabel={setSwLabel}
            updateTasks={updateTasks} cdTitleRef={cdTitleRef as React.RefObject<HTMLInputElement>}
          />
        )}
      </div>
    </div>
  );
}

type FullProps = {
  data: AppData; save: (d: AppData) => void; view: View; setView: (v: View) => void; mode: Mode;
  input: string; setInput: (s: string) => void; addTask: () => void; allActive: Task[]; today: Task[]; done: Task[];
  toggleComplete: (id: string) => void; toggleTimer: (id: string) => void; deleteTask: (id: string) => void; editTask: (t: Task) => void;
  cyclePriority: (t: Task) => void; setReminder: (t: Task) => void;
  elapsedOf: (t: Task) => number; tick: number;
  query: string; setQuery: (s: string) => void; range: string; setRange: (s: string) => void; tag: string; setTag: (s: string) => void; sort: string; setSort: (s: string) => void;
  cdTitle: string; setCdTitle: (s: string) => void; cdDate: string; setCdDate: (s: string) => void; cdTime: string; setCdTime: (s: string) => void;
  addCountdown: () => void; deleteCountdown: (id: string) => void; editCountdown: (c: Countdown) => void;
  swSeconds: () => number; toggleSw: () => void; resetSw: () => void; saveRecord: () => void; swLabel: string; setSwLabel: (s: string) => void;
  updateTasks: (fn: (t: Task[]) => Task[]) => void;
  cdTitleRef: RefObject<HTMLInputElement>;
};

function FullPanel(p: FullProps) {
  const navs: [View, ReactNode][] = p.mode === 'pet'
    ? [['todo', <><IconCheck width={12} height={12} />今日</>], ['timetable', <><IconCalendar width={12} height={12} />课表</>], ['settings', <><IconSliders width={12} height={12} />设置</>]]
    : p.mode === 'todo'
      ? [['todo', <><IconCheck width={12} height={12} />待办</>], ['history', <><IconHistory width={12} height={12} />历史</>], ['review', <><IconGift width={12} height={12} />回顾</>], ['timetable', <><IconCalendar width={12} height={12} />课表</>], ['settings', <><IconSliders width={12} height={12} />设置</>]]
      : [['countdown', <><IconCalendar width={12} height={12} />倒数日</>], ['timer', <><IconTimer width={12} height={12} />计时</>], ['settings', <><IconSliders width={12} height={12} />设置</>]];
  const title = p.mode === 'pet' ? (p.data.settings.petName?.trim() || '宠物') : p.mode === 'todo' ? 'Todo' : '倒数日';
  return (
    <div className="card-col">
      <div className="panel-head">
        <strong>{title}</strong>
        <nav>
          {navs.map(([id, label]) => (
            <button key={id} className={p.view === id ? 'active' : ''} onClick={() => p.setView(id)}>{label}</button>
          ))}
        </nav>
        <button className="icon-btn" title="收起" onClick={() => window.desktop.closePanel()}><IconClose width={14} height={14} /></button>
      </div>
      <div className="panel-body">
        {p.view === 'settings' ? <SettingsView {...p} /> : p.view === 'history' ? <HistoryView {...p} /> : p.view === 'review' ? <ReviewView data={p.data} /> : p.view === 'timer' ? <TimerView {...p} /> : p.view === 'timetable' ? <TimetableView {...p} /> : p.view === 'countdown' ? <CountdownView {...p} /> : <TodoView {...p} />}
      </div>
    </div>
  );
}

function TodoView(p: FullProps) {
  const focus = todayTasks(p.data.tasks).reduce((n, t) => n + t.totalSeconds, 0);
  const pct = p.today.length ? Math.round(p.done.length / p.today.length * 100) : 0;
  const quote = useMemo(() => SPEECHES[Math.floor(Math.random() * SPEECHES.length)], []);
  const todayCourses = (() => {
    if (!p.data.courses.length) return null;
    const idx = (new Date().getDay() + 6) % 7;
    const cs = [...p.data.courses].filter(c => c.day === idx).sort((a, b) => a.start.localeCompare(b.start));
    return cs.length ? cs : null;
  })();
  return (
    <>
      <div className="hero">
        <div>
          <small>{dayText.format(new Date())}</small>
          <h1>今天也从容完成吧</h1>
        </div>
        <div className="progress"><b>{p.done.length}/{p.today.length}</b><small>今日完成</small></div>
      </div>
      <div className="todo-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="focus"><IconTimer width={12} height={12} /> 今日专注 <b>{fmtDur(focus)}</b></div>
      {todayCourses && (
        <div className="today-course">
          <IconCalendar width={12} height={12} /> 今日课程 {todayCourses.map(c => `${c.name} ${c.start}-${c.end}`).join(' · ')}
        </div>
      )}
      <div className="add-row">
        <input className="input" placeholder="写下待办，#标签自动识别" value={p.input} onChange={e => p.setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && p.addTask()} />
        <button className="btn-primary" onClick={p.addTask}>添加</button>
      </div>
      <h3>进行中 <em>{p.allActive.length}</em></h3>
      <div className="task-list">
        {p.allActive.map(t => (
          <div key={t.id} className={`todo-item${t.priority ? ' pri-' + t.priority : ''}`}>
            <button className="pri-dot" title={t.priority ? '优先级：' + t.priority : '点击设置优先级'} onClick={() => p.cyclePriority(t)} />
            <input type="checkbox" onChange={() => p.toggleComplete(t.id)} />
            <span className="todo-title">{t.title}{t.tags.length > 0 && <small>{t.tags.map(x => '#' + x).join(' ')}</small>}</span>
            {t.due && <span className="due-badge"><IconClock width={10} height={10} />{t.due.slice(5, 16).replace('T', ' ')}</span>}
            <span className="todo-time">{fmtDur(p.elapsedOf(t))}</span>
            <button className="ghost sm" title={t.timers.some(x => !x.end) ? '停止计时' : '开始计时'} onClick={() => p.toggleTimer(t.id)}>{t.timers.some(x => !x.end) ? <IconStop width={12} height={12} /> : <IconPlay width={12} height={12} />}</button>
            <button className="ghost sm" onClick={() => p.setReminder(t)} title="日程提醒"><IconClock width={13} height={13} /></button>
            <button className="ghost sm" onClick={() => p.editTask(t)} title="编辑"><IconEdit width={13} height={13} /></button>
            <button className="ghost sm danger" onClick={() => p.deleteTask(t.id)} title="删除"><IconClose width={13} height={13} /></button>
          </div>
        ))}
        {!p.allActive.length && <p className="empty">暂无待办</p>}
      </div>
      <h3>已完成 · {p.done.length}</h3>
      <div className="task-list">
        {p.done.map(t => (
          <div key={t.id} className="todo-item done">
            <input type="checkbox" checked onChange={() => p.toggleComplete(t.id)} />
            <span className="todo-title">{t.title}</span>
            <span className="todo-time">{fmtDur(p.elapsedOf(t))}</span>
          </div>
        ))}
        {!p.done.length && <p className="empty">今天还没有完成的任务</p>}
      </div>
      <div className="todo-quote">{quote}</div>
    </>
  );
}

function HistoryView(p: FullProps) {
  const allTags = [...new Set(p.data.tasks.flatMap(t => t.tags))];
  const [calDate, setCalDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selDay, setSelDay] = useState<string | null>(null);
  const [moodCat, setMoodCat] = useState<string | null>(null);
  const [moodNote, setMoodNote] = useState('');
  useEffect(() => {
    const cur = selDay ? moodOf(p.data.moods, selDay) : null;
    setMoodCat(cur?.cat ?? null);
    setMoodNote(cur?.note ?? '');
  }, [selDay]);
  const saveMood = (patch: { cat?: string; emoji?: string; note?: string }) => {
    if (!selDay) return;
    const cur = moodOf(p.data.moods, selDay);
    const cat = patch.cat ?? moodCat ?? cur?.cat ?? 'calm';
    const emoji = patch.emoji ?? (patch.cat && cur?.cat !== patch.cat ? moodPresetOf(patch.cat)?.emojis[0] ?? '😶' : cur?.emoji) ?? moodPresetOf(cat)?.emojis[0] ?? '😶';
    const note = patch.note !== undefined ? patch.note : (moodNote ?? cur?.note ?? '');
    if (!cur && !patch.emoji && !patch.cat && !note.trim()) return;
    setMoodCat(cat);
    p.save({ ...p.data, moods: { ...p.data.moods, [selDay]: { cat, emoji, note: note.trim() || undefined } } });
  };
  const doneByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of p.data.tasks) if (t.status === 'completed' && t.completedAt) m.set(day(new Date(t.completedAt)), (m.get(day(new Date(t.completedAt))) ?? 0) + 1);
    return m;
  }, [p.data.tasks]);
  const calCells = useMemo(() => {
    const y = calDate.getFullYear(), mo = calDate.getMonth();
    const first = new Date(y, mo, 1);
    const off = (first.getDay() + 6) % 7; // 周一开头
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(y, mo, 1 - off + i);
      const k = day(d);
      return { d, key: k, inMonth: d.getMonth() === mo, today: k === day() };
    });
  }, [calDate]);
  const toggleMark = (d: string) => {
    const cur = p.data.marks[d];
    const next = cur === 'm1' ? 'm2' : cur === 'm2' ? 'm3' : cur === 'm3' ? undefined : 'm1';
    const marks = { ...p.data.marks };
    if (next) marks[d] = next; else delete marks[d];
    p.save({ ...p.data, marks });
  };
  const histories = useMemo(() => {
    const now = new Date();
    return p.data.tasks.filter(t => {
      if (t.status !== 'completed') return false;
      const d = t.completedAt ? day(new Date(t.completedAt)) : '';
      const valid = selDay ? d === selDay : p.range === 'all' || (p.range === 'today' && d === day()) || (p.range === 'week' && !!t.completedAt && +new Date(t.completedAt) >= +new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)) || (p.range === 'month' && d.slice(0, 7) === day().slice(0, 7));
      return valid && (!p.tag || t.tags.includes(p.tag)) && t.title.toLowerCase().includes(p.query.toLowerCase());
    }).sort((a, b) => p.sort === 'long' ? b.totalSeconds - a.totalSeconds : p.sort === 'short' ? a.totalSeconds - b.totalSeconds : +(b.completedAt || '') - +(a.completedAt || ''));
  }, [p.data.tasks, p.range, p.tag, p.query, p.sort, selDay]);
  const csv = ['标题,标签,创建时间,完成时间,耗时(分钟),来源', ...histories.map(t => `"${t.title.replaceAll('"', '""')}","${t.tags.join(' ')}",${t.createdAt},${t.completedAt || ''},${Math.round(t.totalSeconds / 60)},${t.source}`)].join('\n');
  const exportHistory = (md = false) => {
    const content = md ? histories.map(t => `- [x] ${t.title}（${fmtDur(t.totalSeconds)}，${t.completedAt?.slice(0, 10)}）`).join('\n') : csv;
    window.desktop.exportFile(content, `petodo-history.${md ? 'md' : 'csv'}`);
  };
  return (
    <>
      <h2>历史记录</h2>
      <div className="cal-head">
        <button className="btn-ghost sm" onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}>‹</button>
        <b>{calDate.getFullYear()} 年 {calDate.getMonth() + 1} 月</b>
        <button className="btn-ghost sm" onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}>›</button>
        <button className="btn-ghost sm" onClick={() => { setCalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelDay(null); }}>今天</button>
      </div>
      <div className="cal-grid">
        {['一', '二', '三', '四', '五', '六', '日'].map(w => <div key={w} className="cal-wd">{w}</div>)}
        {calCells.map(c => {
          const n = doneByDay.get(c.key) ?? 0;
          const mark = p.data.marks[c.key];
          const mood = moodOf(p.data.moods, c.key);
          const cls = ['date', !c.inMonth ? 'mute' : '', c.today ? 'today' : '', selDay === c.key ? 'sel' : '', mark ? `mark-${mark}` : '', n === 1 ? 'cnt-1' : n === 2 ? 'cnt-2' : n >= 3 ? 'cnt-3' : ''].filter(Boolean).join(' ');
          return (
            <div key={c.key} className={cls} onClick={() => setSelDay(c.key)} onContextMenu={e => { e.preventDefault(); toggleMark(c.key); }}>
              <b>{c.d.getDate()}</b>
              {n > 0 && <small>{n}</small>}
              {mood && <i className="mood-emoji" title={`${moodPresetOf(mood.cat)?.label ?? mood.cat}${mood.note ? '：' + mood.note : ''}`}>{mood.emoji}</i>}
            </div>
          );
        })}
      </div>
      <p className="hint">点击日期查看当天完成；右键涂色标记；选日期后可记当日心情。</p>
      {selDay && (
        <>
          <div className="chip-row"><span className="chip">{selDay} <button onClick={() => setSelDay(null)}>×</button></span></div>
          <div className="mood-box">
            <div className="mood-cats">
              {MOOD_PRESETS.map(mp => {
                const cur = moodOf(p.data.moods, selDay);
                const on = (moodCat ?? cur?.cat) === mp.key;
                return (
                  <button key={mp.key} className={`mood-cat${on ? ' on' : ''}`} style={on ? { borderColor: mp.color, background: mp.color + '22' } : undefined} onClick={() => saveMood({ cat: mp.key })}>
                    {mp.emojis[0]} {mp.label}
                  </button>
                );
              })}
            </div>
            <div className="mood-emos">
              {(() => {
                const cur = moodOf(p.data.moods, selDay);
                const pool = moodPresetOf(moodCat ?? cur?.cat) ?? MOOD_PRESETS[0];
                return pool.emojis.map(e => (
                  <button key={e} className={`mood-emo${cur?.emoji === e && (moodCat ?? cur.cat) === pool.key ? ' on' : ''}`} onClick={() => saveMood({ emoji: e })}>
                    {e}
                  </button>
                ));
              })()}
            </div>
            <div className="mood-note">
              <input className="input" placeholder="随手记（可选），写点什么…" value={moodNote} onChange={e => setMoodNote(e.target.value)} onBlur={() => saveMood({ note: moodNote })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            </div>
            {p.data.moods[selDay] && (
              <div className="mood-actions">
                <button className="btn-ghost sm" onClick={() => { setMoodCat(null); setMoodNote(''); const moods = { ...p.data.moods }; delete moods[selDay]; p.save({ ...p.data, moods }); }}>清除当天心情</button>
              </div>
            )}
          </div>
        </>
      )}
      <div className="filters">
        <input className="input" placeholder="搜索任务" value={p.query} onChange={e => p.setQuery(e.target.value)} />
        <select className="input" value={p.range} disabled={!!selDay} onChange={e => { p.setRange(e.target.value); setSelDay(null); }}>
          <option value="all">全部日期</option><option value="today">今天</option><option value="week">本周</option><option value="month">本月</option>
        </select>
        <select className="input" value={p.tag} onChange={e => p.setTag(e.target.value)}>
          <option value="">全部标签</option>{allTags.map(x => <option key={x}>{x}</option>)}
        </select>
        <select className="input" value={p.sort} onChange={e => p.setSort(e.target.value)}>
          <option value="new">最新完成</option><option value="long">耗时从长到短</option><option value="short">耗时从短到长</option>
        </select>
      </div>
      <div className="actions">
        <button className="btn-ghost" onClick={() => exportHistory()}>导出 CSV</button>
        <button className="btn-ghost" onClick={() => exportHistory(true)}>导出 Markdown</button>
        <button className="btn-ghost danger" onClick={() => { if (confirm(`确定永久删除当前筛选出的 ${histories.length} 条历史任务吗？`)) p.updateTasks(ts => ts.filter(t => !histories.some(h => h.id === t.id))); }}>批量删除</button>
      </div>
      <div className="history-list">
        {histories.map(t => (
          <div key={t.id} className="history-item">
            <div className="history-meta"><b>{t.title}</b><small>{t.completedAt?.slice(0, 10)} · {t.tags.map(x => '#' + x).join(' ')}</small></div>
            <span>{fmtDur(t.totalSeconds)}</span>
            <button className="btn-ghost sm" onClick={() => p.updateTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: 'active', completedAt: undefined, order: Date.now() } : x))}>恢复</button>
          </div>
        ))}
        {!histories.length && <p className="empty">没有匹配的历史任务</p>}
      </div>
    </>
  );
}

function CountdownView(p: FullProps) {
  return (
    <>
      <h2>倒数日</h2>
      <div className="cd-form">
        <input ref={p.cdTitleRef} className="input" placeholder="事件名称，如：生日 / 旅行 / 截止日" value={p.cdTitle} onChange={e => p.setCdTitle(e.target.value)} />
        <div className="cd-row">
          <input className="input" type="date" value={p.cdDate} onChange={e => p.setCdDate(e.target.value)} />
          <input className="input" type="time" value={p.cdTime} onChange={e => p.setCdTime(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={p.addCountdown}>添加倒数日</button>
      </div>
      <div className="cd-list">
        {[...p.data.countdowns].sort((a, b) => +new Date(a.target) - +new Date(b.target)).map(c => {
          const d = daysLeft(c.target);
          return (
            <div key={c.id} className={`countdown-card${d < 0 ? ' overdue' : ''}`}>
              <div className="cd-num">{Math.abs(d)}<small>天</small></div>
              <div className="cd-meta"><b>{c.title}</b><small>{c.target.slice(0, 16).replace('T', ' ')} · {countdownLabel(c.target)}</small></div>
              <button className="btn-ghost sm" title="编辑" onClick={() => p.editCountdown(c)}><IconEdit width={13} height={13} /></button>
              <button className="btn-ghost sm danger" title="删除" onClick={() => p.deleteCountdown(c.id)}><IconClose width={13} height={13} /></button>
            </div>
          );
        })}
        {!p.data.countdowns.length && <p className="empty">还没有倒数日</p>}
      </div>
    </>
  );
}

function TimetableView(p: FullProps) {
  const [err, setErr] = useState('');
  const days = ['一', '二', '三', '四', '五', '六', '日'];
  const todayIdx = (new Date().getDay() + 6) % 7;
  const coursesOf = (d: number) => [...p.data.courses].filter(c => c.day === d).sort((a, b) => a.start.localeCompare(b.start));
  const importCsv = async () => {
    const raw = await window.desktop.importFile();
    if (!raw) return;
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out: Course[] = [];
    for (const line of lines) {
      const parts = line.split(/[,，\t]/).map(x => x.trim());
      const [name, dayStr, start, end, ...rest] = parts;
      const dayN = parseInt(dayStr, 10);
      if (!name || Number.isNaN(dayN) || dayN < 1 || dayN > 7 || !/^\d{1,2}:\d{2}$/.test(start || '') || !/^\d{1,2}:\d{2}$/.test(end || '')) {
        setErr(`第 ${out.length + 1} 行格式错误：${line}`); return;
      }
      out.push({ id: crypto.randomUUID(), name, day: dayN - 1, start, end, location: rest.join('') || undefined });
    }
    if (!out.length) { setErr('没有解析到任何课程'); return; }
    p.save({ ...p.data, courses: [...p.data.courses, ...out] });
    setErr('');
  };
  return (
    <>
      <h2>课表</h2>
      <div className="actions">
        <button className="btn-ghost" onClick={importCsv}>导入课表 (CSV)</button>
        <button className="btn-ghost danger" onClick={() => { if (confirm('清空全部课表？')) p.save({ ...p.data, courses: [] }); }}>清空</button>
      </div>
      <p className="hint">CSV 每行格式：课程名,星期(1-7),开始,结束,地点。示例：高等数学,1,08:00,09:40,教学楼A-101</p>
      {err && <p className="err">{err}</p>}
      <div className="tt-week">
        {days.map((d, i) => (
          <div key={d} className={`tt-day${i === todayIdx ? ' today' : ''}`}>
            <b>{d}</b>
            <div className="tt-courses">
              {coursesOf(i).map(c => (
                <div key={c.id} className="tt-course">
                  <span>{c.name}</span>
                  <small>{c.start}-{c.end}{c.location ? ` · ${c.location}` : ''}</small>
                </div>
              ))}
              {!coursesOf(i).length && <small className="tt-empty">无课</small>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TimerView(p: FullProps) {
  const s = p.swSeconds();
  return (
    <>
      <h2>计时器</h2>
      <div className="sw-card">
        <div className={`sw-time${p.data.stopwatch.running ? ' running' : ''}`}>{fmtHMS(s)}</div>
        <div className="sw-actions">
          <button className="btn-primary" onClick={p.toggleSw}>{p.data.stopwatch.running ? '暂停' : s > 0 ? '继续' : '开始'}</button>
          <button className="btn-ghost" onClick={p.resetSw}>归零</button>
        </div>
        <div className="sw-save">
          <input className="input" placeholder="记录名称，如：写周报" value={p.swLabel} onChange={e => p.setSwLabel(e.target.value)} />
          <button className="btn-ghost" onClick={p.saveRecord} disabled={s <= 0}>保存记录</button>
        </div>
      </div>
      <h3>计时记录</h3>
      <div className="history-list">
        {p.data.timerRecords.map(r => (
          <div key={r.id} className="history-item">
            <div className="history-meta"><b>{r.label}</b><small>{r.start.slice(0, 16).replace('T', ' ')}</small></div>
            <span>{fmtHMS(r.seconds)}</span>
            <button className="btn-ghost sm danger" title="删除" onClick={() => p.save({ ...p.data, timerRecords: p.data.timerRecords.filter(x => x.id !== r.id) })}><IconClose width={13} height={13} /></button>
          </div>
        ))}
        {!p.data.timerRecords.length && <p className="empty">暂无计时记录</p>}
      </div>
    </>
  );
}

const EMOJI_GROUPS: [string, string[]][] = [
  ['表情', ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😜', '🤔', '😴', '🥳', '😭', '😡', '😱', '🥶', '🤗', '🤫', '😶', '😎', '🥺', '😇', '😈']],
  ['动物', ['🐱', '🐶', '🐼', '🐻', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦄', '🐙', '🦋', '🐢', '🐳', '🦊', '🐰', '🐹', '🦉']],
  ['食物', ['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍑', '🥑', '🍔', '🍕', '🌮', '🍜', '🍰', '🍩', '☕', '🍵', '🍦', '🍿']],
  ['其他', ['⚽', '🎮', '🎧', '🎁', '🎈', '🎉', '💎', '🔔', '✏️', '📚', '💡', '❤️', '⭐', '🌈', '🔥', '❄️', '🌙', '☀️', '⏰', '📅']],
];

function SettingsView(p: FullProps) {
  const s = p.data.settings;
  const [emojiOpen, setEmojiOpen] = useState(false);
  const change = (key: string, value: string | boolean) => p.save({ ...p.data, settings: { ...s, [key]: value } });
  const setFeishu = (key: string, value: string) => p.save({ ...p.data, settings: { ...s, feishu: { ...s.feishu, [key]: value } } });
  const upload = async (kind: 'pet' | 'bg') => {
    const path = await window.desktop.uploadImage(kind);
    if (path) p.save({ ...p.data, settings: { ...s, [kind === 'pet' ? 'petImage' : 'countdownBg']: path } });
  };
  const importAll = async () => {
    const raw = await window.desktop.importFile();
    if (!raw) return;
    try {
      const x = JSON.parse(raw);
      if (!Array.isArray(x.tasks)) throw new Error();
      p.save(x);
    } catch { alert('文件格式无效'); }
  };
  return (
    <>
      <h2>设置</h2>
      <label className="setting-label">主题风格</label>
      <div className="theme-row">
        <button className={s.theme !== 'dark' ? 'chosen' : ''} onClick={() => change('theme', 'light')}>浅色</button>
        <button className={s.theme === 'dark' ? 'chosen' : ''} onClick={() => change('theme', 'dark')}>深色</button>
      </div>
      <label className="setting-label">桌宠名字</label>
      <div className="add-row">
        <input className="input" placeholder="给桌宠起个名字（默认：宠物）" value={s.petName ?? ''} onChange={e => change('petName', e.target.value)} />
      </div>
      <label className="setting-label">像素桌宠</label>
      <div className="pets">
        {([['pixel-0', '花煤球'], ['pixel-1', '笔芯煤球'], ['pixel-3', '黑煤球']] as [PetArt, string][]).map(([k, name]) => (
          <button key={k} title={name} className={s.petArt === k && !s.petImage ? 'chosen' : ''} onClick={() => p.save({ ...p.data, settings: { ...s, petArt: k, petImage: undefined, petName: s.petName?.trim() || name } })}>
            <img src={`${BASE}pictures/${k}.png`} alt={name} />
            <small>{name}</small>
          </button>
        ))}
      </div>
      <label className="setting-label">Emoji 桌宠</label>
      <div className="emoji-pick">
        <div className="emoji-cur">
          <span className="emoji-big">{s.pet}</span>
          <span className="emoji-name">{s.petName?.trim() || '宠物'}</span>
          <button className="btn-ghost sm" onClick={() => setEmojiOpen(o => !o)}>{emojiOpen ? '收起' : '展开选择'}</button>
        </div>
        {emojiOpen && (
          <div className="emoji-groups">
            {EMOJI_GROUPS.map(([g, list]) => (
              <div key={g} className="emoji-group">
                <small>{g}</small>
                <div className="pets">
                  {list.map(x => (
                    <button key={x} title={x} className={s.pet === x && !s.petImage && !s.petArt ? 'chosen' : ''} onClick={() => { p.save({ ...p.data, settings: { ...s, pet: x, petArt: undefined, petImage: undefined } }); setEmojiOpen(false); }}>{x}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {s.petImage && <img className="pet-preview" src={s.petImage} alt="自定义形象" />}
      </div>
      <div className="actions">
        <button className="btn-ghost" onClick={() => upload('pet')}>上传图片作为形象</button>
        {s.petImage && <button className="btn-ghost" onClick={() => change('petImage', '')}>恢复默认</button>}
      </div>
      <p className="hint">上传任意图片（建议方形透明底）即可作为桌宠形象。</p>
      <label className="setting-label">面板背景（待办 / 倒数日）</label>
      <div className="bgs">
        {(['bg-0', 'bg-1', 'bg-2', 'bg-3', 'bg-4'] as const).map(k => (
          <button key={k} className={s.countdownBg === k ? 'chosen' : ''} onClick={() => change('countdownBg', k)}>
            <img src={`${BASE}bg/${k}.jpg`} alt={k} />
          </button>
        ))}
      </div>
      <div className="actions">
        <button className="btn-ghost" onClick={() => upload('bg')}>上传图片作为背景</button>
        {s.countdownBg && <button className="btn-ghost" onClick={() => change('countdownBg', '')}>恢复默认</button>}
      </div>
      <label className="setting-label toggle">完成后自动同步飞书 <input type="checkbox" checked={s.autoSync} onChange={e => change('autoSync', e.target.checked)} /></label>
      <fieldset>
        <legend>飞书多维表格</legend>
        <input className="input" placeholder="app_id" value={s.feishu.appId} onChange={e => setFeishu('appId', e.target.value)} />
        <input className="input" placeholder="app_secret" type="password" value={s.feishu.appSecret} onChange={e => setFeishu('appSecret', e.target.value)} />
        <input className="input" placeholder="table_id" value={s.feishu.tableId} onChange={e => setFeishu('tableId', e.target.value)} />
        <button className="btn-ghost" onClick={() => {
          const title = '飞书示例任务 #工作';
          if (!p.data.tasks.some(t => t.title === title)) p.updateTasks(ts => [...ts, { id: crypto.randomUUID(), title, tags: ['工作'], status: 'active', createdAt: new Date().toISOString(), totalSeconds: 0, timers: [], source: 'feishu', order: Date.now() }]);
          alert('已导入 1 条模拟飞书待办。');
        }}>从飞书导入（模拟）</button>
        <p className="hint">真实接口预留：POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal；再 GET /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records。密钥请求应放在主进程。</p>
      </fieldset>
      <div className="actions">
        <button className="btn-ghost" onClick={() => window.desktop.exportFile(JSON.stringify(p.data, null, 2), 'petodo-backup.json')}>导出全部数据</button>
        <button className="btn-ghost" onClick={importAll}>导入全部数据</button>
      </div>
    </>
  );
}

export default PanelApp;
