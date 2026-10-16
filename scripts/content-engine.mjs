import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { escapeHtml } from "../src/html.ts";

const VALID_TYPES = new Set(["concept", "skill", "troubleshooting", "snippet"]);
const VALID_STATUSES = new Set([
  "draft",
  "todo",
  "learning",
  "proficient",
  "review",
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(str) {
  if (typeof str !== "string" || !DATE_RE.test(str)) return false;
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Lightweight, zero-dependency YAML Front Matter parser supporting scalars,
 * inline arrays `[a, b]`, and block lists `- item`.
 */
export function parseFrontMatter(rawContent, fileLabel = "unknown.md") {
  const normalized = rawContent.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { data: {}, body: normalized, hasFrontMatter: false };
  }
  const endIdx = normalized.indexOf("\n---\n", 4);
  const endIdxEof =
    endIdx === -1 && normalized.endsWith("\n---")
      ? normalized.length - 4
      : endIdx;
  if (endIdxEof === -1) {
    throw new Error(`${fileLabel}：Front Matter 未闭合（缺少结束 ---）`);
  }
  const yamlBlock = normalized.slice(4, endIdxEof);
  const body = normalized.slice(endIdxEof + 5);
  const data = {};
  const lines = yamlBlock.split("\n");
  let currentListKey = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ") && currentListKey) {
      const itemVal = unquoteYamlValue(trimmed.slice(2).trim());
      data[currentListKey].push(itemVal);
      continue;
    }

    currentListKey = null;
    const colonIdx = rawLine.indexOf(":");
    if (colonIdx === -1) {
      throw new Error(
        `${fileLabel}：Front Matter 第 ${i + 2} 行格式无效：${rawLine}`,
      );
    }
    const key = rawLine.slice(0, colonIdx).trim();
    const rest = rawLine.slice(colonIdx + 1).trim();

    if (rest === "") {
      data[key] = [];
      currentListKey = key;
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      const inner = rest.slice(1, -1).trim();
      data[key] = inner
        ? inner
            .split(",")
            .map((part) => unquoteYamlValue(part.trim()))
            .filter((part) => part.length > 0)
        : [];
    } else {
      data[key] = unquoteYamlValue(rest);
    }
  }

  return { data, body, hasFrontMatter: true };
}

