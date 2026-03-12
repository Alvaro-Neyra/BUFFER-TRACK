# BufferTrack

![BufferTrack Hero Image](https://via.placeholder.com/1200x400?text=BufferTrack+-+Construction+Project+Management)

BufferTrack is a modern SaaS web application designed for construction project management. It leverages **Lean Construction** principles and the **Last Planner System (LPS)** to streamline commitments, visualize progress, and calculate PPC (Percent Plan Complete) in real time.

## 🌟 Key Features

*   **Interactive Floor Plans**: Multi-level viewer (Master Plan → Building → Floor) with zoom, pan, and interactive activity pins.
*   **Commitment Workflow**: End-to-end management from request to completion, including delayed and restricted states.
*   **Weekly Calendar Integration**: Bidirectional synchronization between the current/next week calendar and the plan viewer.
*   **Real-time PPC Dashboard**: Analytics broken down by specialty, subcontractor, and zone.
*   **Role-Based Access**: 9 distinct roles with specific permissions ensuring data integrity.
*   **Live Updates**: Powered by Socket.io for instant pin state synchronization across all connected clients.

## 🛠 Tech Stack

*   **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS 3+
*   **Language**: TypeScript 5+ (Strict Mode)
*   **Backend/API**: Next.js API Routes, NextAuth.js v5
*   **Database**: MongoDB 7+ via Mongoose 8+
*   **Real-time**: Socket.io
*   **Storage**: Cloudinary (for high-resolution floor plans)
*   **State Management**: Zustand
*   **Validation**: Zod
*   **Testing**: Jest + React Testing Library

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or higher recommended)
*   npm (v9 or higher)
*   MongoDB instance (local or Atlas)
*   Cloudinary account (cloud name + API credentials)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/buffertrack.git
    cd buffertrack
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure Environment Variables:
    Create a `.env.local` file in the root directory and configure it based on `.env.example`:
    ```env
    MONGODB_URI=your_mongodb_connection_string
    NEXTAUTH_SECRET=your_nextauth_secret
    NEXTAUTH_URL=http://localhost:3000
    CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
    CLOUDINARY_API_KEY=your_cloudinary_api_key
    CLOUDINARY_API_SECRET=your_cloudinary_api_secret
    CLOUDINARY_UPLOAD_FOLDER=buffertrack/floors
    NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
    ```

    Floor-plan delivery policy:
    - Persist and use canonical Cloudinary URLs only (no transformation segments).
    - Do not append adaptive transformations such as `f_auto`, `q_auto`, `dpr_auto`, `w_auto`, `h_auto`.
    - Keep client-side compression enabled before upload.

4.  Start the development server:
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Project Structure highlights
We strictly follow Atomic Design principles for our components.

*   `src/app`: Next.js App Router (pages and API)
*   `src/components`: Atomic Design hierarchy (atoms, molecules, organisms, templates, pages)
*   `src/models`: Mongoose database schemas
*   `src/services` & `src/repositories`: Business logic and data access layers.

For detailed architecture and development conventions, strictly refer to `AGENTS.md`.

## 🧪 Testing

We value test coverage to maintain application stability.

```bash
# Run all tests
npm test

# Run a specific test suite
npx jest --testNamePattern="<test-name>"
```

## 🧰 Membership Migration

Use this one-time migration to backfill missing per-project membership fields (`projects[].roleId`, `projects[].specialtyId`) from legacy user fields.

```bash
# Preview changes without writing
npm run migrate:memberships:dry

# Apply migration
npm run migrate:memberships
```

## 🧰 Subcontractor Specialty Sync

Use this maintenance script to link all project specialties to the `Subcontractor` role and backfill missing `specialties.projectId` values when legacy data is unscoped.

```bash
# Preview for a project
npm run sync:subcontractor-specialties:dry -- --project-id <projectObjectId>

# Apply for a project
npm run sync:subcontractor-specialties -- --project-id <projectObjectId>
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
