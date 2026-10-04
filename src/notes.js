/** Extract distinct HTTP(S) links from plain text; never interpret notes as HTML. */
export function descriptionLinks(text) {
  const links = new Set();
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    let candidate = match[0].replace(/[.,;!?]+$/, '');
    // Strip prose delimiters without breaking balanced parentheses in URLs or IPv6 hosts.
    for (const [open, close] of [['(', ')'], ['[', ']']]) {
      while (candidate.endsWith(close) && candidate.split(close).length > candidate.split(open).length) candidate = candidate.slice(0, -1).replace(/[.,;!?]+$/, '');
    }
    try {
      const url = new URL(candidate);
      if (['http:', 'https:'].includes(url.protocol)) links.add(url.href);
    } catch { /* Keep malformed URLs as ordinary text. */ }
  }
  return [...links];
}
