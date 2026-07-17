# AdaptiveMind Design System - Implementation Guide

## Overview

A modern, professional educational UI design system built with **Poppins font**, **Tailwind CSS**, and a dark blue theme with cyan accents. Designed specifically for Grade 9 educational games and dashboards.

## Quick Start

### 1. **The Design System File**
All design tokens are defined in: `src/styles/design-system.css`

This file contains:
- Typography scales (display, heading, body, label)
- Color palette (dark theme with cyan accent)
- Spacing scale
- Border radius utilities
- Shadow system (including glow effects)
- Animation utilities
- Component classes

### 2. **Global Styles**
The design system is automatically imported in `src/styles.css` alongside Tailwind CSS.

Fonts are loaded in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

## Typography

### Display Text (Large Titles)
```jsx
<h1 className="text-display-lg">Main Title</h1>  // 40px, bold
<h1 className="text-display-md">Section Title</h1> // 32px, bold
<h1 className="text-display-sm">Subsection</h1>   // 28px, bold
```

### Headings
```jsx
<h2 className="text-heading-lg">Page Heading</h2>  // 24px, semibold
<h3 className="text-heading-md">Card Title</h3>     // 20px, semibold
<h4 className="text-heading-sm">Small Heading</h4>  // 18px, semibold
```

### Body Text
```jsx
<p className="text-body-lg">Large body text</p>    // 18px, normal
<p className="text-body-md">Regular text</p>       // 16px, normal
<p className="text-body-sm">Small text</p>         // 14px, normal
```

### Labels (UI)
```jsx
<span className="text-label-lg">Label</span>  // 14px, semibold, uppercase
<span className="text-label-md">Caption</span> // 12px, semibold, uppercase
```

## Colors

### Using CSS Variables
```css
/* Background */
background-color: var(--color-bg-primary);      /* #071426 - Dark blue */
background-color: var(--color-bg-secondary);    /* #0F1F3A - Lighter blue */

/* Text */
color: var(--color-text-primary);    /* #FFFFFF - White */
color: var(--color-text-secondary);  /* #B8C2D1 - Light gray-blue */

/* Accent */
color: var(--color-accent);          /* #00E5FF - Cyan (primary interactive) */

/* Status */
color: var(--color-success);         /* #22C55E - Green */
color: var(--color-error);           /* #EF4444 - Red */
color: var(--color-warning);         /* #F59E0B - Amber */
```

### In React/Tailwind
The colors are accessible via Tailwind classes. Use design system shadows and effects:
```jsx
className="text-accent"           // Cyan text
className="bg-success/10"          // Light green background
className="border-error/30"        // Red border with transparency
```

## Components

### Cards
```jsx
<div className="card rounded-2xl">
  <h2 className="text-heading-lg">Title</h2>
  <p className="text-body-md">Content</p>
</div>
```

Features:
- Rounded corners (12-16px)
- Dark blue background
- Subtle border and shadow
- Hover effect with enhanced shadow
- Professional 6px padding

### Buttons

#### Primary (Cyan with glow)
```jsx
<button className="btn btn-primary btn-lg">
  <Icon className="h-4 w-4" />
  Action
</button>
```

#### Secondary (Outline cyan)
```jsx
<button className="btn btn-secondary btn-md">
  Secondary Action
</button>
```

#### Success/Error
```jsx
<button className="btn btn-success btn-sm">Confirm</button>
<button className="btn btn-error btn-md">Delete</button>
```

### Input Fields
```jsx
<input 
  type="text" 
  className="input-field w-full"
  placeholder="Enter text..."
/>
```

Features:
- Dark background with light border
- Cyan focus state
- Smooth transitions

### Badges
```jsx
<div className="badge badge-primary">
  <Icon className="h-4 w-4" />
  Label
</div>
```

Options: `badge-primary`, `badge-success`, `badge-warning`, `badge-error`

### Game Container
```jsx
<div className="container-game rounded-3xl">
  {/* Game content */}
</div>
```

## Spacing

Use consistent 8px base units:
```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px (most common)
--space-6: 24px (card padding)
--space-8: 32px (section spacing)
```

In Tailwind, use standard spacing utilities: `gap-2`, `p-4`, `my-6`, etc.

