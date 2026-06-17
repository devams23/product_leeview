export function getProblemData(): {
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  code: string;
  language: string;
  topics: string[];
} {
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

  // 6. Code (Monaco Editor)
  let code = "";
  try {
    const editors = (window as any).monaco?.editor?.getEditors();
    if (editors && editors.length > 0) {
      code = editors[0].getValue();
    }
  } catch (e) {
    console.error("Could not get monaco editor value", e);
  }

  const language = "python";

  const data = { title, slug, description, difficulty, code, language, topics };
  console.log("[Extension] Scraped Problem Data:", data);

  return data;
}
