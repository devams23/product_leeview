export function getProblemData() {
    const titleEl = document.querySelector("[data-cy=question-title]");
    const title = titleEl?.textContent || "Unknown Problem";
    const slug = window.location.pathname.split("/problems/")[1]?.split("/")[0] || "";
    const difficulty = document.querySelector("[diff]")?.textContent || "Medium";
    const code = window.monaco?.editor?.getEditors()?.[0]?.getValue() || "";
    const language = "python";
    return { title, slug, description: "", difficulty, code, language };
}
