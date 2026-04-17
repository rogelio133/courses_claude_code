# CLAUDE.md — PlatziFlixAndroid

Contexto persistente para el desarrollo de **PlatziFlixAndroid**, plataforma educativa de streaming de cursos de programación.
Este es el proyecto del **Curso de Claude Code de Platzi** (profe: Eduardo Alvarez).

---

## Estructura del repositorio

```
/
├── Backend/      # API REST — FastAPI + PostgreSQL
├── Frontend/     # Web — Next.js 15 + React 19
└── Mobile/
    ├── PlatziFlixiOS/       # iOS — SwiftUI nativo
    └── PlatziFlixAndroid/   # Android — Jetpack Compose nativo
```

Son **4 proyectos independientes** que comparten el mismo backend y los mismos contratos de API.

---

## Backend

**Stack:** Python 3.11 · FastAPI 0.104 · PostgreSQL 15 · SQLAlchemy 2.0 · Alembic · Docker

**Arrancar el entorno:**
```bash
cd Backend
make start        # levanta API (puerto 8000) + PostgreSQL (puerto 5432)
make migrate      # aplica migraciones con Alembic
make seed         # carga datos de prueba
make seed-fresh   # limpia y recarga datos de prueba
make logs         # ver logs en tiempo real
make stop         # bajar contenedores
```

**Estructura interna:**
```
Backend/app/
├── core/config.py          # Settings (Pydantic Settings)
├── db/
│   ├── base.py             # Engine, SessionLocal, get_db()
│   └── seed.py             # Datos de prueba
├── models/
│   ├── base.py             # BaseModel: id, created_at, updated_at, deleted_at
│   ├── course.py
│   ├── lesson.py
│   ├── teacher.py
│   └── course_teacher.py   # Tabla asociativa M2M
├── services/
│   └── course_service.py   # Lógica de negocio
└── main.py                 # Endpoints FastAPI
```

**Patrón arquitectónico:** `routes (main.py)` → `services/` → `db/` (SQLAlchemy)

**Todos los modelos** heredan de `BaseModel` que incluye soft delete via `deleted_at`.

---

## API — Contratos

Base URL: `http://localhost:8000`

### Endpoints implementados

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Bienvenida |
| GET | `/health` | Health check con estado de BD |
| GET | `/courses` | Listar todos los cursos |
| GET | `/courses/{slug}` | Detalle de un curso (con profesores y clases) |

### Endpoint pendiente de implementar

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/courses/{slug}/classes/{id}` | Detalle de una clase individual |

### Esquemas JSON

**Course (listado):**
```json
{ "id": 1, "name": "Curso de React", "description": "...", "thumbnail": "url", "slug": "curso-de-react" }
```

**Course (detalle):**
```json
{
  "id": 1, "name": "Curso de React", "description": "...",
  "thumbnail": "url", "slug": "curso-de-react",
  "teacher_id": [1, 2],
  "classes": [{ "id": 1, "name": "Clase 1", "description": "...", "slug": "clase-1" }]
}
```

**Class (detalle):**
```json
{ "id": 1, "name": "Clase 1", "description": "...", "slug": "clase-1", "video_url": "url" }
```

**Teacher:**
```json
{ "id": 1, "name": "Juan Pérez", "email": "juan@example.com" }
```

---

## Frontend (Web)

**Stack:** Next.js 15.3 · React 19 · TypeScript · SCSS Modules · Vitest + Testing Library

**Arrancar:**
```bash
cd Frontend
yarn dev      # puerto 3000 con Turbopack
yarn test     # tests con Vitest
yarn build
```

**Estructura interna:**
```
Frontend/src/
├── app/
│   ├── page.tsx                    # Home: lista de cursos
│   ├── course/[slug]/page.tsx      # Detalle del curso
│   └── classes/[class_id]/page.tsx # Reproductor de video
├── components/
│   ├── Course/        # Tarjeta de curso
│   ├── CourseDetail/  # Layout detalle de curso
│   └── VideoPlayer/   # Reproductor HTML5
├── types/index.ts     # Interfaces TypeScript centralizadas
└── styles/
    ├── reset.scss
    └── vars.scss      # Variables SCSS (auto-importadas en todos los módulos)
