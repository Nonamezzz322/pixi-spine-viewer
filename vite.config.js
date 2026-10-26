import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	base: '/pixi-spine-viewer/',
	server: {port: 9876}
});