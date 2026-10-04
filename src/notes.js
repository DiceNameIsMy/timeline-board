/** Extract distinct HTTP(S) links from plain text; never interpret notes as HTML. */
export function descriptionLinks(text) {
  const links = new Set();
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const candidate = match[0].replace(/[.,;!?]+$/, '');
    try {
      const url = new URL(candidate);
      if (['http:', 'https:'].includes(url.protocol)) links.add(url.href);
    } catch { /* Keep malformed URLs as ordinary text. */ }
  }
  return [...links];
}
