# Plan de Implementacion Frontend: Sistema de Ratings

Basado en el analisis arquitectonico de `01_sistema_de_ratings.md`.

---

## Convenciones del codigo existente

Antes de implementar, respetar los siguientes patrones ya establecidos:

- **Tipado:** `types/index.ts` centraliza todas las interfaces; los componentes importan desde `@/types`
- **Fetch:** funciones `async` en Server Components con `cache: "no-store"` y manejo explicito de `response.status === 404`
- **Componentes:** funcionales con named export, props tipadas como `interface NombreComponenteProps` en el mismo archivo
- **SCSS:** cada componente tiene su `.module.scss`; import relativo `../../styles/vars.scss` (no el alias `@/`); colores via `color('nombre')`
- **Mapeo snake_case → camelCase:** el backend retorna snake_case, el frontend lo convierte internamente en la funcion de fetch
- **Server Components por defecto:** solo agregar `"use client"` donde sea estrictamente necesario (hooks, eventos del browser, localStorage)

---

## Fase F1: Tipado en `types/index.ts`

**Descripcion:** Agregar las interfaces necesarias sin tocar ningun componente. Sin efecto visual. Es la base de las fases siguientes.

**Precondicion:** Ninguna. Puede arrancar en paralelo con el Backend.

### Pasos

| # | Archivo | Accion |
|---|---------|--------|
| 1 | `Frontend/src/types/index.ts` | Agregar a `CourseDetail`: `averageRating?: number \| null` |
| 2 | `Frontend/src/types/index.ts` | Agregar a `CourseDetail`: `totalRatings?: number` |
| 3 | `Frontend/src/types/index.ts` | Crear interface `RatingSubmission`: `session_id: string`, `rating: number` |
| 4 | `Frontend/src/types/index.ts` | Crear interface `RatingResponse`: `average_rating: number`, `total_ratings: number` |

### Notas

- Campos marcados como opcionales (`?`) hasta que el endpoint del backend este confirmado. Se vuelven requeridos en Fase F4.
- `RatingSubmission` usa `session_id` en snake_case porque se envia directamente al backend.
- `RatingResponse` usa snake_case porque viene directamente del backend (sin mapeo intermedio).

### Criterio de verificacion

`yarn build` pasa sin errores de tipos. Sin cambio visual en ninguna pantalla.

---

## Fase F2: Componente `RatingStars` (aislado)

**Descripcion:** Crear el componente como Client Component completamente aislado, sin integrarlo en ninguna pantalla todavia. El objetivo es tener el componente funcional de forma independiente.

**Precondicion:** Fase F1 completa.

### Pasos

