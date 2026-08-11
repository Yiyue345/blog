import { describe, expect, it } from 'vitest';
import { formatSiteRuntime } from './analytics';

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
