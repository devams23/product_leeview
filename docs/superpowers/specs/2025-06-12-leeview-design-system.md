# LeeView Design System

> **Scope:** Chrome Extension overlay + React Dashboard. Both share the same glassmorphism language, adapted to their contexts.
> **Last updated:** 2025-06-12

---

## Core Principle

One background, one glass surface, one accent. Everything else is opacity and typography weight. No drop shadows — the double-border trick (border + outline) creates depth without glow.

---

## Color Tokens

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#1a1b1e` | Page background, matches LeetCode's outer shell |
| `--bg-panel` | `rgba(255,255,255,0.07)` | Glass card surface |
| `--bg-panel-inner` | `rgba(255,255,255,0.04)` | Nested card, table row hover, inner sections |
| `--bg-input` | `rgba(255,255,255,0.06)` | Search bars, filter dropdowns |

### Borders — the glass edges

| Token | Value | Usage |
|-------|-------|-------|
| `--border-glass` | `1px solid rgba(255,255,255,0.12)` | Primary panel border |
| `--border-glass-inner` | `1px solid rgba(255,255,255,0.07)` | Inner dividers, table rows |
| `--border-glass-strong` | `1px solid rgba(255,255,255,0.2)` | Hover state, active card |
| `--outline-depth` | `1px solid rgba(0,0,0,0.3)` | Outer shadow border (double-border trick) |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `rgba(255,255,255,0.88)` | Headings, active labels |
| `--text-secondary` | `rgba(255,255,255,0.45)` | Sub-labels, timestamps, metadata |
| `--text-muted` | `rgba(255,255,255,0.2)` | Placeholder, disabled, empty states |

### The Accent (used sparingly)

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `rgba(255,255,255,0.75)` | Active tab underline, selected row highlight, CTA button fill |
| `--accent-text` | `#111` | Text on top of the accent (the white button) |

### Semantic Score Colors (only for score values, nothing else)

| Score Range | Value |
|-------------|-------|
| Strong (8+) | `rgba(255,255,255,0.8)` — just brighter white, no green |
| Mid (5–7) | `rgba(255,255,255,0.5)` — dimmer white |
| Weak (<5) | `rgba(255,100,100,0.65)` — the only non-white color in the system |

---

## Typography

| Role | Size | Weight | Color / Notes |
|------|------|--------|---------------|
| Page heading | 18px | 500 | `--text-primary` |
| Section label | 11px | 500 | `--text-secondary`, letter-spacing 0.1em, uppercase |
| Table header | 11px | 500 | `--text-muted`, uppercase |
| Table cell | 13px | 400 | `--text-primary` / `--text-secondary` |
| Score number | 22px | 500 | monospace, see semantic score colors above |
| Score sublabel | 10px | 400 | `--text-muted`, monospace |
| Insight text | 12px | 400 | `--text-secondary`, monospace, line-height 1.6 |
| Timestamp / meta | 11px | 400 | `--text-muted`, monospace |

**Typeface:** monospace for all data, labels, scores, timestamps, code. `system-ui` for headings and paragraph text only.

---

## Spacing & Radius

| Token | Value |
|-------|-------|
| `--radius-panel` | 20px — outer glass cards |
| `--radius-inner` | 12px — inner cards, table, chart containers |
| `--radius-pill` | 30px — buttons, tags, filter chips |
| `--radius-sm` | 8px — score pills, badges, small chips |
| Page padding | 32px horizontal, 28px vertical |
| Card padding | 20px |
| Inner section padding | 14px |
| Grid gap between cards | 16px |

---

## Glass Panel — The Core Component

Every card uses this exact layering:

```css
.outer-panel {
  background: var(--bg-panel);
  border: var(--border-glass);
  outline: var(--outline-depth);
  border-radius: var(--radius-panel);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.inner-section {
  background: var(--bg-panel-inner);
  border: var(--border-glass-inner);
  border-radius: var(--radius-inner);
}
```

No drop shadows anywhere. The `outline` on the outer div replaces shadows — it reads as depth without glowing.

---

## Component Specs

### Interview History Table

- **Container:** glass panel, full width
- **Header row:** `--bg-panel-inner`, `--border-glass-inner` bottom border, 11px uppercase muted labels
- **Data rows:** transparent background, `--border-glass-inner` bottom divider, 40px row height
- **Hover state:** `--bg-panel-inner` fill + `--border-glass-strong` left accent border (2px, left side only, radius 0)
- **Sortable columns:** caret icon at 14px in `--text-muted`, active sort column header text goes to `--text-primary`
- **Difficulty tags:** pill chips
  - Hard: `rgba(255,100,100,0.15)` bg + `rgba(255,100,100,0.3)` border
  - Medium: `rgba(255,180,80,0.12)` bg + `rgba(255,180,80,0.25)` border
  - Easy: `rgba(255,255,255,0.08)` bg + `rgba(255,255,255,0.15)` border
  - Text uses same hue at full saturation but reduced opacity — not white
- **Date/time:** monospace, `--text-muted`

### Score Radar Chart