function unquoteYamlValue(val) {
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

function loadGitDateMap(repoRoot) {
  const map = new Map();
  if (!existsSync(path.join(repoRoot, ".git"))) return map;
  try {
    const out = execFileSync(
      "git",
      ["log", "--format=DATE:%cs", "--name-only", "--", "content"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    if (!out) return map;
    let currentDate = null;
    for (const rawLine of out.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("DATE:")) {
        currentDate = line.slice(5);
      } else if (currentDate) {
        const norm = line.replaceAll("\\", "/");
        const existing = map.get(norm);
        if (!existing) {
          map.set(norm, { created: currentDate, updated: currentDate });
        } else {
          existing.created = currentDate;
        }
      }
    }
  } catch {
    // Fallback to filesystem timestamps when git history is unavailable
  }
  return map;
}

export function slugifyHeading(text, seen = new Map()) {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/[`*_~[\]()<>!@#$%^&+=|\\:;"'?,./]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

export function stripMarkdownInline(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .trim();
}

/**
 * Formats LaTeX math into clean, safe HTML markup with readable typographic symbols
 * so formulas render crisply both online and offline without external script injection.
 */
export function renderMathToHtml(tex, displayMode = false) {
  let formatted = escapeHtml(tex.trim());
  // Handle \text{...}
  formatted = formatted.replace(
    /\\text\{([^{}]*)\}/g,
    '<span class="math-roman">$1</span>',
  );
  // Handle \frac{a}{b}
  for (let pass = 0; pass < 2; pass++) {
    formatted = formatted.replace(
      /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
      '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>',
    );
  }
  const symbols = [
    ["\\rightleftharpoons", "⇌"],
    ["\\longrightarrow", "⟶"],
    ["\\rightarrow", "→"],
    ["\\leftarrow", "←"],
    ["\\Delta", "Δ"],
    ["\\alpha", "α"],
    ["\\beta", "β"],
    ["\\gamma", "γ"],
    ["\\pi", "π"],
    ["\\mu", "μ"],
    ["\\chi", "χ"],
    ["\\le", "≤"],
    ["\\ge", "≥"],
    ["\\neq", "≠"],
    ["\\cdot", "·"],
    ["\\times", "×"],
    ["\\AA", "Å"],
    ["\\left(", "("],
    ["\\right)", ")"],
  ];
  for (const [k, v] of symbols) {
    formatted = formatted.replaceAll(k, v);
  }
  formatted = formatted.replace(/\\(max|min|log|ln|sin|cos|tan)/g, "$1");
  formatted = formatted.replace(/_\{([^{}]+)\}/g, "<sub>$1</sub>");
  formatted = formatted.replace(/_([a-zA-Z0-9+-])/g, "<sub>$1</sub>");
  formatted = formatted.replace(/\^\{([^{}]+)\}/g, "<sup>$1</sup>");
  formatted = formatted.replace(/\^([a-zA-Z0-9+-])/g, "<sup>$1</sup>");

  const tag = displayMode ? "div" : "span";
  const cls = displayMode ? "atlas-math-block" : "atlas-math-inline";
  return `<${tag} class="${cls}" data-latex="${escapeHtml(tex.trim())}">${formatted}</${tag}>`;
}

/**
 * Renders inline Markdown safely (escaping all raw HTML first).
 */
export function renderInlineMarkdown(text, context) {
  const placeholders = [];
  const stash = (html) => {
    const token = `\u0000P${placeholders.length}\u0000`;
    placeholders.push(html);
    return token;
  };

  // 1. Inline code `...`
  let working = text.replace(/`([^`]+)`/g, (_, code) =>
    stash(`<code class="atlas-inline-code">${escapeHtml(code)}</code>`),
  );

  // 2. Inline math $...$
  working = working.replace(/\$([^$\n]+)\$/g, (_, math) =>
    stash(renderMathToHtml(math, false)),
  );

  // 3. Images ![alt](src)
  working = working.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, rawSrc) => {
    const resolvedSrc = context.resolveImage
      ? context.resolveImage(rawSrc.trim(), alt)
      : rawSrc.trim();
    return stash(
      `<figure class="atlas-figure"><img src="${escapeHtml(resolvedSrc)}" alt="${escapeHtml(alt)}" loading="lazy" data-atlas-image="${escapeHtml(resolvedSrc)}" />${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ""}</figure>`,
    );
  });

  // 4. Links [label](href)
  working = working.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawHref) => {
    const href = rawHref.trim();
    const resolved = context.resolveLink
      ? context.resolveLink(href)
      : { href, external: /^https?:\/\//i.test(href) };
    const safeLabel = escapeHtml(label);
    if (resolved.external) {
      return stash(
        `<a href="${escapeHtml(resolved.href)}" class="atlas-ext-link" target="_blank" rel="noopener noreferrer">${safeLabel} <span aria-hidden="true">↗</span></a>`,
      );
    }
    return stash(
      `<a href="${escapeHtml(resolved.href)}" class="atlas-int-link" data-entry-link="${escapeHtml(resolved.entrySlug || "")}">${safeLabel}</a>`,
    );
  });

  // 5. Escape any remaining raw HTML (<script>, <iframe>, tags, etc.)
  working = escapeHtml(working);

  // 6. Bold & Italic
  working = working.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  working = working.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // 7. Restore stashed tokens
  return working.replace(/\u0000P(\d+)\u0000/g, (_, idx) => placeholders[Number(idx)]);
}

/**
 * Full safe Markdown block parser producing HTML, TOC, Quickstart HTML, and findings list.
 */
export function renderMarkdownDocument(body, context = {}) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const toc = [];
  const seenHeadings = new Map();
  const htmlBlocks = [];
  const quickstartBlocks = [];
  const findings = [];

  let inQuickstart = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = trimmed.match(/^```([\w+-]*)\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "text";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      const rawCode = codeLines.join("\n");
      const blockHtml = `<div class="atlas-code-block" data-lang="${escapeHtml(lang)}"><div class="atlas-code-header"><span class="atlas-code-lang">${escapeHtml(lang.toUpperCase())}</span><button type="button" class="atlas-code-copy" data-copy-code="${escapeHtml(rawCode)}">COPY</button></div><pre><code>${escapeHtml(rawCode)}</code></pre></div>`;
      htmlBlocks.push(blockHtml);
      if (inQuickstart) quickstartBlocks.push(blockHtml);
      continue;
    }

    // Display math block $$...$$
    if (trimmed.startsWith("$$")) {
      const mathLines = [];
      if (trimmed.endsWith("$$") && trimmed.length > 4) {
        mathLines.push(trimmed.slice(2, -2));
        i++;
      } else {
        const firstLine = trimmed.slice(2).trim();
        if (firstLine) mathLines.push(firstLine);
        i++;
        while (i < lines.length && !lines[i].trim().endsWith("$$")) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const last = lines[i].trim().slice(0, -2).trim();
          if (last) mathLines.push(last);
          i++;
        }
      }
      const blockHtml = renderMathToHtml(mathLines.join("\n"), true);
      htmlBlocks.push(blockHtml);
      if (inQuickstart) quickstartBlocks.push(blockHtml);
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawHeading = headingMatch[2].trim();
      const plainHeading = stripMarkdownInline(rawHeading);
      const id = slugifyHeading(plainHeading, seenHeadings);

      if (level === 2) {
        inQuickstart =
          plainHeading.includes("快速复习") ||
          plainHeading.toLowerCase().includes("quickstart");
      } else if (level === 1) {
        inQuickstart = false;
      }

      if (level >= 2 && level <= 3) {
        toc.push({ id, text: plainHeading, level });
      }

      const inlineHtml = renderInlineMarkdown(rawHeading, context);
      if (level > 1) {
        htmlBlocks.push(
          `<h${level} id="${escapeHtml(id)}" class="atlas-heading atlas-h${level}"><a href="#${escapeHtml(id)}" class="atlas-heading-anchor" aria-hidden="true">#</a>${inlineHtml}</h${level}>`,
        );
      }
      i++;
      continue;
    }

    // GFM Table
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])
    ) {
      const parseCells = (rowStr) =>
        rowStr
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const headers = parseCells(lines[i]);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        rows.push(parseCells(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${headers.map((h) => `<th>${renderInlineMarkdown(h, context)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          (r) =>
            `<tr>${headers.map((_, colIdx) => `<td>${renderInlineMarkdown(r[colIdx] ?? "", context)}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody>`;
      const tableHtml = `<div class="atlas-table-wrap"><table class="atlas-table">${thead}${tbody}</table></div>`;
      htmlBlocks.push(tableHtml);
      if (inQuickstart) quickstartBlocks.push(tableHtml);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const quoteHtml = `<blockquote class="atlas-blockquote"><p>${renderInlineMarkdown(quoteLines.join(" "), context)}</p></blockquote>`;
      htmlBlocks.push(quoteHtml);
      if (inQuickstart) quickstartBlocks.push(quoteHtml);
      continue;
    }

    // Lists (unordered / ordered / task list)
    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const isOrdered = /^\d+\.\s+/.test(trimmed);
      const listTag = isOrdered ? "ol" : "ul";
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const itemRaw = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "").trim();
        const taskMatch = itemRaw.match(/^\[([ xX])\]\s+(.+)$/);
        if (taskMatch) {
          const checked = taskMatch[1].toLowerCase() === "x";
          const itemText = taskMatch[2];
          items.push(
            `<li class="atlas-task-item"><input type="checkbox" disabled ${checked ? "checked" : ""} /><span>${renderInlineMarkdown(itemText, context)}</span></li>`,
          );
          if (findings.length < 6) findings.push(stripMarkdownInline(itemText));
        } else {
          items.push(`<li>${renderInlineMarkdown(itemRaw, context)}</li>`);
          if (findings.length < 6) findings.push(stripMarkdownInline(itemRaw));
        }
        i++;
      }
      const listHtml = `<${listTag} class="atlas-list">${items.join("")}</${listTag}>`;
      htmlBlocks.push(listHtml);
      if (inQuickstart) quickstartBlocks.push(listHtml);
      continue;
    }

    // Standard Paragraph
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("$$") &&
      !lines[i].trim().startsWith(">") &&
      !/^([-*]|\d+\.)\s+/.test(lines[i].trim()) &&
      !(
        lines[i].trim().includes("|") &&
        i + 1 < lines.length &&
        /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])
      )
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    const rawPara = paraLines.join(" ");
    const paraHtml = `<p>${renderInlineMarkdown(rawPara, context)}</p>`;
    htmlBlocks.push(paraHtml);
    if (inQuickstart) quickstartBlocks.push(paraHtml);
    if (findings.length < 6 && rawPara.length > 10) {
      findings.push(stripMarkdownInline(rawPara));
    }
  }

  return {
    html: htmlBlocks.join("\n"),
    quickstartHtml: quickstartBlocks.join("\n"),
    toc,
    findings,
  };
}

