// Course types
export interface Course {
  id: number;
  title: string;
  teacher: string;
  duration: number;
  thumbnail: string;
  slug: string;
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
export interface RatingStats {
  average_rating: number;
  total_ratings: number;
  rating_distribution: Record<string, number>;
}

export interface RatingResponse {
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