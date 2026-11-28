// dinedibs.app/d/<deal id>: the page a shared deal points to (Netlify Edge Function).
//
// The app's Share button sends this link. Messages, WhatsApp and the rest read the page's
// Open Graph tags, so the preview shows that deal's own photo, title and restaurant instead of
// the home page's one picture. A person who opens it in a browser sees the deal and a way to
// get the app. The page has no script.
//
// It reads the deal the way a signed-out visitor of the app does (the anon key and the read
// policy of migration 0090: live deals at approved restaurants only), so it can show nothing
// the app wouldn't. Anything else (a paused deal, a wrong id, a server that doesn't answer)
// goes to the home page.
//
// Tests: scripts/site-deal.test.ts.

/** Where deals live. The first project that knows the id answers. The anon key is the public
 *  one every copy of the app carries. Put production first when it opens (mobile/RELEASE.md). */
export const PROJECTS: readonly { url: string; anonKey: string }[] = [
  {
    url: 'https://zvlfsddxcdcejsilxdvq.supabase.co', // staging (TestFlight and preview builds)
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2bGZzZGR4Y2RjZWpzaWx4ZHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNjIwNjcsImV4cCI6MjEwNjczODA2N30.oLTAtQHBmceAGNtsiT0OAl_v8Tz3MduXkiR1D6ojTis',
  },
];

export const config = { path: '/d/*' };

const SITE = 'https://dinedibs.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PHOTO_PATH = /^https:\/\/(?:[a-z0-9-]+\.supabase\.co|auth\.dinedibs\.app)\/storage\/v1\/object\/public\/restaurant-photos\/([A-Za-z0-9._/%-]+)$/;
/** The demo restaurants' photos ship inside the app; the website keeps its own copies. */
const SEED = /^seed\/(brunch|burger|burger2|caesar|dumpling|pizza|pizza2|salad|salad2|steak|tacos)\.jpg$/;

export type SharedDeal = {
  id: string;
  title: string;
  description: string | null;
  badge: string | null;
  image_url: string | null;
  restaurants: { name: string; cuisine: string | null; address: string | null; photos: string[] | null } | null;
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** One line of plain text, like `plain` in the app's lib/share.ts. */
export function oneLine(text: string | null | undefined, max = 160): string {
  return (text ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * The address of the deal's photo, 1200 px wide: always from the project the deal came from
 * (only the path of the saved address is kept, as the app does), or the website's copy of a
 * demo photo. Null when the deal has no photo of ours.
 */
export function photoUrl(deal: SharedDeal, projectUrl: string): string | null {
  const saved = deal.image_url || deal.restaurants?.photos?.[0] || '';
  const path = PHOTO_PATH.exec(saved)?.[1];
  if (!path || path.includes('..')) return null;
  if (SEED.test(path)) return `${SITE}/img/${path}`;
  return `${projectUrl}/storage/v1/render/image/public/restaurant-photos/${path}?width=1200&resize=contain&quality=75`;
}

export function renderDeal(deal: SharedDeal, projectUrl: string): string {
  const title = oneLine(deal.title, 80);
  const place = oneLine(deal.restaurants?.name, 80);
  const heading = place ? `${title} · ${place}` : title;
  const about = oneLine(deal.description) || `A deal at ${place || 'a local restaurant'} on Dine Dibs. Claim it in the app, walk in, show your code.`;
  const photo = photoUrl(deal, projectUrl) ?? `${SITE}/img/seed/tacos.jpg`;
  const facts = [oneLine(deal.restaurants?.cuisine, 40), oneLine(deal.restaurants?.address, 120)].filter(Boolean).join(' · ');
  const badge = oneLine(deal.badge, 20);
  const e = escapeHtml;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(heading)} · Dine Dibs</title>
<meta name="description" content="${e(about)}">
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.png" type="image/png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dine Dibs">
<meta property="og:title" content="${e(heading)}">
<meta property="og:description" content="${e(about)}">
<meta property="og:url" content="${SITE}/d/${e(deal.id)}">
<meta property="og:image" content="${e(photo)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="wrap top"><a class="logo" href="/"><img src="/dinedibs.svg" alt="" width="64" height="64">Dine Dibs</a></header>
<main class="wrap shared">
  <article class="shared-card">
    <div class="shared-art"><img src="${e(photo)}" alt="">${badge ? `<span class="badge">${e(badge)}</span>` : ''}</div>
    <div class="shared-body">
      <h1>${e(title)}</h1>
      ${place ? `<p class="shared-place">${e(place)}</p>` : ''}
      ${facts ? `<p class="shared-facts">${e(facts)}</p>` : ''}
      ${oneLine(deal.description) ? `<p class="shared-about">${e(oneLine(deal.description, 400))}</p>` : ''}
      <a class="btn primary" href="/">Get the app to claim it</a>
      <p class="shared-how">Claim it in the app, walk in, show your code at the counter.</p>
    </div>
  </article>
</main>
</body>
</html>
`;
}

/** The deal as a signed-out visitor may read it, with the project that has it; null when none does. */
export async function findDeal(id: string, projects = PROJECTS, fetcher: typeof fetch = fetch): Promise<{ deal: SharedDeal; projectUrl: string } | null> {
  for (const p of projects) {
    try {
      const res = await fetcher(
        `${p.url}/rest/v1/deals?id=eq.${id}&select=id,title,description,badge,image_url,restaurants(name,cuisine,address,photos)&limit=1`,
        { headers: { apikey: p.anonKey, Authorization: `Bearer ${p.anonKey}` }, signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) continue;
      const rows = (await res.json()) as SharedDeal[];
      if (Array.isArray(rows) && rows[0]?.id === id && typeof rows[0].title === 'string') return { deal: rows[0], projectUrl: p.url };
    } catch {
      // this project didn't answer: try the next one
    }
  }
  return null;
}

function home(): Response {
  return new Response(null, { status: 302, headers: { Location: `${SITE}/`, 'Cache-Control': 'no-store' } });
}

export async function handle(request: Request, projects = PROJECTS, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const id = new URL(request.url).pathname.replace(/^\/d\//, '').replace(/\/$/, '').toLowerCase();
  if (!UUID.test(id)) return home();
  const found = await findDeal(id, projects, fetcher);
  if (!found) return home();
  const photoHosts = projects.map((p) => p.url).join(' ');
  return new Response(request.method === 'HEAD' ? null : renderDeal(found.deal, found.projectUrl), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // A paused or changed deal stops showing within five minutes.
      'Cache-Control': 'public, max-age=300',
      // The site's own headers (site/_headers) cover its files, not this answer: keep them in step.
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': `default-src 'self'; img-src 'self' data: ${photoHosts}; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'none'; connect-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'`,
    },
  });
}

export default (request: Request) => handle(request);
