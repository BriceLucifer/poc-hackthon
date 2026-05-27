# CI/CD Guide

This repository is a GitHub project:

- Git root: `/Users/yunxiang/Nexus/notes/compsci-714/hackthon/poc`
- Remote: `git@github.com:BriceLucifer/poc-hackthon.git`
- Backend: FastAPI + `uv`
- Frontend: React + Vite

Use GitHub Actions for CI/CD. The repository includes a GitHub Pages workflow at
`.github/workflows/pages.yml` that builds `frontend/` and publishes it to:

`https://bricelucifer.github.io/poc-hackthon/`

The frontend is a static Vite app. GitHub Pages cannot run the FastAPI backend,
so deploy the backend separately and set `VITE_API_BASE_URL` to that backend's
public API URL.

## GitHub Pages Setup

In the GitHub repository:

1. Go to `Settings -> Pages`.
2. Under `Build and deployment`, set `Source` to `GitHub Actions`.
3. Go to `Settings -> Secrets and variables -> Actions -> Variables`.
4. Add `VITE_API_BASE_URL` if the deployed frontend should call a hosted backend.

Example value:

```text
https://your-backend.example.com/api
```

If `VITE_API_BASE_URL` is not set, the frontend defaults to `/api`, which is
only correct for local Vite development or a production reverse proxy that serves
the frontend and backend from the same domain.

## Pages Workflow

The repository workflow:

```yaml
name: Deploy frontend to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    name: Build frontend
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: frontend

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}
        run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/dist

  deploy:
    name: Deploy
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## CI Validation

The recommended validation pipeline checks both apps on every pull request and
push to `main`.

## Required Secrets

Add these in GitHub under:

`Settings -> Secrets and variables -> Actions -> New repository secret`

Minimum secrets for backend smoke checks:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_API_VERSION`
- `AZURE_OPENAI_CHAT_DEPLOYMENT`
- `AZURE_OPENAI_EMBED_DEPLOYMENT`

If CI should only build the code and not call Azure, keep the app import and
frontend build steps only. Do not commit `.env` files.

## Recommended Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  frontend:
    name: Frontend build
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: frontend

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload frontend artifact
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: frontend/dist

  backend:
    name: Backend smoke check
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: backend

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v5

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: uv sync --extra azure-openai

      - name: Import FastAPI app
        run: uv run python -c "from main import app; print(app.title)"

      - name: Start backend and check health
        env:
          AZURE_OPENAI_ENDPOINT: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
          AZURE_OPENAI_API_KEY: ${{ secrets.AZURE_OPENAI_API_KEY }}
          AZURE_OPENAI_API_VERSION: ${{ secrets.AZURE_OPENAI_API_VERSION }}
          AZURE_OPENAI_CHAT_DEPLOYMENT: ${{ secrets.AZURE_OPENAI_CHAT_DEPLOYMENT }}
          AZURE_OPENAI_EMBED_DEPLOYMENT: ${{ secrets.AZURE_OPENAI_EMBED_DEPLOYMENT }}
          LLM_BACKEND: auto
        run: |
          uv run uvicorn main:app --host 127.0.0.1 --port 8000 &
          sleep 5
          curl --fail http://127.0.0.1:8000/api/health
```

## Local Equivalent

Run the same checks locally before pushing:

```bash
cd frontend
npm ci
npm run build

cd ../backend
uv sync --extra azure-openai
uv run python -c "from main import app; print(app.title)"
uv run serve
```

In another terminal:

```bash
curl --fail http://127.0.0.1:8000/api/health
```

## Deployment Notes

This guide only defines CI validation. For CD, use the same successful build
artifacts:

- Deploy `frontend/dist` to a static host such as Azure Static Web Apps, Vercel,
  Netlify, or GitHub Pages.
- Deploy `backend` to a Python-capable service such as Azure App Service,
  Azure Container Apps, Render, Fly.io, or a VM.
- Configure production environment variables in the deployment platform, not in
  Git.
- Keep the frontend API target aligned with the backend deployment URL. In local
  development, Vite proxies `/api/*` to `http://localhost:8000`.

## Current Gaps

There are no dedicated test commands in the repository yet. The workflow uses
build and smoke checks. Once tests are added, extend the workflow with:

```yaml
- name: Run backend tests
  run: uv run pytest

- name: Run frontend tests
  run: npm test
```
