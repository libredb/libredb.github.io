/** Click-to-load YouTube. The poster is a link to the video until JavaScript
 *  runs; then pressing it swaps in the player, so no request reaches YouTube
 *  before the visitor asks for one. Why it must stay this way: `tour` in
 *  src/data/platform.ts. */
for (const box of document.querySelectorAll<HTMLElement>('[data-yt-facade]')) {
  const play = box.querySelector<HTMLAnchorElement>('[data-yt-play]');
  const src = box.dataset.ytPlayer;
  if (!play || !src) continue;

  play.addEventListener('click', (event) => {
    // A modified click still means "open YouTube in a new tab".
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = box.dataset.ytTitle ?? 'Video';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    play.replaceWith(frame);
    frame.focus();
  });
}
