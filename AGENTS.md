# AGENTS.md — BufferTrack

> **This file is the single source of truth for AI coding agents working on this project.**
> It follows the open [AGENTS.md](https://agents.md) format — compatible with Claude Code,
> Cursor, GitHub Copilot, OpenAI Codex, Amp, and any agent that supports the standard.
>
> ⚠️ If an active MCP tool or skill provides more up-to-date information than what is
> written here (e.g. a newer API, updated library version, or revised pattern), **prefer
> the MCP/skill information over this file**. This file sets defaults and intent;
> connected tools provide real-time accuracy.
>
> **Do NOT modify without team consensus.**

---

## 🧭 Project Overview

**BufferTrack** is a SaaS web application for construction project management based on
**Lean Construction** and the **Last Planner System (LPS)**. It allows construction teams
to manage commitments, visualize interactive floor plans with activity pins, and calculate
the PPC (Percent Plan Complete) in real time.

Key capabilities:
- Multi-level plan viewer (Master Plan → Building → Floor) with zoom/pan and interactive pins
- Commitment workflow: request → notification → commit → active → complete/delayed/restricted
- Weekly calendar (Current Week / Next Week) synced bidirectionally with the plan viewer
- PPC dashboard by specialty, subcontractor, and zone
- Role-based access control (9 roles)
- Real-time updates via Socket.io

---

## ⚡ Dev Commands

```bash
# Install dependencies
npm install

# Start development server (with HMR)
npm run dev

# Type check only (no emit)
npm run typecheck

# Lint
npm run lint

# Run tests
npm test

# Run a single test
npx jest --testNamePattern="<test name>"

# Build for production (DO NOT run inside an active agent session —
# it disables HMR and leaves the dev server in an inconsistent state)
npm run build
```

> After moving files or changing imports, always run `npm run lint` and `npm run typecheck`
> to ensure ESLint and TypeScript rules still pass.

---

## 🛠 Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | **Next.js 14+** (App Router) | Server Components by default |
| Language | **TypeScript 5+** | Strict mode enabled |
| Styles | **Tailwind CSS 3+** | No inline CSS unless justified |
| Database | **MongoDB 7+** | Via Mongoose 8+ |
| Auth | **NextAuth.js v5** | JWT strategy |
| Real-time | **Socket.io** | Pin state sync |
| Plan zoom/pan | **Pixi.js (WebGL)** | Legacy views use @panzoom/panzoom, migrating all to PixiJS for zero-lag |
| File storage | **Google Cloud Storage** | JPG/WebP 300 DPI floor plans |
| Validation | **Zod** | All API inputs |
| Global state | **Zustand** | Client-side only |
| Testing | **Jest + React Testing Library** | Co-located test files |

---

## 📁 Project Structure

```
buffertrack/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Public auth routes
│   │   ├── (dashboard)/            # Protected routes
│   │   ├── api/                    # REST API Routes
│   │   └── layout.tsx
│   ├── components/                 # Atomic Design hierarchy
│   │   ├── atoms/                  # Button, Input, Badge, Icon, Pin
│   │   ├── molecules/              # Card, FormGroup, Tooltip, Modal
│   │   ├── organisms/              # PlanViewer, Calendar, Sidebar, PinForm
│   │   ├── templates/              # Reusable page layouts
│   │   └── pages/                  # Assembled full pages
│   ├── lib/
│   │   ├── mongodb.ts              # Singleton MongoDB connection
│   │   ├── auth.ts                 # NextAuth config
│   │   ├── socket.ts               # Socket.io config
│   │   └── gcs.ts                  # Google Cloud Storage config
│   ├── models/                     # Mongoose models (1 file per model)
│   ├── repositories/               # Repository Pattern — data access layer
│   ├── services/                   # Service Layer — business logic
│   ├── hooks/                      # Custom React hooks
│   ├── store/                      # Zustand global state
│   ├── types/                      # TypeScript interfaces and types
│   ├── constants/                  # Specialties, roles, colors, statuses
│   └── schemas/                    # Zod validation schemas
├── public/
├── AGENTS.md                       ← this file
├── .env.local                      # Never commit — use .env.example as template
├── .env.example
└── package.json
```

---

## 🗄 Database Model (MongoDB)

### Collections

```
users             → Role, specialty, company, approval status
projects          → Name, description, configuration
buildings         → Code, number, X%/Y% coordinates on master plan
floors            → GCS image URL, order, label, buildingId ref
commitments       → Specialty, requester, assignee, X%/Y% coords, status, dates
weeklySnapshots   → Frozen weekly PPC data for historical reporting
restrictions      → Active blockers linked to a commitment
specialties       → Name + configurable hex color (admin-managed)
```

### Modeling rules
- Use **ObjectId references** between collections — avoid deep embedding
- Only embed data that never changes independently (e.g. pin coordinates)
- Always use `timestamps: true` in Mongoose schemas
- Required indexes: `projectId`, `buildingId`, `floorId`, `assignedTo`, `weekStart`
- Comment each model explaining **why** the structure was chosen

---

## 👥 Roles & Permissions

| Role | Create/Edit Pins | Admin Approval Required | Full Dashboard |
|------|:---------------:|:----------------------:|:--------------:|
| Subcontractor | ✅ | ✅ | ❌ |
| Coordinator | ✅ | ✅ | ❌ |
| Production Lead | ✅ | ❌ | ✅ |
| Production Engineer | ✅ | ❌ | ✅ |
| Production Manager | 👁 Read-only | ❌ | ✅ |
| Superintendent | 👁 Read-only | ❌ | ✅ |
| Project Manager | 👁 Read-only | ❌ | ✅ |
| Project Director | 👁 Read-only | ❌ | ✅ |
| Admin | ✅ Full access | ❌ | ✅ |

**Additional rules:**
- A user can belong to multiple projects
- Subcontractors only see their own pins
- Week closing is **manual** (executed by Admin or Production Lead)
- Notifications are **in-app only** (no email in v1)

---

## 🎨 Design System

### Color palette
```
Background:       #F4F7F6
Panels:           #FFFFFF
Primary accent:   #2563EB
Success / PPC:    #10B981
Alert / Delayed:  #EF4444
In Progress:      #F59E0B
```

### Pin states
| State | Color | Visual |
|-------|-------|--------|
| In Progress | `#F59E0B` | 🟡 Yellow fill |
| Completed | `#10B981` | 🟢 Green fill |
| Delayed | `#EF4444` | 🔴 Red fill |
| Restriction | `#EF4444` | ⚠️ Warning icon |

### UI rules
- **Mobile-first** — plan viewer takes 100% on mobile
- **Bottom Sheet** on mobile for details, calendar, and forms
- **Collapsible sidebar** on desktop
- Calendar = horizontal bar (Current Week / Next Week, Mon–Sun)
- Tailwind CSS only — no inline styles without justification

---

## 🗺 Navigation Flow

```
Master Plan (Level 1)
  └── Click on building → "Select Floor" modal
        └── Select floor → Detail Plan (Level 2)
              └── Click on plan → Commitment Form (Pin)
```

---

## 🔁 Commitment State Machine

```
Solicitud (Request)
  → Notificación (Notification sent to assignee)
  → Compromiso (Assignee picks a day → Pin activates)
  → En Proceso / In Progress  (yellow)
  → Completado / Completed    (green, counts for PPC)
  → En Retraso / Delayed      (red, past due date)
  → Restricción / Restriction (⚠️ blocked)
```

---

## ⚙️ Design Patterns (always comment in code)

| Pattern | Where | Why |
|---------|-------|-----|
| **Repository Pattern** | `src/repositories/` | Decouples data access from business logic; easy to swap DB |
| **Service Layer** | `src/services/` | Business logic between API routes and repositories |
| **Observer** | Socket.io events | Real-time pin state propagation |
| **Factory** | Commitment creation | Centralizes validation and construction of complex objects |
| **Compound Components** | `PlanViewer`, `Calendar` | Share internal state without prop drilling |
| **Custom Hooks** | `useZoom`, `usePins`, `useSocket`, `useCalendar` | Encapsulate and reuse complex logic |
| **Atomic Design** | `components/` hierarchy | Scalable, consistent component architecture |

---

## ✅ Code Style & Conventions

### TypeScript
- Interfaces in `src/types/` — prefix `I` for models: `IUser`, `ICommitment`, `IBuilding`
- Utility types — prefix `T`: `TRole`, `TSpecialty`, `TPinStatus`
- **Never use `any`** — use `unknown` if the type is uncertain
- Strict mode must remain enabled in `tsconfig.json`

### React / Next.js
- Components: **PascalCase** (`PlanViewer.tsx`)
- Hooks: **camelCase with `use` prefix** (`usePlanZoom.ts`)
- Server Components by default — `"use client"` only where truly necessary
- Never use `useEffect` for data fetching — use Server Components or React Query
- Always type props with explicit interfaces (no inline anonymous types)

### API responses (consistent format)
```ts
{ success: boolean; data?: T; error?: string }
```

### MongoDB / Mongoose
- One file per model in `src/models/`
- Use `.lean()` on read-only queries for better performance
- Comment indexes with justification
- Use transactions for operations spanning multiple collections

---

## 🧪 Testing

- Unit tests: models, services, hooks, atoms, molecules
- Integration tests: critical API routes (commitment creation, PPC calculation)
- File naming: `ComponentName.test.tsx` co-located with source file
- Mock MongoDB with `mongodb-memory-server`
- Run before every commit: `npm run lint && npm run typecheck && npm test`

---

## 🔐 Git Workflow

- Branch naming: `feat/<name>`, `fix/<name>`, `chore/<name>`
- Commit format: `[buffertrack] <type>: <description>`
- Always run `npm run lint && npm test` before committing
- Never commit `.env.local` or service account keys

---

## 🌍 Environment Variables

```env
# .env.local (never commit — see .env.example)
MONGODB_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GCS_BUCKET_NAME=
GCS_PROJECT_ID=
GCS_SERVICE_ACCOUNT_KEY=
NEXT_PUBLIC_SOCKET_URL=
```

---

## 🚀 Development Priority Order

1. Authentication & roles (login, register, user approval)
2. Master Plan Overview (zoom/pan, building pins with hover summary)
3. Detail Plan — Level 2 (interactive pins, commitment form)
4. Weekly calendar (Current/Next Week, bidirectional sync with plan)
5. PPC Dashboard (by specialty, subcontractor, zone)
6. Restrictions log — The Red List (filterable, exportable)
7. Week closing (historical PPC snapshots)

---

## 📌 Critical Agent Notes

- **`MasterPlanViewer` and `PlanViewer`** are critical components — must handle 300 DPI images with smooth, zero-lag zoom using **PixiJS (WebGL)** instead of heavy DOM manipulation.
- Pins use **percentage coordinates (X%, Y%)** — this ensures responsiveness across
  all screen sizes and zoom levels
- PPC calculation must be **server-side** for consistency
- Socket.io real-time updates are **required** for pin state changes
- Dashboard data is stored **per week** with explicit `weekStart` / `weekEnd` dates
- **Always comment** design patterns and best practices used, explaining the reasoning
- Prefer **Server Components** — only add `"use client"` when interactivity is required
- When in doubt about a library API or Next.js behavior, prefer information from
  **MCP tools or connected skills** over this file — they may have more current data
