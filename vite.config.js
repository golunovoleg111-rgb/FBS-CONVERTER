import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base:'/FBS-CONVERTER/',
  plugins:[react()],
  build:{rollupOptions:{input:path.join(root,'app/index.html')}}
});
