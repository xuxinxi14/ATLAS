import {
  Compartment,
  EditorState,
  StateField,
  type Extension,
} from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  syntaxTree,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import {
  markdown,
  insertNewlineContinueMarkup,
} from "@codemirror/lang-markdown";
import { searchKeymap } from "@codemirror/search";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
  placeholder,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { renderStudioMarkdown, type StudioMarkdownContext } from "./markdown";
import { escapeHtml } from "../html";
import "./live-editor.css";

export type StudioEditorMode = "edit" | "source" | "preview";
export { renderStudioMarkdown, studioHeadingId } from "./markdown";

interface MountOptions {
  host: HTMLElement;
  key: string;
  body: string;
  mode: StudioEditorMode;
  readOnly: boolean;
  context: StudioMarkdownContext;
  onChange: (value: string, lines: number) => void;
  onSave: () => void;
  onToggleRead: () => void;
  initialSelection?: { from: number; to: number; scrollTop: number };
}

let current: EditorView | undefined;
let currentKey = "";
let callbacks: MountOptions | undefined;
const modeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const cache = new Map<string, { state: EditorState; scrollTop: number }>();
let renderedBlockCache = new Map<string, string>();
let restoreEditorFocus = false;

function selectionIntersects(state: EditorState, from: number, to: number) {
  return state.selection.ranges.some(
    (range) => range.from <= to && range.to >= from,
  );
}

class RenderedBlock extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly source: string,
    readonly html: string,
  ) {
    super();
  }
  eq(other: RenderedBlock) {
    return (
      this.from === other.from &&
      this.to === other.to &&
      this.html === other.html
    );
  }
  toDOM(view: EditorView) {
    const root = document.createElement("div");
    root.className = "studio-rendered-block studio-markdown-content";
    root.innerHTML = this.html;
    root.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      view.dispatch({
        selection: { anchor: Math.min(this.from + 1, this.to) },
      });
      view.focus();
    });
    return root;
  }
  ignoreEvent() {
    return false;
  }
}

/** Block widgets are supplied directly by a state field, as CodeMirror requires. */
const renderedBlocks = StateField.define<DecorationSet>({
  create(state) {
    return buildBlocks(state);
  },
  update(value, tr) {
    if (
      tr.docChanged ||
      tr.selection ||
      syntaxTree(tr.startState) !== syntaxTree(tr.state)
    )
      return buildBlocks(tr.state);
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function buildBlocks(state: EditorState): DecorationSet {
  if (!callbacks) return Decoration.none;
  const ranges: ReturnType<Decoration["range"]>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      const name = node.name;
      if (!["Table", "FencedCode", "Blockquote", "Paragraph"].includes(name))
        return;
      const source = state.sliceDoc(node.from, node.to);
      const render =
        name === "Table" ||
        name === "FencedCode" ||
        (name === "Blockquote" && /^\s*>\s*\[![a-z]+\]/i.test(source)) ||
        (name === "Paragraph" &&
          (/^\s*\$\$[\s\S]*\$\$\s*$/.test(source) ||
            /^\s*!\[[^\]]*\]\([^\n]+\)\s*$/.test(source) ||
            /^\s*!\[\[[^\]\n]+\]\]\s*$/.test(source)));
      if (!render) return;
      if (!selectionIntersects(state, node.from, node.to)) {
        let html = renderedBlockCache.get(source);
        if (html === undefined) {
          html = renderStudioMarkdown(source, callbacks!.context);
          renderedBlockCache.set(source, html);
          if (renderedBlockCache.size > 200)
            renderedBlockCache.delete(renderedBlockCache.keys().next().value!);
        }
        if (html)
          ranges.push(
            Decoration.replace({
              widget: new RenderedBlock(node.from, node.to, source, html),
              block: true,
            }).range(node.from, node.to),
          );
      }
      return false;
    },
  });
  return Decoration.set(ranges, true);
}

class TaskWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly checked: boolean,
  ) {
    super();
  }
  eq(other: TaskWidget) {
    return this.from === other.from && this.checked === other.checked;
  }
  toDOM(view: EditorView) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.setAttribute(
      "aria-label",
      this.checked ? "标记为未完成" : "标记为已完成",
    );
    input.addEventListener("mousedown", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      view.dispatch({
        changes: {
          from: this.from + 1,
          to: this.from + 2,
          insert: input.checked ? "x" : " ",
        },
      });
    });
    return input;
  }
  ignoreEvent() {
    return false;
  }
}

class InlinePreviewWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly html: string,
  ) {
    super();
  }
  eq(other: InlinePreviewWidget) {
    return this.from === other.from && this.html === other.html;
  }
  toDOM(view: EditorView) {
    const node = document.createElement("span");
    node.className = "studio-inline-preview studio-markdown-content";
    node.innerHTML = this.html;
    node.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: this.from + 1 } });
      view.focus();
    });
    return node;
  }
  ignoreEvent() {
    return false;
  }
}

function inlineHtml(source: string) {
  if (source.startsWith("=="))
    return `<mark>${escapeHtml(source.slice(2, -2))}</mark>`;
  const html = renderStudioMarkdown(source, callbacks!.context);
  return html.replace(/^<p>/, "").replace(/<\/p>\s*$/, "");
}

function wrapSelection(view: EditorView, marker: string) {
  const selection = view.state.selection.main;
  const selected = view.state.sliceDoc(selection.from, selection.to);
  view.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: `${marker}${selected}${marker}`,
    },
    selection: {
      anchor: selection.from + marker.length,
      head: selection.from + marker.length + selected.length,
    },
  });
  return true;
}

const hiddenMark = Decoration.replace({});
const markClasses: Record<string, string> = {
  StrongEmphasis: "studio-md-strong",
  Emphasis: "studio-md-emphasis",
  Strikethrough: "studio-md-strike",
  InlineCode: "studio-md-inline-code",
  Link: "studio-md-link",
};

const inlinePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      )
        this.decorations = this.build(update.view);
    }
    build(view: EditorView) {
      const ranges: ReturnType<Decoration["range"]>[] = [];
      for (const viewport of view.visibleRanges) {
        const customRanges: Array<{ from: number; to: number }> = [];
        let pos = view.state.doc.lineAt(viewport.from).from;
        while (pos <= viewport.to && pos <= view.state.doc.length) {
          const line = view.state.doc.lineAt(pos);
          if (!selectionIntersects(view.state, line.from, line.to)) {
            const pattern =
              /!?\[\[[^\]\n]+\]\]|(?<![\\$])\$(?!\$|\s)[^$\n]+?(?<!\s)\$(?!\$)|==[^\n]+?==/g;
            for (const match of line.text.matchAll(pattern)) {
              const from = line.from + match.index!;
              const to = from + match[0].length;
              let ancestor = syntaxTree(view.state).resolveInner(from, 1);
              let insideCode = false;
              while (ancestor) {
                if (
                  [
                    "InlineCode",
                    "FencedCode",
                    "CodeBlock",
                    "Image",
                    "URL",
                  ].includes(ancestor.name)
                ) {
                  insideCode = true;
                  break;
                }
                if (!ancestor.parent) break;
                ancestor = ancestor.parent;
              }
              if (insideCode || !callbacks) continue;
              customRanges.push({ from, to });
              ranges.push(
                Decoration.replace({
                  widget: new InlinePreviewWidget(from, inlineHtml(match[0])),
                }).range(from, to),
              );
            }
          }
          if (line.to >= view.state.doc.length) break;
          pos = line.to + 1;
        }
        syntaxTree(view.state).iterate({
          from: viewport.from,
          to: viewport.to,
          enter(node) {
            if (
              customRanges.some(
                (range) => node.from >= range.from && node.to <= range.to,
              )
            )
              return false;
            const line = view.state.doc.lineAt(node.from);
            const activeLine = selectionIntersects(
              view.state,
              line.from,
              line.to,
            );
            if (/^ATXHeading[1-6]$/.test(node.name)) {
              ranges.push(
                Decoration.line({
                  class: `studio-md-heading studio-md-h${node.name.slice(-1)}`,
                }).range(line.from),
              );
            } else if (node.name === "QuoteMark") {
              ranges.push(
                Decoration.line({ class: "studio-md-quote" }).range(line.from),
              );
            }
            const cls = markClasses[node.name];
            if (cls && node.to > node.from)
              ranges.push(
                Decoration.mark({ class: cls }).range(node.from, node.to),
              );
            if (!activeLine) {
              if (node.name === "Image" && callbacks) {
                const raw = view.state.sliceDoc(node.from, node.to);
                ranges.push(
                  Decoration.replace({
                    widget: new InlinePreviewWidget(node.from, inlineHtml(raw)),
                  }).range(node.from, node.to),
                );
                return false;
              }
              if (
                [
                  "HeaderMark",
                  "EmphasisMark",
                  "StrikethroughMark",
                  "CodeMark",
                  "LinkMark",
                  "QuoteMark",
                  "URL",
                ].includes(node.name)
              ) {
                let end = node.to;
                if (
                  node.name === "HeaderMark" &&
                  view.state.sliceDoc(end, end + 1) === " "
                )
                  end++;
                if (end > node.from)
                  ranges.push(hiddenMark.range(node.from, end));
              } else if (
                node.name === "ListMark" &&
                !/^\d/.test(view.state.sliceDoc(node.from, node.to))
              ) {
                const task = node.node.parent?.getChild("Task");
                ranges.push(
                  task
                    ? hiddenMark.range(node.from, node.to)
                    : Decoration.replace({
                        widget: new InlinePreviewWidget(
                          node.from,
                          '<span class="studio-md-bullet">•</span>',
                        ),
                      }).range(node.from, node.to),
                );
              } else if (node.name === "TaskMarker") {
                const checked = /[xX]/.test(
                  view.state.sliceDoc(node.from, node.to),
                );
                ranges.push(
                  Decoration.replace({
                    widget: new TaskWidget(node.from, checked),
                  }).range(node.from, node.to),
                );
              }
            }
          },
        });
      }
      return Decoration.set(ranges, true);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const liveMode: Extension = [renderedBlocks, inlinePreview];
