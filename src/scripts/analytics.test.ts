import { describe, expect, it } from 'vitest';
import {
	formatSiteRuntime,
	isVisitorCountWindowActive,
	shouldRequestAnalytics,
	VISITOR_COUNT_WINDOW_MS,
} from './analytics';

describe('site runtime formatter', () => {
	it('formats elapsed days and a zero-padded clock', () => {
		const startedAt = '2026-08-05T00:00:00.000Z';
		const now = Date.parse('2026-08-07T03:04:05.000Z');

		expect(formatSiteRuntime(startedAt, now)).toBe('2 天 03:04:05');
	});

	it('handles invalid and future start times safely', () => {
		expect(formatSiteRuntime('invalid', 0)).toBe('暂时无法计算');
		expect(formatSiteRuntime('2026-08-05T00:00:00.000Z', 0)).toBe('0 天 00:00:00');
	});
});

describe('visitor count window', () => {
	it('keeps the visitor marker active for 24 hours', () => {
		const now = Date.parse('2026-08-12T00:00:00.000Z');
		const countedAt = String(now - VISITOR_COUNT_WINDOW_MS + 1);

		expect(isVisitorCountWindowActive(countedAt, now)).toBe(true);
		expect(isVisitorCountWindowActive(String(now - VISITOR_COUNT_WINDOW_MS), now)).toBe(false);
	});

	it('rejects missing, invalid, and future markers', () => {
		const now = Date.parse('2026-08-12T00:00:00.000Z');

		expect(isVisitorCountWindowActive(null, now)).toBe(false);
		expect(isVisitorCountWindowActive('invalid', now)).toBe(false);
		expect(isVisitorCountWindowActive(String(now + 1), now)).toBe(false);
	});
});

describe('analytics request cache', () => {
	it('skips ordinary page requests while a visitor ordinal is cached', () => {
		expect(shouldRequestAnalytics('page', false, 19)).toBe(false);
	});

	it('still requests expired, missing, and article analytics', () => {
		expect(shouldRequestAnalytics('page', true, 19)).toBe(true);
		expect(shouldRequestAnalytics('page', false)).toBe(true);
		expect(shouldRequestAnalytics('article', false, 19)).toBe(true);
	});
});
