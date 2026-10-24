import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { firstName, initialOf } from "../../lib/format";
import { buttonClass } from "../ui/Button";

const NAV = [
  { to: "/dashboard", label: "Overview" },
  { to: "/history", label: "History" },
];

function Logo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5 rounded-chip">
      <span className="grid h-7 w-7 place-items-center rounded-[8px] border border-line-2 bg-ink-3">
        <span className="h-2.5 w-2.5 rounded-full bg-signal shadow-[0_0_12px_rgba(212,255,63,0.6)]" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-text-1">LeeView</span>
    </Link>
  );
}

function navClass(active: boolean) {
  return `relative flex h-9 items-center rounded-btn px-3 text-sm transition-colors duration-150 ${
    active ? "bg-ink-2 text-text-1" : "text-text-2 hover:bg-ink-2/60 hover:text-text-1"
  }`;
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const name = firstName(user);

  return (
    <div className="min-h-screen bg-ink-0">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-ink-0 px-4 py-6 lg:flex">
        <div className="mb-8 px-2">
          <Logo />
        </div>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-signal" />}
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ai-soft font-display text-[16px] text-ai">
              {initialOf(user)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] text-text-1">{name}</p>
              <p className="truncate text-[12px] text-text-2">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className={buttonClass("ghost", "sm", "self-start px-2")}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-ink-0/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive) + " h-8 px-2.5"}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            className={buttonClass("ghost", "sm", "px-2.5")}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="lg:pl-60">
        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
