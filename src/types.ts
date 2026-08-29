export type Mode = 'pet' | 'todo' | 'countdown';
export type View = 'todo' | 'history' | 'review' | 'settings' | 'countdown' | 'timer' | 'timetable';

export type TimerEntry = { start: string; end?: string };
export type Priority = 'high' | 'medium' | 'low';
export type Task = {
  id: string;
  title: string;
  tags: string[];
  status: 'active' | 'completed';
  createdAt: string;
  completedAt?: string;
  totalSeconds: number;
  timers: TimerEntry[];
  source: 'local' | 'feishu';
  pinned?: boolean;
  order: number;
  priority?: Priority;
  due?: string;
  remindMinutes?: number;
  reminded?: boolean;
};

export type Countdown = { id: string; title: string; target: string; createdAt: string };

export type Course = { id: string; name: string; day: number; start: string; end: string; location?: string };

export type Stopwatch = { running: boolean; start?: string; elapsed: number; label?: string };

export type TimerRecord = { id: string; label: string; start: string; end: string; seconds: number };

export type PetArt = 'pixel-0' | 'pixel-1' | 'pixel-3';
export type BgKey = 'bg-0' | 'bg-1' | 'bg-2' | 'bg-3' | 'bg-4';

export type Settings = {
  pet: string;
  petName?: string;
  petImage?: string;
  petArt?: PetArt;
  countdownBg?: BgKey | string;
  theme?: 'light' | 'dark';
  autoSync: boolean;
  feishu: { appId: string; appSecret: string; tableId: string };
};

export type Mood = { cat: string; emoji: string; note?: string };

export type AppData = {
  tasks: Task[];
  settings: Settings;
  countdowns: Countdown[];
  courses: Course[];
  marks: Record<string, string>;
  moods: Record<string, Mood | string>;
  stopwatch: Stopwatch;
  timerRecords: TimerRecord[];
};

export type PanelShow = { kind: 'hover' | 'full'; mode: Mode; view?: View; focus?: boolean };
