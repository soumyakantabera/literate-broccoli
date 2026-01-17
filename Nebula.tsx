/* Nebula.tsx
   An advanced Markdown ↔ NebulaXML document editor (single-file React component).

   Dependencies (install in your project):
   - react
   - framer-motion
   - @monaco-editor/react
   - marked
   - dompurify
   - turndown
   - uuid
   - lucide-react
   - shadcn/ui components (Card, Button, Input, Tabs, Dialog, DropdownMenu, ScrollArea, Separator, Badge, Switch)

   Notes:
   - This component is intended for client-side rendering (uses DOMParser, localStorage).
   - In Next.js App Router, add "use client" at the top of this file (already included).
*/

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import TurndownService from "turndown";
import { v4 as uuidv4 } from "uuid";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FormattingToolbar } from "@/components/FormattingToolbar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FileExplorer } from "@/components/FileExplorer";
import { useFileManager } from "@/contexts/FileManagerContext";

import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Code2,
  Command,
  Download,
  FileText,
  History,
  MessageSquarePlus,
  PanelLeft,
  PanelRight,
  Save,
  Search,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

declare global {
  interface Window {
    __nebula_monaco?: any;
  }
}

/**
 * Nebula — Advanced Markdown + XML Document Editor
 * -------------------------------------------------
 * - Markdown is the human-first authoring surface.
 * - NebulaXML is the canonical, schema-friendly base.
 * - Visual mode is a convenient layer over Markdown (HTML render + roundtrip).
 *
 * NebulaXML (informal schema):
 * <nebula version="1.0">
 *   <meta>
 *     <title>...</title>
 *     <updatedAt>ISO</updatedAt>
 *   </meta>
 *   <document>
 *     <heading level="1">...</heading>
 *     <paragraph>Inline nodes...</paragraph>
 *     <list ordered="false">
 *       <item><paragraph>...</paragraph></item>
 *     </list>
 *     <codeBlock lang="">...</codeBlock>
 *     <blockquote>...</blockquote>
 *     <divider/>
 *     <table><row><cell>...</cell></row></table>
 *     <image src="" alt=""/>
 *   </document>
 * </nebula>
 */

// ---------- Utilities ----------

const STORAGE_KEY = "nebula:v1";

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function countWords(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[#>*_~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

function estimateReadingMinutes(wordCount: number) {
  // ~220 wpm default
  return Math.max(1, Math.round(wordCount / 220));
}

type OutlineItem = { id: string; level: number; text: string; line: number };

function extractOutline(md: string): OutlineItem[] {
  const lines = md.split("\n");
  const out: OutlineItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
    if (m) out.push({ id: uuidv4(), level: m[1].length, text: m[2], line: i + 1 });
  }
  return out;
}

function sanitizeHtml(html: string, allowUnsafe = false) {
  if (allowUnsafe) return html;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed"],
    FORBID_ATTR: [/^on/i] as unknown as string[],
  });
}

function isXmlParseError(doc: Document) {
  const errs = doc.getElementsByTagName("parsererror");
  return !!(errs && errs.length);
}

