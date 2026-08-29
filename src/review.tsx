import { useMemo, useState } from 'react';
import type { AppData, Mood } from './types';
import { day, fmtDur, moodOf, moodPresetOf } from './lib';

type Period = 'week' | 'month' | 'year';
const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: 'week', label: '一周', days: 7 },
  { key: 'month', label: '一月', days: 30 },
  { key: 'year', label: '一年', days: 365 },
];

type DayStat = { key: string; label: string; mood: Mood | null; focus: number; busy: number; count: number };

export function ReviewView({ data }: { data: AppData }) {
  const [period, setPeriod] = useState<Period>('week');
  const days = PERIODS.find(x => x.key === period)!.days;

  const dayStats = useMemo<DayStat[]>(() => {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stats: DayStat[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = day(d);
      stats.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, mood: moodOf(data.moods, key), focus: 0, busy: 0, count: 0 });
    }
    const sessions: { start: number; end: number }[] = [];
    for (const t of data.tasks) {
      for (const tm of t.timers) {
        const st = +new Date(tm.start);
        const en = tm.end ? +new Date(tm.end) : now;
        if (en > st) sessions.push({ start: st, end: en });
      }
    }
    for (const r of data.timerRecords) {
      const st = +new Date(r.start);
      const en = +new Date(r.end);
      if (en > st) sessions.push({ start: st, end: en });
    }
    const byKey = new Map(stats.map(s => [s.key, s]));
    const span = new Map<string, { first: number; last: number }>();
    for (const s of sessions) {
      const k = day(new Date(s.start));
      const stat = byKey.get(k);
      if (!stat) continue;
      stat.focus += s.end - s.start;
      stat.count++;
      const sp = span.get(k);
      if (!sp) span.set(k, { first: s.start, last: s.end });
      else { sp.first = Math.min(sp.first, s.start); sp.last = Math.max(sp.last, s.end); }
    }
    for (const [k, sp] of span) {
      const stat = byKey.get(k);
      if (stat) stat.busy = sp.last - sp.first;
    }
    return stats;
  }, [data, days]);

  const moodCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dayStats) if (d.mood) m.set(d.mood.cat, (m.get(d.mood.cat) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [dayStats]);

  const months = useMemo(() => {
    // 每月取出现最多的类别作为代表
    const perMonth = new Map<string, Map<string, number>>();
    for (const d of dayStats) {
      if (!d.mood) continue;
      const mk = d.key.slice(0, 7);
      if (!perMonth.has(mk)) perMonth.set(mk, new Map());
      perMonth.get(mk)!.set(d.mood.cat, (perMonth.get(mk)!.get(d.mood.cat) ?? 0) + 1);
    }
    return [...perMonth.entries()].map(([mk, cats]) => {
      const top = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
      return { key: mk, label: `${Number(mk.slice(5))} 月`, cat: top[0], count: top[1] };
    });
  }, [dayStats]);

  const totalFocus = dayStats.reduce((n, d) => n + d.focus, 0);
  const focusMax = Math.max(...dayStats.map(d => d.focus), 0);
  const focusDay = focusMax > 0 ? dayStats.find(d => d.focus === focusMax) ?? null : null;
  const busyDays = dayStats.filter(d => d.busy > 0);
  const busyMax = Math.max(...dayStats.map(d => d.busy), 0);
  const avgBusy = busyDays.length ? busyDays.reduce((n, d) => n + d.busy, 0) / busyDays.length : 0;

  const topTask = useMemo(() => {
    let best: { title: string; sec: number } | null = null;
    for (const t of data.tasks) {
      let sec = 0;
      for (const tm of t.timers) {
        const st = +new Date(tm.start);
        const en = tm.end ? +new Date(tm.end) : Date.now();
        if (en > st) sec += en - st;
      }
      if (sec > 0 && (!best || sec > best.sec)) best = { title: t.title, sec };
    }
    return best;
  }, [data.tasks]);

  const focusBar = (sec: number) => (focusMax > 0 ? Math.max(4, Math.round((sec / focusMax) * 64)) : 0);

  return (
    <div className="review">
      <h2>卡西莫多的礼物</h2>
      <p className="hint">你投入的每一分钟，都会在将来开花。</p>
      <div className="rev-range">
        {PERIODS.map(x => (
          <button key={x.key} className={period === x.key ? 'on' : ''} onClick={() => setPeriod(x.key)}>{x.label}</button>
        ))}
      </div>

      <section className="rev-sec">
        <h3><span className="dot" />心情</h3>
        {period === 'week' ? (
          <div className="rev-strip">
            {dayStats.map(d => (
              <span key={d.key} className={`rev-chip${d.mood ? ' has' : ''}`} title={d.mood?.note ? `${d.key} ${d.mood.note}` : d.key}>
                <b>{d.mood && d.mood.emoji}</b>
                <small>{d.key.slice(5).replace('-', '/')}</small>
              </span>
            ))}
          </div>
        ) : period === 'month' ? (
          <div className="rev-minis">
            {dayStats.map(d => (
              <span key={d.key} className={`rev-mini${d.mood ? ' has' : ''}`} title={d.mood?.note ? `${d.key} ${d.mood.note}` : d.key}>{d.mood && d.mood.emoji}</span>
            ))}
          </div>
        ) : (
          <div className="rev-mons">
            {months.map(m => (
              <span key={m.key} className="rev-mon" title={`${m.label}记录 ${m.count} 天`}>
                <b>{moodPresetOf(m.cat)?.emojis[0] ?? '😶'}</b>
                <small>{m.label}</small>
              </span>
            ))}
          </div>
        )}
        {moodCounts.length > 0 ? (
          <div className="rev-bars">
            {moodCounts.slice(0, 6).map(([cat, n]) => {
              const mp = moodPresetOf(cat);
              return (
                <div key={cat} className="rev-bar">
                  <div className="rev-bar-head"><span>{mp?.emojis[0] ?? '😶'} {mp?.label ?? cat}</span><small>{n} 天</small></div>
                  <div className="rev-bar-track"><i style={{ width: `${(n / moodCounts[0][1]) * 100}%`, background: mp?.color ?? '#b9c6d6' }} /></div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty">这段时间还没有心情记录</p>
        )}
      </section>

      <section className="rev-sec">
        <h3><span className="dot" />专注时长</h3>
        <div className="rev-big">{fmtDur(totalFocus)}<small>总专注</small></div>
        <div className="rev-daybars" title={focusDay ? `最投入：${focusDay.label} ${fmtDur(focusMax)}` : undefined}>
          {dayStats.map(d => (
            <span key={d.key} title={`${d.key} ${fmtDur(d.focus)}`}>
              <i style={{ height: `${focusBar(d.focus)}px`, background: d.focus === focusMax && focusMax > 0 ? '#4e6078' : '#b9c6d6' }} />
              {period === 'week' && <small>{d.key.slice(8)}</small>}
            </span>
          ))}
        </div>
        {focusDay && <p className="hint">最投入的一天：{focusDay.label} · {fmtDur(focusMax)}</p>}
        {topTask && <p className="hint">最长的一个任务：{topTask.title.length > 14 ? topTask.title.slice(0, 14) + '…' : topTask.title} · {fmtDur(topTask.sec)}</p>}
      </section>

      <section className="rev-sec">
        <h3><span className="dot" />忙碌时间</h3>
        {busyDays.length > 0 ? (
          <>
            <div className="rev-big">{fmtDur(avgBusy)}<small>平均每天</small></div>
            <div className="rev-busy">
              {busyDays.slice(0, 7).map(d => (
                <div key={d.key} className="rev-busy-row" title={`${d.key} ${fmtDur(d.busy)}`}>
                  <span>{d.key.slice(5)}</span>
                  <div className="rev-busy-track"><i style={{ width: `${(d.busy / Math.max(busyMax, 1)) * 100}%` }} /></div>
                  <small>{fmtDur(d.busy)}</small>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="empty">这段时间没有计时活动</p>
        )}
      </section>
    </div>
  );
}
