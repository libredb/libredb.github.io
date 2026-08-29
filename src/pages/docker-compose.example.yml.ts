import composeYaml from '../data/docker-compose.example.yml?raw';

/**
 * Serves the compose file at https://libredb.org/docker-compose.example.yml so
 * `curl -O` works, which is the whole point of the mirror.
 *
 * It is an endpoint rather than a second copy in `public/`. The previous site
 * kept the file in both places and needed a build step to copy one over the
 * other — which rewrote tracked files on every build and still let them drift
 * between builds. Rendering the same `?raw` import that /docker-compose renders
 * means the page and the download can never disagree.
 */
export function GET(): Response {
  // Only the body survives: this is a static build, so the file lands on disk and
  // the host picks the headers. The rename to docker-compose.yml is handled by
  // the `download` attribute on /docker-compose and by the quick-start `mv`.
  return new Response(composeYaml, { headers: { 'content-type': 'text/yaml; charset=utf-8' } });
}
