import { serve } from 'bun';
import index from './public/index.html';

serve({
  routes: {
    '/': index,
  },
  fetch(req) {
    const url = new URL(req.url);
    return new Response(Bun.file(`./public${url.pathname}`));
  },
});
