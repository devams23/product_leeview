import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { firstName, initialOf } from "../../lib/format";
import { NAV_SECTIONS, PROFILE_NAV, type NavItem } from "../../lib/nav";
import { buttonClass } from "../ui/Button";
import { Brand } from "../ui/BrandMark";

function Logo({ size }: { size: number }) {
  return (
    <Link to="/dashboard" className="flex items-center rounded-chip">
      <Brand size={size} />
    </Link>
  );
}

/** Shown once after the extension sends the user back from the sign-in page. */
function ConnectedBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("lv:from-extension") === "1") {
        sessionStorage.removeItem("lv:from-extension");
        setShow(true);
      }
    } catch {
      // Storage unavailable (private mode): skip the banner.
    }
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="mb-6 flex items-center justify-between gap-4 rounded-btn border border-signal/20 bg-signal-soft px-4 py-3 text-[14px] text-text-1"
    >
      <p>Extension connected. Your LeetCode tab is ready — start your interview there.</p>
      <button type="button" onClick={() => setShow(false)} className={buttonClass("ghost", "sm", "shrink-0")}>
        Dismiss
      </button>
    </div>
  );
}

function navClass(active: boolean) {
  return `flex h-9 items-center gap-3 rounded-btn px-3 text-sm transition-colors duration-150 ${
    active ? "bg-signal-soft text-text-1 [&>svg]:text-signal" : "text-text-2 hover:bg-ink-2 hover:text-text-1"
  }`;
}

function RailItem({ item }: { item: NavItem }) {
  if (item.soon) {
    return (
      <span className="flex h-9 cursor-default items-center gap-3 rounded-btn px-3 text-sm text-text-3" aria-disabled="true">
        {item.icon}
        <span className="flex-1">{item.label}</span>
        <span className="rounded-chip bg-ink-3 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-text-3">
          Soon
        </span>
      </span>
    );
  }
  return (
    <NavLink to={item.to} className={({ isActive }) => navClass(isActive)}>
      {item.icon}
      {item.label}
    </NavLink>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const name = firstName(user);
  const mobileItems = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => !i.soon);

  return (
    <div className="min-h-screen bg-ink-0">
      {/* Desktop rail: a floating panel rather than a bordered column. */}
      <aside className="fixed inset-y-3 left-3 hidden w-60 flex-col rounded-shell bg-ink-1 px-3 py-5 lg:flex">
        <div className="mb-7 px-3">
          <Logo size={26} />
        </div>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <p className="mb-1.5 px-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-3">
                {section.label}
              </p>
              {section.items.map((item) => (
                <RailItem key={item.to} item={item} />
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-4 flex items-center gap-1">
          <NavLink
            to={PROFILE_NAV.to}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 items-center gap-3 rounded-btn px-2 py-2 transition-colors duration-150 ${
                isActive ? "bg-ink-2" : "hover:bg-ink-2"
              }`
            }
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ai-soft font-display text-[15px] text-ai">
              {initialOf(user)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-text-1">{name}</span>
              <span className="block truncate text-[12px] text-text-3">View profile</span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-btn text-text-3 transition-colors hover:bg-ink-2 hover:text-text-1"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
              <path d="M10 17l-5-5 5-5" />
              <path d="M5 12h11" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-ink-0/90 px-4 backdrop-blur lg:hidden">
        <Logo size={22} />
        <div className="flex items-center gap-1">
          <nav aria-label="Primary" className="flex items-center gap-1">
            {mobileItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive) + " h-8 px-2.5"}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <NavLink
            to={PROFILE_NAV.to}
            aria-label="Profile"
            className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-ai-soft font-display text-[14px] text-ai"
          >
            {initialOf(user)}
          </NavLink>
        </div>
      </header>

      <div className="lg:pl-[264px]">
        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <ConnectedBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