async function collectMarkdownFiles(dir, rootDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "assets") continue;
      files.push(...(await collectMarkdownFiles(fullPath, rootDir)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      !(dir === rootDir && entry.name.toLowerCase() === "readme.md")
    ) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

/**
 * Core ATLAS Content Pipeline: scans, auto-infers, validates, resolves images/links,
 * and builds the manifest, search index, and telemetry data.
 */
export async function buildKnowledgeBase(options = {}) {
  const repoRoot = options.repoRoot ?? path.resolve(".");
  const contentDir =
    options.contentDir ?? path.join(repoRoot, "content");
  const publicDir = options.publicDir ?? path.join(repoRoot, "public");
  const copyAssets = options.copyAssets ?? false;
  const nowDate = options.nowDate ?? "2026-10-16";

  const categoriesPath =
    options.categoriesPath ?? path.join(contentDir, "categories.json");
  const categoriesConfig = JSON.parse(
    await fs.readFile(categoriesPath, "utf8"),
  );
  const portals = categoriesConfig.portals ?? [];
  const portalMap = new Map(portals.map((p) => [p.id, p]));
  if (categoriesConfig.inbox) {
    portalMap.set(categoriesConfig.inbox.id, categoriesConfig.inbox);
  }

  const mdFiles = await collectMarkdownFiles(contentDir);
  if (mdFiles.length === 0) {
    throw new Error(`content 目录为空：未在 ${contentDir} 中找到任何 Markdown 知识条目`);
  }

  const errors = [];
  const rawEntries = [];
  const gitDateMap = loadGitDateMap(repoRoot);

  // Pass 1: Parse Front Matter & Auto-infer metadata
  for (const filePath of mdFiles) {
    const relPath = path
      .relative(contentDir, filePath)
      .replaceAll("\\", "/");
    const fileLabel = `content/${relPath}`;
    const rawText = await fs.readFile(filePath, "utf8");
    let parsed;
    try {
      parsed = parseFrontMatter(rawText, fileLabel);
    } catch (err) {
      errors.push(err.message);
      continue;
    }

    const { data: fm, body } = parsed;
    const pathParts = relPath.split("/");
    const folderCategory = pathParts.length > 1 ? pathParts[0] : "inbox";
    const fileStem = path.basename(relPath, ".md");

    // 1. Category auto-inference
    const category = fm.category ? String(fm.category).trim() : folderCategory;
    if (!portalMap.has(category)) {
      errors.push(
        `${fileLabel}.category：未知分类 "${category}"（允许值：${[...portalMap.keys()].join(", ")}）`,
      );
    }

    // 2. Title auto-inference
    const h1Match = body.match(/^#\s+(.+)$/m);
    const inferredTitle = h1Match
      ? stripMarkdownInline(h1Match[1])
      : fileStem;
    const title = fm.title !== undefined ? String(fm.title).trim() : inferredTitle;
    if (!title) {
      errors.push(`${fileLabel}.title：标题不能为空`);
    }

    // 3. Slug & ID auto-inference
    const defaultSlug = `${category}/${fileStem}`;
    const slug = (fm.slug ? String(fm.slug).trim() : defaultSlug).replace(
      /^\/+|\/+$/g,
      "",
    );
    const id = fm.id
      ? String(fm.id).trim()
      : slug.replaceAll("/", "-").toLowerCase();

    // 4. Type auto-inference
    const h2Count = (body.match(/^##\s+/gm) ?? []).length;
    const defaultType =
      body.trim().length < 450 || h2Count <= 2 ? "snippet" : "skill";
    const type = fm.type ? String(fm.type).trim() : defaultType;
    if (!VALID_TYPES.has(type)) {
      errors.push(
        `${fileLabel}.type：未知知识类型 "${type}"（允许值：concept, skill, troubleshooting, snippet）`,
      );
    }

    // 5. Status auto-inference
    const defaultStatus = category === "inbox" ? "draft" : "proficient";
    const status = fm.status ? String(fm.status).trim() : defaultStatus;
    if (!VALID_STATUSES.has(status)) {
      errors.push(
        `${fileLabel}.status：未知状态 "${status}"（允许值：draft, todo, learning, proficient, review）`,
      );
    }

    // 6. Dates auto-inference & validation
    const gitDates = gitDateMap.get(fileLabel);
    const stat = await fs.stat(filePath);
    const mtimeDate = stat.mtime.toISOString().slice(0, 10);
    const created = fm.created
      ? String(fm.created).trim()
      : gitDates?.created || mtimeDate;
    const updated = fm.updated
      ? String(fm.updated).trim()
      : gitDates?.updated || created;

    if (!isValidCalendarDate(created)) {
      errors.push(
        `${fileLabel}.created：日期 "${created}" 无效，必须为合法的 YYYY-MM-DD`,
      );
    }
    if (!isValidCalendarDate(updated)) {
      errors.push(
        `${fileLabel}.updated：日期 "${updated}" 无效，必须为合法的 YYYY-MM-DD`,
      );
    }

    // 7. Summary auto-inference
    let summary = fm.summary !== undefined ? String(fm.summary).trim() : "";
    if (!summary && fm.summary === undefined) {
      const bodyWithoutH1 = body.replace(/^#\s+.+$/m, "").trim();
      const firstLine = bodyWithoutH1
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("#") && !l.startsWith("```"));
      summary = firstLine
        ? stripMarkdownInline(firstLine).slice(0, 110)
        : title;
    }
    if (!summary) {
      errors.push(`${fileLabel}.summary：摘要不能为空`);
    }

    // 8. Tags, URLs, Relations, Aliases
    const portalInfo = portalMap.get(category);
    const tags = Array.isArray(fm.tags) && fm.tags.length > 0
      ? fm.tags.map((t) => String(t).trim()).filter(Boolean)
      : [portalInfo?.title ?? category, type];

    const sourceUrls = Array.isArray(fm.source_urls)
      ? fm.source_urls.map(String)
      : [];
    for (const urlStr of sourceUrls) {
      try {
        const parsedUrl = new URL(urlStr);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("invalid protocol");
        }
      } catch {
        errors.push(
          `${fileLabel}.source_urls：包含无效或不安全的链接 "${urlStr}"（仅允许 http/https）`,
        );
      }
    }

    const prerequisites = Array.isArray(fm.prerequisites)
      ? fm.prerequisites.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const related = Array.isArray(fm.related)
      ? fm.related.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const aliases = Array.isArray(fm.aliases)
      ? fm.aliases
          .map((v) => String(v).trim().replace(/^\/+|\/+$/g, ""))
          .filter(Boolean)
      : [];

    rawEntries.push({
      id,
      slug,
      title,
      category,
      subcategory: fm.subcategory ? String(fm.subcategory).trim() : "general",
      type,
      status,
      tags,
      summary,
      created,
      updated,
      version_scope: fm.version_scope
        ? String(fm.version_scope).trim()
        : "通用版本",
      source_urls: sourceUrls,
      prerequisites,
      related,
      aliases,
      filePath,
      relPath,
      fileLabel,
      body,
      autoInferred: !parsed.hasFrontMatter,
    });
  }

  // Pass 2: Check ID, Slug, and Alias uniqueness
  const idOwner = new Map();
  const slugOwner = new Map();

  for (const entry of rawEntries) {
    if (idOwner.has(entry.id)) {
      errors.push(
        `${entry.fileLabel}：重复的 id "${entry.id}"（已存在于 ${idOwner.get(entry.id).fileLabel}）`,
      );
    } else {
      idOwner.set(entry.id, entry);
    }

    if (slugOwner.has(entry.slug)) {
      errors.push(
        `${entry.fileLabel}：重复的 slug "${entry.slug}"（已存在于 ${slugOwner.get(entry.slug).fileLabel}）`,
      );
    } else {
      slugOwner.set(entry.slug, entry);
    }

    for (const alias of entry.aliases) {
      if (slugOwner.has(alias)) {
        errors.push(
          `${entry.fileLabel}：aliases 中的 "${alias}" 与其他条目 slug/alias 冲突`,
        );
      } else {
        slugOwner.set(alias, entry);
      }
    }
  }

  // Pass 3: Validate internal links, prerequisites, related entries, images & render HTML
  const entries = [];
  const copiedMediaFiles = [];

  for (const entry of rawEntries) {
    for (const reqId of entry.prerequisites) {
      if (!idOwner.has(reqId)) {
        errors.push(
          `${entry.fileLabel}.prerequisites：引用的前置知识条目 "${reqId}" 不存在`,
        );
      }
    }
    for (const relId of entry.related) {
      if (!idOwner.has(relId)) {
        errors.push(
          `${entry.fileLabel}.related：引用的关联知识条目 "${relId}" 不存在`,
        );
      }
    }

    const images = [];
    const pendingAssetCopies = [];

    const resolveImage = (rawSrc) => {
      if (/^(javascript|data|vbscript):/i.test(rawSrc)) {
        errors.push(
          `${entry.fileLabel}：包含不安全的图片协议 "${rawSrc}"`,
        );
        return "";
      }
      if (/^https?:\/\//i.test(rawSrc) || rawSrc.startsWith("/")) {
        errors.push(
          `${entry.fileLabel}：禁止在 Markdown 中写死域名或根路径图片 "${rawSrc}"，请使用同级 ./assets/ 或 media/<id>/`,
        );
        return rawSrc;
      }

      const cleanRel = rawSrc.replace(/^\.\//, "");
      let sourceFile;
      let outputMediaPath;

      if (cleanRel.startsWith("media/")) {
        sourceFile = path.join(publicDir, cleanRel);
        outputMediaPath = cleanRel;
      } else {
        sourceFile = path.resolve(path.dirname(entry.filePath), rawSrc);
        const fileName = path.basename(sourceFile);
        outputMediaPath = `media/entries/${entry.id}/${fileName}`;
        pendingAssetCopies.push({ sourceFile, outputMediaPath });
      }

      if (!existsSync(sourceFile)) {
        errors.push(
          `${entry.fileLabel}：引用的图片文件不存在 "${rawSrc}"（查找路径：${sourceFile}）`,
        );
      } else {
        images.push(outputMediaPath);
      }
      return outputMediaPath;
    };

    const resolveLink = (rawHref) => {
      if (/^(javascript|vbscript|data):/i.test(rawHref)) {
        errors.push(`${entry.fileLabel}：包含不安全的链接协议 "${rawHref}"`);
        return { href: "#", external: false };
      }
      if (/^https?:\/\//i.test(rawHref)) {
        return { href: rawHref, external: true };
      }
      if (rawHref.startsWith("#")) {
        return { href: rawHref, external: false };
      }
      const cleanTarget = rawHref
        .replace(/^\.\//, "")
        .replace(/\.md$/i, "")
        .replace(/^\/+|\/+$/g, "");
      const targetEntry =
        idOwner.get(cleanTarget) ?? slugOwner.get(cleanTarget);
      if (!targetEntry) {
        errors.push(
          `${entry.fileLabel}：内部知识链接目标不存在 "${rawHref}"`,
        );
        return { href: `#/entry/${cleanTarget}`, external: false };
      }
      return {
        href: `#/entry/${targetEntry.slug}`,
        external: false,
        entrySlug: targetEntry.slug,
      };
    };

    const rendered = renderMarkdownDocument(entry.body, {
      resolveImage,
      resolveLink,
    });

    if (copyAssets && errors.length === 0) {
      for (const copyJob of pendingAssetCopies) {
        if (existsSync(copyJob.sourceFile)) {
          const destFile = path.join(publicDir, copyJob.outputMediaPath);
          await fs.mkdir(path.dirname(destFile), { recursive: true });
          await fs.copyFile(copyJob.sourceFile, destFile);
          copiedMediaFiles.push(copyJob.outputMediaPath);
        }
      }
    }

    const plainBody = stripMarkdownInline(entry.body);
    const portalInfo = portalMap.get(entry.category);

    entries.push({
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      category: entry.category,
      categoryTitle: portalInfo?.title ?? entry.category,
      en: portalInfo?.en ?? entry.category.toUpperCase(),
      department: portalInfo?.department ?? "知识档案",
      subcategory: entry.subcategory,
      type: entry.type,
      status: entry.status,
      tags: entry.tags,
      summary: entry.summary,
      created: entry.created,
      updated: entry.updated,
      version_scope: entry.version_scope,
      source_urls: entry.source_urls,
      prerequisites: entry.prerequisites,
      related: entry.related,
      aliases: entry.aliases,
      relPath: `content/${entry.relPath}`,
      autoInferred: entry.autoInferred,
      images,
      toc: rendered.toc,
      quickstartHtml: rendered.quickstartHtml,
      html: rendered.html,
      findings:
        rendered.findings.length > 0 ? rendered.findings : [entry.summary],
      plainText: plainBody,
    });
  }

  if (errors.length > 0) {
    throw new Error(`ATLAS 内容校验失败：\n- ${errors.join("\n- ")}`);
  }

  // Sort entries deterministically: portal order first, then updated desc, then title
  const portalOrder = new Map(portals.map((p, idx) => [p.id, idx]));
  portalOrder.set("inbox", 99);

  entries.sort((a, b) => {
    const pa = portalOrder.get(a.category) ?? 50;
    const pb = portalOrder.get(b.category) ?? 50;
    if (pa !== pb) return pa - pb;
    if (a.updated !== b.updated) return b.updated.localeCompare(a.updated);
    return a.id.localeCompare(b.id);
  });

  // Assign visual display codes per portal (e.g., T-001, C-001, R-001...) and global visual code
  const portalCounters = new Map();
  entries.forEach((entry, idx) => {
    const pInfo = portalMap.get(entry.category);
    const prefix = pInfo?.codePrefix ?? "X";
    const nextNum = (portalCounters.get(entry.category) ?? 0) + 1;
    portalCounters.set(entry.category, nextNum);
    entry.visualCode = `${prefix}-${String(nextNum).padStart(3, "0")}`;
    entry.globalCode = `X-${String(idx + 1).padStart(3, "0")}`;
  });

  // Compute Telemetry & Review Queue
  const nowMs = Date.parse(`${nowDate}T00:00:00Z`);
  const publishedEntries = entries.filter((e) => e.category !== "inbox");
  const statusCounts = {
    proficient: 0,
    learning: 0,
    todo: 0,
    review: 0,
    draft: 0,
  };
  const typeCounts = {
    concept: 0,
    skill: 0,
    troubleshooting: 0,
    snippet: 0,
  };
  const activityByDate = {};
  const reviewQueue = [];

  for (const entry of entries) {
    statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
    typeCounts[entry.type] = (typeCounts[entry.type] ?? 0) + 1;
    activityByDate[entry.updated] = (activityByDate[entry.updated] ?? 0) + 1;

    const updatedMs = Date.parse(`${entry.updated}T00:00:00Z`);
    const daysSinceUpdate = Math.floor((nowMs - updatedMs) / 86_400_000);
    if (
      entry.status === "review" ||
      (entry.category !== "inbox" && daysSinceUpdate >= 180)
    ) {
      reviewQueue.push({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        category: entry.category,
        categoryTitle: entry.categoryTitle,
        updated: entry.updated,
        daysSinceUpdate,
        reason:
          entry.status === "review"
            ? "已标记为需校准 (review)"
            : `距上次校准已 ${daysSinceUpdate} 天`,
      });
    }
  }

  const portalStats = portals.map((p) => {
    const items = entries.filter((e) => e.category === p.id);
    const proficientCount = items.filter(
      (e) => e.status === "proficient",
    ).length;
    return {
      id: p.id,
      title: p.title,
      en: p.en,
      codePrefix: p.codePrefix,
      description: p.description,
      total: items.length,
      proficient: proficientCount,
      learning: items.filter((e) => e.status === "learning").length,
      todo: items.filter((e) => e.status === "todo").length,
      review: items.filter((e) => e.status === "review").length,
    };
  });

  const telemetry = {
    generatedAt: nowDate,
    totalEntries: publishedEntries.length,
    inboxCount: entries.length - publishedEntries.length,
    statusCounts,
    typeCounts,
    portalStats,
    reviewQueue,
    recentEntries: [...publishedEntries]
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .slice(0, 6)
      .map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        category: e.category,
        categoryTitle: e.categoryTitle,
        type: e.type,
        status: e.status,
        updated: e.updated,
        visualCode: e.visualCode,
      })),
    activityByDate,
  };

  const searchIndex = entries.map((e) => ({
    id: e.id,
    slug: e.slug,
    visualCode: e.visualCode,
    globalCode: e.globalCode,
    title: e.title,
    category: e.category,
    categoryTitle: e.categoryTitle,
    type: e.type,
    status: e.status,
    tags: e.tags,
    summary: e.summary,
    headings: e.toc.map((t) => t.text).join(" "),
    body: e.plainText.slice(0, 2000),
    updated: e.updated,
  }));

  return {
    portals,
    inbox: categoriesConfig.inbox,
    entries,
    telemetry,
    searchIndex,
    copiedMediaFiles,
  };
}

export function formatEntryTextDownload(entry) {
  const tagsLine = entry.tags.join(", ");
  const sources =
    entry.source_urls.length > 0 ? entry.source_urls.join("\n- ") : "本地实践记录";
  return `\uFEFFATLAS · PERSONAL KNOWLEDGE TERMINAL\nFILE ${entry.visualCode} (${entry.id}) / ${entry.title}\n${entry.en} · ${entry.type.toUpperCase()} · STATUS: ${entry.status.toUpperCase()}\n\n所属领域：${entry.categoryTitle} (${entry.category})\n适用范围：${entry.version_scope}\n更新日期：${entry.updated}\n标签：${tagsLine}\n\n【摘要】\n${entry.summary}\n\n【核心要点】\n${entry.findings.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\n【正文内容】\n${entry.plainText}\n\n参考来源：\n- ${sources}\n`;
}
