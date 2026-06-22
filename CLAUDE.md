@AGENTS.md

# Jetrique Homepage — Project State & Memory

## Project Overview
Homepage for **Jetrique**, a luxury aviation/travel brand (jets, helicopters, stays, destinations).

- **Framework**: Next.js 16.2.7 — App Router
- **Runtime**: React 19.2.4
- **Package Manager**: Bun
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4 (`@theme` block, OKLCH variables, `@utility container`)
- **Animation**: Framer Motion 12
- **State/Data**: TanStack React Query v5
- **UI Primitives**: Radix UI, shadcn, CVA (class-variance-authority)
- **Utilities**: `clsx` + `tailwind-merge` via `cn()`, Lucide React icons, `tw-animate-css`

---

## Build Commands
```bash
bun dev        # development server
bun build      # production build
bun start      # production server
bun lint       # eslint
```

---

## Directory Map
```
app/
  (home)/page.tsx       # Root page — composes header/main/footer
  layout.tsx            # RootLayout: fonts (Geist), QueryProvider, suppressHydrationWarning
  globals.css           # @theme, OKLCH :root vars, dark mode, custom @utility container

components/
  ui/
    button.tsx          # CVA button — data-slot, data-variant, data-size attributes
    card.tsx            # Shadcn card primitive
  features/
    navbar.tsx          # Fixed top header: green banner → charcoal bar → white nav
    hero.tsx            # Banner image + 4-column feature bar
    assets.tsx          # 4 asset cards (Jets/Heli/Stays/Destination) with separators
    blog.tsx            # Shadcn Carousel — 3-up blog cards with images, title, excerpt
    contact-us.tsx      # Framer Motion ticker logos + contact copy block
    footer.tsx          # Contact info row → charcoal bar → green base band

lib/
  utils.ts              # cn() = twMerge(clsx(...))
  queryClient.ts        # Shared QueryClient instance
  sanitization.ts       # Text/HTML validation regex

providers/
  queryProvider.tsx     # QueryClientProvider + ReactQueryDevtools (dev only)

public/
  main-logo.png         # Brand logo (used in Navbar)
  images/
    1.jpg               # Hero banner background
    3–6.svg             # Feature icons (luxury, safety, support, global)
    7–10.jpg            # Asset card images (jets, heli, stays, destination)
    13–15.jpg           # Blog post images (jet interior, dining, mountain)
    16–23.png           # Partner/certification logos (ticker)
    Footer Icon-01–03.svg  # Phone, email, address icons
```

---

## Page Composition — `(home)/page.tsx`
```tsx
<div className="min-h-screen flex flex-col bg-neutral-50/10">
  <header className="w-full flex flex-col fixed top-0 z-50">
    <Navbar />
  </header>
  <main className="flex-grow mt-34 md:mt-28">
    <Hero />
    <Assets />
    <Blog />
    <ContactUs />
    {/* future sections inserted here, above Footer */}
  </main>
  <footer className="w-full flex flex-col">
    <Footer />
  </footer>
</div>
```
- `header` is **fixed** (`z-50`); `main` compensates with `mt-34 md:mt-28`
- New sections slot into `<main>` in document order

---

## Design System

### Brand Colors (hardcoded hex, not in theme vars)
| Token | Value | Usage |
|---|---|---|
| Brand Green | `#8cc63f` | Logo banner, separators, hover states, accents |
| Charcoal | `#3a3a3a` | Navbar/footer separator bar, dark text |
| Text Gray | `#4a4a4a` | Nav links, footer contact text |
| Neutral 500/700 | Tailwind scale | Body copy, headings |

### OKLCH Theme Variables (`globals.css`)
All Shadcn-compatible tokens live in `:root` as OKLCH values. Always prefer semantic vars (`bg-background`, `text-foreground`, `bg-card`, etc.) over raw hex for any new Shadcn-adjacent components. Use hardcoded brand hex only for Jetrique-branded UI (banners, separators, hover underlines).

### Custom Container (`@utility container`)
```css
/* responsive max-widths with inline padding */
sm: padding 1rem
md: max-width 750px,  padding 1.5rem
lg: max-width 1000px, padding 1.5rem
xl: max-width 1200px, padding 1rem
2xl: max-width 1400px, padding 0.5rem
```
Use `<div className="container">` — **not** `container mx-auto` (mx-auto already baked in).

