import { makeRouter, RouteTable } from './_router';
import { handler as exportsPdf } from '../api/exports/pdf';
import { handler as battlecard } from '../api/competitors/battlecard';

// Both routes render with PDFKit: this function runs at 1024 MB / 60s and its
// bundle carries the .afm font metrics (pdfFonts marker → afterBundling hook
// in api.stack.ts). Never move these routes to a default-profile function.
export const routes: RouteTable = {
  'POST /exports/pdf': exportsPdf,
  'POST /competitors/{id}/battlecard': battlecard,
};

export const handler = makeRouter(routes);
