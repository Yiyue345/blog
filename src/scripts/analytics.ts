interface SiteStats {
	totalVisits: number;
}

interface ArticleStats {
	path: string;
	title: string;
	views: number;
}

interface AnalyticsPayload {
	site?: SiteStats;
	article?: ArticleStats | null;
	popularArticles?: ArticleStats[];
}

type AnalyticsWindow = Window & {
	__analyticsLastPageView?: string;
	__siteRuntimeInterval?: number;
};

const countFormatter = new Intl.NumberFormat('zh-CN');
const VISITOR_COUNTED_AT_KEY = 'analytics:visitor-counted-at';
const VISITOR_ORDINAL_KEY = 'analytics:visitor-ordinal';
export const VISITOR_COUNT_WINDOW_MS = 24 * 60 * 60 * 1_000;

interface SiteVisitReservation {
	shouldCount: boolean;
	marker?: string;
	visitorOrdinal?: number;
}

function isNonNegativeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function formatCount(value: number) {
	return countFormatter.format(value);
}

export function isVisitorCountWindowActive(value: string | null, now = Date.now()) {
	if (!value) return false;
	const countedAt = Number(value);
	return Number.isFinite(countedAt)
		&& countedAt >= 0
		&& countedAt <= now
		&& now - countedAt < VISITOR_COUNT_WINDOW_MS;
}

function readStoredVisitorOrdinal() {
	try {
		const storedValue = window.localStorage.getItem(VISITOR_ORDINAL_KEY);
		if (storedValue === null) return undefined;
		const value = Number(storedValue);
		return isNonNegativeInteger(value) ? value : undefined;
	} catch {
		return undefined;
	}
}

function reserveSiteVisit(now = Date.now()): SiteVisitReservation {
	try {
		const countedAt = window.localStorage.getItem(VISITOR_COUNTED_AT_KEY);
		if (isVisitorCountWindowActive(countedAt, now)) {
			return {
				shouldCount: false,
				visitorOrdinal: readStoredVisitorOrdinal(),
			};
		}

		const marker = String(now);
		window.localStorage.setItem(VISITOR_COUNTED_AT_KEY, marker);
		window.localStorage.removeItem(VISITOR_ORDINAL_KEY);
		return { shouldCount: true, marker };
	} catch {
		// Browsers that block localStorage fall back to the previous page-view counting behavior.
		return { shouldCount: true };
	}
}

function saveVisitorOrdinal(reservation: SiteVisitReservation, value: unknown) {
	if (!reservation.shouldCount || !isNonNegativeInteger(value)) return;
	try {
		window.localStorage.setItem(VISITOR_ORDINAL_KEY, String(value));
	} catch {
		// The displayed value can still use the response even when storage is unavailable.
	}
}

function rollbackSiteVisitReservation(reservation: SiteVisitReservation) {
	if (!reservation.marker) return;
	try {
		if (window.localStorage.getItem(VISITOR_COUNTED_AT_KEY) === reservation.marker) {
			window.localStorage.removeItem(VISITOR_COUNTED_AT_KEY);
		}
	} catch {
		// Nothing to roll back when localStorage is unavailable.
	}
}

function setSiteTotalVisits(value: unknown) {
	if (!isNonNegativeInteger(value)) return;
	document.querySelectorAll<HTMLElement>('[data-site-total-visits]').forEach((element) => {
		element.textContent = formatCount(value);
	});
}

function setCurrentArticleViews(value: unknown) {
	if (!isNonNegativeInteger(value)) return;
	document.querySelectorAll<HTMLElement>('[data-article-view-count]').forEach((element) => {
		element.textContent = `${formatCount(value)} 次浏览`;
	});
}

function setAnalyticsUnavailable() {
	document.querySelectorAll<HTMLElement>('[data-site-total-visits], [data-article-view-count]').forEach((element) => {
		if (element.textContent?.includes('加载中')) element.textContent = '暂不可用';
	});
}

