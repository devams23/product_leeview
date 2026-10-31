import type { ReactNode } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Planned page: listed so the menu shows where it is heading, but not clickable yet. */
  soon?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const icons = {
  overview: svg(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  history: svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>),
  profile: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
};

/** The app menu. Add a section or item here and both the desktop rail and the mobile bar pick it up. */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Practice",
    items: [
      { to: "/dashboard", label: "Overview", icon: icons.overview },
      { to: "/history", label: "History", icon: icons.history },
    ],
  },
];

/** Where the rail's main button goes: LeetCode, because interviews start from the panel there. */
export const START_INTERVIEW_URL = "https://leetcode.com/problemset/";

export const PROFILE_NAV: NavItem = { to: "/profile", label: "Profile", icon: icons.profile };
