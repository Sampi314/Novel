# Mobile & Touch Support — Design Spec

**Date**: 2026-03-10
**Feature**: #30 Mobile & Touch Support
**Status**: Approved

## Overview

Add full mobile support to the Thiên Hoang Đại Lục map app: proper touch gestures, responsive navigation, and PWA enhancements. Mobile users get the same capabilities as desktop.

## A. Gesture System (MapViewer.jsx)

### Pinch-to-Zoom Fix
- Current: zooms toward canvas center
- Fix: compute midpoint of two touch points, zoom toward that midpoint in world space
- Track `lastTouchDist` and `lastTouchMid` for smooth delta calculation

### Momentum Scrolling
- Track velocity from last 3-5 touch positions during pan
- On touchend: apply velocity with friction deceleration (factor 0.95)
- Use `requestAnimationFrame` loop, stop when velocity < 0.5px/frame
- Cancel momentum on any new touch

### Double-Tap Zoom
- Detect two taps within 300ms, distance < 20px
- Zoom in 2× toward tap point
- If already at max zoom, zoom out to fit
- Animate zoom over ~200ms with easing

### Long-Press (500ms)
- Show tooltip/bottom sheet for nearest location within 60px radius
- Cancel if finger moves > 10px
- Use `setTimeout` cleared on touchmove/touchend
- Haptic feedback via `navigator.vibrate(10)` if available

## B. Mobile Navigation

### Replace MobileTabBar with Hamburger Menu
- Remove `MobileTabBar.jsx` component
- Add hamburger button: 44×44px, top-left corner, frosted glass background
- Three horizontal bars icon, animates to X when drawer is open

### Slide-Out Drawer
- 280px wide, full viewport height, slides from left
- Same frosted glass aesthetic as desktop sidebar
- All 11 navigation items with Vietnamese labels + small Chinese characters
- Active tab highlighted with gold accent
- Backdrop overlay (rgba(0,0,0,0.5)), tap to close
- Swipe-from-left-edge (within 20px of screen edge) to open
- Swipe-left on drawer to close

## C. Responsive Map UI

### Touch Targets
- All interactive elements: minimum 44×44px on mobile
- Zoom +/- buttons enlarged, moved to bottom-right (above safe area)
- Layer toggle buttons get larger hit areas

### Compact Era Slider
- Horizontal slider below map on mobile (instead of side panel)
- Era labels abbreviated if needed
- Thumb size increased for touch

### Location Info
- Desktop: hover tooltip
- Mobile: bottom sheet (slides up from bottom, 40% viewport height)
- Drag handle at top to expand to full height or dismiss
- Shows same info as desktop tooltip

### Modals
- Full-screen on mobile (no margin, border-radius: 0 at top)
- Close button enlarged, positioned in safe area

## D. Safe Areas & PWA

### Viewport
- Add `viewport-fit=cover` to meta viewport tag
- Use `env(safe-area-inset-*)` padding on navigation elements and bottom UI

### PWA Meta Tags
- Apple touch icon (192×192)
- `theme-color` meta tag matching app background (#05080f)
- Existing `manifest.json` from vite-plugin-pwa handles the rest

## E. CSS Additions

### Mobile Media Query (≤640px)
- Stack/reflow layout adjustments
- Reduced `backdrop-filter: blur(8px)` (performance)
- Hide desktop-only UI elements (sidebar)
- `touch-action: none` on map canvas (prevent browser gestures)
- `-webkit-overflow-scrolling: touch` on scrollable panels

### Touch-Action Rules
- Map canvas: `touch-action: none` (we handle all gestures)
- Scrollable panels: `touch-action: pan-y` (vertical scroll only)
- Buttons: default touch-action (allow browser tap handling)

## Files Affected

| File | Change |
|------|--------|
| `src/map/MapViewer.jsx` | Gesture system overhaul |
| `src/App.jsx` | Replace MobileTabBar with hamburger + drawer |
| `src/components/MobileTabBar.jsx` | Delete |
| `src/components/MobileDrawer.jsx` | New — slide-out navigation |
| `src/index.css` | Mobile media queries, touch rules |
| `index.html` | viewport-fit, PWA meta tags |

## Mobile Breakpoint

640px (matches existing `isMobile` detection in App.jsx).