const sourceMode: Extension = syntaxHighlighting(defaultHighlightStyle, {
  fallback: true,
});

export function mountStudioEditor(options: MountOptions) {
  if (current) unmountStudioEditor();
  callbacks = options;
  renderedBlockCache = new Map();
  currentKey = options.key;
  const saved = cache.get(options.key);
  let state = saved?.state;
  if (!state || state.doc.toString() !== options.body) {
    state = EditorState.create({
      doc: options.body,
      extensions: [
        history(),
        markdown({ extensions: [GFM] }),
        EditorView.lineWrapping,
        placeholder("在这里输入 Markdown…"),
        EditorView.contentAttributes.of({
          id: "studio-cm-body",
          "aria-label": "Markdown 正文",
          "aria-multiline": "true",
        }),
        keymap.of([
          {
            key: "Mod-s",
            stopPropagation: true,
            run: () => {
              callbacks?.onSave();
              return true;
            },
          },
          {
            key: "Mod-e",
            stopPropagation: true,
            run: () => {
              callbacks?.onToggleRead();
              return true;
            },
          },
          { key: "Mod-b", run: (view) => wrapSelection(view, "**") },
          { key: "Mod-i", run: (view) => wrapSelection(view, "*") },
          { key: "Enter", run: insertNewlineContinueMarkup },
          ...searchKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        modeCompartment.of(options.mode === "source" ? sourceMode : liveMode),
        readOnlyCompartment.of(EditorState.readOnly.of(options.readOnly)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            callbacks?.onChange(
              update.state.doc.toString(),
              update.state.doc.lines,
            );
        }),
      ],
    });
  } else {
    state = state.update({
      effects: [
        modeCompartment.reconfigure(
          options.mode === "source" ? sourceMode : liveMode,
        ),
        readOnlyCompartment.reconfigure(
          EditorState.readOnly.of(options.readOnly),
        ),
      ],
    }).state;
  }
  current = new EditorView({ state, parent: options.host });
  if (saved) current.scrollDOM.scrollTop = saved.scrollTop;
  if (options.initialSelection) {
    current.dispatch({
      selection: {
        anchor: options.initialSelection.from,
        head: options.initialSelection.to,
      },
    });
    current.scrollDOM.scrollTop = options.initialSelection.scrollTop;
  }
  if (restoreEditorFocus && options.mode !== "preview") current.focus();
  restoreEditorFocus = false;
}

export function unmountStudioEditor() {
  if (!current) return;
  restoreEditorFocus = current.hasFocus;
  cache.set(currentKey, {
    state: current.state,
    scrollTop: current.scrollDOM.scrollTop,
  });
  while (cache.size > 12) cache.delete(cache.keys().next().value!);
  current.destroy();
  current = undefined;
}

export function rekeyStudioEditor(from: string, to: string) {
  if (currentKey === from) currentKey = to;
  const saved = cache.get(from);
  if (saved && from !== to) {
    cache.delete(from);
    cache.set(to, saved);
  }
}

export function setStudioEditorMode(mode: StudioEditorMode) {
  current?.dispatch({
    effects: modeCompartment.reconfigure(
      mode === "source" ? sourceMode : liveMode,
    ),
  });
}

export function insertStudioEditorText(value: string): boolean {
  if (!current) return false;
  current.dispatch(current.state.replaceSelection(value));
  current.focus();
  return true;
}

export function focusStudioEditor() {
  current?.focus();
}
export function studioEditorScrollElement() {
  return current?.scrollDOM;
}
