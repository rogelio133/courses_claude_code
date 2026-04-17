# Análisis Técnico: Sistema de Ratings (1-5 estrellas)

## Problema

Implementar un sistema de ratings anónimos de 1 a 5 estrellas para cursos en Platziflix, sin sistema de usuarios activo. El diseño debe ser evolutivo: cuando se agregue autenticación en el futuro, asociar ratings a usuarios debe ser un cambio aditivo y no destructivo sobre el esquema actual.

---

## Impacto Arquitectural

- **Backend:** nueva tabla `course_ratings`, nuevo endpoint `POST /courses/{slug}/ratings`, modificación del endpoint `GET /courses/{slug}` para incluir agregados, nuevo service `rating_service.py`, nuevo modelo `rating.py`, nuevo directorio `schemas/`.
- **Frontend:** nuevo Client Component `RatingStars`, modificación de `CourseDetail` para introducir un SSR boundary explícito, actualización de tipos TypeScript, nueva función de fetch para `POST`.
- **Base de datos:** tabla `course_ratings` con columna nullable `user_id` (reservada para futura autenticación), índice compuesto para consultas de agregación.

---

## Esquema SQL

```sql
CREATE TABLE course_ratings (
    id          SERIAL          PRIMARY KEY,
    course_id   INTEGER         NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    rating      SMALLINT        NOT NULL CHECK (rating >= 1 AND rating <= 5),
    session_id  VARCHAR(255)    NOT NULL,
    user_id     INTEGER         NULL,       -- reservado, FK a users cuando exista
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMP       NULL
);

-- Un session_id puede votar una sola vez por curso
CREATE UNIQUE INDEX uq_course_ratings_session
    ON course_ratings (course_id, session_id)
    WHERE deleted_at IS NULL;

-- Consultas de agregación por curso
CREATE INDEX idx_course_ratings_course_id
    ON course_ratings (course_id)
    WHERE deleted_at IS NULL;
```

> **Decisión de diseño — identificación anónima:** se usa `session_id` (UUID generado en el cliente y almacenado en `localStorage`) en lugar de IP address. La IP es mutable, compartida en NAT y viola GDPR al ser PII. El `session_id` es opaco, no vincula a una persona y se puede reemplazar trivialmente por `user_id` cuando exista autenticación. El campo `user_id` se reserva como columna nullable desde el inicio para que la migración futura sea solo `ALTER TABLE ADD FOREIGN KEY`, sin modificar filas existentes.

---

## Contratos de API

### Nuevo endpoint — Crear rating

```
POST /courses/{slug}/ratings
Content-Type: application/json

Request body:
{
  "rating": 4,           // integer, 1..5, requerido
  "session_id": "uuid"   // string, requerido, generado por el cliente
}

Responses:
201 Created
{
  "id": 42,
  "course_id": 1,
  "rating": 4,
  "average_rating": 4.2,
  "total_ratings": 87
}

409 Conflict   -- session_id ya votó en este curso
{
  "detail": "Session has already rated this course"
}

422 Unprocessable Entity  -- validación Pydantic falla
{
  "detail": [{ "loc": ["body", "rating"], "msg": "...", "type": "..." }]
}

404 Not Found  -- slug no existe
```

> **Decisión de diseño — 409 vs actualización silenciosa:** se retorna 409 en lugar de actualizar el voto existente. Esto obliga al cliente a manejar el estado explícitamente. Si en el futuro se decide permitir actualización de voto, la implementación es `INSERT ... ON CONFLICT DO UPDATE` y retornar 200.

### Modificación de endpoint existente — Detalle de curso

```
GET /courses/{slug}

Response (campos nuevos marcados con +):
{
  "id": 1,
  "name": "Curso de React",
  "description": "...",
  "thumbnail": "url",
  "slug": "curso-de-react",
  "teacher_id": [1, 2],
  "classes": [...],
  "average_rating": 4.2,    // + float | null si no hay ratings
  "total_ratings": 87       // + integer
}
```

> **Decisión de diseño — `null` vs `0` para cursos sin ratings:** `average_rating: null` cuando no hay votos. Permite al cliente distinguir "nadie ha votado" de "promedio real", lo cual es imposible si se usa `0` dado el constraint `CHECK (rating >= 1)`.

