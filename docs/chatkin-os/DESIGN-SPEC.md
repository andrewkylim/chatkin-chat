# Chatkin OS Design Specification

## Core Design Language (from MVP)

### Color Palette

```css
/* Light Mode */
--bg-primary: #F7F5F3;      /* Warm beige background */
--bg-secondary: #FFFFFF;     /* White cards/containers */
--bg-tertiary: #FBF9F7;      /* Subtle background variation */
--text-primary: #2A2A2A;     /* Dark gray text */
--text-secondary: #737373;   /* Medium gray */
--text-muted: #A3A3A3;       /* Light gray */
--border-color: #E0DDD9;     /* Subtle tan borders */
--accent-primary: #C77C5C;   /* Terracotta/rust (primary actions) */
--accent-hover: #B86C4C;     /* Darker terracotta */
--accent-success: #5D9B76;   /* Sage green (completed states) */
--danger: #D32F2F;           /* Red (destructive actions) */
```

### Typography

- **Font**: 'Inter' (Google Fonts)
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Letter spacing**: -0.01em (body), -0.02em to -0.03em (headings)
- **Line height**: 1.5-1.6 (body), 1.2-1.4 (headings)

### Spacing & Sizing

- **Border radius**: 6px (small), 8px (medium), 12px (large)
- **Padding**: 12px (compact), 16-20px (standard), 24px (spacious)
- **Gaps**: 8px (tight), 12-16px (standard), 20-24px (loose)

---

## Critical Mobile UI Pattern (WhatsApp Approach)

### ⚠️ IMPORTANT: Only Apply to Chat Pages

**This pattern is ONLY for chat interfaces** (Global Chat, Project Chat, Tasks Chat, Notes Chat).

**DO NOT apply to:**
- Landing pages
- Marketing pages
- Authentication pages
- Any page that needs normal scrolling

The `overflow: hidden` on `html, body` prevents scrolling, which is intentional for chat but breaks regular pages.

### The Problem We Solved
Mobile keyboard covering chat input, viewport jumping, scroll issues

### The Solution (MUST IMPLEMENT for Chat Pages Only)

#### 1. Viewport Meta Tag
```html
<meta name="viewport"
      content="width=device-width,
               initial-scale=1.0,
               maximum-scale=1.0,
               user-scalable=no,
               viewport-fit=cover,
               interactive-widget=resizes-content">
```
☝️ `interactive-widget=resizes-content` is critical - tells mobile browsers to resize viewport when keyboard appears

#### 2. Global HTML/Body Setup (app.css)
```css
/* DO NOT add overflow: hidden here - breaks non-chat pages! */
html, body {
  height: 100%;
  margin: 0;
  /* Let each page control its own overflow */
}
```

#### 3. Chat Page Scoped Styles (CRITICAL - Prevents iOS Elastic Scroll)
```svelte
<!-- routes/chat/+page.svelte -->
<style>
  /* ONLY for chat page: Lock viewport to prevent elastic scroll/dragging on mobile */
  :global(html),
  :global(body) {
    overflow: hidden;           /* Prevent document-level scroll */
    overscroll-behavior: none;  /* iOS 16+ fix for elastic bounce */
  }

  .chat-page {
    min-height: 100vh;
    background: var(--bg-primary);
  }
</style>
```

☝️ **Why `:global()`?** This applies `overflow: hidden` ONLY when the chat page is rendered, preventing it from breaking other pages.

#### 4. Mobile Chat Layout Component (MobileChatLayout.svelte)
```css
/* Full-screen container - WhatsApp pattern */
.mobile-chat-layout {
  position: absolute;           /* NOT fixed - avoids iOS keyboard issues */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
  overscroll-behavior: none;    /* Extra protection against elastic scroll */
}

/* Header: flex-shrink: 0 (NOT position: fixed!) */
.chat-header {
  flex-shrink: 0;               /* Stays at top, in flex flow */
  padding: 16px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  height: 64px;
  box-sizing: border-box;
}

/* Messages Area: flex: 1 (fills remaining space) */
.messages-area {
  flex: 1;                      /* Grows to fill space */
  overflow-y: auto;             /* Scrolls independently */
  -webkit-overflow-scrolling: touch;  /* Smooth iOS scrolling */
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transform: translate3d(0, 0, 0);    /* GPU acceleration */
  touch-action: pan-y;          /* Only allow vertical scrolling */
  overscroll-behavior: contain; /* Contain scroll to this element */
}

/* Input Bar: flex-shrink: 0 (NOT position: fixed!) */
.input-bar {
  flex-shrink: 0;               /* Stays at bottom, in flex flow */
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  box-sizing: border-box;
}

.message-input {
  flex: 1;
  border: 1px solid var(--border-color);
  padding: 10px 14px;
  background: var(--bg-tertiary);
  touch-action: manipulation;   /* Faster tap response on mobile */
}

/* Bottom Nav: flex-shrink: 0 (NOT position: fixed!) */
.bottom-nav {
  flex-shrink: 0;
  display: flex;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  height: calc(50px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
}
```

#### 4. Implementation in SvelteKit

