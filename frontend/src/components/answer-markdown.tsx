import type { ReactNode } from "react";

type InlinePart =
  | { kind: "link"; label: string; href: string }
  | { kind: "strong" | "emphasis" | "code"; content: string };

const INLINE_MARKDOWN =
  /(\[[^\]]+\]\([^)]+\)|<https?:\/\/[^>\s]+>|https?:\/\/[^\s<>]+|www\.[^\s<>]+|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g;

function safeHref(href: string): string | null {
  const normalized = href.startsWith("www.") ? `https://${href}` : href;
  try {
    const parsed = new URL(normalized, "https://local.invalid");
    if (["https:", "http:", "mailto:"].includes(parsed.protocol)) return normalized;
  } catch {
    return null;
  }
  return null;
}

function parseInlinePart(token: string): InlinePart | null {
  const markdownLink = token.match(/^\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)$/);
  if (markdownLink) {
    const href = safeHref(markdownLink[2]!);
    return href ? { kind: "link", label: markdownLink[1]!, href } : null;
  }
  const autolink = token.match(/^<(https?:\/\/[^>]+)>$/);
  if (autolink) return { kind: "link", label: autolink[1]!, href: autolink[1]! };

  if (/^(https?:\/\/|www\.)/.test(token)) {
    const trailing = token.match(/[.,!?;:]+$/)?.[0] ?? "";
    const candidate = trailing ? token.slice(0, -trailing.length) : token;
    const href = safeHref(candidate);
    if (href) return { kind: "link", label: token, href };
  }

  if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
    return { kind: "strong", content: token.slice(2, -2) };
  }
  if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
    return { kind: "emphasis", content: token.slice(1, -1) };
  }
  if (token.startsWith("`") && token.endsWith("`")) {
    return { kind: "code", content: token.slice(1, -1) };
  }
  return null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(INLINE_MARKDOWN)) {
    const token = match[0];
    const start = match.index ?? cursor;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const part = parseInlinePart(token);
    if (!part) {
      nodes.push(token);
    } else if (part.kind === "link") {
      nodes.push(
        <a
          key={`${keyPrefix}-${index}`}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {part.label}
        </a>,
      );
    } else if (part.kind === "strong") {
      nodes.push(<strong key={`${keyPrefix}-${index}`}>{part.content}</strong>);
    } else if (part.kind === "emphasis") {
      nodes.push(<em key={`${keyPrefix}-${index}`}>{part.content}</em>);
    } else {
      nodes.push(
        <code key={`${keyPrefix}-${index}`} className="rounded bg-muted px-1 py-0.5">
          {part.content}
        </code>,
      );
    }
    cursor = start + token.length;
    index += 1;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderBlocks(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let index = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`p-${index++}`} className="my-2 whitespace-pre-wrap first:mt-0 last:mb-0">
        {paragraph.map((line, lineIndex) => (
          <span key={`line-${lineIndex}`}>
            {lineIndex > 0 && <br />}
            {renderInline(line, `p-${index}-${lineIndex}`)}
          </span>
        ))}
      </p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const List = list.ordered ? "ol" : "ul";
    const className = list.ordered ? "my-2 list-decimal space-y-1 pl-6" : "my-2 list-disc space-y-1 pl-6";
    blocks.push(
      <List key={`list-${index++}`} className={className}>
        {list.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>
        ))}
      </List>,
    );
    list = null;
  };

  for (const line of lines) {
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flushList();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push((ordered ?? unordered)![1]!);
      continue;
    }
    flushList();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="break-words text-[13px] leading-[1.8] [&_a]:break-all [&_em]:italic [&_strong]:font-bold">
      {renderBlocks(text)}
    </div>
  );
}
