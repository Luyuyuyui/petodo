/// <reference types="vite/client" />
import type { AppData, Mode, PanelShow, View } from './types';

interface DesktopApi {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<boolean>;
  onData(fn: () => void): void;
  iconHover(): void;
  iconLeave(): void;
  onIconExpand(fn: (mode: Mode) => void): void;
  onIconCollapse(fn: () => void): void;
  iconCollapsed(): void;
  panelHover(): void;
  panelLeave(): void;
  onPanelShow(fn: (v: PanelShow) => void): void;
  onPanelHide(fn: () => void): void;
  panelHidden(): void;
  setMode(m: Mode): void;
  onMode(fn: (m: Mode) => void): void;
  menu(): void;
  full(view: View, focus?: boolean): void;
  closePanel(): void;
  quit(): void;
  dragStart(sx: number, sy: number): void;
  dragMove(sx: number, sy: number): void;
  dragEnd(): void;
  exportFile(content: string, name: string): Promise<boolean>;
  importFile(): Promise<string | null>;
  uploadImage(kind?: 'pet' | 'bg'): Promise<string | null>;
}

declare global {
  interface Window { desktop: DesktopApi; }
}

export {};
