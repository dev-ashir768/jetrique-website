<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Jetrique Homepage Project State & Memory

## Project Overview
This repository contains the homepage for **Jetrique**, built using:
- **Core Framework**: Next.js 16.2.7 (App Router) & React 19.2.4
- **Package Manager**: Bun
- **Styling**: Tailwind CSS v4 (using OKLCH colors, theme block variables, and CSS-in-JS properties via `@theme`)
- **Data Fetching/State**: TanStack React Query v5 with custom queryClient
- **UI Libraries**: Radix UI, Lucide React, and tw-animate-css

## Directory Map
- `app/` - Application routes (Next.js App Router).
  - `(home)/page.tsx` - Root page component rendering `<header>` (`<Navbar />`), `<main>` (`<Hero />`, `<ContactUs />`), and `<footer>` (`<Footer />`).
  - `layout.tsx` - Main layout importing global styles, fonts, and setting metadata.
  - `globals.css` - Custom styling theme, oklch colors, base layer overrides, and custom `@utility container`.
- `components/` - Application components.
  - `ui/` - Atomic UI components (`button.tsx`, `card.tsx`).
  - `features/` - Feature-level components (`navbar.tsx`, `footer.tsx`, `hero.tsx`, `contact-us.tsx`).
- `providers/` - Provider wrappers.
  - `queryProvider.tsx` - Query client wrapper with react-query devtools enabled in dev.
- `lib/` - Utility libraries.
  - `queryClient.ts` - Shared `QueryClient` instantiation.
  - `sanitization.ts` - Basic text and HTML validation regex.
  - `utils.ts` - Core tailwind-merge helper function `cn`.

## Component Guidelines
1. **Shadcn UI & HTML data attributes**: Component styling uses native HTML `data-` attributes (`data-slot`, `data-variant`, `data-size`) to control responsive and compound variant styles. Prefer nesting styles using Tailwind selector modifiers (e.g. `group-data-[size=sm]/card:px-3` or `has-data-[slot=card-footer]:pb-0`) to keep components clean.
2. **OKLCH Color Palette**: Color definitions in `globals.css` are written in OKLCH space. Use variables (`bg-card`, `text-card-foreground`, etc.) instead of hardcoded hex/rgb values.
3. **Vanilla CSS & Tailwind v4**: Standard Tailwind CSS rules apply. Do not use inline styles or random classes for colors/borders unless it maps to theme variables.

## Update Log
- **2026-06-04**: Created the brand `Navbar` component (`components/features/navbar.tsx`) showing a centered brand-green banner, logo, charcoal separator bar, and hover-enabled navigation items. Integrated it into the home page route under a semantic `<header>` wrapper. Added `suppressHydrationWarning` on `<html>` and `<body>` tags in `app/layout.tsx` to handle browser extension attribute injections.
- **2026-06-04**: Created the brand `Footer` component (`components/features/footer.tsx`) with contact list (phone, email, address), green separator bar, and green base banner. Mounted it in `(home)/page.tsx` inside a semantic `<footer>` tag.
- **2026-06-04**: Created the `Hero` component (`components/features/hero.tsx`) containing a responsive helicopter banner image with overlay experience typography, and a 4-column icon-description details bar underneath. Mounted it in `(home)/page.tsx` inside the `<main>` tag.
- **2026-06-04**: Created the `ContactUs` component (`components/features/contact-us.tsx`) featuring a floating row of partner logos (`16.png` to `23.png`) and centered contact description with a green separator. Integrated it in `(home)/page.tsx` inside the `<main>` tag.
- **2026-06-05**: Created the `Assets` component (`components/features/assets.tsx`) featuring the 4 categories (Jets, Heli, Stays, Destination) with customized premium UI styling, hover animations, responsive layout, and vertical separators matching the provided UI mockup. Mounted it in `(home)/page.tsx` directly below the `Hero` component.
- **2026-06-05**: Refactored the route structure to add a global layout `app/(home)/layout.tsx` mounting the `Navbar` and `Footer` so all child pages inherit them automatically, and simplified `app/(home)/page.tsx` accordingly.
- **2026-06-05**: Styled the "Our Product" navbar element as a brand-green border capsule outline pointing to `/our-products`.
- **2026-06-05**: Created the `OurProducts` route page (`app/(home)/our-products/page.tsx`) mapping 1.jpg to 4.jpg in a 4-column design with vertical separators, description logs, custom clock indicators, and interactive Book Now buttons.
- **2026-06-05**: Fixed the responsive layout on `OurProducts` page to render 4 columns on large screens, 2 columns on medium, and 1 column on mobile viewports with clean absolute separators. Implement active page tracking in `Navbar` to dynamically highlight the current active navigation item.
- **2026-06-05**: Created the `AboutUs` feature component (`components/features/about-us.tsx`) with alternating responsive layout rows and brand-green separators. Created the `about-us` route page (`app/(home)/about-us/page.tsx`) rendering it, and updated the Navbar route links to map to `/about-us`.
- **2026-06-09**: Created the premium `ContactDetails` feature component (`components/features/contact-details.tsx`) featuring contact cards using brand-aligned footer icons, an interactive contact form, and a responsive container layout. Created the route page `app/(home)/contact-us/page.tsx` rendering it, and updated the Navbar route links to map to `/contact-us` (formerly empty).