export function formatSiteRuntime(startedAt: string, now = Date.now()) {
	const startedAtMs = Date.parse(startedAt);
	if (!Number.isFinite(startedAtMs)) return '暂时无法计算';

	const elapsedSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1_000));
	const days = Math.floor(elapsedSeconds / 86_400);
	const hours = Math.floor((elapsedSeconds % 86_400) / 3_600);
	const minutes = Math.floor((elapsedSeconds % 3_600) / 60);
	const seconds = elapsedSeconds % 60;
	const pad = (value: number) => String(value).padStart(2, '0');

	return `${formatCount(days)} 天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function setupSiteRuntime() {
	const runtimeWindow = window as AnalyticsWindow;
	if (runtimeWindow.__siteRuntimeInterval) {
		window.clearInterval(runtimeWindow.__siteRuntimeInterval);
	}

	const update = () => {
		document.querySelectorAll<HTMLElement>('[data-site-runtime]').forEach((element) => {
			const startedAt = element.dataset.siteCreatedAt;
			if (startedAt) element.textContent = formatSiteRuntime(startedAt);
		});
	};

	update();
	runtimeWindow.__siteRuntimeInterval = window.setInterval(update, 1_000);
}

function getAnalyticsPageType() {
	return document.body.dataset.analyticsContentType === 'article' ? 'article' : 'page';
}

async function recordPageView() {
	const runtimeWindow = window as AnalyticsWindow;
	const path = window.location.pathname;
	if (runtimeWindow.__analyticsLastPageView === path) return;
	runtimeWindow.__analyticsLastPageView = path;
	const siteVisit = reserveSiteVisit();

	try {
		const response = await fetch('/api/analytics', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			credentials: 'same-origin',
			keepalive: true,
			body: JSON.stringify({
				path,
				title: document.body.dataset.analyticsTitle || document.title,
				type: getAnalyticsPageType(),
				countSiteVisit: siteVisit.shouldCount,
			}),
		});
		if (!response.ok) {
			rollbackSiteVisitReservation(siteVisit);
			setAnalyticsUnavailable();
			return;
		}

		const payload = await response.json() as AnalyticsPayload;
		saveVisitorOrdinal(siteVisit, payload.site?.totalVisits);
		setSiteTotalVisits(siteVisit.visitorOrdinal ?? payload.site?.totalVisits);
		setCurrentArticleViews(payload.article?.views);
	} catch {
		// Analytics must never interrupt page rendering or navigation.
		rollbackSiteVisitReservation(siteVisit);
		setAnalyticsUnavailable();
	}
}

function normalizePopularArticle(value: unknown): ArticleStats | null {
	if (!value || typeof value !== 'object') return null;
	const candidate = value as Partial<ArticleStats>;
	if (
		typeof candidate.path !== 'string'
		|| !/^\/blog\/[^/]+\/?$/.test(candidate.path)
		|| typeof candidate.title !== 'string'
		|| !candidate.title.trim()
		|| !isNonNegativeInteger(candidate.views)
	) {
		return null;
	}
	return {
		path: candidate.path,
		title: candidate.title.trim(),
		views: candidate.views,
	};
}

export async function loadPopularArticles() {
	const section = document.querySelector<HTMLElement>('[data-popular-articles]');
	const list = section?.querySelector<HTMLOListElement>('[data-popular-articles-list]');
	if (
		!section
		|| !list
		|| section.dataset.loaded === 'true'
		|| section.dataset.loading === 'true'
	) return;
	section.dataset.loading = 'true';

	try {
		const response = await fetch('/api/analytics?limit=3', {
			headers: { accept: 'application/json' },
			credentials: 'same-origin',
		});
		if (!response.ok) return;

		const payload = await response.json() as AnalyticsPayload;
		setSiteTotalVisits(payload.site?.totalVisits);
		const articles = Array.isArray(payload.popularArticles)
			? payload.popularArticles
				.map(normalizePopularArticle)
				.filter((article): article is ArticleStats => article !== null)
			: [];
		if (articles.length === 0) return;

		const fragment = document.createDocumentFragment();
		articles.forEach((article, index) => {
			const item = document.createElement('li');
			item.className = 'popular-article-item';

			const rank = document.createElement('span');
			rank.className = 'popular-article-rank';
			rank.textContent = String(index + 1).padStart(2, '0');

			const link = document.createElement('a');
			link.className = 'popular-article-link';
			link.href = article.path;
			link.textContent = article.title;

			const views = document.createElement('span');
			views.className = 'popular-article-views';
			views.textContent = `${formatCount(article.views)} 次浏览`;

			item.append(rank, link, views);
			fragment.append(item);
		});

		list.replaceChildren(fragment);
		section.hidden = false;
		section.dataset.loaded = 'true';
	} catch {
		// Keep the optional ranking hidden while analytics is unavailable.
	} finally {
		delete section.dataset.loading;
	}
}

export function initSiteAnalytics() {
	setupSiteRuntime();
	void recordPageView();
}
