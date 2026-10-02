/**
 * One link rendered in the friends section on the About page.
 */
export interface FriendLink {
  name: string;
  description: string;
  url: string;
  avatar?: string;
  featured?: boolean;
}

/**
 * Friend links are kept outside the page template so the list can be updated
 * without touching the layout.
 */
export const friendLinks: FriendLink[] = [
  {
    name: 'FishCat233 的空间',
    description: '🕊神的博客',
    url: 'https://aaafishcat.top/',
    avatar: 'https://a.favicon.im/aaafishcat.top?larger=true',
  },
  // {
  //   name: '交换友链',
  //   description: '欢迎来信交换友链',
  //   url: 'mailto:me@yiyuemeow.com',
  //   featured: true,
  // },
];
