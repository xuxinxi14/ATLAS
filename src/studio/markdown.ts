import DOMPurify from "dompurify";
import katex from "katex";
import hljs from "highlight.js/lib/common";
import { Marked } from "marked";
import { escapeHtml } from "../html";
import "katex/dist/katex.min.css";

/** Rendering is local and synchronous: it also works in the published offline build. */
export interface StudioMarkdownContext {
  resolveImage: (src: string) => string;
  resolveWiki: (target: string) => string | undefined;
}

const markdown = new Marked({ gfm: true, breaks: false });
export function studioHeadingId(text: string) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[`*_~[\]()<>!@#$%^&+=|\\:;"'?,./]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}
markdown.use({
  extensions: [
    {
      name: "atlasBlockMath",
      level: "block",
      start: (src: string) => src.indexOf("$$"),
      tokenizer(src: string) {
        const match =
          /^ {0,3}\$\$[ \t]*(?:\n([\s\S]+?)\n[ \t]*|([^\n$]+?)[ \t]*)\$\$(?:\n|$)/.exec(
            src,
          );
        if (match)
          return {
            type: "atlasBlockMath",
            raw: match[0],
            text: match[1] ?? match[2],
          };
      },
      renderer(token) {
        return `<div class="studio-math-block">${katex.renderToString(String(token.text), { displayMode: true, throwOnError: false, trust: false })}</div>`;
      },
    },
    {
      name: "atlasInlineMath",
      level: "inline",
      start: (src: string) => src.indexOf("$"),
      tokenizer(src: string) {
        const match = /^\$(?!\$|\s)([^\n$]+?)(?<!\s)\$(?!\$)/.exec(src);
        if (match)
          return { type: "atlasInlineMath", raw: match[0], text: match[1] };
      },
      renderer(token) {
        return katex.renderToString(String(token.text), {
          throwOnError: false,
          trust: false,
        });
      },
    },
    {
      name: "atlasHighlight",
      level: "inline",
      start: (src: string) => src.indexOf("=="),
      tokenizer(src: string) {
        const match = /^==([^\n]+?)==/.exec(src);
        if (match)
          return { type: "atlasHighlight", raw: match[0], text: match[1] };
      },
      renderer(token) {
        return `<mark>${escapeHtml(String(token.text))}</mark>`;
      },
    },
    {
      name: "atlasWikiLink",
      level: "inline",
      start: (src: string) => src.search(/!?\[\[/),
      tokenizer(src: string) {
        const match = /^(!?)\[\[([^\]\n]+)\]\]/.exec(src);
        if (match)
          return {
            type: "atlasWikiLink",
            raw: match[0],
            embed: Boolean(match[1]),
            text: match[2],
          };
      },
      renderer(token) {
        const [target, alias] = String(token.text).split("|");
        const label = escapeHtml(alias || target);
        if (
          token.embed &&
          /\.(png|jpe?g|gif|webp|svg|avif)(?:#.*)?$/i.test(target)
        ) {
          return `<img src="${escapeHtml(target)}" alt="${label}" loading="lazy">`;
        }
        return `<a class="studio-wiki-link" data-wiki-target="${escapeHtml(target)}">${label}</a>`;
      },
    },
  ],
});

export function renderStudioMarkdown(
  source: string,
  context: StudioMarkdownContext,
): string {
  if (!source.trim()) return "";
  const rendered = markdown.parse(source, { async: false });
  const clean = DOMPurify.sanitize(rendered, {
    FORBID_TAGS: ["style", "iframe", "form", "object", "embed"],
    ADD_ATTR: ["data-wiki-target"],
  });
  const template = document.createElement("template");
  template.innerHTML = clean;
  for (const code of template.content.querySelectorAll<HTMLElement>(
    "pre code",
  )) {
    const language = Array.from(code.classList)
      .find((name) => name.startsWith("language-"))
      ?.slice(9);
    if (language && hljs.getLanguage(language)) {
      code.innerHTML = hljs.highlight(code.textContent ?? "", {
        language,
        ignoreIllegals: true,
      }).value;
      code.classList.add("hljs");
    }
  }
  const seenHeadings = new Map<string, number>();
  for (const heading of template.content.querySelectorAll<HTMLElement>(
    "h1, h2, h3, h4, h5, h6",
  )) {
    const base = studioHeadingId(heading.textContent ?? "");
    const count = seenHeadings.get(base) ?? 0;
    seenHeadings.set(base, count + 1);
    heading.id = count ? `${base}-${count}` : base;
  }
  for (const image of template.content.querySelectorAll("img")) {
    const src = image.getAttribute("src") || "";
    const resolved = context.resolveImage(src);
    if (resolved && !/^(?:javascript|vbscript|data):/i.test(resolved.trim()))
      image.setAttribute("src", resolved);
    else image.removeAttribute("src");
    image.loading = "lazy";
  }
  for (const link of template.content.querySelectorAll<HTMLAnchorElement>(
    "a",
  )) {
    const wiki = link.dataset.wikiTarget;
    if (wiki) {
      const href = context.resolveWiki(wiki);
      if (href) link.setAttribute("href", href);
      else link.classList.add("is-unresolved");
    }
    let href = link.getAttribute("href") || "";
    if (!wiki && /^[^:#?]+\.md(?:#.*)?$/i.test(href)) {
      const resolved = context.resolveWiki(href.replace(/^\.\//, ""));
      if (resolved) {
        link.setAttribute("href", resolved);
        href = resolved;
      }
    }
    if (/^https?:/i.test(href)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  }
  for (const quote of template.content.querySelectorAll("blockquote")) {
    const first = quote.firstElementChild;
    const text = first?.firstChild;
    if (!(text instanceof Text)) continue;
    const match = /^\[!([a-z]+)\][+-]?(?:[ \t]+([^\n]*))?/i.exec(text.data);
    if (!match) continue;
    text.data = text.data.slice(match[0].length).replace(/^\s*\n/, "");
    if (!first?.textContent?.trim() && !first?.querySelector("img"))
      first?.remove();
    const callout = document.createElement("aside");
    callout.className = "studio-markdown-callout";
    callout.dataset.callout = match[1].toLowerCase();
    const title = document.createElement("strong");
    title.textContent = match[2]?.trim() || match[1].toUpperCase();
    callout.append(title, ...Array.from(quote.childNodes));
    quote.replaceWith(callout);
  }
  return template.innerHTML;
}
