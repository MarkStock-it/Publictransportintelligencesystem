import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Rollup options can be customized here. During the build you may see
  // warnings about modules being automatically treated as external.
  // Those warnings look like:
  //   "This is most likely unintended because it can break your application
  //    at runtime. If you do want to externalize this module explicitly add
  //    it to `build.rollupOptions.external`"
  //
  // To silence them and ensure the module isn’t accidentally bundled, list
  // the module name(s) below. For example, if `fs` or a Node-only package
  // appears, add it to the array.
  // The array is empty by default so it doesn’t change anything until you add
  // a name.
  build: {
    rollupOptions: {
      external: [] as string[],
    },
  },
})
