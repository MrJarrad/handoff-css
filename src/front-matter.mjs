// P17 — the plugin's markdown exports now open with a leading `---` YAML
// front-matter block ahead of the bold identity lines this package already
// parses. This module is a MINIMAL hand-rolled reader for that block — no
// YAML dependency, because the shape it needs is narrow: flat scalar keys,
// one level of nested mapping (`policies:`, `fingerprint:`, `figma:`,
// `companion:`), quoted strings, bare ints, and simple sequences of flat
// mappings (`breakpoints:`, `selectedNodes:`). Anything wider than that
// (multi-line scalars, anchors, flow collections) is out of scope on purpose.

/** Parse one scalar token: quoted string, int, or bare string/null. */
function scalar(raw) {
  const v = raw.trim();
  if (v === "" || v === "~" || v === "null") return null;
  if (/^"([^"]*)"$/.test(v)) return v.slice(1, -1);
  if (/^'([^']*)'$/.test(v)) return v.slice(1, -1);
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

const indentOf = (line) => line.length - line.replace(/^ */, "").length;

/**
 * Parse a block of lines (already stripped of the surrounding `---` markers)
 * at a given base indent, returning `{ value, next }` where `next` is the
 * index of the first line NOT consumed.
 */
function parseBlock(lines, start, baseIndent) {
  const out = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i += 1; continue; }
    const indent = indentOf(line);
    if (indent < baseIndent) break;
    if (indent > baseIndent) { i += 1; continue; } // malformed/deeper — skip defensively

    const listItem = /^-\s?/.exec(line.slice(indent));
    if (listItem) break; // caller handles sequences

    const m = /^([\w.-]+):\s?(.*)$/.exec(line.slice(indent));
    if (!m) { i += 1; continue; }
    const [, key, rest] = m;

    if (rest === "") {
      // Nested block: either a mapping (deeper indent, `key: value`) or a
      // sequence (deeper indent, `- key: value` items).
      const nextLine = lines[i + 1];
      const nextIndent = nextLine != null ? indentOf(nextLine) : -1;
      if (nextLine != null && nextIndent > indent && /^-\s?/.test(nextLine.slice(nextIndent))) {
        const { value, next } = parseSequence(lines, i + 1, nextIndent);
        out[key] = value;
        i = next;
      } else if (nextLine != null && nextIndent > indent) {
        const { value, next } = parseBlock(lines, i + 1, nextIndent);
        out[key] = value;
        i = next;
      } else {
        out[key] = null;
        i += 1;
      }
    } else {
      out[key] = scalar(rest);
      i += 1;
    }
  }
  return { value: out, next: i };
}

/** Parse a sequence of `- ` items, each a flat (or one-level nested) mapping or scalar. */
function parseSequence(lines, start, itemIndent) {
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i += 1; continue; }
    const indent = indentOf(line);
    if (indent < itemIndent) break;
    if (indent > itemIndent) { i += 1; continue; }
    if (!/^-\s?/.test(line.slice(indent))) break;

    const rest = line.slice(indent).replace(/^-\s?/, "");
    if (rest === "") { i += 1; continue; }
    const inline = /^([\w.-]+):\s?(.*)$/.exec(rest);
    if (!inline) {
      items.push(scalar(rest));
      i += 1;
      continue;
    }
    // The item's first key sits on the `- ` line itself; sibling keys follow
    // at `itemIndent + 2` (the width of "- ").
    const item = {};
    item[inline[1]] = scalar(inline[2]);
    const memberIndent = itemIndent + (line.slice(itemIndent).indexOf(rest));
    i += 1;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === "") { i += 1; continue; }
      const ind = indentOf(l);
      if (ind !== memberIndent || /^-\s?/.test(l.slice(ind))) break;
      const m2 = /^([\w.-]+):\s?(.*)$/.exec(l.slice(ind));
      if (!m2) break;
      item[m2[1]] = scalar(m2[2]);
      i += 1;
    }
    items.push(item);
  }
  return { value: items, next: i };
}

/**
 * Read a leading `---`/`---` YAML front-matter block, if present.
 *
 * @param {string} text
 * @returns {{ frontMatter: object|null, body: string, offset: number }}
 *   `body` is `text` with the front-matter block (and its fences) removed, so
 *   the rest of the pipeline sees the same markdown it always did. `offset`
 *   is the number of lines removed, so a caller tracking 1-based line numbers
 *   in `body` can add it back to report against the ORIGINAL file.
 */
export function parseFrontMatter(text) {
  if (!text.startsWith("---\n") && text !== "---") return { frontMatter: null, body: text, offset: 0 };
  const lines = text.split("\n");
  if (lines[0] !== "---") return { frontMatter: null, body: text, offset: 0 };
  const end = lines.indexOf("---", 1);
  if (end === -1) return { frontMatter: null, body: text, offset: 0 };

  const { value } = parseBlock(lines, 1, 0);
  const body = lines.slice(end + 1).join("\n");
  return { frontMatter: value, body, offset: end + 1 };
}
