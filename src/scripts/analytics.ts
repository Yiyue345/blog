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

function isNonNegativeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function formatCount(value: number) {
	return countFormatter.format(value);
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

	try {
		const response = await fetch('/api/analytics', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({
				path,
				title: document.body.dataset.analyticsTitle || document.title,
				type: getAnalyticsPageType(),
			}),
		});
		if (!response.ok) {
			setAnalyticsUnavailable();
			return;
		}

		const payload = await response.json() as AnalyticsPayload;
		setSiteTotalVisits(payload.site?.totalVisits);
		setCurrentArticleViews(payload.article?.views);
	} catch {
		// Analytics must never interrupt page rendering or navigation.
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
