import { defineConfig } from 'vite';

/**
 * A separate build for the embeddable widget.
 *
 * It cannot share the dashboard's build: this file is served onto other
 * people's websites, so it must be one self-contained IIFE with no module
 * graph, no code splitting, no CSS file to load, and no React. A visitor to a
 * customer's site should download a few kB, not an application.
 */
export default defineConfig({
  build: {
    // Written into the same dist/ the dashboard produces, so one static host
    // serves both and the snippet URL sits next to the app.
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/widget/index.ts',
      name: 'ReplyIQWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        // No hash: the snippet a customer pastes into their HTML must keep
        // working across every deploy we ever make.
        entryFileNames: 'widget.js',
      },
    },
  },
});
