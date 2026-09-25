import rss from '@astrojs/rss';
import type { APIContext, GetStaticPaths } from 'astro';
import { canonicalUrl, pagePath, site } from '../../../../lib/site';
import { feedCreator, feedSelfLink, feedXmlns } from '../../../../lib/feed';
import { engineName, type PublishedPosts } from '../../../../lib/posts';

/**
 * One feed per engine archive, alongside the archive page itself.
 *
 * The site-wide feed carries every post, so an aggregator that wants one
 * engine has to filter it downstream. Planet for the MySQL Community asks for
 * the opposite in the notes at the top of its own planet.ini
 * (github.com/oursqlcommunity-org/planet): "If your blog contains a mix MySQL
 * and non-MySQL content, please consider submitting a category or tag feed
 * instead of a default feed." Without one, our entry there runs the site feed
 * through siftrss on a title regex, which misses posts whose title does not
 * name the engine. mysql-wire-compatible-engines-one-provider is titled "Nine
 * servers, one connection type, different answers" and is exactly that case.
 *
 * The grouping is not new: /blog/engine/<id> already lists these posts. Both
 * routes read it from engineArchives(), so the threshold lives in one place.
 */
export const getStaticPaths = (async () => {
  const { getCollection } = await import('astro:content');
  const { engineArchives } = await import('../../../../lib/posts');

  const posts = await getCollection('posts', ({ data }) => data.status === 'published');

  return [...engineArchives(posts).entries()].map(([engine, list]) => ({
    params: { engine },
    props: { posts: list },
  }));
}) satisfies GetStaticPaths;

type Props = { posts: PublishedPosts };

export function GET(context: APIContext) {
  const engine = context.params.engine!;
  const { posts } = context.props as Props;
  const name = engineName(engine) ?? engine;

  return rss({
    title: `${site.name} — ${name} posts`,
    description: `Posts about ${name} from the ${site.name} blog.`,
    // The archive, not the home page: a reader who follows the feed back should
    // land on the list it was cut from.
    site: canonicalUrl(`/blog/engine/${engine}`),
    trailingSlash: true,
    xmlns: feedXmlns,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: pagePath(`/blog/${post.id}`),
      // The engine first, so an aggregator filtering on category has the name
      // it asked for. Deduped because a post is free to carry the engine as a
      // tag too, and two identical <category> elements help nobody.
      categories: [name, ...post.data.tags.map((t) => t.label)],
      customData: feedCreator(post.data.author.name || site.name),
    })),
    customData: `<language>en</language>${feedSelfLink(`/blog/engine/${engine}/rss.xml`)}`,
  });
}
