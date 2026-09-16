/** @doc Turns whatever the computer agent hands back into readable prose.
 *
 * The provider sometimes returns its raw internal payload — a JSON blob, a
 * `Final result:` dump, an `AgentHistoryList(...)` repr or a fenced code block
 * wrapping the answer. Showing that verbatim is what made a finished task look
 * like machine noise in the chat, so every surface renders the result through
 * this cleaner first.
 */

const RAW_PREFIXES =
  /^(?:final\s+result|final\s+answer|result|output|done|task\s+(?:result|output|completed))\s*[:\-–]\s*/i;

/** Pulls the most answer-like string out of a parsed provider payload. */
function fromJson(value: unknown, depth = 0): string {
  if (depth > 4) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value.map((v) => fromJson(v, depth + 1)).filter(Boolean);
    return parts.join("\n\n");
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = [
      "result_text",
      "final_result",
      "finalResult",
      "result",
      "answer",
      "output_text",
      "output",
      "text",
      "content",
      "summary",
      "message",
      "extracted_content",
    ];
    for (const key of keys) {
      if (key in obj) {
        const found = fromJson(obj[key], depth + 1);
        if (found.trim()) return found;
      }
    }
  }
  return "";
}

/**
 * Cleans a provider result string for display. Returns an empty string when
 * nothing human-readable is left, so callers can fall back to their own copy.
 */
export function cleanAgentResult(raw: string | null | undefined): string {
  let text = (raw ?? "").trim();
  if (!text) return "";

  // A fenced block that wraps the whole answer is provider packaging.
  const fenced = text.match(/^```(?:json|text|markdown)?\s*\n([\s\S]*?)\n?```$/i);
  if (fenced) text = fenced[1].trim();

  // JSON payloads: keep the answer field, drop the machinery.
  if (/^[[{]/.test(text)) {
    try {
      const extracted = fromJson(JSON.parse(text));
      if (extracted.trim()) text = extracted.trim();
    } catch {
      /* not valid JSON — fall through to the textual cleanup */
    }
  }

  // Provider reprs are never useful to a reader.
  text = text
    .replace(/AgentHistoryList\([\s\S]*?\)\s*$/g, "")
    .replace(/^\s*(?:ActionResult|AgentOutput)\([\s\S]*?\)\s*$/gm, "")
    .trim();

  // Strip leading machine labels, repeatedly ("Final result: Output: …").
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(RAW_PREFIXES, "").trim();
    if (next === text) break;
    text = next;
  }

  // Escaped newlines from a JSON-encoded string.
  if (!text.includes("\n") && /\\n/.test(text)) text = text.replace(/\\n/g, "\n");
  text = text.replace(/\\"/g, '"').replace(/\n{3,}/g, "\n\n").trim();

  // Nothing but braces, quotes or ids left → treat it as no readable result.
  if (!/[\p{L}\p{N}]/u.test(text)) return "";
  return text;
}
