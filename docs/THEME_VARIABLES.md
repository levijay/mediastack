# MediaStack Theme CSS Variables Reference
# ==========================================
# 
# Theme System with Element-Based Naming
# All colors are CSS variables - NO HARDCODED COLORS
#
# BASE THEME PROPERTIES (5 core colors):
# - background:   Page background color
# - cardBg:       Card/surface background color
# - navbarBg:     Navbar background, button bg, selected items, accent color
# - hoverBg:      Hover states (navbar hover, button hover)
# - rowHoverBg:   Table row / cell hover background

## BASE COLORS (set from theme)
--page-bg            # Page background (= background)
--card-bg            # Card/surface background (= cardBg)
--navbar-bg          # Navigation bar background (= navbarBg)
--hover-bg           # General hover state (= hoverBg)
--row-hover-bg       # Table row hover (= rowHoverBg)

## NAVBAR
--navbar-text        # Navigation text color
--navbar-hover       # Nav link hover background (= hoverBg)
--navbar-active      # Active nav link background (= hoverBg)
--navbar-border      # Navbar bottom border (= hoverBg)
--navbar-brand       # Logo/brand text color

## BUTTONS - PRIMARY
--btn-primary-bg     # Primary button background (= navbarBg)
--btn-primary-text   # Primary button text
--btn-primary-hover  # Primary button hover (= hoverBg)
--btn-primary-border # Primary button border
--btn-primary-focus  # Primary button focus ring

## BUTTONS - SECONDARY
--btn-secondary-bg     # Secondary button background (= cardBg)
--btn-secondary-text   # Secondary button text
--btn-secondary-hover  # Secondary button hover (= rowHoverBg)
--btn-secondary-border # Secondary button border (= hoverBg)
--btn-secondary-focus  # Secondary button focus ring

## BUTTONS - DANGER
--btn-danger-bg      # Danger button background
--btn-danger-text    # Danger button text
--btn-danger-hover   # Danger button hover
--btn-danger-border  # Danger button border
--btn-danger-focus   # Danger button focus ring

## TEXT
--text-primary       # Main text color
--text-secondary     # Secondary text color
--text-muted         # Muted/subtle text
--text-link          # Link text color (= navbarBg)
--text-link-hover    # Link hover color (= hoverBg)

## HEADINGS
--heading-text       # Page heading color
--card-title         # Card title color

## BORDERS
--border-color       # Default border color (= hoverBg)
--border-light       # Light border color
--border-focus       # Focus border color (= navbarBg)

## CARDS & SURFACES
--surface-bg         # Surface background (= cardBg)
--surface-hover      # Surface hover (= rowHoverBg)
--surface-border     # Surface border (= hoverBg)
--card-border        # Card border (= hoverBg)
--card-shadow        # Card shadow color

## INPUTS & FORMS
--input-bg           # Input background (= background)
--input-text         # Input text color
--input-placeholder  # Input placeholder color
--input-border       # Input border (= hoverBg)
--input-focus-border # Input focus border (= navbarBg)
--input-focus-ring   # Input focus ring (= navbarBg)

## TABLES
--table-bg           # Table background (= cardBg)
--table-header-bg    # Table header background (= background)
--table-row-hover    # Table row hover (= rowHoverBg)
--table-border       # Table border (= hoverBg)
--table-text         # Table text color

## MODALS & DIALOGS
--modal-bg           # Modal background (= cardBg)
--modal-overlay      # Modal overlay color
--modal-border       # Modal border (= hoverBg)

## DROPDOWNS & MENUS
--dropdown-bg        # Dropdown background (= cardBg)
--dropdown-hover     # Dropdown item hover (= rowHoverBg)
--dropdown-border    # Dropdown border (= hoverBg)
--dropdown-text      # Dropdown text color

## SELECTION & ACTIVE STATES
--selected-bg        # Selected item background (= navbarBg)
--selected-text      # Selected item text
--active-bg          # Active state background (= hoverBg)
--focus-ring         # Focus ring color (= navbarBg)

## SCROLLBAR
--scrollbar-track    # Scrollbar track (= background)
--scrollbar-thumb    # Scrollbar thumb (= hoverBg)
--scrollbar-thumb-hover # Scrollbar thumb hover (= rowHoverBg)

## BADGES & TAGS
--badge-bg           # Badge background (= hoverBg)
--badge-text         # Badge text color

## TOOLTIPS
--tooltip-bg         # Tooltip background
--tooltip-text       # Tooltip text

## LOADING & SPINNERS
--spinner-color      # Loading spinner color (= navbarBg)
--skeleton-bg        # Skeleton loader background (= hoverBg)

## PROGRESS BARS
--progress-bg        # Progress bar track (= hoverBg)
--progress-fill      # Progress bar fill (= navbarBg)

## TABS
--tab-bg             # Tab background (= cardBg)
--tab-active-bg      # Active tab background (= navbarBg)
--tab-active-text    # Active tab text
--tab-hover          # Tab hover background (= rowHoverBg)
--tab-text           # Tab text color
--tab-border         # Tab border (= hoverBg)

## TOGGLE / SWITCH
--toggle-bg          # Toggle background (= hoverBg)
--toggle-active-bg   # Toggle active background (= navbarBg)
--toggle-thumb       # Toggle thumb color

# ==========================================
# THEME DEFINITIONS
# ==========================================
# Format: { background, cardBg, navbarBg, hoverBg, rowHoverBg }

# Default Dark
background: oklch(0.15 0 0)
cardBg: oklch(0.22 0 0)
navbarBg: oklch(0.45 0.15 250)
hoverBg: oklch(0.3 0.08 250)
rowHoverBg: oklch(0.28 0.05 250)

