"use client";

import { useMemo } from "react";
import katex from "katex";

/**
 * Renders text containing inline `$...$` / display `\[...\]` LaTeX segments
 * (as scraped from the AoPS wiki) using KaTeX. Non-math text passes through
 * as plain spans.
 */

function renderSegment(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return `<span class="text-bad">${escapeHtml(tex)}</span>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Split on $...$ and \[...\] blocks, keeping delimiters. */
function toHtml(text: string): string {
  const out: string[] = [];
  let i = 0;
  const n = text.length;
  let plain = "";

  const flushPlain = () => {
    if (plain) {
      out.push(
        escapeHtml(plain).replace(/\n\n/g, '</p><p class="mt-3">')
      );
      plain = "";
    }
  };

  while (i < n) {
    if (text.startsWith("\\[", i)) {
      const end = text.indexOf("\\]", i + 2);
      if (end !== -1) {
        flushPlain();
        out.push(renderSegment(text.slice(i + 2, end), true));
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "$" && text[i - 1] !== "\\") {
      const dbl = text.startsWith("$$", i);
      const delim = dbl ? "$$" : "$";
      const end = text.indexOf(delim, i + delim.length);
      if (end !== -1) {
        flushPlain();
        out.push(renderSegment(text.slice(i + delim.length, end), dbl));
        i = end + delim.length;
        continue;
      }
    }
    plain += text[i];
    i++;
  }
  flushPlain();
  return `<p>${out.join("")}</p>`;
}

export default function Latex({
  text,
  className,
  math = false,
}: {
  text: string;
  className?: string;
  /** render the whole string as a math expression (e.g. answer choices) */
  math?: boolean;
}) {
  const html = useMemo(() => {
    if (math) {
      const tex = text.replace(/^\$+|\$+$/g, "");
      return renderSegment(tex, false);
    }
    return toHtml(text);
  }, [text, math]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
