# Plataforma de Streaming de Audio con Búfer Persistente

Proyecto de grado - Ingeniería de Software. Arquitectura MVC, sin APIs externas.

## Stack
- Frontend: Vue 3 + Pinia + TypeScript (Vite)
- Backend: Node.js + Express + TypeScript
- Base de datos: PostgreSQL

## Estructura
- `frontend/`: Vistas (Vue)
- `backend/`: Controladores, servicios y modelos

## Ejecución
```bash
cd frontend && npm install && npm run dev
cd backend && npm install && npm run dev
```

## Flujo de ramas
`feature/<nombre>` y `fix/<nombre>` → `Develop` → `QA` → `main`.
`hotfix/<nombre>` sale de `main`.

## Equipo
- (1-Jose Jhonathan Rosero Vega / 2-Miguel Angel Arcila Rodriguez )