import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self'; worker-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export default defineConfig({
  plugins: [react(), {
    name: 'production-privacy-policy',
    transformIndexHtml(html, context) {
      return context.server ? html : html.replace('<!-- privacy-policy -->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
    },
  }],
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'] },
});
