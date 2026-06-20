import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// 相対パス（base: './'）で出力するため、Web 静的ホスティング（サブパス可）・
// file:// 直開き・Wails のいずれでも assets を解決できる。
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), svelte()],
})
