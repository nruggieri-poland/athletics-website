// Shared by every place a CMS-editor-supplied URL (article/document external
// links, rich text links/images) gets rendered as an href/src. Escaping HTML
// syntax isn't enough on its own — a value like `javascript:alert(1)` has no
// special HTML characters to escape but still executes when clicked. Allow
// only the schemes a legitimate link on this site would ever need.
const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|\/|#)/i;

export function sanitizeUrl(url: string): string {
  return SAFE_URL_PATTERN.test(url) ? url : "#";
}