- **Container:** glass panel, square-ish
- **Chart area:** no axis grid lines visible — instead use `rgba(255,255,255,0.06)` concentric pentagons
- **Radar fill:** `rgba(255,255,255,0.1)` with `rgba(255,255,255,0.35)` stroke
- **Data point dots:** 4px, `rgba(255,255,255,0.7)`
- **Axis labels:** 10px monospace, `--text-secondary`
- **Comparison overlay** (e.g. best session vs current): second fill in `rgba(255,255,255,0.04)` with dashed stroke `rgba(255,255,255,0.15)`

### Progress Line Chart

- **Container:** glass panel, full width, 180px tall
- **Grid lines:** horizontal only, `rgba(255,255,255,0.05)`, 3–4 lines max
- **Line stroke:** `rgba(255,255,255,0.6)`, 1.5px
- **Area fill under line:** `rgba(255,255,255,0.05)`
- **Data point on hover:** 5px circle, `rgba(255,255,255,0.9)`, tooltip in a glass pill (`--bg-panel`, `--border-glass-strong`)
- **X-axis labels:** 10px monospace, `--text-muted`

### Code Diff Viewer

- Two-column layout inside a single glass panel, split by a `--border-glass` vertical divider
- Each side: `--bg-panel-inner` background, `border-radius: var(--radius-inner)`, `font-family: monospace`, 13px, line-height 1.7
- **Removed lines:** `rgba(255,80,80,0.08)` row bg, `rgba(255,80,80,0.4)` left border 2px
- **Added lines:** `rgba(255,255,255,0.05)` row bg, `rgba(255,255,255,0.2)` left border 2px
- **Line numbers:** `--text-muted`, 11px, 32px fixed width column

### Transcript Player

- Single column, glass panel
- Each turn is a row: speaker label (YOU / AI) in 10px uppercase monospace `--text-muted`, text in `--text-secondary` 13px
- **Active/highlighted turn:** `--bg-panel-inner` bg + `--border-glass-strong` left border
- **Flagged moments** (from the Flag button during recording): small ⚑ icon in `rgba(255,255,255,0.4)` beside the row, with a subtle `rgba(255,255,255,0.04)` row background tint
- **Turn counter / timestamp:** monospace, `--text-muted`, right-aligned

### Similar Problems

- Horizontal scrollable row of glass chips
- Each chip: `--bg-panel`, `--border-glass`, `--radius-pill`, padding 6px 14px
- Problem title: 12px `--text-primary`, difficulty tag inline beside it
- On hover: `--border-glass-strong`, background shifts to `rgba(255,255,255,0.1)`

---

## Extension-Specific Styles

### Outer Panel (Overlay Widget)

```css
.extension-overlay {
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.22);
  outline: 1px solid rgba(0,0,0,0.18);
  border-radius: 20px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
```

The double border (border + outline) is the trick — it creates the light-catches-edge illusion without actual blur.

### Inner Body States

| State | Background | Usage |
|-------|-----------|-------|
| Idle / Debrief | `rgba(255,255,255,0.82)` | Froated glass sitting inside the outer shell |
| Recording / Listening | `rgba(0,0,0,0.35)` | The only second shade used; just black at low opacity |

### CTA Button States

| State | Background | Text | Border |
|-------|-----------|------|--------|
| Idle | `rgba(255,255,255,0.9)` | `#111` | none |
| Live (recording) | `#2e1f1f` | `#c07070` | `1px solid rgba(255,100,100,0.2)` |
| Debrief ready | `#1e2a24` | `#70a888` | `1px solid rgba(112,168,136,0.2)` |

They signal state without shouting. Low-saturation tints only.

### End Button

- The only semantic exception: faint red
- Background: `rgba(255,100,100,0.1)`, border: `1px solid rgba(255,100,100,0.2)`
- Text: `rgba(255,100,100,0.8)`

---

## Dashboard Layout Grid

```
[  Score Radar  ] [  Progress Over Time (2x wide)  ]
[  Interview History Table — full width             ]
[  Code Diff Viewer (2x wide)  ] [  Transcript      ]
[  Similar Problems — full width scrollable row     ]
```

- 12-column grid, gap: 16px
- Radar = 4 cols
- Progress = 8 cols
- History = 12 cols
- Diff = 8 cols
- Transcript = 4 cols
- Similar Problems = 12 cols

---

## Interaction States

| State | Style |
|-------|-------|
| Default | `--border-glass` |
| Hover | `--border-glass-strong` + `--bg-panel-inner` fill shift |
| Active / selected | white pill button: `background: rgba(255,255,255,0.9)`, `color: #111` |
| Disabled | opacity 0.3, no border change |
| Focus ring (inputs) | `outline: 2px solid rgba(255,255,255,0.25)`, offset 2px |

---

## Notes for Claude Code

- Chrome extensions injecting a `position: fixed` div support `backdrop-filter` natively — no special flags needed.
- The blur radius should be 16–20px. On LeetCode's dark background this makes the panel look lifted off the screen.
- The frosted white panel pops cleanly against LeetCode's `#1a1a1a` editor background — high contrast without fighting the UI for attention.
- One-shade rule: the entire widget is white-on-dark or dark-on-white. No blue, no green, no amber. The only accent is the faint red on the End button — one single semantic exception.
