async function getCodeFromIndexedDB(language: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('LeetCode-problems');
      request.onerror = () => resolve("");
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('problem_code')) {
          resolve("");
          return;
        }

        try {
          const transaction = db.transaction(['problem_code'], 'readonly');
          const store = transaction.objectStore('problem_code');

          const getAllKeysReq = store.getAllKeys();
          const getAllReq = store.getAll();

          getAllKeysReq.onsuccess = () => {
            getAllReq.onsuccess = () => {
              const keys = getAllKeysReq.result as string[];
              const values = getAllReq.result as string[];

              let latestTime = 0;
              let latestCodeKey = "";

              for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (key.endsWith('-updated-time') && key.includes(`_${language}`)) {
                  const time = parseInt(values[i], 10);
                  if (time > latestTime) {
                    latestTime = time;
                    latestCodeKey = key.replace('-updated-time', '');
                  }
                }
              }

              if (latestCodeKey) {
                const codeIndex = keys.indexOf(latestCodeKey);
                if (codeIndex !== -1) {
                  resolve(values[codeIndex]);
                  return;
                }
              }
              resolve("");
            };
          };

          transaction.onerror = () => resolve("");
        } catch (e) {
          resolve("");
        }
      };
    } catch (e) {
      resolve("");
    }
  });
}

function getCodeFromDOM(): string {
  try {
    const cmContent = document.querySelector('.cm-content');
    if (!cmContent) return "";

    const lines = Array.from(cmContent.querySelectorAll('.cm-line'));
    return lines.map(line => line.textContent || "").join('\n');
  } catch (e) {
    return "";
  }
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

  let code = await getCodeFromIndexedDB(language);
  if (!code) {
    code = getCodeFromDOM();
  }

  return { title, slug, description, difficulty, code, language, topics };
}