function xmlPretty(xml: string) {
  const PADDING = "  ";
  const reg = /(>)(<)(\/*)/g;
  let formatted = "";
  let pad = 0;
  xml = xml.replace(reg, "$1\n$2$3");
  xml.split("\n").forEach((node) => {
    if (!node.trim()) return;
    let indent = 0;
    if (node.match(/^<\//)) {
      pad = Math.max(0, pad - 1);
    } else if (node.match(/^<[^!?][^>]*[^/]>.*$/) && !node.includes("</")) {
      indent = 1;
    } else if (node.match(/^<[^!?][^>]*>$/) && !node.endsWith("/>") && !node.startsWith("</")) {
      indent = 1;
    }
    formatted += PADDING.repeat(pad) + node.trim() + "\n";
    pad += indent;
  });
  return formatted.trim();
}

// ---------- Markdown <-> NebulaXML ----------

function htmlToNebulaXml(html: string, title = "Untitled") {
  const parser = new DOMParser();
  const doc = document.implementation.createDocument("", "nebula", null);
  const root = doc.documentElement;
  root.setAttribute("version", "1.0");

  const meta = doc.createElement("meta");
  const titleEl = doc.createElement("title");
  titleEl.textContent = title;
  const updatedAt = doc.createElement("updatedAt");
  updatedAt.textContent = nowIso();
  meta.appendChild(titleEl);
  meta.appendChild(updatedAt);

  const body = doc.createElement("document");
  const container = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const div = container.body.firstElementChild;

  const importInline = (parentXml: Element, node: ChildNode) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? "";
      if (t) parentXml.appendChild(doc.createTextNode(t));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const elNode = node as Element;
    const tag = elNode.tagName.toLowerCase();

    const el: Element = (() => {
      if (tag === "strong" || tag === "b") return doc.createElement("bold");
      if (tag === "em" || tag === "i") return doc.createElement("italic");
      if (tag === "del" || tag === "s") return doc.createElement("strike");
      if (tag === "code") return doc.createElement("code");
      if (tag === "a") {
        const a = doc.createElement("link");
        a.setAttribute("href", elNode.getAttribute("href") || "");
        return a;
      }
      if (tag === "br") return doc.createElement("break");
      return doc.createElement("span");
    })();

    parentXml.appendChild(el);
    for (const child of Array.from(elNode.childNodes)) importInline(el, child);
  };

  const importBlock = (node: ChildNode): Element | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || "").trim();
      if (!t) return null;
      const p = doc.createElement("paragraph");
      p.appendChild(doc.createTextNode(t));
      return p;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const elNode = node as Element;
    const tag = elNode.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const h = doc.createElement("heading");
      h.setAttribute("level", tag.slice(1));
      for (const child of Array.from(elNode.childNodes)) importInline(h, child);
      return h;
    }

    if (tag === "p") {
      const p = doc.createElement("paragraph");
      for (const child of Array.from(elNode.childNodes)) importInline(p, child);
      return p;
    }

    if (tag === "ul" || tag === "ol") {
      const list = doc.createElement("list");
      list.setAttribute("ordered", tag === "ol" ? "true" : "false");
      for (const li of Array.from(elNode.querySelectorAll(":scope > li"))) {
        const item = doc.createElement("item");
        const children = Array.from(li.childNodes);
        const hasBlock = children.some(
          (c) =>
            c.nodeType === Node.ELEMENT_NODE &&
            ["p", "ul", "ol", "pre", "blockquote", "table"].includes((c as Element).tagName.toLowerCase())
        );
        if (hasBlock) {
          for (const c of children) {
            const b = importBlock(c);
            if (b) item.appendChild(b);
          }
        } else {
          const p = doc.createElement("paragraph");
          for (const c of children) importInline(p, c);
          item.appendChild(p);
        }
        list.appendChild(item);
      }
      return list;
    }

    if (tag === "pre") {
      const codeEl = elNode.querySelector("code");
      const cb = doc.createElement("codeBlock");
      const klass = codeEl?.getAttribute("class") || "";
      const langMatch = /language-([a-z0-9_+-]+)/i.exec(klass);
      cb.setAttribute("lang", langMatch?.[1] || "");
      cb.textContent = (codeEl?.textContent ?? elNode.textContent ?? "").replace(/\n$/, "");
      return cb;
    }

    if (tag === "blockquote") {
      const bq = doc.createElement("blockquote");
      for (const child of Array.from(elNode.childNodes)) {
        const b = importBlock(child);
        if (b) bq.appendChild(b);
      }
      return bq;
    }

    if (tag === "hr") return doc.createElement("divider");

    if (tag === "table") {
      const t = doc.createElement("table");
      const rows = Array.from(elNode.querySelectorAll("tr"));
      for (const r of rows) {
        const row = doc.createElement("row");
        const cells = Array.from(r.querySelectorAll("th,td"));
        for (const c of cells) {
          const cell = doc.createElement("cell");
          for (const child of Array.from(c.childNodes)) importInline(cell, child);
          row.appendChild(cell);
        }
        t.appendChild(row);
      }
      return t;
    }

    if (tag === "img") {
      const img = doc.createElement("image");
      img.setAttribute("src", elNode.getAttribute("src") || "");
      img.setAttribute("alt", elNode.getAttribute("alt") || "");
      return img;
    }

    const p = doc.createElement("paragraph");
    for (const child of Array.from(elNode.childNodes)) importInline(p, child);
    return p;
  };

  for (const child of Array.from(div?.childNodes ?? [])) {
    const b = importBlock(child);
    if (b) body.appendChild(b);
  }

  root.appendChild(meta);
  root.appendChild(body);

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

function nebulaXmlToMarkdown(xmlString: string): { markdown: string; error: string | null } {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, "application/xml");
  if (isXmlParseError(xml)) return { markdown: "", error: "XML parse error" };

  const root = xml.documentElement;
  if (!root || root.tagName !== "nebula") return { markdown: "", error: "Root element must be <nebula>" };

  const docNode = root.querySelector("document");
  if (!docNode) return { markdown: "", error: "Missing <document>" };

  const inlineToMd = (n: ChildNode): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent || "";
    if (n.nodeType !== Node.ELEMENT_NODE) return "";
    const el = n as Element;
    const tag = el.tagName;

    const inner = Array.from(el.childNodes).map(inlineToMd).join("");

    if (tag === "bold") return `**${inner}**`;
    if (tag === "italic") return `*${inner}*`;
    if (tag === "strike") return `~~${inner}~~`;
    if (tag === "code") return `\`${inner.replace(/`/g, "\\`")}\``;
    if (tag === "link") {
      const href = (el.getAttribute("href") || "").trim();
      return href ? `[${inner || href}](${href})` : inner;
    }
    if (tag === "break") return "\n";
    return inner;
  };

  const blockToMd = (el: Element): string => {
    const tag = el.tagName;

    if (tag === "heading") {
      const level = clamp(parseInt(el.getAttribute("level") || "1", 10), 1, 6);
      return `${"#".repeat(level)} ${Array.from(el.childNodes).map(inlineToMd).join("").trim()}\n`;
    }
    if (tag === "paragraph") {
      const t = Array.from(el.childNodes).map(inlineToMd).join("");
      return `${t.trim()}\n`;
    }
    if (tag === "divider") return `---\n`;
    if (tag === "codeBlock") {
      const lang = (el.getAttribute("lang") || "").trim();
      const text = (el.textContent || "").replace(/\n+$/, "");
      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    }
    if (tag === "blockquote") {
      const inner = Array.from(el.children)
        .map((c) => blockToMd(c as Element))
        .join("\n");
      return (
        inner
          .split("\n")
          .map((l) => (l.trim() ? `> ${l}` : ">"))
          .join("\n") + "\n"
      );
    }
    if (tag === "list") {
      const ordered = (el.getAttribute("ordered") || "false") === "true";
      const items = Array.from(el.children).filter((c) => (c as Element).tagName === "item") as Element[];
      let i = 1;
      return (
        items
          .map((it) => {
            const blocks = Array.from(it.children) as Element[];
            const label = blocks[0] ? blockToMd(blocks[0]).trim() : "";
            const bullet = ordered ? `${i++}. ` : "- ";
            const rest = blocks
              .slice(1)
              .map((b) => blockToMd(b).trim())
              .filter(Boolean)
              .map((t) => t.split("\n").map((l) => `  ${l}`).join("\n"))
              .join("\n");
            return `${bullet}${label}${rest ? `\n${rest}` : ""}`;
          })
          .join("\n") + "\n"
      );
    }
    if (tag === "table") {
      const rows = Array.from(el.children).filter((c) => (c as Element).tagName === "row") as Element[];
      const grid = rows.map((r) =>
        Array.from(r.children)
          .filter((c) => (c as Element).tagName === "cell")
          .map((c) => Array.from(c.childNodes).map(inlineToMd).join("").trim())
      );
      if (!grid.length) return "\n";
      const header = grid[0];
      const sep = header.map(() => "---");
      const mdRows = [
        `| ${header.join(" | ")} |`,
        `| ${sep.join(" | ")} |`,
        ...grid.slice(1).map((r) => `| ${r.join(" | ")} |`),
      ];
      return `\n${mdRows.join("\n")}\n`;
    }
    if (tag === "image") {
      const src = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || "";
      return src ? `![${alt}](${src})\n` : "\n";
    }

    const inner = Array.from(el.children).map((c) => blockToMd(c as Element)).join("\n");
    return `${inner}\n`;
  };

  const blocks = Array.from(docNode.children).map((c) => blockToMd(c as Element).trimEnd());
  const markdown = blocks.join("\n\n").trim() + "\n";
  return { markdown, error: null };
}

function markdownToNebulaXml(markdown: string, title = "Untitled", allowUnsafe = false) {
  marked.setOptions({ gfm: true, breaks: true });
  const rawHtml = marked.parse(markdown || "");
  const clean = sanitizeHtml(rawHtml as string, allowUnsafe);
  const xml = htmlToNebulaXml(clean, title);
  return xmlPretty(xml);
}

type NebulaComment = { id: string; quote: string; note: string; ts: string };

function applyHighlightsToHtml(html: string, comments: NebulaComment[]) {
  if (!comments.length) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  const wrapMatchInTextNode = (textNode: Text, start: number, end: number, comment: NebulaComment) => {
    const text = textNode.nodeValue || "";
    const before = text.slice(0, start);
    const match = text.slice(start, end);
    const after = text.slice(end);

    const span = doc.createElement("span");
    span.setAttribute("data-nebula-comment", comment.id);
    span.className =
      "rounded px-1 bg-amber-200/50 dark:bg-amber-400/20 border border-amber-300/40 dark:border-amber-400/30";
    span.textContent = match;

    const parent = textNode.parentNode;
    if (!parent) return;
    const frag = doc.createDocumentFragment();
    if (before) frag.appendChild(doc.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(doc.createTextNode(after));
    parent.replaceChild(frag, textNode);
  };

  const visitTextNodes = (node: Element | null, fn: (t: Text) => void) => {
    if (!node) return;
    const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);
    for (const tn of nodes) fn(tn);
  };

  for (const c of comments) {
    const q = (c.quote || "").trim();
    if (!q) continue;
    let done = false;
    visitTextNodes(root, (tn) => {
      if (done) return;
      const t = tn.nodeValue || "";
      const idx = t.indexOf(q);
      if (idx >= 0) {
        wrapMatchInTextNode(tn, idx, idx + q.length, c);
        done = true;
      }
    });
  }

  return root?.innerHTML ?? html;
}

// ---------- Nebula UI ----------

const DEFAULT_MD = `# Nebula — The Stellar Editor

Welcome to **Nebula**, a next‑gen editor that keeps content in sync across:

- **Visual** (WYSIWYG-ish)
- **Markdown** (authoring)
- **NebulaXML** (canonical base)

---

## What makes it "advanced"?

- Command palette (**Ctrl/⌘ + K**)
- Outline navigation
- Commenting with highlights
- Version history + restore
- Import/Export Markdown + XML
- Find/Replace
- Schema validation (best‑effort)

> Tip: switch between tabs and watch Markdown and XML remain synchronized.


### A code block

\`\`\`ts
type NebulaNode = {
  id: string;
  kind: "heading" | "paragraph" | "list";
};
\`\`\`

### A table

| Feature | Markdown | NebulaXML |
|---|---:|---:|
| Sync | ✅ | ✅ |
| Canonical | ❌ | ✅ |
`;

function formatShortTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function FileBadge({ dirty }: { dirty: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-muted-foreground">Status</div>
      {dirty ? (
        <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          Unsaved
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Saved
        </Badge>
      )}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="px-1.5 py-0.5 rounded border bg-muted text-[11px] font-mono">{children}</span>;
}

function IconChip({ icon: Icon, label }: { icon: any; label: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-background/60">
      <Icon className="h-4 w-4" />
      <span className="text-xs">{label}</span>
    </span>
  );
}

// ---------- Main App ----------

type Snapshot = { id: string; ts: string; markdown: string };

export default function Nebula() {
  const monacoEditorRef = useRef<any>(null);
  const visualEditorRef = useRef<HTMLDivElement>(null);
  
  // File management - safely get context
  let currentFile: any = null;
  let updateFile: any = () => {};
  
  try {
    const fileManager = useFileManager();
    currentFile = fileManager.currentFile;
    updateFile = fileManager.updateFile;
  } catch (e) {
    // FileManager not available yet, use defaults
    console.log('FileManager not available, using defaults');
  }

  const [docTitle, setDocTitle] = useState("Nebula Document");
  const [activeTab, setActiveTab] = useState<"visual" | "markdown" | "xml">("visual");
  const [markdown, setMarkdown] = useState(DEFAULT_MD);
  const [xml, setXml] = useState("");
  const [dirty, setDirty] = useState(false);

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const [history, setHistory] = useState<Snapshot[]>([]);
  const [comments, setComments] = useState<NebulaComment[]>([]);

  const [allowUnsafeHtml, setAllowUnsafeHtml] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  const [findOpen, setFindOpen] = useState(false);
  const [findTerm, setFindTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);

  const [commentOpen, setCommentOpen] = useState(false);
  const [commentQuote, setCommentQuote] = useState("");
  const [commentNote, setCommentNote] = useState("");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  const [xmlError, setXmlError] = useState<string | null>(null);

  // Formatting handler for the visual editor
  const handleFormat = (command: string, value?: string) => {
    if (activeTab !== "visual") return;
    
    // Special handling for certain commands
    if (command === "createLink") {
      const url = prompt("Enter URL:");
      if (url) {
        document.execCommand(command, false, url);
      }
      return;
    }
    
    if (command === "insertCheckbox") {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'mr-2';
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.insertNode(checkbox);
      }
      return;
    }
    
    if (command === 'lineHeight' && value) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const parent = range.commonAncestorContainer.parentElement;
        if (parent) {
          parent.style.lineHeight = value;
        }
      }
      return;
    }
    
    // Standard execCommand
    try {
      document.execCommand(command, false, value);
    } catch (e) {
      console.error('Format command failed:', e);
    }
  };

  // Load current file from FileManager
  useEffect(() => {
    if (currentFile) {
      setDocTitle(currentFile.name);
      setMarkdown(currentFile.markdown || DEFAULT_MD);
      setXml(currentFile.xml || "");
      setDirty(false);
    }
  }, [currentFile?.id]); // Only reload when file ID changes

  // Keep XML in sync
  useEffect(() => {
    try {
      const nextXml = markdownToNebulaXml(markdown, docTitle, allowUnsafeHtml);
      setXml(nextXml);
      setXmlError(null);
    } catch (e: any) {
      setXmlError(String(e?.message || e));
    }
  }, [markdown, docTitle, allowUnsafeHtml]);

  const outline = useMemo(() => extractOutline(markdown), [markdown]);
  const wc = useMemo(() => countWords(markdown), [markdown]);
  const minutes = useMemo(() => estimateReadingMinutes(wc), [wc]);

  const renderedHtml = useMemo(() => {
    marked.setOptions({ gfm: true, breaks: true });
    const rawHtml = marked.parse(markdown || "");
    const clean = sanitizeHtml(rawHtml as string, allowUnsafeHtml);
    return applyHighlightsToHtml(clean, comments);
  }, [markdown, comments, allowUnsafeHtml]);

  const selectedComment = useMemo(
    () => comments.find((c) => c.id === selectedCommentId) || null,
    [comments, selectedCommentId]
  );

  const turndown = useMemo(() => {
    const td = new TurndownService({ codeBlockStyle: "fenced", emDelimiter: "*" });
    td.addRule("strikethrough", {
      filter: ["del", "s"],
      replacement: function (content) {
        return `~~${content}~~`;
      },
    });
    td.addRule("lineBreak", {
      filter: function (node) {
        return (node as HTMLElement).nodeName === "BR";
      },
      replacement: function () {
        return "\\n";
      },
    });
    return td;
  }, []);

  // Auto-save to FileManager
  useEffect(() => {
    if (currentFile && dirty) {
      const timeoutId = setTimeout(() => {
        updateFile(currentFile.id, {
          name: docTitle,
          markdown,
          xml,
        });
        setDirty(false);
      }, 1000); // Auto-save after 1 second of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [markdown, xml, docTitle, dirty, currentFile, updateFile]);

  const handleSave = () => {
    if (currentFile) {
      // Force immediate save
      updateFile(currentFile.id, {
        name: docTitle,
        markdown,
        xml,
      });
      setDirty(false);
    }
  };

  const restoreSnapshot = (snap: Snapshot) => {
    setMarkdown(snap.markdown);
    setDirty(true);
  };

  const exportFile = (kind: "xml" | "markdown") => {
    const blob =
      kind === "xml"
        ? new Blob([xml], { type: "application/xml;charset=utf-8" })
        : new Blob([markdown], { type: "text/markdown;charset=utf-8" });

    const a = document.createElement("a");
    const safeName = (docTitle || "nebula").replace(/[^a-z0-9\-_. ]/gi, "").trim() || "nebula";
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName}.${kind === "xml" ? "nebula.xml" : "md"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 250);
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const name = file.name.toLowerCase();
    if (name.endsWith(".xml") || name.includes("nebula")) {
      const { markdown: mdFromXml, error } = nebulaXmlToMarkdown(text);
      if (error) {
        setXmlError(error);
        setXml(xmlPretty(text));
        return;
      }
      setMarkdown(mdFromXml || "");
      setDirty(true);
      return;
    }
    setMarkdown(text);
    setDirty(true);
  };

  const jumpToOutline = (line: number) => {
    const editor = monacoEditorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
    setActiveTab("markdown");
  };

  const openCommentFromSelection = () => {
    const sel = window.getSelection();
    const quote = sel?.toString() || "";
    if (!quote.trim()) return;
    setCommentQuote(quote.trim().slice(0, 240));
    setCommentNote("");
    setCommentOpen(true);
  };

  const addComment = () => {
    const c: NebulaComment = { id: uuidv4(), quote: commentQuote.trim(), note: commentNote.trim(), ts: nowIso() };
    const next = [c, ...comments];
    setComments(next);
    setSelectedCommentId(c.id);
    setCommentOpen(false);
    setDirty(true); // Mark as dirty to trigger auto-save
  };

  const deleteComment = (id: string) => {
    const next = comments.filter((c) => c.id !== id);
    setComments(next);
    if (selectedCommentId === id) setSelectedCommentId(null);
    setDirty(true); // Mark as dirty to trigger auto-save
  };

  const runFindReplace = (mode: "findNext" | "replaceAll") => {
    const term = findTerm;
    if (!term) return;

    const flags = caseSensitive ? "g" : "gi";
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);

    if (mode === "replaceAll") {
      const replaced = markdown.replace(re, replaceTerm);
      setMarkdown(replaced);
      setDirty(true);
      return;
    }

    const editor = monacoEditorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const value = model.getValue();
    const pos = editor.getPosition();
    const offset = model.getOffsetAt(pos);

    const forward = value.slice(offset);
    const m1 = re.exec(forward);
    let idx = -1;
    if (m1) idx = offset + m1.index;
    else {
      re.lastIndex = 0;
      const m2 = re.exec(value);
      if (m2) idx = m2.index;
    }

    if (idx >= 0) {
      const start = model.getPositionAt(idx);
      const end = model.getPositionAt(idx + term.length);
      editor.setSelection({
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
      });
      editor.revealPositionInCenter(start);
      editor.focus();
    }
  };

  // Command palette commands
  const commands = useMemo(() => {
    const insertSnippet = (snippet: string) => {
      const editor = monacoEditorRef.current;
      if (!editor) {
        setMarkdown((m) => (m.endsWith("\n") ? m : m + "\n") + snippet + "\n");
        setDirty(true);
        return;
      }
      const model = editor.getModel();
      const pos = editor.getPosition();
      if (!model || !pos) return;

      const monaco = window.__nebula_monaco;
      if (!monaco?.Range) {
        // fallback insert at end
        setMarkdown((m) => (m.endsWith("\n") ? m : m + "\n") + snippet + "\n");
        setDirty(true);
        return;
      }

      const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
      editor.executeEdits("nebula", [{ range, text: snippet, forceMoveMarkers: true }]);
      editor.focus();
    };

    const insertHeading = (level: number) => {
      insertSnippet(`${"#".repeat(level)} `);
    };

    return [
      { id: "h1", label: "Insert Heading 1", hint: "#", icon: FileText, run: () => insertHeading(1) },
      { id: "h2", label: "Insert Heading 2", hint: "##", icon: FileText, run: () => insertHeading(2) },
      { id: "bullets", label: "Insert Bullet List", hint: "- - -", icon: Sparkles, run: () => insertSnippet("- Item 1\n- Item 2\n- Item 3") },
      { id: "table", label: "Insert Table", hint: "| | |", icon: Braces, run: () => insertSnippet("| Column A | Column B |\n|---|---|\n| Value 1 | Value 2 |") },
      { id: "code", label: "Insert Code Block", hint: "```", icon: Code2, run: () => insertSnippet("```js\nconsole.log('Hello Nebula');\n```") },
      { id: "divider", label: "Insert Divider", hint: "---", icon: Sparkles, run: () => insertSnippet("---") },
      { id: "find", label: "Find & Replace", hint: "Ctrl/⌘+F", icon: Search, run: () => setFindOpen(true) },
      { id: "save", label: "Save Snapshot", hint: "Local", icon: Save, run: () => handleSave() },
      { id: "exportMd", label: "Export Markdown", hint: ".md", icon: Download, run: () => exportFile("markdown") },
      { id: "exportXml", label: "Export NebulaXML", hint: ".xml", icon: Download, run: () => exportFile("xml") },
    ] as const;
  }, [handleSave, markdown, docTitle, exportFile]);

  const filteredCommands = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q));
  }, [commands, paletteQuery]);

  const xmlValidation = useMemo(() => {
    if (!xml) return { ok: false, message: "Empty" };
    try {
      const p = new DOMParser();
      const d = p.parseFromString(xml, "application/xml");
      if (isXmlParseError(d)) return { ok: false, message: "XML parse error" };
      if (d.documentElement?.tagName !== "nebula") return { ok: false, message: "Root must be <nebula>" };
      if (!d.querySelector("document")) return { ok: false, message: "Missing <document>" };
      return { ok: true, message: "Valid" };
    } catch (e: any) {
      return { ok: false, message: String(e?.message || e) };
    }
  }, [xml]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        setPaletteQuery("");
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
        return;
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const leftWidth = leftOpen ? "w-[320px]" : "w-[56px]";
  const rightWidth = rightOpen ? "w-[360px]" : "w-[56px]";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted/40">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: -8, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="h-9 w-9 rounded-2xl bg-gradient-to-br from-indigo-500/25 via-fuchsia-500/20 to-cyan-500/20 border shadow-sm grid place-items-center"
              title="Nebula"
            >
              <Sparkles className="h-4 w-4" />
            </motion.div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Nebula</div>
              <div className="text-xs text-muted-foreground">Markdown ↔ NebulaXML</div>
            </div>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <div className="flex-1 flex items-center gap-3">
            <Input
              value={docTitle}
              onChange={(e) => {
                setDocTitle(e.target.value);
                setDirty(true);
              }}
              className="max-w-[420px]"
              placeholder="Document title"
            />
            <FileBadge dirty={dirty} />
          </div>

          <div className="hidden md:flex items-center gap-2">
            <IconChip icon={Command} label={<span className="inline-flex items-center gap-1">Palette <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd></span>} />
            <IconChip icon={Search} label={<span className="inline-flex items-center gap-1">Find <Kbd>Ctrl</Kbd>+<Kbd>F</Kbd></span>} />
            <IconChip icon={Save} label={<span className="inline-flex items-center gap-1">Save <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd></span>} />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setLeftOpen((v) => !v)} title="Toggle left panel">
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setRightOpen((v) => !v)} title="Toggle right panel">
              <PanelRight className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[240px]">
                <DropdownMenuLabel>Document</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleSave} className="gap-2">
                  <Save className="h-4 w-4" /> Save snapshot
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportFile("markdown")} className="gap-2">
                  <Download className="h-4 w-4" /> Export Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFile("xml")} className="gap-2">
                  <Download className="h-4 w-4" /> Export NebulaXML
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".md,.markdown,.xml,.txt";
                    input.onchange = async (e: any) => {
                      const f = e.target.files?.[0] as File | undefined;
                      if (f) await importFile(f);
                    };
                    input.click();
                  }}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" /> Import…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPaletteOpen(true)} className="gap-2">
                  <Command className="h-4 w-4" /> Command palette
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFindOpen(true)} className="gap-2">
                  <Search className="h-4 w-4" /> Find & Replace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-[1400px] px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr,auto] gap-4 items-stretch">
          {/* Left panel */}
          <Card className={`${leftWidth} transition-all duration-300 overflow-hidden`}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{leftOpen ? "Navigator" : ""}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setFindOpen(true)} title="Find & Replace">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {leftOpen ? (
                <Tabs defaultValue="files" className="w-full">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="files">Files</TabsTrigger>
                    <TabsTrigger value="outline">Outline</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="comments">Comments</TabsTrigger>
                  </TabsList>

                  <TabsContent value="files" className="mt-3 h-[520px]">
                    <FileExplorer />
                  </TabsContent>

                  <TabsContent value="outline" className="mt-3">
                    <ScrollArea className="h-[520px] pr-3">
                      <div className="flex flex-col gap-1">
                        {outline.length ? (
                          outline.map((h) => (
                            <button
                              key={h.id}
                              onClick={() => jumpToOutline(h.line)}
                              className="text-left px-2 py-1.5 rounded-lg hover:bg-muted transition flex items-center gap-2"
                              title={`Line ${h.line}`}
                            >
                              <span className="text-[10px] font-mono text-muted-foreground w-7">{h.level}</span>
                              <span className="text-sm truncate" style={{ paddingLeft: (h.level - 1) * 8 }}>
                                {h.text}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No headings yet. Add one with the palette (<Kbd>Ctrl</Kbd>+<Kbd>K</Kbd>).
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="history" className="mt-3">
                    <ScrollArea className="h-[520px] pr-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Snapshots (max 40)</div>
                        <Button size="sm" variant="secondary" onClick={handleSave} className="gap-2">
                          <History className="h-4 w-4" /> Save
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        {history.length ? (
                          history.map((s) => (
                            <button key={s.id} onClick={() => restoreSnapshot(s)} className="text-left p-3 rounded-xl border hover:bg-muted/50 transition">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium truncate">Snapshot</div>
                                <Badge variant="secondary" className="text-[11px]">
                                  {formatShortTime(s.ts)}
                                </Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{(s.markdown || "").slice(0, 140)}</div>
                            </button>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">No snapshots yet. Hit “Save” to capture a restore point.</div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="comments" className="mt-3">
                    <ScrollArea className="h-[520px] pr-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Highlights sync in Visual view</div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setCommentQuote("");
                            setCommentNote("");
                            setCommentOpen(true);
                          }}
                          className="gap-2"
                        >
                          <MessageSquarePlus className="h-4 w-4" /> New
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        {comments.length ? (
                          comments.map((c) => (
                            <div key={c.id} className={`p-3 rounded-xl border transition ${selectedCommentId === c.id ? "bg-muted/60" : "hover:bg-muted/40"}`}>
                              <button onClick={() => setSelectedCommentId(c.id)} className="w-full text-left" title="Select comment">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-medium truncate">Comment</div>
                                  <Badge variant="secondary" className="text-[11px]">
                                    {formatShortTime(c.ts)}
                                  </Badge>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <div className="font-mono text-[11px] rounded-lg bg-background/60 border px-2 py-1">“{c.quote}”</div>
                                  {c.note ? <div className="mt-2">{c.note}</div> : null}
                                </div>
                              </button>
                              <div className="mt-2 flex justify-end">
                                <Button size="sm" variant="ghost" onClick={() => deleteComment(c.id)}>
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">No comments yet. Select text in Visual mode and click “Comment”.</div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Button variant="ghost" size="icon" onClick={() => setLeftOpen(true)} title="Open">
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-xs text-muted-foreground -rotate-90 whitespace-nowrap">Navigator</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Center */}
          <Card className="min-h-[680px] overflow-hidden">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Editor</CardTitle>
                  <Badge variant="secondary" className="gap-2">
                    <span className="font-mono text-[11px]">wc:{wc}</span>
                    <span className="font-mono text-[11px]">~{minutes} min</span>
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 border rounded-xl px-2 py-1 bg-background/60">
                    <span className="text-xs text-muted-foreground">Unsafe HTML</span>
                    <Switch checked={allowUnsafeHtml} onCheckedChange={(v) => setAllowUnsafeHtml(!!v)} />
                  </div>

                  <Button variant="secondary" onClick={handleSave} className="gap-2">
                    <Save className="h-4 w-4" /> Save
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setActiveTab("visual");
                      setTimeout(() => openCommentFromSelection(), 0);
                    }}
                    title="Add comment from selection (Visual mode)"
                  >
                    <MessageSquarePlus className="h-4 w-4" /> Comment
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="visual" className="gap-2">
                    <Sparkles className="h-4 w-4" /> Visual
                  </TabsTrigger>
                  <TabsTrigger value="markdown" className="gap-2">
                    <FileText className="h-4 w-4" /> Markdown
                  </TabsTrigger>
                  <TabsTrigger value="xml" className="gap-2">
                    <Braces className="h-4 w-4" /> NebulaXML
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="visual" className="mt-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-2xl border bg-background/60 overflow-hidden">
                      {/* Add FormattingToolbar */}
                      {activeTab === "visual" && (
                        <FormattingToolbar onFormat={handleFormat} />
                      )}
                      
                      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Visual Surface (contentEditable, roundtrips to Markdown)</div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="secondary" className="gap-2" onClick={openCommentFromSelection} title="Select text then add a comment">
                            <MessageSquarePlus className="h-4 w-4" /> Comment from selection
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              const w = window.open("", "_blank");
                              if (!w) return;
                              w.document.write(`<!doctype html><html><head><title>${docTitle}</title><meta charset="utf-8"/></head><body>${renderedHtml}</body></html>`);
                              w.document.close();
                              w.focus();
                              w.print();
                            }}
                          >
                            <Download className="h-4 w-4" /> Print/PDF
                          </Button>
                        </div>
                      </div>

                      <div
                        ref={visualEditorRef}
                        className="nebula-prose p-5 min-h-[520px] outline-none"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => {
                          const html = (e.currentTarget as HTMLElement).innerHTML;
                          const md = turndown.turndown(html);
                          setMarkdown(md.endsWith("\n") ? md : md + "\n");
                          setDirty(true);
                        }}
                        onBlur={(e) => {
                          const html = (e.currentTarget as HTMLElement).innerHTML;
                          const md = turndown.turndown(html);
                          setMarkdown(md.endsWith("\n") ? md : md + "\n");
                          setDirty(true);
                        }}
                        dangerouslySetInnerHTML={{ __html: renderedHtml }}
                      />
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="gap-2">
                          <Command className="h-3.5 w-3.5" />
                          <span>
                            Palette: <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd>
                          </span>
                        </Badge>
                        <Badge variant="secondary" className="gap-2">
                          <Search className="h-3.5 w-3.5" />
                          <span>
                            Find: <Kbd>Ctrl</Kbd>+<Kbd>F</Kbd>
                          </span>
                        </Badge>
                      </div>
                      {selectedComment ? (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Selected comment highlight:</span>
                          <Badge variant="secondary" className="font-mono text-[11px]">
                            {selectedComment.id.slice(0, 8)}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="markdown" className="mt-3">
                  <div className="rounded-2xl border overflow-hidden">
                    <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Markdown Source</div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" className="gap-2" onClick={() => setPaletteOpen(true)}>
                          <Command className="h-4 w-4" /> Palette
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => setFindOpen(true)}>
                          <Search className="h-4 w-4" /> Find
                        </Button>
                      </div>
                    </div>
                    <div className="h-[560px]">
                      <Editor
                        height="100%"
                        defaultLanguage="markdown"
                        theme="vs-dark"
                        value={markdown}
                        onMount={(editor, monaco) => {
                          monacoEditorRef.current = editor;
                          window.__nebula_monaco = monaco;
                        }}
                        onChange={(val) => {
                          setMarkdown(val ?? "");
                          setDirty(true);
                        }}
                        options={{
                          minimap: { enabled: false },
                          wordWrap: "on",
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                          smoothScrolling: true,
                          padding: { top: 12, bottom: 12 },
                        }}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="xml" className="mt-3">
                  <div className="rounded-2xl border overflow-hidden">
                    <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">NebulaXML (Canonical Base)</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="gap-2">
                          {xmlValidation.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                          <span className="font-mono text-[11px]">{xmlValidation.message}</span>
                        </Badge>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => exportFile("xml")}>
                          <Download className="h-4 w-4" /> Export
                        </Button>
                      </div>
                    </div>

                    <div className="h-[560px]">
                      <Editor
                        height="100%"
                        defaultLanguage="xml"
                        theme="vs-dark"
                        value={xml}
                        onChange={(val) => {
                          const next = val ?? "";
                          setXml(next);
                          const { markdown: mdFromXml, error } = nebulaXmlToMarkdown(next);
                          if (error) {
                            setXmlError(error);
                          } else {
                            setXmlError(null);
                            setMarkdown(mdFromXml);
                            setDirty(true);
                          }
                        }}
                        options={{
                          minimap: { enabled: false },
                          wordWrap: "on",
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                          smoothScrolling: true,
                          padding: { top: 12, bottom: 12 },
                        }}
                      />
                    </div>

                    {xmlError ? (
                      <div className="px-3 py-2 border-t text-xs text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/20">
                        XML issue: {xmlError}
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Right panel */}
          <Card className={`${rightWidth} transition-all duration-300 overflow-hidden`}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{rightOpen ? "Inspector" : ""}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setPaletteOpen(true)} title="Command palette">
                    <Command className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {rightOpen ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl border bg-background/60">
                    <div className="text-xs text-muted-foreground">Stats</div>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Words</div>
                        <div className="text-sm font-medium">{wc}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Read time</div>
                        <div className="text-sm font-medium">~{minutes} min</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Comments</div>
                        <div className="text-sm font-medium">{comments.length}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Snapshots</div>
                        <div className="text-sm font-medium">{history.length}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border bg-background/60">
                    <div className="text-xs text-muted-foreground">Export / Import</div>
                    <div className="mt-2 flex flex-col gap-2">
                      <Button variant="secondary" className="gap-2 justify-start" onClick={() => exportFile("markdown")}>
                        <Download className="h-4 w-4" /> Export Markdown
                      </Button>
                      <Button variant="secondary" className="gap-2 justify-start" onClick={() => exportFile("xml")}>
                        <Download className="h-4 w-4" /> Export NebulaXML
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 justify-start"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = ".md,.markdown,.xml,.txt";
                          input.onchange = async (e: any) => {
                            const f = e.target.files?.[0] as File | undefined;
                            if (f) await importFile(f);
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4" /> Import…
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border bg-background/60">
                    <div className="text-xs text-muted-foreground">Selected comment</div>
                    <div className="mt-2 text-sm">
                      {selectedComment ? (
                        <div className="space-y-2">
                          <div className="font-mono text-[11px] rounded-lg bg-muted/40 border px-2 py-1">“{selectedComment.quote}”</div>
                          {selectedComment.note ? <div className="text-sm">{selectedComment.note}</div> : <div className="text-xs text-muted-foreground">No note.</div>}
                          <div className="flex justify-end">
                            <Button size="sm" variant="ghost" onClick={() => deleteComment(selectedComment.id)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Pick a comment on the left to inspect it.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Button variant="ghost" size="icon" onClick={() => setRightOpen(true)} title="Open">
                    <PanelRight className="h-4 w-4" />
                  </Button>
                  <div className="text-xs text-muted-foreground -rotate-90 whitespace-nowrap">Inspector</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Command palette */}
      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent className="max-w-[680px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Command className="h-5 w-5" /> Command palette
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} placeholder="Type a command…" />
            <div className="rounded-xl border overflow-hidden">
              <ScrollArea className="h-[340px]">
                <div className="p-2">
                  {filteredCommands.length ? (
                    filteredCommands.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          c.run();
                          setPaletteOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <c.icon className="h-4 w-4" />
                          <div className="text-sm font-medium">{c.label}</div>
                        </div>
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {c.hint}
                        </Badge>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground p-3">No matches.</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaletteOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Find & Replace */}
      <Dialog open={findOpen} onOpenChange={setFindOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" /> Find & Replace
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Input value={findTerm} onChange={(e) => setFindTerm(e.target.value)} placeholder="Find…" />
              <Input value={replaceTerm} onChange={(e) => setReplaceTerm(e.target.value)} placeholder="Replace with…" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={caseSensitive} onCheckedChange={(v) => setCaseSensitive(!!v)} />
                <span className="text-sm">Case sensitive</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => runFindReplace("findNext")}>
                  Find next
                </Button>
                <Button onClick={() => runFindReplace("replaceAll")}>Replace all</Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFindOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Comment */}
      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent className="max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" /> Add comment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Quote (highlighted in Visual mode when possible)</div>
              <Input value={commentQuote} onChange={(e) => setCommentQuote(e.target.value)} placeholder="Paste or type the exact text to highlight…" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Note</div>
              <Input value={commentNote} onChange={(e) => setCommentNote(e.target.value)} placeholder="Add context, a task, or an idea…" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!commentQuote.trim()) return;
                addComment();
                setDirty(true);
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tiny helper style (prose-ish) */}
      <style jsx global>{`
        .nebula-prose h1, .nebula-prose h2, .nebula-prose h3, .nebula-prose h4 {
          font-weight: 650;
          letter-spacing: -0.01em;
          margin-top: 1.1em;
          margin-bottom: 0.45em;
        }
        .nebula-prose p { margin: 0.65em 0; }
        .nebula-prose ul, .nebula-prose ol { padding-left: 1.25rem; margin: 0.6em 0; }
        .nebula-prose blockquote {
          border-left: 3px solid hsl(var(--muted-foreground) / 0.25);
          padding-left: 0.9rem;
          margin: 0.75em 0;
          opacity: 0.95;
        }
        .nebula-prose pre {
          overflow: auto;
          padding: 0.9rem;
          border-radius: 0.9rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--muted) / 0.35);
        }
        .nebula-prose code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 0.92em;
        }
        .nebula-prose table { width: 100%; border-collapse: collapse; margin: 0.8em 0; }
        .nebula-prose th, .nebula-prose td { border: 1px solid hsl(var(--border)); padding: 0.4rem 0.6rem; }
      `}</style>
    </div>
  );
}
