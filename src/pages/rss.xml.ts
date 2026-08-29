import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '../lib/site';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => data.status === 'published')).sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );

  return rss({
    title: `${site.name} — blog`,
    description: site.description,
    site: context.site ?? site.url,
    trailingSlash: false,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `/blog/${post.id}`,
      categories: post.data.tags.map((t) => t.label),
      author: post.data.author.name || site.name,
    })),
    customData: `<language>${site.defaultLocale}</language>`,
  });
}
