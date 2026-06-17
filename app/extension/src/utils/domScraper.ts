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

  // 6. Code and Language (via Script Injection to access window.monaco in main context)
  const extData = await new Promise<{ code: string; language: string }>((resolve) => {
    const listener = (event: MessageEvent) => {
      if (event.data && event.data.type === "LEE_VIEW_CODE_RESPONSE") {
        window.removeEventListener("message", listener);
        resolve({
          code: event.data.code || "",
          language: event.data.language || "python"
        });
      }
    };
    window.addEventListener("message", listener);

    try {
      const script = document.createElement("script");
      script.textContent = `
        (function() {
          try {
            let extractedCode = "";
            let extractedLang = "python";
            
            if (window.monaco && window.monaco.editor) {
              const editors = window.monaco.editor.getEditors();
              if (editors && editors.length > 0) {
                extractedCode = editors[0].getValue();
                const model = editors[0].getModel();
                if (model) {
                  extractedLang = model.getLanguageId() || extractedLang;
                }
              }
            }
            
            window.postMessage({
              type: "LEE_VIEW_CODE_RESPONSE",
              code: extractedCode,
              language: extractedLang
            }, "*");
          } catch(e) {
            window.postMessage({
              type: "LEE_VIEW_CODE_RESPONSE",
              code: "",
              language: "python"
            }, "*");
          }
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove(); // Clean up immediately after execution
    } catch (e) {
      // Fallback if script injection is blocked (e.g., CSP)
      resolve({ code: "", language: "python" });
    }
    
    // Timeout fallback just in case the message never arrives
    setTimeout(() => {
      window.removeEventListener("message", listener);
      resolve({ code: "", language: "python" });
    }, 1500);
  });

  const data = { title, slug, description, difficulty, code: extData.code, language: extData.language, topics };
  console.log("[Extension] Scraped Problem Data:", data);

  return data;
}
