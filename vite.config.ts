import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 前端资源与 electron-builder 的 Windows 成品分目录输出，避免 Windows 锁定运行中的 exe 时构建失败。
export default defineConfig({ plugins: [react()], base: './', build: { outDir: 'web-dist', emptyOutDir: true } });
