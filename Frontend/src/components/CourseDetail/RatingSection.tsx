'use client';

import { useState, useEffect, useCallback } from 'react';
import { StarRating } from '@/components/StarRating/StarRating';
import { ratingsApi, ApiError } from '@/services/ratingsApi';
import styles from './RatingSection.module.scss';

interface RatingSectionProps {
  courseId: number;
  initialAverageRating?: number;
  initialTotalRatings?: number;
  userId: number;
}

function calculateOptimisticAverage(
  currentAverage: number,
  currentTotal: number,
  oldRating: number,
  newRating: number,
  isNewRating: boolean
): number {
  if (isNewRating) {
    const newTotal = currentTotal + 1;
    return (currentAverage * currentTotal + newRating) / newTotal;
  }
  if (currentTotal <= 1) return newRating;
  return (currentAverage * currentTotal - oldRating + newRating) / currentTotal;
}

export const RatingSection = ({
  courseId,
  initialAverageRating = 0,
  initialTotalRatings = 0,
  userId,
}: RatingSectionProps) => {
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(initialAverageRating);
  const [totalRatings, setTotalRatings] = useState(initialTotalRatings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    ratingsApi.getCourseRatings(courseId).then((ratings) => {
      const found = ratings.find((r) => r.user_id === userId);
      if (found) setUserRating(found.rating);
    }).catch((err) => {
      console.error('Failed to load user rating:', err);
    });
  }, [courseId, userId]);

  const handleRatingChange = useCallback(
    async (newRating: number) => {
      const previousUserRating = userRating;
      const previousAverage = averageRating;
      const previousTotal = totalRatings;
      const isNewRating = previousUserRating === 0;

      const optimisticAverage = calculateOptimisticAverage(
        averageRating,
        totalRatings,
        previousUserRating,
        newRating,
        isNewRating
      );
      const optimisticTotal = isNewRating ? totalRatings + 1 : totalRatings;

      setUserRating(newRating);
      setAverageRating(optimisticAverage);
      setTotalRatings(optimisticTotal);
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        if (isNewRating) {
          await ratingsApi.addCourseRating(courseId, { user_id: userId, rating: newRating });
        } else {
          await ratingsApi.updateCourseRating(courseId, userId, { user_id: userId, rating: newRating });
        }
        setSuccessMessage('Rating guardado exitosamente');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        setUserRating(previousUserRating);
        setAverageRating(previousAverage);
        setTotalRatings(previousTotal);
        const message = err instanceof ApiError
          ? err.message
          : 'Error al guardar rating. Por favor intenta de nuevo.';
        setError(message);
        setTimeout(() => setError(null), 5000);
      } finally {
        setIsLoading(false);
      }
    },
    [courseId, userId, userRating, averageRating, totalRatings]
  );

  return (
    <section className={styles.ratingSection} aria-label="Ratings del curso">
      <div className={styles.userRating}>
        <h3 className={styles.statsTitle}>Califica este curso</h3>
        <StarRating
          rating={userRating}
          onRatingChange={handleRatingChange}
          size="large"
          disabled={isLoading}
        />
        {isLoading && (
          <p className={styles.loadingText} role="status" aria-live="polite">
            Guardando...
          </p>
        )}
        {successMessage && (
          <p className={styles.successText} role="status" aria-live="polite">
            {successMessage}
          </p>
        )}
        {error && (
          <p className={styles.errorText} role="alert" aria-live="assertive">
            {error}
          </p>
        )}
      </div>

      <div>
        <h3 className={styles.statsTitle}>Rating general</h3>
        <p className={styles.statsDescription}>
          Basado en {totalRatings} {totalRatings === 1 ? 'valoración' : 'valoraciones'}
        </p>
        <StarRating
          rating={averageRating}
          readonly
          size="medium"
          showCount
          totalRatings={totalRatings}
        />
      </div>
    </section>
  );
};
