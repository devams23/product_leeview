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
    return lines.map(line => line.textContent || "").join('\\n');
  } catch (e) {
    return "";
  }
}

export async function getProblemData(): Promise<{
  title: string;
  slug: string;
  description: string;
  difficulty: string;
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
  const slug = window.location.pathname.split("/problems/")[1]?.split("/")[0] || "";

  // 3. Difficulty
  let difficulty = "Unknown";
  if (document.querySelector('.text-difficulty-easy, [class*="text-difficulty-easy"]')) difficulty = "Easy";
  else if (document.querySelector('.text-difficulty-medium, [class*="text-difficulty-medium"]')) difficulty = "Medium";
  else if (document.querySelector('.text-difficulty-hard, [class*="text-difficulty-hard"]')) difficulty = "Hard";
  else {
    const diffEl = document.querySelector('[diff]');
    if (diffEl) difficulty = diffEl.textContent || "Medium";
  }

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
  let language = window.localStorage.getItem("global_lang") || "python";
  // Remove JSON string quotes if present
  language = language.replace(/^"|"$/g, '');

  let code = await getCodeFromIndexedDB(language);
  if (!code) {
    console.log("[Extension] IndexedDB code not found or empty, falling back to DOM scraping");
    code = getCodeFromDOM();
  }

  const data = { title, slug, description, difficulty, code, language, topics };
  console.log("[Extension] Scraped Problem Data:", data);

  return data;
}
