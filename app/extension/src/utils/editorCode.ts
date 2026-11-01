// Pure helpers for reading the candidate's code from LeetCode. Nothing here touches the page.

export const EDITOR_BRIDGE_SOURCE = "leeview-editor";

export interface EditorSnapshot {
  code: string;
  language: string;
}

interface MonacoModel {
  getLanguageId(): string;
  getValue(): string;
}

interface MonacoEditor {
  getModel(): MonacoModel | null;
  getRawOptions?(): { readOnly?: boolean };
}

export interface MonacoLike {
  editor: {
    getEditors?(): MonacoEditor[];
    getModels(): MonacoModel[];
  };
}

function isCode(model: MonacoModel): boolean {
  const language = model.getLanguageId();
  return Boolean(language) && language !== "plaintext";
}

/** The live code. LeetCode's testcase box is also Monaco, so plaintext and read-only editors don't count. */
export function readMonacoCode(monaco: MonacoLike | undefined): EditorSnapshot | null {
  if (!monaco) return null;

  const editors = monaco.editor.getEditors?.() ?? [];
  const models = editors.length
    ? editors.flatMap((editor) => {
        const model = editor.getModel();
        return model && !editor.getRawOptions?.().readOnly ? [model] : [];
      })
    : monaco.editor.getModels();

  const longest = models
    .filter(isCode)
    .reduce<MonacoModel | null>((best, model) => (!best || model.getValue().length > best.getValue().length ? model : best), null);
  return longest && { code: longest.getValue(), language: longest.getLanguageId() };
}

/** Saved code may be stored JSON-encoded, which would otherwise reach the AI as one line of escapes. */
export function decodeSavedCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  if (raw.length < 2 || !raw.startsWith('"') || !raw.endsWith('"')) return raw;
  try {
    const decoded: unknown = JSON.parse(raw);
    return typeof decoded === "string" ? decoded : raw;
  } catch {
    return raw;
  }
}

/** Saved code for this exact problem and language, or nothing. Another problem's code is worse than none. */
export function pickSavedCode(keys: string[], values: unknown[], questionId: string | null, language: string): string {
  if (!questionId) return "";

  let newest = -1;
  let code: unknown = "";
  keys.forEach((key, index) => {
    const parts = String(key).split("_");
    if (parts[0] !== questionId || parts[parts.length - 1] !== language) return;
    const time = parseInt(String(values[keys.indexOf(`${key}-updated-time`)]), 10) || 0;
    if (time > newest) {
      newest = time;
      code = values[index];
    }
  });
  return decodeSavedCode(code);
}

export function questionIdFromTitle(title: string): string | null {
  return title.match(/^\s*(\d+)\./)?.[1] ?? null;
}

/** Monaco renders only what's on screen, out of order and with non-breaking spaces. */
export function orderVisibleLines(lines: { top: number; text: string }[]): string {
  return [...lines]
    .sort((a, b) => a.top - b.top)
    .map((line) => line.text.replace(/ /g, " "))
    .join("\n");
}