```

**Patrón:** Server Components por defecto. Fetch directo en servidor con `cache: "no-store"`. Sin estado global ni librerías de state management.

**Tipos preparados pero no implementados en UI:** `Progress`, `Quiz`, `QuizOption`, `FavoriteToggle`

---

## Mobile — iOS

**Stack:** Swift 5+ · SwiftUI · URLSession · Combine · MVVM + Clean Architecture

**Estructura interna:**
```
PlatziFlixiOS/
├── Data/
│   ├── Entities/          # DTOs (Codable)
│   ├── Mapper/            # DTO → Domain model
│   └── Repositories/      # Implementaciones remotas
├── Domain/
│   ├── Models/            # Course, Lesson, Teacher
│   └── Repositories/      # Protocolos/interfaces
├── Presentation/
│   ├── ViewModels/        # @Published + @MainActor
│   └── Views/             # SwiftUI Views
└── Services/              # NetworkManager (URLSession)
```

**Estado actual:** Listado de cursos implementado. Navegación al detalle pendiente.

---

## Mobile — Android

**Stack:** Kotlin · Jetpack Compose · Retrofit 2.9 · OkHttp3 · Coroutines · MVVM + MVI

**Base URL en emulador:** `http://10.0.2.2:8000/`

**Estructura interna:**
```
platziflixandroid/
├── data/
│   ├── entities/          # DTOs (@SerializedName Gson)
│   ├── mappers/           # DTO → Domain model
│   ├── network/           # ApiService (Retrofit) + NetworkModule
│   └── repositories/      # RemoteCourseRepository + MockCourseRepository
├── domain/
│   ├── models/            # Course, Lesson, Teacher
│   └── repositories/      # Interfaces
├── presentation/courses/
│   ├── components/        # LoadingIndicator, ErrorMessage, CourseCard
│   ├── screen/            # CourseListScreen
│   ├── state/             # CourseListUiState, CourseListUiEvent
│   └── viewmodel/         # CourseListViewModel (StateFlow)
├── di/                    # AppModule (DI manual)
└── ui/theme/              # Material 3
```

**Estado actual:** Listado de cursos implementado. Navegación al detalle pendiente.

---

## Modelo de datos — Base de datos

```
courses          lessons           teachers         course_teachers
────────────     ──────────────    ────────────     ─────────────────
id               id                id               course_id (FK)
name             name              name             teacher_id (FK)
description      description       email
thumbnail        slug
slug             video_url
                 course_id (FK)

Todos los modelos: created_at, updated_at, deleted_at (soft delete)
```

---

## Estado del proyecto (MVP)

| Feature | Backend | Web | iOS | Android |
|---------|---------|-----|-----|---------|
| Listar cursos | ✅ | ✅ | ✅ | ✅ |
| Detalle de curso | ✅ | ✅ | ⬜ pendiente | ⬜ pendiente |
| Reproducir clase | ✅ spec | ✅ | ⬜ | ⬜ |
| Progress tracking | ⬜ | tipos ✅ | ⬜ | ⬜ |
| Quizzes | ⬜ | tipos ✅ | ⬜ | ⬜ |
| Favoritos | ⬜ | tipos ✅ | ⬜ | ⬜ |

---

## Convenciones

- El backend usa **snake_case** en JSON. El Frontend y Mobile hacen el mapeo a camelCase internamente.
- Los slugs son los identificadores únicos de cursos en la API (no los IDs numéricos).
- Las clases se identifican por ID numérico en la API.
- Soft delete: nunca se borran registros, se setea `deleted_at`. Los servicios filtran por `deleted_at IS NULL`.
- Los specs de la API viven en `Backend/specs/`.
