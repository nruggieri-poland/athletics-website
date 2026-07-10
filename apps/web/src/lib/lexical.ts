// Minimal, framework-agnostic Lexical JSON -> HTML converter, covering the
// node types Payload's default richText editor produces (paragraphs,
// headings, lists, links, basic text formatting, uploaded images). Avoids
// pulling in @payloadcms/richtext-lexical/react (and therefore a React
// island) just to render article bodies on an otherwise React-free site.

interface LexicalNode {
  type: string;
  children?: LexicalNode[];
  text?: string;
  format?: number | string;
  tag?: string;
  listType?: "bullet" | "number";
  url?: string;
  newTab?: boolean;
  value?: { url?: string; alt?: string };
  fields?: { url?: string; newTab?: boolean };
}

const TEXT_FORMAT = {
  bold: 1,
  italic: 1 << 1,
  strikethrough: 1 << 2,
  underline: 1 << 3,
  code: 1 << 4,
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderText(node: LexicalNode): string {
  let html = escapeHtml(node.text ?? "");
  const format = typeof node.format === "number" ? node.format : 0;
  if (format & TEXT_FORMAT.code) html = `<code>${html}</code>`;
  if (format & TEXT_FORMAT.bold) html = `<strong>${html}</strong>`;
  if (format & TEXT_FORMAT.italic) html = `<em>${html}</em>`;
  if (format & TEXT_FORMAT.underline) html = `<u>${html}</u>`;
  if (format & TEXT_FORMAT.strikethrough) html = `<s>${html}</s>`;
  return html;
}

function renderChildren(node: LexicalNode): string {
  return (node.children ?? []).map(renderNode).join("");
}

function renderNode(node: LexicalNode): string {
  switch (node.type) {
    case "text":
      return renderText(node);
    case "paragraph":
      return `<p>${renderChildren(node)}</p>`;
    case "heading": {
      // Every article page already has its own <h1> (the title) — clamp
      // editor-authored headings to h2+ so they can't create a second h1 or
      // otherwise break the page's heading hierarchy.
      const tag = node.tag === "h1" ? "h2" : (node.tag ?? "h2");
      return `<${tag}>${renderChildren(node)}</${tag}>`;
    }
    case "list":
      return node.listType === "number"
        ? `<ol>${renderChildren(node)}</ol>`
        : `<ul>${renderChildren(node)}</ul>`;
    case "listitem":
      return `<li>${renderChildren(node)}</li>`;
    case "quote":
      return `<blockquote>${renderChildren(node)}</blockquote>`;
    case "link": {
      const url = node.fields?.url ?? node.url ?? "#";
      const target = node.fields?.newTab || node.newTab ? ' target="_blank" rel="noopener"' : "";
      return `<a href="${escapeHtml(url)}"${target}>${renderChildren(node)}</a>`;
    }
    case "linebreak":
      return "<br />";
    case "upload": {
      const url = node.value?.url;
      if (!url) return "";
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(node.value?.alt ?? "")}" loading="lazy" />`;
    }
    default:
      return renderChildren(node);
  }
}

export function lexicalToHtml(body: unknown): string {
  const root = (body as { root?: LexicalNode })?.root;
  if (!root) return "";
  return renderChildren(root);
}
