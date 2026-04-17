# Plan de Implementacion Backend: Sistema de Ratings

Basado en el analisis arquitectonico de `01_sistema_de_ratings.md`.

---

## Convenciones del codigo existente

Antes de implementar, respetar los siguientes patrones ya establecidos:

- **Imports:** relativos dentro de cada paquete (`.base`, `.course`), absolutos desde `app.*` en servicios
- **Descubrimiento de modelos en Alembic:** `env.py` usa `from app.models import *` — el nuevo modelo debe estar exportado desde `Backend/app/models/__init__.py`
- **Patron de servicio:** constructor `__init__(self, db: Session)`, factory `get_X_service(db: Session = Depends(get_db))` en `main.py`
- **Respuestas:** los endpoints retornan `dict` o `list` plano; los servicios retornan `Dict[str, Any]`
- **Soft delete:** siempre filtrar con `.filter(Model.deleted_at.is_(None))`
- **Tests:** clases agrupadas por dominio, patron AAA, mocks via `app.dependency_overrides`

---

## Fase B1: Modelo ORM `CourseRating`

**Descripcion:** Crear el modelo SQLAlchemy para `course_ratings`. Es la base de todo lo demas porque Alembic necesita el modelo para autogenerar la migracion.

**Precondicion:** Ninguna.

### Pasos

| # | Archivo | Accion |
|---|---------|--------|
| 1 | `Backend/app/models/rating.py` | Crear clase `CourseRating(BaseModel)` con `__tablename__ = 'course_ratings'` |
| 2 | `Backend/app/models/rating.py` | Columna `course_id`: `Integer`, `ForeignKey('courses.id')`, `nullable=False`, `index=True` |
| 3 | `Backend/app/models/rating.py` | Columna `rating`: `SmallInteger`, `nullable=False` |
| 4 | `Backend/app/models/rating.py` | Columna `session_id`: `String(255)`, `nullable=False` |
| 5 | `Backend/app/models/rating.py` | Columna `user_id`: `Integer`, `nullable=True` (reservado para autenticacion futura) |
| 6 | `Backend/app/models/rating.py` | `__table_args__`: `CheckConstraint('rating >= 1 AND rating <= 5', name='rating_value_check')` |
| 7 | `Backend/app/models/rating.py` | Relationship `course = relationship("Course", back_populates="ratings")` |
| 8 | `Backend/app/models/course.py` | Agregar `ratings = relationship("CourseRating", back_populates="course")` |
| 9 | `Backend/app/models/__init__.py` | Verificar que exporta o incluye `CourseRating` para que Alembic lo descubra |

### Riesgos

- Si `__init__.py` no importa el modelo, Alembic genera una migracion vacia — verificar antes de correr `autogenerate`
- El `back_populates` en `Course` debe coincidir exactamente con el nombre del relationship en `CourseRating`

### Criterio de verificacion

```bash
python -c "from app.models.rating import CourseRating; print(CourseRating.__table__.columns.keys())"
```
Sin errores de importacion.

---

## Fase B2: Migracion Alembic

**Descripcion:** Generar y aplicar la migracion que crea la tabla `course_ratings` con sus indices. Sin esta fase ninguna operacion de DB funcionara.

**Precondicion:** Fase B1 completa + contenedor Docker corriendo (`make start`).

### Pasos

| # | Accion | Detalle |
|---|--------|---------|
| 1 | Generar migracion | `alembic revision --autogenerate -m "add_course_ratings_table"` desde `Backend/app/` |
| 2 | Revisar archivo generado | Verificar que incluye `op.create_table('course_ratings', ...)` con todas las columnas y el `CheckConstraint` |
| 3 | Agregar manualmente el unique index parcial | `op.create_index('uq_course_ratings_course_session_active', 'course_ratings', ['course_id', 'session_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))` — Alembic no lo autogenera |
| 4 | Agregar indice de performance | `op.create_index('idx_course_ratings_course_id', 'course_ratings', ['course_id'], postgresql_where=sa.text('deleted_at IS NULL'))` si no fue autogenerado |
| 5 | Verificar `downgrade()` | Debe eliminar indices antes que la tabla (orden de dependencias) |
| 6 | Aplicar migracion | `make migrate` o `alembic upgrade head` |

