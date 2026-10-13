import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    // Several tests find their files with import.meta.glob (lessons, translations, mic
    // recordings). The persistent transform cache doesn't notice new matching files, so new
    // content would silently go untested.
    fsModuleCache: false,
  },
});
