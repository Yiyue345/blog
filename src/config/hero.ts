import defaultBackground from '../assets/blog-placeholder-1.webp';
// import homeBackground from '../assets/homepage-background.jpg'

/**
 * Hero copy and background settings for one page.
 */
export interface HeroSectionConfig {
  /**
   * Main hero headline text.
   */
  text: string;
  /**
   * Optional hero subtitle text.
   */
  subtitle?: string;
  /**
   * Hero background image URL.
   */
  backgroundImage: string;
}

/**
 * Centralized hero configuration for all top-level pages and post fallback.
 */
export interface HeroConfig {
  home: HeroSectionConfig;
  blog: HeroSectionConfig;
  tags: HeroSectionConfig;
  about: HeroSectionConfig;
  /**
   * Default hero image shared by all article pages.
   */
  postDefaultBackground: string;
}

export const heroConfig: HeroConfig = {
  home: {
    text: '主页',
    subtitle: '感觉还是得写点东西在这',
    backgroundImage: defaultBackground.src,
  },
  blog: {
    text: '文章',
    subtitle: '一览无余',
    backgroundImage: defaultBackground.src,
  },
  tags: {
    text: '标签',
    subtitle: '分门别类',
    backgroundImage: defaultBackground.src,
  },
  about: {
    text: '关于',
    subtitle: '我去这是谁',
    backgroundImage: defaultBackground.src,
  },
  postDefaultBackground: defaultBackground.src,
};
