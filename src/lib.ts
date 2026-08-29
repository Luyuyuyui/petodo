export const day = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const dayText = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });

export const fmtClock = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

export const fmtHMS = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export const fmtDur = (s: number) => (s ? `${Math.floor(s / 3600) ? Math.floor(s / 3600) + 'h ' : ''}${Math.floor(s % 3600 / 60)}m` : '0m');

export const parseTags = (title: string) => [...title.matchAll(/#([^\s#]+)/g)].map(x => x[1]);

export const daysLeft = (target: string) => Math.ceil((+new Date(target) - Date.now()) / 86400000);

export const countdownLabel = (target: string) => {
  const d = daysLeft(target);
  if (d > 1) return `${d} 天`;
  if (d === 1) return '明天';
  if (d === 0) return '今天';
  return `已过 ${-d} 天`;
};

import type { Task, Mood } from './types';

export const todayTasks = (tasks: Task[]) => tasks.filter(t => day(new Date(t.completedAt || t.createdAt)) === day());

// 句子池：点击桌宠的随机气泡 + todo 页底部随机句子共用
export const SPEECHES = [
  '当压抑被揭穿 欢迎加入这狂欢',
  '那个不拘一格的自我！',
  '脚印会旧而梦还在走',
  '不再定义未知的远方，旅程本该不一样',
  '我也许是渺小漂流的鱼，是最平庸的一首诗，而我深爱着阳光泥土空气，想用力自在大口呼吸',
  '你经过我每个灿烂时刻 我才真正学会如你般自由',
  '让这世界就此忘了我曾存在过~',
  '你记得我最纯净的轮廓，握住小小风车和放肆的梦',
  '山 请你慢些走向我啊',
  '我有我的节奏 善待所有哪怕不属于我',
  '请别再说 你何必这样活',
  '那太阳闪耀依旧 照亮胚胎 照亮墓碑',
  '窗口很旧 睁开眼就看得到山丘',
  '值得珍惜无数擦肩无数相见',
  '花开与花落',
  '将有一天你会遇见美好的一切',
  '下个春天回来我就会回家',
  '亘古未来，繁华不再，万物皆只因我一念花开',
  '就算没有任何人能看清那株灿烂的花蕊也应该放声歌颂赞美鲜红的玫瑰',
];

export const MOOD_PRESETS: { key: string; label: string; color: string; emojis: string[] }[] = [
  { key: 'happy', label: '开心', color: '#e8c97a', emojis: ['😄', '😁', '😆', '😝', '🤪', '😋'] },
  { key: 'energetic', label: '元气', color: '#f0c04a', emojis: ['⚡', '🔥', '💥', '🚀', '🎆', '☄️'] },
  { key: 'calm', label: '平静', color: '#b9c6d6', emojis: ['😌', '🧘', '🕊️', '🌿', '🪷', '🌊'] },
  { key: 'sunny', label: '等天晴', color: '#c7b8a8', emojis: ['🌤️', '☁️', '🌧️', '⛅', '🌈', '☔'] },
  { key: 'slack', label: '摸鱼', color: '#a8c4b0', emojis: ['🐟', '🦦', '🍵', '🛋️', '🎮', '😎'] },
  { key: 'food', label: '干饭', color: '#d9b98a', emojis: ['🍜', '🍔', '🍗', '🍰', '🍉', '🥤'] },
  { key: 'tired', label: '疲惫', color: '#b8b0c4', emojis: ['😪', '😴', '🥱', '😫', '🫠', '😩'] },
  { key: 'frustrated', label: '烦躁', color: '#d9a09a', emojis: ['😤', '😠', '😾', '🤯', '😖', '💢'] },
  { key: 'sad', label: '难过', color: '#a8b8cc', emojis: ['😢', '😭', '😔', '🥀', '💧', '🫂'] },
  { key: 'anxious', label: '焦虑', color: '#c4a8b8', emojis: ['😰', '😨', '😟', '🥶', '🌀', '🫨'] },
  { key: 'flat', label: '躺平', color: '#c0bfb4', emojis: ['🛌', '😑', '🦥', '🐌', '🧸', '🍂'] },
  { key: 'night', label: '熬夜', color: '#9aa7c9', emojis: ['🌙', '🌃', '🦉', '😵', '✨', '🌠'] },
  { key: 'sick', label: '生病', color: '#c9b0a8', emojis: ['🤒', '🤧', '😷', '💊', '🩹', '🌡️'] },
  { key: 'inspired', label: '灵感', color: '#a8c4c4', emojis: ['💡', '🎨', '📝', '🎵', '🔮', '🎬'] },
  { key: 'lucky', label: '幸运', color: '#b8c4a8', emojis: ['🍀', '🎁', '💰', '🌟', '🪙', '🍭'] },
  { key: 'full', label: '充实', color: '#b0b8a8', emojis: ['📚', '📈', '✅', '🏁', '🎓', '🌱'] },
  { key: 'love', label: '心动', color: '#e8aeb8', emojis: ['💕', '💗', '💖', '💘', '💝', '💓'] },
  { key: 'bored', label: '无聊', color: '#c4c4b8', emojis: ['😒', '🫥', '😐', '🙄', '🤷', '😗'] },
  { key: 'grateful', label: '感恩', color: '#c8b8a0', emojis: ['🙏', '🌸', '🕯️', '🤲', '💐', '🌻'] },
  { key: 'thinking', label: '思考', color: '#a8b8c0', emojis: ['🤔', '💭', '🧠', '📖', '✍️', '🔍'] },
  { key: 'lonely', label: '孤独', color: '#9aa8b8', emojis: ['🌫️', '🌒', '🗝️', '🕸️', '🌉', '🦢'] },
  { key: 'excited', label: '期待', color: '#e0b060', emojis: ['🤩', '🎢', '🎡', '🥁', '🎊', '🪅'] },
];
export const moodPresetOf = (cat?: string) => MOOD_PRESETS.find(x => x.key === cat);
export const moodOf = (m: Record<string, Mood | string>, k: string) => {
  const v = m[k];
  if (!v) return null;
  if (typeof v === 'string') return { cat: v, emoji: MOOD_PRESETS.find(x => x.key === v)?.emojis[0] ?? '😶', note: undefined };
  return v;
};
