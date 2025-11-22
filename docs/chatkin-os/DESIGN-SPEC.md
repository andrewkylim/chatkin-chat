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

#### 2. Full-Height Container
```css
html, body {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

#app {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
}
```

#### 3. Chat Layout Structure
```css
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  flex-shrink: 0;           /* Fixed height header */
  padding: 16px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.messages {
  flex: 1;                  /* Grows to fill space */
  overflow-y: auto;         /* Scrolls independently */
  -webkit-overflow-scrolling: touch;  /* Smooth iOS scrolling */
  padding: 16px;
}

.input-container {
  flex-shrink: 0;           /* Fixed height input */
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom)); /* iPhone notch */
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
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
