import {
  EDITOR_BRIDGE_SOURCE,
  orderVisibleLines,
  pickSavedCode,
  questionIdFromTitle,
  type EditorSnapshot,
} from "./editorCode";

const EDITOR_TIMEOUT_MS = 300;

/** Asks editorBridge, which runs in the page, for what's in the editor right now. */
function readLiveEditor(): Promise<EditorSnapshot | null> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const finish = (snapshot: EditorSnapshot | null) => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      resolve(snapshot);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== EDITOR_BRIDGE_SOURCE) return;
      if (event.data.type === "CODE" && event.data.id === id) finish(event.data.snapshot);
    };
    const timer = window.setTimeout(() => finish(null), EDITOR_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    window.postMessage({ source: EDITOR_BRIDGE_SOURCE, type: "READ", id }, window.location.origin);
  });
}

async function getSavedCode(slug: string, language: string): Promise<string> {
  const heading = document.querySelector(`a[href^="/problems/${slug}"]`)?.textContent ?? document.title;
  const questionId = questionIdFromTitle(heading);
  if (!questionId) return "";

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('LeetCode-problems');
      request.onerror = () => resolve("");
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('problem_code')) {
          resolve("");
          return;
        }

        try {
          const transaction = db.transaction(['problem_code'], 'readonly');
          const store = transaction.objectStore('problem_code');
          const getAllKeysReq = store.getAllKeys();
          const getAllReq = store.getAll();

          getAllReq.onsuccess = () => {
            resolve(pickSavedCode(getAllKeysReq.result.map(String), getAllReq.result, questionId, language));
          };
          transaction.onerror = () => resolve("");
        } catch {
          resolve("");
        }
      };
    } catch {
      resolve("");
    }
  });
}

function getVisibleCode(): string {
  const editors = Array.from(document.querySelectorAll('.monaco-editor .view-lines'));
  const largest = editors.reduce<Element | null>(
    (best, editor) => (!best || editor.childElementCount > best.childElementCount ? editor : best),
    null,
  );
  if (!largest) return "";

  return orderVisibleLines(
    Array.from(largest.children).map((line) => ({
      top: parseFloat((line as HTMLElement).style.top) || 0,
      text: line.textContent ?? "",
    })),
  );
}

/** Slug from a LeetCode problem path, or null when not on a problem page. */
export function slugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

function readDifficulty(): string | null {
  if (document.querySelector('.text-difficulty-easy, [class*="text-difficulty-easy"]')) return "Easy";
  if (document.querySelector('.text-difficulty-medium, [class*="text-difficulty-medium"]')) return "Medium";
  if (document.querySelector('.text-difficulty-hard, [class*="text-difficulty-hard"]')) return "Hard";
  const diffEl = document.querySelector('[diff]');
  if (diffEl) return diffEl.textContent || null;
  return null;
}

/** Light, synchronous scrape used by the overlay header (no description/code). */
export function scrapeProblemHeader(): { slug: string | null; title: string; difficulty: string } {
  const slug = slugFromPath(window.location.pathname);
  if (!slug) return { slug: null, title: "", difficulty: "" };

  let title = document.title.split(" - ")[0] || "";
  title = title.replace(/^\d+\.\s/, "").trim();

  return { slug, title, difficulty: readDifficulty() ?? "" };
}

export async function getProblemData(): Promise<{
  title: string;
  slug: string;
  description: string;
  difficulty: string | null;
  code: string;
  language: string;
  topics: string[];
}> {
  // 1. Title from document title "1. Two Sum - LeetCode"
  let title = document.title.split(" - ")[0] || "Unknown Problem";
  if (title.match(/^\d+\.\s/)) {
    title = title.replace(/^\d+\.\s/, "");
  }

  // 2. Slug from URL
  const slug = slugFromPath(window.location.pathname) || "";

  // 3. Difficulty
  const difficulty = readDifficulty();

  // 4. Description
  const descEl = document.querySelector('[data-track-load="description_content"]');
  let description = descEl ? (descEl.textContent || "") : "";

  // 5. Topics
  const topicEls = document.querySelectorAll('a[href^="/tag/"]');
  const topics = Array.from(topicEls).map(el => el.textContent || "").filter(Boolean);

  if (!description) {
    const possibleDesc = document.querySelector('div[class*="content"]');
    if (possibleDesc) {
      description = possibleDesc.textContent || "";
    }
  }

  // Clean up description formatting
  description = description.replace(/\s+/g, ' ').trim();

  // 6. Code and Language
  let language = window.localStorage.getItem("global_lang")?.toString() || "python";
  // Remove JSON string quotes if present
  language = language.replace(/^"|"$/g, '');

  const live = await readLiveEditor();
  const code = live ? live.code : (await getSavedCode(slug, language)) || getVisibleCode();

  return { title, slug, description, difficulty, code, language, topics };
}