### Riesgos

- El unique index parcial con `WHERE deleted_at IS NULL` es sintaxis PostgreSQL especifica — Alembic nunca lo autogenera, siempre hay que escribirlo a mano
- El `downgrade()` debe eliminar indices antes que la tabla; si el orden es incorrecto falla por dependencias

### Criterio de verificacion

```sql
-- Conectar a PostgreSQL y ejecutar:
\d course_ratings
```
Muestra tabla, columnas, CheckConstraint y ambos indices. `alembic current` apunta al nuevo revision.

---

## Fase B3: Schemas Pydantic

**Descripcion:** Crear el directorio `schemas/` y los contratos de entrada/salida para el endpoint de ratings. Establece el patron para futuros endpoints.

**Precondicion:** Fase B1 (conceptualmente). Independiente de B2 — pueden ejecutarse en paralelo.

### Pasos

| # | Archivo | Accion |
|---|---------|--------|
| 1 | `Backend/app/schemas/__init__.py` | Crear directorio `schemas/` con `__init__.py` vacio |
| 2 | `Backend/app/schemas/rating.py` | Crear `RatingCreate(BaseModel)`: `rating: int = Field(ge=1, le=5)`, `session_id: str = Field(min_length=1, max_length=255)` |
| 3 | `Backend/app/schemas/rating.py` | Crear `RatingResponse(BaseModel)`: `id: int`, `course_id: int`, `rating: int`, `average_rating: float`, `total_ratings: int` con `model_config = ConfigDict(from_attributes=True)` |
| 4 | `Backend/app/schemas/rating.py` | Crear `CourseRatingSummary(BaseModel)`: `average_rating: Optional[float]`, `total_ratings: int = 0` |

### Notas de implementacion

- `session_id` se valida solo por longitud, no como `UUID` type — el cliente mobile puede enviar formatos distintos
- `average_rating` en `RatingResponse` es calculado post-insert por el servicio, no proviene del ORM directamente
- La validacion de `Field(ge=1, le=5)` en Pydantic y el `CheckConstraint` en DB son dos capas independientes e intencionadas

### Criterio de verificacion

```bash
python -c "from app.schemas.rating import RatingCreate, RatingResponse, CourseRatingSummary; print('OK')"
```

---

## Fase B4: Servicio `RatingService`

**Descripcion:** Implementar la logica de negocio para crear ratings y calcular el resumen estadistico. Aqui vive el manejo del `IntegrityError` para el 409 y la query de agregacion.

**Precondicion:** Fases B1, B2 y B3 completas.

### Pasos

| # | Archivo | Accion |
|---|---------|--------|
| 1 | `Backend/app/services/rating_service.py` | Crear clase `RatingService` con constructor `__init__(self, db: Session)` identico al patron de `CourseService` |
| 2 | `Backend/app/services/rating_service.py` | Importar: `from sqlalchemy.exc import IntegrityError`, `from sqlalchemy import func`, modelos `Course` y `CourseRating` |
| 3 | `Backend/app/services/rating_service.py` | Implementar `create_rating(self, course_id: int, rating_data: RatingCreate) -> Dict[str, Any]` |
| 4 | `Backend/app/services/rating_service.py` | En `create_rating`: envolver insert en `try/except IntegrityError` — el `except` debe ejecutar `self.db.rollback()` **antes** del `raise HTTPException(409)` |
| 5 | `Backend/app/services/rating_service.py` | Tras insert exitoso: llamar a `get_course_rating_summary` y retornar dict con `id`, `course_id`, `rating`, `average_rating`, `total_ratings` |
| 6 | `Backend/app/services/rating_service.py` | Implementar `get_course_rating_summary(self, course_id: int) -> Dict[str, Any]` con `func.avg` y `func.count`, filtro `deleted_at IS None` |
| 7 | `Backend/app/services/rating_service.py` | Manejar `None` de `func.avg` cuando no hay registros: `round(avg, 2) if avg else None` |

### Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| `IntegrityError` sin rollback deja la sesion corrompida | `self.db.rollback()` es obligatorio en el bloque `except`, antes del `raise` |
| Race condition: dos requests simultaneos del mismo `session_id` pasan validacion en memoria | El unique index en DB es la defensa real; no agregar validacion previa con `SELECT` (crea TOCTOU) |
| N+1: llamar a `get_course_rating_summary` despues del insert es una segunda query | Aceptable en write path; dos queries separadas son mas legibles que una subquery compleja |

### Criterio de verificacion

```bash
curl -X POST http://localhost:8000/courses/{slug}/ratings \
  -H "Content-Type: application/json" \
  -d '{"rating": 4, "session_id": "test-uuid-123"}'
# → 201

curl -X POST http://localhost:8000/courses/{slug}/ratings \
  -H "Content-Type: application/json" \
  -d '{"rating": 4, "session_id": "test-uuid-123"}'
# → 409
```

---

## Fase B5: Endpoints y actualizacion de `CourseService`

**Descripcion:** Exponer los nuevos endpoints y enriquecer el response de detalle de curso con datos de rating.

**Precondicion:** Fase B4 completa.

### Parte A — Nuevo endpoint `POST /courses/{slug}/ratings`

| # | Archivo | Accion |
|---|---------|--------|
| 1 | `Backend/app/main.py` | Agregar factory `get_rating_service(db: Session = Depends(get_db)) -> RatingService` siguiendo el patron de `get_course_service` |
| 2 | `Backend/app/main.py` | Agregar endpoint `POST /courses/{slug}/ratings` con `status_code=201` |
| 3 | `Backend/app/main.py` | El endpoint resuelve el curso por slug primero (usando `course_service`) — retorna 404 si no existe |
| 4 | `Backend/app/main.py` | Llama a `rating_service.create_rating(course.id, rating_data)` y retorna el dict |
| 5 | `Backend/app/main.py` | Agregar imports: `from app.services.rating_service import RatingService`, `from app.schemas.rating import RatingCreate` |

### Parte B — Actualizar `GET /courses/{slug}`

| # | Archivo | Accion |
|---|---------|--------|
| 1 | `Backend/app/services/course_service.py` | Agregar metodo privado `_get_rating_summary(self, course_id: int)` con la query de agregacion (duplicar logica, NO importar `RatingService` — evita dependencia circular) |
| 2 | `Backend/app/services/course_service.py` | Importar `from app.models.rating import CourseRating` y `from sqlalchemy import func` |
| 3 | `Backend/app/services/course_service.py` | En `get_course_by_slug()`: llamar a `_get_rating_summary` y agregar `average_rating` y `total_ratings` al dict de retorno |

### Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Dependencia circular si `CourseService` importa `RatingService` | Duplicar la query de agregacion en `CourseService` como metodo privado |
| Test `test_course_detail_contract_fields_only` fallara por los nuevos campos | Actualizar `MOCK_COURSE_DETAIL` y el assertion del set de campos en la misma tarea |

### Criterio de verificacion

```bash
curl http://localhost:8000/courses/{slug}
# → Incluye "average_rating": null y "total_ratings": 0 si no hay ratings
# → Incluye el promedio correcto si ya hay ratings
```

---

## Fase B6: Tests

**Descripcion:** Cubrir los nuevos comportamientos con tests siguiendo el patron existente del proyecto.

**Precondicion:** Fases B3, B4 y B5 completas.

### Pasos