### Recurring UI Patterns

**Section wrapper (standard)**
```tsx
<section className="w-full bg-white py-12 md:py-20 px-4 md:px-8">
  <div className="container">...</div>
</section>
```

**Heading + green underline**
```tsx
<h3 className="text-xl md:text-2xl font-medium text-neutral-700 tracking-wide">
  Section Title
</h3>
<div className="w-86 h-[1.5px] bg-[#8cc63f] mt-3" />
```

**Charcoal separator bar** (Navbar/Footer structural divider)
```tsx
<div className="w-full h-3.5 bg-[#3a3a3a]" />
```

**Green base band** (Footer bottom)
```tsx
<div className="w-full bg-[#8cc63f] py-2 md:py-4" />
```

**Vertical card separator** (Assets pattern)
```tsx
<div className="relative h-70 w-[3px] bg-neutral-200 flex items-center justify-center">
  <div className="absolute w-[6px] h-40 bg-[#8cc63f] shadow-[0_0_8px_rgba(140,198,63,0.3)]" />
</div>
```

**Image hover scale**
```tsx
<div className="group overflow-hidden rounded-[4px]">
  <Image className="object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
</div>
```

---

## Component Rules
1. **All feature components are `"use client"`** — co-located interactivity, no RSC data fetching yet.
2. **`cn()` for all conditional classNames** — never string interpolation.
3. **`data-slot` / `data-variant` / `data-size`** on Shadcn UI primitives — use Tailwind `data-[]` modifiers for compound variant styles.
4. **Next.js `<Image>`** for every image — `fill` for unknown dimensions (use a positioned parent), explicit `width`/`height` for known sizes.
5. **No inline styles** — map everything to Tailwind utilities or CSS variables.
6. **Framer Motion** (`motion.*`) for any continuous animation (e.g. tickers). Prefer Tailwind `transition-*` for simple hover/state transitions.
7. **TypeScript interfaces** defined at the top of each component file for local data shapes.
8. **`React.Fragment` with `key`** when mapping items that include separator elements between them.

---

## Update Log
- **2026-06-04**: Created `Navbar` (`components/features/navbar.tsx`) — green banner, logo, charcoal bar, white nav with hover underline and active pill styles. Integrated into `(home)/page.tsx` as fixed `<header>`. Added `suppressHydrationWarning` to `<html>` and `<body>` in `layout.tsx`.
- **2026-06-04**: Created `Footer` (`components/features/footer.tsx`) — contact row (phone/email/address with SVG icons), charcoal bar, green base band.
- **2026-06-04**: Created `Hero` (`components/features/hero.tsx`) — full-width banner image (`aspect-[21/9]` on md+) with commented-out text overlay, and 4-column feature bar with SVG icons and `border-[#8cc63f]/50` vertical dividers.
- **2026-06-04**: Created `ContactUs` (`components/features/contact-us.tsx`) — Framer Motion infinite ticker of 8 partner logos with edge fade gradients, followed by centered heading + green underline + body copy.
- **2026-06-05**: Created `Assets` (`components/features/assets.tsx`) — 4-card grid (Jets, Heli, Stays, Destination) with `aspect-[3/4]` portrait images, gradient overlays, label + animated arrow, and custom green-accent vertical separators between cards on desktop.
- **2026-06-05**: Initialized comprehensive `CLAUDE.md` documenting full design system, layout hierarchy, color tokens, recurring patterns, and component rules.
- **2026-06-05**: Created `Blog` (`components/features/blog.tsx`) — shadcn `Carousel` (Embla-backed), 3-up desktop / 1-up mobile layout, `aspect-[4/3]` landscape images (13–15.jpg), heading + green underline, section subtitle, green ghost `CarouselPrevious`/`CarouselNext` arrows (`top-[38%]`, `loop: true`). Mounted in `(home)/page.tsx` between `<Assets />` and `<ContactUs />`.
- **2026-06-05**: Revised `Blog` — `<Carousel>` wrapper now encompasses the full header so custom `BlogArrow` components (using `useCarousel()` hook) can be placed inline inside the subtitle row, flanking the subtitle text (left/right). Added `md:border-r md:border-neutral-200` vertical separator between cards on desktop. Replaced Lucide chevrons with `Icons-02.svg` (right-pointing, `rotate-180` for prev).
