import type { CourseRating, CourseDetail, RatingRequest } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    return response;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out', 408);
    }
    throw new ApiError('Network error', 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP error ${response.status}`;
    let details: Record<string, unknown> | undefined;

    try {
      const body = await response.json();
      message = (body.detail as string) || (body.message as string) || message;
      details = body as Record<string, unknown>;
    } catch {
      // body is not JSON, keep default message
    }

    throw new ApiError(message, response.status, String(response.status), details);
  }

  return response.json() as Promise<T>;
}

async function getCourseRatings(courseId: number): Promise<CourseRating[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/courses/${courseId}/ratings`);
  if (response.status === 404) return [];
  return handleApiResponse<CourseRating[]>(response);
}

async function addCourseRating(
  courseId: number,
  data: RatingRequest
): Promise<CourseRating> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/courses/${courseId}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleApiResponse<CourseRating>(response);
}

async function updateCourseRating(
  courseId: number,
  userId: number,
  data: RatingRequest
): Promise<CourseRating> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/courses/${courseId}/ratings/${userId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  return handleApiResponse<CourseRating>(response);
}

async function deleteCourseRating(courseId: number, userId: number): Promise<void> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/courses/${courseId}/ratings/${userId}`,
    { method: 'DELETE' }
  );
  if (response.status === 404) return;
  if (!response.ok) {
    throw new ApiError(`HTTP error ${response.status}`, response.status);
  }
}

async function getCourseWithRatings(slug: string): Promise<CourseDetail> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/courses/${slug}`);
  const data = await handleApiResponse<CourseDetail>(response);
  return {
    ...data,
    average_rating: data.average_rating ?? 0,
    total_ratings: data.total_ratings ?? 0,
  };
}

export const ratingsApi = {
  getCourseRatings,
  addCourseRating,
  updateCourseRating,
  deleteCourseRating,
  getCourseWithRatings,
} as const;