# Default Light
background: oklch(0.97 0 0)
cardBg: oklch(1 0 0)
navbarBg: oklch(0.45 0.15 250)
hoverBg: oklch(0.92 0.02 250)
rowHoverBg: oklch(0.95 0.01 250)

# Minimal
background: oklch(0.14 0 0)
cardBg: oklch(0.2 0 0)
navbarBg: oklch(0.92 0 0)
hoverBg: oklch(0.27 0 0)
rowHoverBg: oklch(0.37 0 0)

# autobrr
background: oklch(0.21 0.01 285.89)
cardBg: oklch(0.27 0.01 286.03)
navbarBg: oklch(0.62 0.19 259.81)
hoverBg: oklch(0.37 0.01 285.81)
rowHoverBg: oklch(0.37 0.03 259.73)

# Napster
background: oklch(0.78 0 0)
cardBg: oklch(1 0 0)
navbarBg: oklch(0.3 0.14 265.14)
hoverBg: oklch(0.78 0 0)
rowHoverBg: oklch(0.82 0.17 99.27)

# Nightwalker
background: oklch(0.31 0.02 262.24)
cardBg: oklch(0.35 0.02 262.59)
navbarBg: oklch(0.62 0.19 259.81)
hoverBg: oklch(0.41 0.04 254.55)
rowHoverBg: oklch(0.41 0.04 254.55)

# Swizzin
background: oklch(0.25 0 0)
cardBg: oklch(0.31 0 0)
navbarBg: oklch(0.71 0.15 166.57)
hoverBg: oklch(0.46 0.07 250.95)
rowHoverBg: oklch(0.39 0 0)

# The Kyle
background: oklch(0.21 0.02 248.83)
cardBg: oklch(0.25 0.08 282.88)
navbarBg: oklch(0.54 0.23 351.56)
hoverBg: oklch(0.72 0.13 223.94)
rowHoverBg: oklch(0.38 0.16 351.45)

# Amber Minimal
background: oklch(0.2 0 0)
cardBg: oklch(0.27 0 0)
navbarBg: oklch(0.64 0.13 73.98)
hoverBg: oklch(0.27 0 0)
rowHoverBg: oklch(0.47 0.12 46.2)

# Amethyst Haze
background: oklch(0.22 0.02 292.85)
cardBg: oklch(0.25 0.03 292.73)
navbarBg: oklch(0.71 0.08 302.05)
hoverBg: oklch(0.46 0.05 295.56)
rowHoverBg: oklch(0.32 0.03 308.61)

# Bubblegum
background: oklch(0.25 0.03 234.16)
cardBg: oklch(0.29 0.03 233.54)
navbarBg: oklch(0.92 0.08 87.67)
hoverBg: oklch(0.78 0.08 4.13)
rowHoverBg: oklch(0.67 0.1 356.98)

# Catppuccin
background: oklch(0.22 0.03 284.06)
cardBg: oklch(0.24 0.03 283.91)
navbarBg: oklch(0.22 0.03 284.06)
hoverBg: oklch(0.48 0.03 278.64)
rowHoverBg: oklch(0.32 0.03 281.98)

# Claude
background: oklch(0.27 0 106.64)
cardBg: oklch(0.25 0 106.53)
navbarBg: oklch(0.67 0.13 38.76)
hoverBg: oklch(0.98 0.01 95.1)
rowHoverBg: oklch(0.21 0.01 95.42)

# Cyberpunk
background: oklch(0.16 0.04 281.83)
cardBg: oklch(0.25 0.06 281.14)
navbarBg: oklch(0.67 0.29 341.41)
hoverBg: oklch(0.25 0.06 281.14)
rowHoverBg: oklch(0.57 0.12 165.75)

# Kitsune
background: oklch(0 0 0)
cardBg: oklch(0.13 0.01 285)
navbarBg: oklch(0.78 0.1 350.12)
hoverBg: oklch(0.18 0.01 285.33)
rowHoverBg: oklch(0.22 0.04 349.62)

# Nord
background: oklch(0.32 0.02 264.18)
cardBg: oklch(0.38 0.03 266.47)
navbarBg: oklch(0.77 0.06 217.47)
hoverBg: oklch(0.76 0.05 194.49)
rowHoverBg: oklch(0.59 0.08 254.03)

# Perpetuity
background: oklch(0.21 0.02 224.45)
cardBg: oklch(0.23 0.03 216.07)
navbarBg: oklch(0.85 0.13 195.04)
hoverBg: oklch(0.38 0.06 216.5)
rowHoverBg: oklch(0.38 0.06 216.5)

# Synthwave
background: oklch(0.19 0.07 304.57)
cardBg: oklch(0.22 0.08 303.76)
navbarBg: oklch(0.75 0.18 346.81)
hoverBg: oklch(0.34 0.14 305.57)
rowHoverBg: oklch(0.31 0.11 303.32)

# Tangerine
background: oklch(0.26 0.03 262.67)
cardBg: oklch(0.31 0.03 268.64)
navbarBg: oklch(0.64 0.17 36.44)
hoverBg: oklch(0.31 0.03 266.71)
rowHoverBg: oklch(0.34 0.06 267.59)

# The Matrix
background: oklch(0.11 0.01 165.27)
cardBg: oklch(0.17 0.03 154.3)
navbarBg: oklch(0.87 0.29 141.53)
hoverBg: oklch(0.31 0.08 149.18)
rowHoverBg: oklch(0.25 0.05 155.17)