| # | Archivo | Casos de test |
|---|---------|---------------|
| 1 | `Backend/app/test_ratings.py` | `test_post_rating_success` → 201 con todos los campos del contrato |
| 2 | `Backend/app/test_ratings.py` | `test_post_rating_duplicate_returns_409` → mock lanza `HTTPException(409)` |
| 3 | `Backend/app/test_ratings.py` | `test_post_rating_course_not_found` → mock de `get_course_by_slug` retorna `None` → 404 |
| 4 | `Backend/app/test_ratings.py` | `test_post_rating_invalid_rating_below_1` → body `{"rating": 0, "session_id": "x"}` → 422 |
| 5 | `Backend/app/test_ratings.py` | `test_post_rating_invalid_rating_above_5` → body `{"rating": 6, "session_id": "x"}` → 422 |
| 6 | `Backend/app/test_ratings.py` | `test_post_rating_missing_session_id` → body `{"rating": 3}` → 422 |
| 7 | `Backend/app/test_ratings.py` | `test_course_detail_includes_rating_fields` → response incluye `average_rating` y `total_ratings` |
| 8 | `Backend/app/test_ratings.py` | `test_course_detail_average_rating_null_when_no_ratings` → response retorna `null`, no ausente |
| 9 | `Backend/app/test_main.py` | Actualizar `MOCK_COURSE_DETAIL` para incluir `"average_rating": 4.5, "total_ratings": 10` |
| 10 | `Backend/app/test_main.py` | Actualizar assertion de `TestContractCompliance` para incluir los nuevos campos en el set esperado |

### Notas

- Los tests 4, 5 y 6 (validacion 422) no requieren mocks — Pydantic rechaza el request antes del handler
- El fixture del `client` en `test_ratings.py` necesita `dependency_overrides` de dos servicios: `get_course_service` y `get_rating_service`

### Criterio de verificacion

```bash
pytest Backend/app/ -v
# Todos en verde, incluyendo los tests existentes actualizados
```

---

## Diagrama de dependencias

```
B1 (Modelo ORM)
 ├── B2 (Migracion)     [independiente de B3]
 └── B3 (Schemas)       [independiente de B2]
      └── B4 (RatingService)
           └── B5 (Endpoints + CourseService)
                └── B6 (Tests)
```

B2 y B3 pueden ejecutarse en paralelo una vez terminada B1.

---

## Tabla de riesgos consolidada

| Riesgo | Fase | Impacto | Mitigacion |
|--------|------|---------|-----------|
| Modelo no detectado por Alembic | B1 | Migracion vacia | Verificar `__init__.py` antes de `autogenerate` |
| Unique index parcial no autogenerado | B2 | Sin proteccion de duplicados | Agregar manualmente en el archivo de migracion |
| `IntegrityError` sin rollback | B4 | Sesion DB corrompida | `self.db.rollback()` obligatorio en el `except` |
| Dependencia circular entre servicios | B5 | Error de importacion en runtime | Duplicar query de agregacion en `CourseService` como metodo privado |
| Tests de contrato fallando | B5/B6 | Falso positivo en CI | Actualizar `MOCK_COURSE_DETAIL` y assertions simultaneamente |
| Race condition en inserts simultaneos | B4 | Doble rating del mismo usuario | El unique index es la defensa; no agregar SELECT previo |

---

## Archivos del plan

**Nuevos:**
- `Backend/app/models/rating.py`
- `Backend/app/schemas/__init__.py`
- `Backend/app/schemas/rating.py`
- `Backend/app/services/rating_service.py`
- `Backend/app/test_ratings.py`
- `Backend/app/alembic/versions/<timestamp>_add_course_ratings_table.py`

**Modificados:**
- `Backend/app/models/course.py`
- `Backend/app/models/__init__.py`
- `Backend/app/services/course_service.py`
- `Backend/app/main.py`
- `Backend/app/test_main.py`