| # | Archivo | Accion |
|---|---------|--------|
| 1 | `Frontend/src/components/RatingStars/RatingStars.tsx` | Crear directorio y archivo con directive `"use client"` en la primera linea |
| 2 | `Frontend/src/components/RatingStars/RatingStars.tsx` | Definir interface `RatingStarsProps`: `courseSlug: string`, `initialAverageRating: number \| null \| undefined`, `totalRatings: number \| undefined` |
| 3 | `Frontend/src/components/RatingStars/RatingStars.tsx` | Named export: `export const RatingStars: FC<RatingStarsProps> = ...` |
| 4 | `Frontend/src/components/RatingStars/RatingStars.tsx` | Estados internos: `selectedRating` (0 = sin votar), `hoverRating`, `hasVoted`, `isLoading`, `currentAverage`, `currentTotal` |
| 5 | `Frontend/src/components/RatingStars/RatingStars.tsx` | `useEffect` para leer `localStorage` — clave: `platziflix_rating_${courseSlug}`. El estado inicial de todos los campos derivados de localStorage debe ser `null`/`0`/`false` para evitar hydration mismatch |
| 6 | `Frontend/src/components/RatingStars/RatingStars.tsx` | Generar `session_id` con `crypto.randomUUID()` **dentro del `useEffect`**; si ya existe en localStorage reutilizarlo, si no persisitirlo |
| 7 | `Frontend/src/components/RatingStars/RatingStars.tsx` | Al click en estrella: `POST http://localhost:8000/courses/${courseSlug}/ratings` con body `RatingSubmission`; al exito actualizar `currentAverage` y `currentTotal` con la respuesta |
| 8 | `Frontend/src/components/RatingStars/RatingStars.tsx` | Texto de soporte: si `currentAverage` existe mostrar `"X.X / 5 (N valoraciones)"`; si no hay ratings mostrar `"Se el primero en valorar este curso"`; si `hasVoted` mostrar `"Tu valoracion: N estrellas"` |
| 9 | `Frontend/src/components/RatingStars/RatingStars.module.scss` | Crear con import `@import '../../styles/vars.scss'` (ruta relativa, identica a otros componentes) |
| 10 | `Frontend/src/components/RatingStars/RatingStars.module.scss` | Clases: `.container`, `.starsRow`, `.star`, `.starFilled`, `.starHover`, `.starDisabled`, `.ratingInfo`, `.ratingCount` |
| 11 | `Frontend/src/components/RatingStars/RatingStars.module.scss` | Color estrella activa: `color('primary')` (#ff2d2d). Color estrella vacia: `color('light-gray')`. Post-voto: `opacity: 0.7`, `cursor: default` |

### Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Hydration mismatch por `localStorage` | Todo acceso a `localStorage` dentro de `useEffect`. Estado inicial siempre neutro (`null`, `0`, `false`) |
| `crypto.randomUUID()` evaluado en SSR | Generar dentro de `useEffect` o proteger con `typeof window !== "undefined"` |
| `localStorage` bloqueado en modo privado | Envolver en `try/catch`; si falla, generar UUID temporal en memoria sin persistir |

### Criterio de verificacion

Renderizar `<RatingStars courseSlug="test" initialAverageRating={4.2} totalRatings={18} />` en una pagina de prueba:
- Muestra 5 estrellas
- Responde a hover y click
- Hace el POST al backend
- Sin errores de hidratacion en consola del browser
- `yarn build` pasa

---

## Fase F3: Tests del componente `RatingStars`

**Descripcion:** Escribir tests con Vitest + Testing Library antes de la integracion, siguiendo el patron del proyecto.

**Precondicion:** Fase F2 completa. Puede solaparse con el inicio de F4.

### Pasos

| # | Accion | Detalle |
|---|--------|---------|
| 1 | Verificar configuracion de Vitest | Confirmar que `vitest.config.ts` usa `jsdom` como entorno — requerido para `localStorage` en tests |
| 2 | Verificar convencion de ubicacion | Buscar archivos `*.test.tsx` o `*.spec.tsx` en el proyecto para confirmar si van junto al componente o en `__tests__/` |
| 3 | Crear `RatingStars.test.tsx` | Caso: render inicial muestra 5 estrellas |
| 4 | Crear `RatingStars.test.tsx` | Caso: render con `initialAverageRating={4}` muestra el promedio en texto |
| 5 | Crear `RatingStars.test.tsx` | Caso: render sin ratings muestra el mensaje "Se el primero en valorar" |
| 6 | Crear `RatingStars.test.tsx` | Caso: hover sobre estrella 3 cambia el estado visual de las primeras 3 |
| 7 | Crear `RatingStars.test.tsx` | Caso: click en estrella 4 llama al fetch con payload `{rating: 4, session_id: "..."}` |
| 8 | Crear `RatingStars.test.tsx` | Caso: post-voto las estrellas quedan deshabilitadas (no responden a hover/click adicionales) |
| 9 | Crear `RatingStars.test.tsx` | Mock de `localStorage`: `jest.spyOn(Storage.prototype, 'getItem')` o el equivalente de Vitest |
| 10 | Crear `RatingStars.test.tsx` | Mock de `fetch`: interceptar el POST y retornar un `RatingResponse` simulado |

### Notas

- No testear SSR/hydration directamente — eso es responsabilidad de tests e2e
- Enfocarse en logica de interaccion del componente

### Criterio de verificacion

`yarn test` ejecuta los tests de `RatingStars` y todos pasan. Sin `console.error` sobre `act()` ni warnings de React en la salida.

---

## Fase F4: Integracion en `CourseDetail` y `page.tsx`

**Descripcion:** Conectar `RatingStars` en el flujo real de datos del Server Component. Esta fase toca tres archivos existentes.

**Precondicion:** Fases F1, F2 y F3 completas. Idealmente Backend Fase B5 confirmada (endpoint disponible).

### Pasos

| # | Archivo | Accion |
|---|---------|--------|
| 1 | `Frontend/src/app/course/[slug]/page.tsx` | **Verificar primero** la estructura real del JSON con `console.log` antes de asumir nombres de campos |
| 2 | `Frontend/src/app/course/[slug]/page.tsx` | En `getCourseData()`: cambiar `return response.json()` por mapeo explicito que agrega `averageRating: data.average_rating ?? null` y `totalRatings: data.total_ratings ?? 0` |
| 3 | `Frontend/src/types/index.ts` | Convertir `averageRating?` y `totalRatings?` de opcionales a requeridos (quitar `?`) ahora que el backend esta confirmado |
| 4 | `Frontend/src/components/CourseDetail/CourseDetail.tsx` | Agregar import: `import { RatingStars } from "@/components/RatingStars/RatingStars"` |
| 5 | `Frontend/src/components/CourseDetail/CourseDetail.tsx` | Renderizar `<RatingStars courseSlug={course.slug} initialAverageRating={course.averageRating} totalRatings={course.totalRatings} />` dentro de `.courseInfo`, despues del bloque `.stats` |
| 6 | `Frontend/src/components/CourseDetail/CourseDetail.tsx` | **No agregar** `"use client"` — `CourseDetail` debe permanecer como Server Component; Next.js gestiona el SSR boundary automaticamente |

### Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Mapeo incorrecto del JSON (snake_case vs nombres internos del frontend) | Verificar con `console.log(data)` en desarrollo antes de asumir nombres de campos |
| Alguien agrega `"use client"` a `CourseDetail` pensando que es necesario | Solo el componente que usa hooks/eventos del browser necesita `"use client"`, no los que lo importan |
| Backend no retorna `average_rating`/`total_ratings` todavia | Campos opcionales con `?? null` y `?? 0` en el mapeo absorben la ausencia sin errores en runtime |

### Criterio de verificacion

- Pagina `/course/[slug]` muestra el componente de estrellas debajo de las estadisticas
- El promedio inicial es visible en `view-source` (SSR — viene del servidor)
- Las estrellas responden a interaccion en el cliente
- Sin errores en consola del browser
- `yarn build` pasa
- `yarn test` sigue pasando

---

## Fase F5: Refinamiento y accesibilidad

**Descripcion:** Pulir el componente para que sea accesible y coherente con el sistema de diseno sin cambiar la logica de datos.

**Precondicion:** Fase F4 funcionando correctamente.

### Pasos

| # | Archivo | Accion |
|---|---------|--------|
| 1 | `RatingStars.tsx` | Agregar `role="group"` y `aria-label="Valorar este curso"` al contenedor de estrellas |
| 2 | `RatingStars.tsx` | Cada estrella: `aria-label="X estrellas"` + `role="radio"` o usar elementos `<button>` nativos (ya son focuseables por defecto) |
| 3 | `RatingStars.tsx` | Si se usan `<span>` o `<div>`: agregar `tabIndex={0}` y manejar `onKeyDown` con `Enter` y `Space` para activar el click |
| 4 | `RatingStars.tsx` | Estado de carga `isLoading`: deshabilitar con `pointer-events: none` y mostrar texto `"Guardando..."` |
| 5 | `RatingStars.tsx` | Manejo de error en POST: mostrar mensaje de error breve y restaurar el estado previo para permitir reintento |
| 6 | `RatingStars.module.scss` | Area de toque minima 44x44px en mobile (recomendacion WCAG): ajustar `padding` de cada estrella |
| 7 | `RatingStars.module.scss` | Agregar `touch-action: manipulation` para mejor respuesta en mobile |

### Criterio de verificacion

- Navegacion completa por teclado: Tab llega a las estrellas, Enter/Space las activa
- Sin warnings de accesibilidad en Lighthouse
- Estado de error muestra retroalimentacion al usuario y permite reintentar
- Componente usable en viewport de 375px de ancho
- `yarn test` sigue pasando

---

## Diagrama de dependencias

```
F1 (Tipos)
 └── F2 (Componente RatingStars)
      └── F3 (Tests)
           └── F4 (Integracion)   <-- requiere tambien Backend B5
                └── F5 (Accesibilidad)
```

F1, F2 y F3 pueden ejecutarse en paralelo con el Backend (B1–B5).
F4 requiere que el endpoint `POST /courses/{slug}/ratings` este disponible.

---

## Tabla de riesgos consolidada

| Riesgo | Fase | Impacto | Mitigacion |
|--------|------|---------|-----------|
| Hydration mismatch por `localStorage` | F2 | Error en produccion | Todo acceso a `localStorage` dentro de `useEffect`; estado inicial neutro |
| `crypto.randomUUID()` en SSR | F2 | Build break | Dentro de `useEffect` o con guardia `typeof window !== "undefined"` |
| `localStorage` bloqueado en modo privado | F2 | Usuario no puede votar | `try/catch`; UUID temporal en memoria como fallback |
| Mapeo incorrecto snake_case → camelCase | F4 | Campos undefined en runtime | Verificar JSON real con `console.log` antes de escribir el mapeo |
| `CourseDetail` se convierte en Client Component | F4 | Perdida de SSR en la pagina completa | Solo `RatingStars` tiene `"use client"` |
| jsdom no configurado en Vitest | F3 | Tests de `localStorage` fallan | Verificar `vitest.config.ts` antes de escribir los tests |

---

## Archivos del plan

**Nuevos:**
- `Frontend/src/components/RatingStars/RatingStars.tsx`
- `Frontend/src/components/RatingStars/RatingStars.module.scss`
- `Frontend/src/components/RatingStars/RatingStars.test.tsx`

**Modificados:**
- `Frontend/src/types/index.ts`
- `Frontend/src/app/course/[slug]/page.tsx`
- `Frontend/src/components/CourseDetail/CourseDetail.tsx`
