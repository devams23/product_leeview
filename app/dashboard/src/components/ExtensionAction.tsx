import { useExtensionInstalled } from "../hooks/useExtensionInstalled";
import { buttonClass } from "./ui/Button";

/** The Chrome Web Store listing. Empty until the extension is published. */
export const EXTENSION_URL: string = import.meta.env.VITE_EXTENSION_URL ?? "";

/** The install button, which says so plainly when there is nothing to install from yet. */
export function ExtensionAction() {
  const installed = useExtensionInstalled();

  if (installed) {
    return (
      <p className="inline-flex h-11 items-center gap-2 text-[15px] text-text-1">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-signal">
          <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Added to Chrome
      </p>
    );
  }

  if (!EXTENSION_URL) {
    return (
      <p className="inline-flex h-11 w-fit items-center rounded-btn border border-line-2 px-4 text-[14px] text-text-2">
        Coming soon to the Chrome Web Store
      </p>
    );
  }

  return (
    <a href={EXTENSION_URL} target="_blank" rel="noreferrer" className={buttonClass("primary", "md", "w-fit")}>
      Add to Chrome
    </a>
  );
}
