import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { firstName } from "../../lib/format";
import {
  NAV_FOOTER,
  NAV_SECTIONS,
  PROFILE_NAV,
  SIGN_OUT_ICON,
  START_ICON,
  START_INTERVIEW_URL,
  type NavItem,
} from "../../lib/nav";
import { Avatar } from "../ui/Avatar";
import { buttonClass } from "../ui/Button";
import { Brand, BrandMark, Wordmark } from "../ui/BrandMark";

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
  return `flex items-center rounded-btn text-sm transition-colors duration-150 ${
    active ? "bg-signal-soft text-text-1 [&_svg]:text-signal" : "text-text-2 hover:bg-ink-2 hover:text-text-1"
  }`;
}

/** Holds a row's icon: the width of the collapsed rail, so icons stay put as it opens. */
const SLOT = "grid h-10 w-10 shrink-0 place-items-center";

function RailItem({ item }: { item: NavItem }) {
  if (item.soon) {
    return (
      <span className="flex cursor-default items-center rounded-btn text-sm text-text-3" aria-disabled="true">
        <span className={SLOT}>{item.icon}</span>
        <span className="lv-rail-label flex-1">{item.label}</span>
        <span className="lv-rail-label pr-3 text-[12px]">Soon</span>
      </span>
    );
  }
  return (
    <NavLink to={item.to} className={({ isActive }) => navClass(isActive)}>
      <span className={SLOT}>{item.icon}</span>
      <span className="lv-rail-label">{item.label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const name = firstName(user);
  const mobileItems = [...NAV_SECTIONS.flatMap((s) => s.items), ...NAV_FOOTER].filter((i) => !i.soon);

  return (
    <div className="min-h-screen bg-ink-0">
      {/* Desktop rail: icons only until hovered or tabbed into, then it opens over the page. */}
      <aside className="lv-rail fixed inset-y-3 left-3 z-30 hidden flex-col rounded-shell border border-line bg-ink-1 p-3 lg:flex">
        <Link to="/dashboard" aria-label="LeeView" className="mb-5 flex items-center rounded-btn">
          <span className={SLOT}>
            <BrandMark size={26} />
          </span>
          <span className="lv-rail-label">
            <Wordmark />
          </span>
        </Link>
        <a
          href={START_INTERVIEW_URL}
          target="_blank"
          rel="noreferrer"
          className="mb-5 flex items-center rounded-btn bg-signal text-sm font-medium text-signal-ink transition-colors duration-150 hover:bg-signal/90"
        >
          <span className={SLOT}>{START_ICON}</span>
          <span className="lv-rail-label">Start an interview</span>
        </a>
        <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="flex flex-col gap-1 border-line not-first:border-t not-first:pt-3">
              {section.items.map((item) => (
                <RailItem key={item.to} item={item} />
              ))}
            </div>
          ))}
        </nav>
        {NAV_FOOTER.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {NAV_FOOTER.map((item) => (
              <RailItem key={item.to} item={item} />
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center">
          <NavLink
            to={PROFILE_NAV.to}
            aria-label={`${name}, view profile`}
            className={({ isActive }) =>
              `flex min-w-[40px] flex-1 items-center rounded-btn transition-colors duration-150 ${
                isActive ? "bg-ink-2" : "hover:bg-ink-2"
              }`
            }
          >
            <span className={SLOT}>
              <Avatar user={user} size={30} />
            </span>
            <span className="lv-rail-label min-w-0 truncate text-[13px] text-text-1">{name}</span>
          </NavLink>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className={`lv-rail-label ${SLOT} rounded-btn text-text-3 hover:bg-ink-2 hover:text-text-1`}
          >
            {SIGN_OUT_ICON}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-ink-0/90 px-4 backdrop-blur-sm lg:hidden">
        <Logo size={22} />
        <div className="flex items-center gap-1">
          <nav aria-label="Primary" className="flex items-center gap-1">
            {mobileItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={({ isActive }) => navClass(isActive) + " h-8 gap-2 px-2.5"}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <NavLink
            to={PROFILE_NAV.to}
            aria-label="Profile"
            className="ml-1 rounded-full"
          >
            <Avatar user={user} size={32} />
          </NavLink>
        </div>
      </header>

      <div className="lg:pl-[76px]">
        <main className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <ConnectedBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