**For Chat Pages Only:**
```svelte
<!-- routes/chat/+page.svelte or routes/projects/[id]/chat/+page.svelte -->
<div class="chat-page">
  <!-- Chat interface goes here -->
</div>

<style>
  /* Apply mobile pattern ONLY to chat pages */
  .chat-page {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden; /* Scoped to this page only */
  }
</style>
```

**For Regular Pages (Landing, Auth, etc.):**
```svelte
<!-- routes/+page.svelte (landing page) -->
<div class="landing">
  <!-- Normal scrollable content -->
</div>

<style>
  .landing {
    /* NO overflow:hidden, NO position:absolute */
    /* Let the page scroll normally */
    min-height: 100vh;
  }
</style>
```

---

## Component Styles

### Buttons
```css
.primary-btn {
  background: #2A2A2A;
  color: white;
  padding: 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9375rem;
  transition: all 0.2s ease;
}

.primary-btn:hover {
  background: #3A3A3A;
  transform: translateY(-1px);
}

.primary-btn:active {
  transform: translateY(0);
}
```

### Message Bubbles
```css
.message-bubble {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.message.user .message-bubble {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  margin-left: auto;
}

.message.ai .message-bubble {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  margin-right: auto;
}
```

### Input Fields
```css
input, textarea {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.9375rem;
  font-family: 'Inter', sans-serif;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
}
```

---

## 🔑 WHY THIS MOBILE CHAT PATTERN WORKS

### The iOS Safari Elastic Scroll Problem

**Problem:** On iOS Safari, if html/body are scrollable, the user can drag the entire page up/down with an elastic "rubber band" effect, even when there's no content to scroll. This makes the chat layout feel unstable and unprofessional.

**Solution:** Lock the document-level scroll with `overflow: hidden` and `overscroll-behavior: none`, but ONLY on chat pages using `:global()` scoping.

### Why We Use `position: absolute` Instead of `position: fixed`

**THREE critical reasons:**

1. **iOS Keyboard Behavior**
   When an input is focused on iOS Safari, `position: fixed` elements are converted to `position: absolute`, causing unexpected layout jumps.

2. **Safari Toolbar Collapsing**
   iOS Safari has a collapsing address bar. `position: fixed` calculates position based on the visual viewport, which changes as the toolbar appears/disappears, causing the layout to "jump".

3. **Safe Area Insets**
   iPhones with notches use `env(safe-area-inset-bottom)`. Fixed positioning doesn't always respect these safe areas correctly, while the flexbox approach maintains consistent spacing.

### Why We Use `flex-shrink: 0` Instead of `position: fixed` for Header/Input/Nav

**The flexbox approach:**
- Keeps all elements in the flex flow (no z-index conflicts)
- Respects safe area insets naturally
- No layout jumps when keyboard appears
- Each section knows its height requirements
- Messages area flexibly fills remaining space

**What `position: fixed` would cause:**
- Z-index conflicts blocking touch events
- Elements don't resize with viewport changes
- Safe area insets require manual calculation
- Layout jumps when iOS Safari toolbar collapses

### The Complete Flow

1. **`:global()` scope** locks html/body overflow ONLY on chat pages
2. **`position: absolute`** container fills viewport without fixed positioning issues
3. **`flex-shrink: 0`** keeps header/input/nav in flex flow
4. **`flex: 1`** messages area fills remaining space
5. **`overflow-y: auto`** on messages enables scrolling INSIDE the container
6. **`overscroll-behavior: contain`** prevents scroll from bubbling to document
7. **`touch-action: pan-y`** optimizes touch scrolling on messages
8. **`touch-action: manipulation`** speeds up taps on inputs

### Testing Checklist

✅ Chat page has no elastic bounce/dragging
✅ Homepage and other pages scroll normally
✅ Messages scroll smoothly within their container
✅ Keyboard doesn't cause layout jumps
✅ Header stays at top (doesn't move)
✅ Input/nav stay at bottom (don't move)
✅ Safe area insets work on iPhone notches
✅ No z-index conflicts blocking touch

---

## Responsive Breakpoints

```css
/* Mobile-first approach */
/* Base styles = mobile */

@media (min-width: 640px) {
  /* Tablet adjustments */
}

@media (min-width: 1024px) {
  /* Desktop */
  .bottom-tabs {
    display: none; /* Hide on desktop */
  }

  .sidebar {
    display: block; /* Show sidebar on desktop */
  }
}
```

---

## Key Design Principles

1. **Mobile-first** - All layouts work on mobile, enhance for desktop
2. **Warm & Calm** - Beige/terracotta palette feels approachable, not clinical
3. **Clear Hierarchy** - Bold weights and tight letter-spacing for important text
4. **Smooth Interactions** - Subtle transforms and transitions (0.2s ease)
5. **Safe Areas** - Always use `env(safe-area-inset-*)` for iPhone notches

---

## Critical Do's and Don'ts

### ✅ DO:
- Use the exact viewport meta tag shown above
- Use flexbox with `flex: 1` for scrollable areas
- Set `overflow: hidden` on html/body
- Use `position: absolute` on main app container
- Include safe area insets for iOS

### ❌ DON'T:
- Use `vh` units for height (breaks on mobile keyboard)
- Use `position: fixed` for input areas
- Forget `-webkit-overflow-scrolling: touch`
- Use `user-scalable=yes` (causes issues)
