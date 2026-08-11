/**
 * Site-level settings shared by header, SEO tags, and feed generation.
 */
export interface SiteConfig {
  /**
   * Canonical production URL of this site.
   */
  siteUrl: string;
  /**
   * Global site title used in header and metadata.
   */
  siteTitle: string;
  /**
   * Optional suffix appended to browser/SEO page titles.
   */
  siteTitleSuffix: string;
  /**
   * Default site description used by index and RSS metadata.
   */
  siteDescription: string;
  /**
   * BCP-47 locale tag (for example: zh-CN, en-US).
   */
  locale: string;
  /**
   * Repository URL shown in the header action area.
   */
  headerGithubRepoUrl: string;
  /**
   * Global favicon ico path served from the public directory.
   */
  faviconIco: string;
  /**
   * Site launch time used by the live footer timer.
   */
  siteCreatedAt: string;
}

export const siteConfig: SiteConfig = {
  siteUrl: 'https://blog.yiyuemeow.com',
  siteTitle: 'YiYue\' s Blog',
  siteTitleSuffix: '依月的碎碎念',
  siteDescription: '一个用来存放妙妙博客的地方',
  locale: 'zh-CN',
  headerGithubRepoUrl: 'https://github.com/Yiyue345/blog',
  faviconIco: '/favicon.ico',
  siteCreatedAt: '2026-08-05T19:09:21+08:00',
};

export const {
  siteUrl,
  siteTitle,
  siteTitleSuffix,
  siteDescription,
  locale,
  headerGithubRepoUrl,
  faviconIco,
  siteCreatedAt,
} = siteConfig;