---

## Propuesta de Solución

### Backend — Archivos a crear

#### `Backend/app/models/rating.py`

Clase `CourseRating(BaseModel)` con columnas:
- `course_id`: Integer, FK a `courses.id`, NOT NULL, indexed
- `rating`: SmallInteger, NOT NULL, con `CheckConstraint('rating >= 1 AND rating <= 5')`
- `session_id`: String(255), NOT NULL
- `user_id`: Integer, nullable (reservado)
- Relationship `course` → `Course`

#### `Backend/app/schemas/rating.py`

Tres schemas Pydantic:
- `RatingCreate`: `rating: int = Field(ge=1, le=5)`, `session_id: str`
- `RatingResponse`: `id`, `course_id`, `rating`, `average_rating: float`, `total_ratings: int`
- `CourseRatingSummary`: `average_rating: float | None`, `total_ratings: int`

#### `Backend/app/services/rating_service.py`

Clase `RatingService` con métodos:
- `create_rating(db, slug, rating_data) -> dict`: valida que el curso existe, inserta rating, retorna agregados en la misma transacción. Captura `IntegrityError` y lo convierte en HTTPException 409.
- `get_course_rating_summary(db, course_id) -> dict`: `SELECT AVG(rating), COUNT(*)` con filtro `deleted_at IS NULL`.

#### `Backend/alembic/versions/<timestamp>_add_course_ratings_table.py`

Migración Alembic que crea la tabla, el unique index y el índice de performance. No modifica tablas existentes.

---

### Backend — Archivos a modificar

#### `Backend/app/services/course_service.py`

Método `get_course_by_slug()` — agregar subquery correlacionada de agregación:

```python
from sqlalchemy import func, select

rating_subq = (
    select(
        func.avg(CourseRating.rating).label("average_rating"),
        func.count(CourseRating.id).label("total_ratings")
    )
    .where(
        CourseRating.course_id == Course.id,
        CourseRating.deleted_at.is_(None)
    )
    .correlate(Course)
    .scalar_subquery()
)
```

El dict de retorno agrega:
```python
"average_rating": round(average_rating, 1) if average_rating else None,
"total_ratings": total_ratings or 0
```

#### `Backend/app/main.py`

- Agregar ruta `POST /courses/{slug}/ratings` con dependency injection de `RatingService`
- El response de `GET /courses/{slug}` incluye automáticamente los campos nuevos una vez modificado el service

---

### Frontend — Archivos a crear

#### `Frontend/src/components/RatingStars/RatingStars.tsx`

**Client Component obligatorio** (`"use client"`). Responsabilidades:
- Lee o genera `session_id` desde `localStorage` dentro de `useEffect` (nunca en render — evita hydration mismatch)
- Estados: `selectedRating: number | null`, `hoverRating: number | null`, `hasVoted: boolean`, `isLoading: boolean`
- Al click en estrella: llama a `POST /courses/{slug}/ratings`
- Muestra promedio actual recibido como prop desde el Server Component padre

```typescript
interface RatingStarsProps {
  courseSlug: string;
  initialAverageRating: number | null;
  initialTotalRatings: number;
}
```

#### `Frontend/src/components/RatingStars/RatingStars.module.scss`

Estilos para las 5 estrellas con estados: vacía, rellena, hover, deshabilitada (post-voto).

---

### Frontend — Archivos a modificar

#### `Frontend/src/types/index.ts`

```typescript
// Agregar a CourseDetail:
averageRating: number | null;
totalRatings: number;

// Nuevas interfaces:
export interface RatingSubmission {
  rating: number;
  session_id: string;
}

export interface RatingResponse {
  id: number;
  course_id: number;
  rating: number;
  average_rating: number;
  total_ratings: number;
}
```

#### `Frontend/src/components/CourseDetail/CourseDetail.tsx`

**Permanece Server Component.** Importa `RatingStars` (Client Component) y le pasa props. Next.js gestiona el SSR boundary automáticamente.

```tsx
<RatingStars
  courseSlug={course.slug}
  initialAverageRating={course.averageRating}
  initialTotalRatings={course.totalRatings}
/>
```

