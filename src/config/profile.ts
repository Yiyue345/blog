import type { ImageMetadata } from 'astro';
import defaultAvatar from '../assets/profile.jpg';
import avatar from '../assets/avatar.jpg'

/**
 * Allowed social entry keys in profile configuration.
 */
export type ProfileSocialKey = 'github' | 'x' | 'email' | 'website';

/**
 * One social link item rendered on `/about`.
 */
export interface ProfileSocialLink {
  key: ProfileSocialKey;
  label: string;
  url: string;
}

/**
 * Personal profile settings used by About page and article author schema.
 */
export interface ProfileConfig {
  /**
   * Optional avatar URL for About page and structured data.
   */
  avatar?: string | ImageMetadata;
  /**
   * Display name used across the site.
   */
  name: string;
  /**
   * Short headline/title shown on About page.
   */
  title: string;
  /**
   * Short bio text shown on About page and in schema.
   */
  bio: string;
  /**
   * Optional location text.
   */
  location?: string;
  /**
   * Optional contact email.
   */
  email?: string;
  /**
   * Personal GitHub profile URL (separate from repo URL).
   */
  githubProfileUrl: string;
  /**
   * Social links displayed in About page social row.
   */
  socials: ProfileSocialLink[];
}

export const profileConfig: ProfileConfig = {
  avatar: avatar,
  name: '依月',
  title: '无业游民（大学生',
  bio: '就是个苦逼的学生，以及 xnn（划掉），平时喜欢写点有的没的的东西，虽然输出的内容和胡说八道差不太多',
  location: '桂林',
  email: 'e@mai.l',
  githubProfileUrl: 'https://github.com/Yiyue345/',
  socials: [
    { key: 'github', label: 'GitHub', url: 'https://github.com/Yiyue345/' },
    { key: 'x', label: 'X', url: 'https://x.com' },
    { key: 'website', label: 'Website', url: 'https://yiyuemeow.com' },
  ],
};
