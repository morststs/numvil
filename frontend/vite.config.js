import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// 相対パス（base: './'）で出力するため、任意の静的ホスティング（サブパス可）・
// file:// 直開きのいずれでも assets を解決できる。
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), svelte()],
})
