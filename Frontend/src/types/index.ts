// Course types
export interface Course {
  id: number;
  title: string;
  teacher: string;
  duration: number;
  thumbnail: string;
  slug: string;
  average_rating?: number;
  total_ratings?: number;
}

// Class types
export interface Class {
  id: number;
  title: string;
  description: string;
  video: string;
  duration: number;
  slug: string;
}

// Course Detail type
export interface CourseDetail extends Course {
  description: string;
  classes: Class[];
}

// Progress types
export interface Progress {
  progress: number; // seconds
  user_id: number;
}

// Quiz types
export interface QuizOption {
  id: number;
  answer: string;
  correct: boolean;
}

export interface Quiz {
  id: number;
  question: string;
  options: QuizOption[];
}

// Favorite types
export interface FavoriteToggle {
  course_id: number;
}

// Rating types
export interface CourseRating {
  id: number;
  course_id: number;
  user_id: number;
  rating: number;
  created_at: string;
  updated_at: string;
}

export interface RatingRequest {
  user_id: number;
  rating: number;
}

export interface RatingStats {
  average_rating: number;
  total_ratings: number;
  rating_distribution: Record<string, number>;
}

export type RatingState = 'idle' | 'loading' | 'success' | 'error';

export interface RatingError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export function isValidRating(rating: number): rating is number {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function isCourseRating(obj: unknown): obj is CourseRating {
  if (typeof obj !== 'object' || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.id === 'number' &&
    typeof r.course_id === 'number' &&
    typeof r.user_id === 'number' &&
    typeof r.rating === 'number' &&
    typeof r.created_at === 'string' &&
    typeof r.updated_at === 'string'
  );
}