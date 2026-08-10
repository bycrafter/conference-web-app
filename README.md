# Conference Web App

## 🚀 Quick Start / Full System Run

> **This repository is only the frontend (SPA).** All docker compose orchestration for the full system (this app, the BFF `conference-web-api`, and infrastructure like databases/message brokers) is **managed centrally in the `crafter-infra` repository** — not here. To build and run the **entire system** together, use `crafter-infra`.

Navigate to the `crafter-infra` repository and run the following scripts **in this exact order**:

```bash
cd ../crafter-infra

./docker-image-build.sh
./start-infra.sh
```

Once the infrastructure is up, this app will be available (by default) at `http://localhost:8080`.

---

## 📖 Project Description

**Conference Web App** is the user-facing Single Page Application (SPA) for the conferencing platform. It provides the web interface used to:

- Create, browse, and manage **video conferences / events**.
- Submit and review **slot requests** (booking of time slots on providers).
- Configure and manage **conference providers**.
- Manage users and access, enforcing **Role-Based Access Control (RBAC)** with roles such as `ADMIN`, `ORGANIZER`, and `STANDART_USER`.

The application communicates exclusively with the `conference-web-api` (BFF) over HTTP for all data and business logic.

## 🛠️ Tech Stack

- **Framework:** [Vue 3](https://vuejs.org/) (`<script setup>`, Composition API) + TypeScript
- **Build Tool:** [Vite](https://vitejs.dev/)
- **State Management:** [Pinia](https://pinia.vuejs.org/) (with `pinia-plugin-persistedstate`)
- **Routing:** [Vue Router](https://router.vuejs.org/)
- **HTTP Client:** [Axios](https://axios-http.com/)
- **UI Library:** [PrimeVue](https://primevue.org/) + PrimeIcons
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (via `tailwindcss-primeui`) + SCSS
- **Calendar:** [FullCalendar](https://fullcalendar.io/) (`@fullcalendar/vue3`)
- **Testing:** [Vitest](https://vitest.dev/) + [@vue/test-utils](https://test-utils.vuejs.org/) (unit/component), [Cypress](https://www.cypress.io/) (E2E)
- **Linting/Formatting:** ESLint + Prettier

## ✅ Prerequisites

- **Node.js** — version pinned in [`.nvmrc`](./.nvmrc) (currently `22.23.1`). Using [nvm](https://github.com/nvm-sh/nvm) is recommended:
  ```bash
  nvm use
  ```
- **npm** (bundled with Node.js)

## 🔧 Environment Variables

Vite environment variables are **compile-time only** — they are baked into the build at build time. Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable              | Description                                                                 | Example                       |
|-----------------------|-------------------------------------------------------------------------------|--------------------------------|
| `VITE_API_BASE_URL`   | Base URL used by the SPA to call the BFF (`conference-web-api`).            | `http://localhost:3000/v1`    |

- `.env.development` — used by `npm run dev` (points directly to a locally running BFF).
- `.env.production` — used by `npm run build` (typically a relative path, e.g. `/v1`, proxied by nginx/reverse proxy).

## 💻 Local Development Setup

Install dependencies:

```bash
npm install
```

Run the local development server (with hot reload):

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Lint (and auto-fix) the codebase:

```bash
npm run lint
```

## 🧪 Testing

Run unit / component tests (Vitest):

```bash
npx vitest run
```

Run End-to-End tests (Cypress):

```bash
npx cypress open
# or headless
npx cypress run
```

## 🐳 Docker

A standalone `Dockerfile` and `docker-compose.yml` are provided in this repo to build and run **just this frontend** as a container (served via nginx):

```bash
docker compose up --build
```

The app will be available at `http://localhost:8080`.

> **Note:** Full system docker compose orchestration (this app + `conference-web-api` BFF + all infrastructure: databases, message brokers, etc.) is **centrally managed in the `crafter-infra` repository**, not here. This repo's `docker-compose.yml` is only for standalone/isolated frontend runs (e.g. quick local checks). For running the **full system**, always use `crafter-infra` as described in [Quick Start](#-quick-start--full-system-run) above — do not attempt to compose the whole stack from this repository.

## 📁 Project Structure

The codebase follows a **feature-based** structure:

```
src/
├── features/           # Feature domains (conferences, providers, users, ...)
│   └── <feature>/
│       ├── components/  # Feature-specific UI components
│       ├── views/       # Route-level views
│       ├── stores/       # Pinia stores
│       └── services/     # API integration (Axios calls to the BFF)
├── layout/              # App-wide layout components (topbar, sidebar, ...)
├── router/              # Vue Router configuration
└── test/                # Test setup and utilities
```

## 📄 License

See [`LICENSE.md`](./LICENSE.md).