#### `Frontend/src/app/course/[slug]/page.tsx`

Sin cambios en lógica de fetch. Solo actualizar el tipado del objeto deserializado para mapear `average_rating` → `averageRating` y `total_ratings` → `totalRatings` (snake_case del backend a camelCase del frontend, consistente con la convención del proyecto).

---

## Plan de Implementación

### Fase 1 — Backend (prerequisito)

| # | Acción | Archivo |
|---|--------|---------|
| 1 | Crear modelo ORM | `Backend/app/models/rating.py` |
| 2 | Generar migración | `alembic revision --autogenerate -m "add_course_ratings_table"` |
| 3 | Aplicar migración | `make migrate` |
| 4 | Crear schemas Pydantic | `Backend/app/schemas/rating.py` |
| 5 | Crear service de ratings | `Backend/app/services/rating_service.py` |
| 6 | Modificar course service | `Backend/app/services/course_service.py` — agregar agregados |
| 7 | Agregar endpoints | `Backend/app/main.py` — POST nuevo + actualizar GET |

### Fase 2 — Frontend

| # | Acción | Archivo |
|---|--------|---------|
| 8 | Actualizar tipos | `Frontend/src/types/index.ts` |
| 9 | Crear componente interactivo | `Frontend/src/components/RatingStars/RatingStars.tsx` |
| 10 | Crear estilos | `Frontend/src/components/RatingStars/RatingStars.module.scss` |
| 11 | Integrar en detalle de curso | `Frontend/src/components/CourseDetail/CourseDetail.tsx` |

---

## Riesgos Técnicos

### N+1 Query — riesgo alto
Si `get_all_courses()` se modifica para incluir ratings y se itera calculando el promedio por separado, se generarán N queries adicionales. **Mitigación:** calcular con una sola query `GROUP BY` o subquery correlacionada. Para el listado de cursos, los ratings **no se incluyen en el MVP** — solo en el detalle.

### Breaking change en API — riesgo medio
`GET /courses/{slug}` agrega campos. Es retrocompatible (additive) con `Gson` en Android y `Codable` en Swift, que ignoran campos desconocidos por defecto. **Acción:** comunicar al equipo mobile que deben agregar los campos a sus modelos cuando implementen ratings.

### SSR boundary e hydration mismatch — riesgo medio
`localStorage` no existe en el servidor. Acceder fuera de `useEffect` en el Client Component lanza error de hidratación. **Mitigación obligatoria:** todo acceso a `localStorage` dentro de `useEffect(() => { ... }, [])`. El estado inicial de `session_id` debe ser `null`.

### Race condition en inserts simultáneos — riesgo bajo
Dos requests simultáneos del mismo `session_id` pueden pasar la validación de negocio y ambos intentar insertar. El unique index garantiza que solo uno tendrá éxito. **Mitigación:** capturar `IntegrityError` de SQLAlchemy en `rating_service.py` y convertirlo en 409.

### Sesión persistente en localStorage — riesgo bajo (aceptado)
Si el usuario borra localStorage, puede votar múltiples veces. Es inherente al diseño anónimo y aceptable en MVP. Documentar como limitación conocida.

---

## Decisiones de Diseño — Resumen

| Decisión | Opción elegida | Alternativa descartada | Razón |
|----------|---------------|----------------------|-------|
| Identificación anónima | `session_id` UUID en localStorage | IP address | IP es PII, mutable y compartida en NAT |
| Voto duplicado | 409 Conflict | Actualizar silenciosamente (200) | Transparencia en el contrato de API |
| Agregados en GET /courses/{slug} | Subquery en la misma query | Query separada en el service | Evita round-trip adicional; transacción atómica |
| Schemas Pydantic | Directorio `schemas/` separado | Inline en `main.py` | Escalabilidad; `main.py` ya tiene toda la lógica de routing |
| Ratings en listado de cursos | No incluir en MVP | Incluir en tarjetas | Evita N+1 en listado; reduce scope del MVP |
| Nombre del campo en JSON | `average_rating`, `total_ratings` (snake_case) | camelCase | Consistencia con convención existente del backend |
