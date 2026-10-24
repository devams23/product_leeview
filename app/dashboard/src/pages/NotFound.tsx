import { Link } from "react-router-dom";
import { buttonClass } from "../components/ui/Button";

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-ink-0 px-6 text-center">
      <p className="font-display text-[96px] leading-none text-text-1 sm:text-[128px]">404</p>
      <div className="flex max-w-md flex-col gap-3">
        <h1 className="font-display text-[28px] text-text-1">This page does not exist</h1>
        <p className="text-[15px] leading-relaxed text-text-2">
          The link may be out of date. Your practice history is still in the overview.
        </p>
      </div>
      <Link to="/dashboard" className={buttonClass("primary")}>
        Go to overview
      </Link>
    </div>
  );
}
