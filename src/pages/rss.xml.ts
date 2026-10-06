import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { pagePath, site } from '../lib/site';
import { feedCreator, feedSelfLink, feedXmlns } from '../lib/feed';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => data.status === 'published')).sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );

  return rss({
    title: `${site.name} — blog`,
    description: site.description,
    site: context.site ?? site.url,
    trailingSlash: true,
    xmlns: feedXmlns,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: pagePath(`/blog/${post.id}`),
      categories: post.data.tags.map((t) => t.label),
      // Not <author>: RSS 2.0 defines that element as an email address, and a
      // bare name there fails the W3C validator. The name belongs in dc:creator.
      customData: feedCreator(post.data.author.name || site.name),
    })),
    customData: `<language>en</language>${feedSelfLink('/rss.xml')}`,
  });
}