## Shadows & Effects

### Glowing Effects (for interactive elements)
```jsx
<button className="glow">Interactive Button</button>
<div className="glow-intense">Highlighted Element</div>
```

Use for:
- Primary buttons
- Interactive cards
- Highlighted papers in games
- Active navigation items

## Border Radius

```
--radius-sm: 4px    (small elements)
--radius-md: 8px    (inputs, badges)
--radius-lg: 12px   (buttons, cards)
--radius-xl: 16px   (large cards)
--radius-2xl: 24px  (sections)
--radius-3xl: 32px  (major containers)
```

## Animations

### Fade In
```jsx
<div className="animate-fade-in">Content fades in</div>
```

### Slide Up
```jsx
<div className="animate-slide-up">Content slides up</div>
```

### Pulse Glow
```jsx
<div className="animate-pulse-glow">Glowing pulse effect</div>
```

## Emotion Colors

For emotion-aware UI elements:
```jsx
className="text-emotion-happy"       // Green
className="text-emotion-neutral"     // Amber
className="text-emotion-confused"    // Purple
className="text-emotion-frustrated"  // Red
className="text-emotion-angry"       // Dark orange
```

## Real-World Examples

### Example 1: Game Question Card
```jsx
<div className="card rounded-2xl">
  <div className="text-label-md text-text-muted">QUESTION 3</div>
  <h2 className="mt-2 text-heading-lg text-accent">What is 1/2 + 1/4?</h2>
  <p className="mt-3 text-body-md text-text-secondary">Hint: Convert to the same denominator</p>
  <button className="mt-4 btn btn-primary btn-lg">Submit Answer</button>
</div>
```

### Example 2: Student Progress
```jsx
<div className="card rounded-2xl">
  <h3 className="text-heading-md">Mathematics Progress</h3>
  <div className="mt-4 flex items-center gap-3">
    <span className="text-label-md text-text-muted">Score</span>
    <span className="text-display-sm text-success font-bold">85%</span>
  </div>
  <div className="mt-3 h-2 rounded-full bg-bg-secondary overflow-hidden">
    <div className="h-full w-[85%] bg-gradient-primary"></div>
  </div>
</div>
```

### Example 3: Status Badge
```jsx
<div className="badge badge-success">
  <CheckCircle2 className="h-4 w-4" />
  Task Completed
</div>
```

## Best Practices

1. **Always use text-* classes** for consistent typography sizing
2. **Use CSS variables** for colors instead of hardcoding hex values
3. **Apply glow effects** to interactive elements to guide user attention
4. **Maintain consistent spacing** using the 8px scale
5. **Use rounded corners** (16px is standard for cards)
6. **Leverage shadows** for depth, not just borders
7. **Group related information** in cards with consistent styling
8. **Use color purposefully**:
   - Cyan = actionable/interactive
   - Green = success/positive
   - Red = errors/warnings
   - Amber = warnings/caution

## Migration Guide

If updating an existing component to use the design system:

### Old
```jsx
<div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
  <h2 className="text-xl font-semibold">Title</h2>
  <button className="rounded-2xl bg-primary px-4 py-3">Button</button>
</div>
```

### New
```jsx
<div className="card rounded-2xl">
  <h2 className="text-heading-lg">Title</h2>
  <button className="btn btn-primary btn-md">Button</button>
</div>
```

## Testing the Design System

Components updated to use the design system:
- ✅ `fraction-room.jsx` - Complete modern redesign
- ✅ `StudentDashboard.jsx` - Header and sections
- 🔄 Other components (in progress)

To verify the design is working:
1. Run `npm run dev`
2. Navigate to Fraction Room (`/fraction-room`)
3. Check that:
   - Poppins font is used
   - Colors match the specification
   - Cards have proper shadows and rounded corners
   - Buttons have cyan color with glow effect
   - Cyan accent is prominent

## Support

For questions about the design system:
- Check `src/styles/design-system.css` for all available variables
- Review component examples in updated files like `fraction-room.jsx`
- Refer to this guide for typography and color standards

---

**Design System Created**: June 2026
**Framework**: React + Tailwind CSS + Poppins Font
**Theme**: Modern Dark Academic with Cyan Accents
