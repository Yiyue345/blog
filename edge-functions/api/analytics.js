import { getStore } from '@edgeone/pages-blob';

const ANALYTICS_STORE_NAME = 'blog-analytics';
const SITE_STATS_KEY = 'analytics/site.json';
const ARTICLE_KEY_PREFIX = 'analytics/articles/';
const MAX_BODY_BYTES = 4096;
const MAX_PATH_LENGTH = 512;
const MAX_TITLE_LENGTH = 160;
const MAX_ARTICLES_SCANNED = 256;

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function getAnalyticsStore(context) {
  const store = context?.analyticsStore ??
    getStore({ name: ANALYTICS_STORE_NAME, consistency: 'strong' });
  if (
    !store ||
    typeof store.get !== 'function' ||
    typeof store.setJSON !== 'function' ||
    typeof store.list !== 'function'
  ) {
    throw new Error('The analytics Blob store is unavailable');
  }
  return store;
}

function parseJsonValue(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function sanitizeTitle(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const title = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return title ? title.slice(0, MAX_TITLE_LENGTH) : fallback;
}

function deriveTitleFromPath(pathname) {
  const slug = pathname.replace(/\/$/, '').split('/').pop() || 'Untitled';
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function normalizeVisit(body, requestUrl) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('Request body must be a JSON object');
  }
  if (typeof body.path !== 'string' || !body.path.startsWith('/')) {
    throw new TypeError('path must be an absolute site path');
  }
  if (body.path.length > MAX_PATH_LENGTH) {
    throw new TypeError('path is too long');
  }

  const requestOrigin = new URL(requestUrl).origin;
  const visitUrl = new URL(body.path, requestOrigin);
  if (visitUrl.origin !== requestOrigin) {
    throw new TypeError('path must belong to this site');
  }

  const pathname = visitUrl.pathname.replace(/\/{2,}/g, '/');
  if (body.type !== undefined && body.type !== 'article' && body.type !== 'page') {
    throw new TypeError('type must be article or page');
  }
  if (body.countSiteVisit !== undefined && typeof body.countSiteVisit !== 'boolean') {
    throw new TypeError('countSiteVisit must be a boolean');
  }

  const matchesArticlePath = /^\/blog\/[^/]+\/?$/.test(pathname);
  if (body.type === 'article' && !matchesArticlePath) {
    throw new TypeError('article type requires an article path');
  }

  const isArticle = body.type === 'article' || (body.type === undefined && matchesArticlePath);
  const fallbackTitle = isArticle ? deriveTitleFromPath(pathname) : '';

  return {
    path: pathname,
    isArticle,
    title: isArticle ? sanitizeTitle(body.title, fallbackTitle) : null,
    countSiteVisit: body.countSiteVisit !== false,
  };
}

function isSameOriginRequest(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return false;
  }
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function createArticleKey(pathname) {
  const bytes = new TextEncoder().encode(pathname);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${ARTICLE_KEY_PREFIX}${hash}.json`;
}

async function readJson(store, key, fallback) {
  const value = await store.get(key, { type: 'json', consistency: 'strong' });
  return parseJsonValue(value, fallback);
}

function normalizeSiteStats(value) {
  return {
    totalVisits: toNonNegativeInteger(value?.totalVisits),
    lastVisitedAt: typeof value?.lastVisitedAt === 'string' ? value.lastVisitedAt : null,
  };
}

function normalizeArticleStats(value) {
  if (!value || typeof value.path !== 'string' || typeof value.title !== 'string') {
    return null;
  }
  return {
    path: value.path,
    title: value.title,
    views: toNonNegativeInteger(value.views),
    lastVisitedAt: typeof value.lastVisitedAt === 'string' ? value.lastVisitedAt : null,
  };
}

function getPopularLimit(requestUrl) {
  const rawLimit = new URL(requestUrl).searchParams.get('limit');
  if (!rawLimit || !/^\d+$/.test(rawLimit)) {
    return 10;
  }
  return Math.min(Math.max(Number(rawLimit), 1), 20);
}

export async function onRequestPost(context) {
  const { request } = context;
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: { code: 'FORBIDDEN', message: 'Cross-origin writes are not allowed' } }, 403);
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonResponse({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Expected application/json' } }, 415);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } }, 413);
  }

  let visit;
  try {
    visit = normalizeVisit(JSON.parse(rawBody), request.url);
  } catch {
    return jsonResponse({ error: { code: 'INVALID_REQUEST', message: 'Invalid visit payload' } }, 400);
  }

  try {
    const store = getAnalyticsStore(context);
    const now = new Date().toISOString();
    const articleKey = visit.isArticle ? await createArticleKey(visit.path) : null;
    const [storedSiteStats, storedArticleStats] = await Promise.all([
      readJson(store, SITE_STATS_KEY, {}),
      articleKey ? readJson(store, articleKey, {}) : Promise.resolve(null),
    ]);

    const siteStats = normalizeSiteStats(storedSiteStats);
    if (visit.countSiteVisit) {
      siteStats.totalVisits += 1;
    }
    siteStats.lastVisitedAt = now;

    let articleStats = null;
    if (articleKey) {
      articleStats = normalizeArticleStats(storedArticleStats) ?? {
        path: visit.path,
        title: visit.title,
        views: 0,
        lastVisitedAt: null,
      };
      articleStats.path = visit.path;
      articleStats.title = visit.title;
      articleStats.views += 1;
      articleStats.lastVisitedAt = now;
    }

    await Promise.all([
      store.setJSON(SITE_STATS_KEY, siteStats),
      articleKey ? store.setJSON(articleKey, articleStats) : Promise.resolve(),
    ]);

    return jsonResponse({ site: siteStats, article: articleStats }, 200);
  } catch (error) {
    console.error('Failed to record analytics visit', error);
    return jsonResponse(
      { error: { code: 'ANALYTICS_UNAVAILABLE', message: 'Analytics storage is unavailable' } },
      503,
    );
  }
}

export async function onRequestGet(context) {
  try {
    const store = getAnalyticsStore(context);
    const limit = getPopularLimit(context.request.url);
    const [storedSiteStats, articleObjects] = await Promise.all([
      readJson(store, SITE_STATS_KEY, {}),
      store.list({ prefix: ARTICLE_KEY_PREFIX, consistency: 'strong' }),
    ]);
    const blobs = articleObjects?.blobs ?? [];
    const scannedBlobs = blobs.slice(0, MAX_ARTICLES_SCANNED);

    const articles = await Promise.all(
      scannedBlobs.map(async ({ key }) => normalizeArticleStats(await readJson(store, key, {}))),
    );
    const popularArticles = articles
      .filter(Boolean)
      .sort((left, right) => {
        if (right.views !== left.views) {
          return right.views - left.views;
        }
        return String(right.lastVisitedAt).localeCompare(String(left.lastVisitedAt));
      })
      .slice(0, limit);

    return jsonResponse({
      site: normalizeSiteStats(storedSiteStats),
      popularArticles,
      meta: {
        limit,
        truncated: blobs.length > MAX_ARTICLES_SCANNED,
        consistency: 'strong',
      },
    });
  } catch (error) {
    console.error('Failed to read analytics stats', error);
    return jsonResponse(
      { error: { code: 'ANALYTICS_UNAVAILABLE', message: 'Analytics storage is unavailable' } },
      503,
    );
  }
}
