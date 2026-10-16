import { defineConfig } from 'vitest/config';

// Unit tests live next to the code in src/. The Playwright suite (e2e/) has its own runner and must not be
// collected here; local agent worktrees under .claude/ are kept out too.
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
