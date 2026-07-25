# Vedha Design System — TaskFlow

TaskFlow follows the **Vedha** brand language ([vedha.ae](https://vedha.ae/)): dark-first luxury SaaS, teal → champagne gold accents, glass surfaces, generous whitespace.

## Tokens

| Token | Value |
|-------|--------|
| Primary BG | `#09090B` |
| Secondary BG | `#111827` |
| Surface | `rgba(255,255,255,0.04)` |
| Cards | `rgba(255,255,255,0.05)` |
| Borders | `rgba(255,255,255,0.08)` |
| Radius | `18px` |
| Blur | `20px` |
| Teal | `#0f6661` |
| Mid | `#2f5d5a` |
| Cyan | `#a1c8cf` |
| Gold | `#d4a574` |
| Champagne | `#e0c49a` |

## Typography

- **Inter** (primary)
- **Manrope** (fallback)

## CSS utilities

- `.glass` / `.glass-card` — glassmorphism
- `.gradient-vedha` / `.gradient-vedha-animated` — brand gradient
- `.btn-gradient` — primary CTA
- `.text-gradient-vedha` — gradient text
- `.mesh-vedha` — atmospheric background

## Theme

Dark by default (`storageKey: taskflow-theme`). Light optional via toggle.

## Components to prefer

- Gradient `Button` (default variant)
- `Card` (glass-card)
- Floating search in navbar + ⌘K
- `AiAssistant` on all dashboard routes
- `EmptyState` for vacant views
