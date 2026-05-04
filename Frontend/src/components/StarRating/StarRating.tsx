'use client';

import { memo, useState, useCallback, useId, KeyboardEvent } from 'react';
import styles from './StarRating.module.scss';

interface StarIconProps {
  fillState: 'empty' | 'half' | 'full';
}

const StarIcon = ({ fillState }: StarIconProps) => {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {fillState === 'half' && (
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={
          fillState === 'full'
            ? 'currentColor'
            : fillState === 'half'
            ? `url(#${gradientId})`
            : 'none'
        }
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  totalRatings?: number;
  disabled?: boolean;
  className?: string;
}

const StarRatingBase = ({
  rating,
  onRatingChange,
  readonly = false,
  size = 'medium',
  showCount = false,
  totalRatings = 0,
  disabled = false,
  className = '',
}: StarRatingProps) => {
  const [hoverRating, setHoverRating] = useState(0);

  const getStarFillState = useCallback(
    (starIndex: number): 'empty' | 'half' | 'full' => {
      const currentRating = hoverRating || rating;
      if (currentRating >= starIndex) return 'full';
      if (currentRating >= starIndex - 0.5) return 'half';
      return 'empty';
    },
    [hoverRating, rating]
  );

  const handleMouseEnter = useCallback(
    (star: number) => {
      if (readonly || disabled) return;
      setHoverRating(star);
    },
    [readonly, disabled]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverRating(0);
  }, []);

  const handleClick = useCallback(
    (star: number) => {
      if (readonly || disabled || !onRatingChange) return;
      onRatingChange(star);
    },
    [readonly, disabled, onRatingChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, star: number) => {
      if (readonly || disabled || !onRatingChange) return;

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          if (star < 5) {
            const nextButton = event.currentTarget.nextElementSibling as HTMLButtonElement | null;
            nextButton?.focus();
          }
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (star > 1) {
            const prevButton = event.currentTarget.previousElementSibling as HTMLButtonElement | null;
            prevButton?.focus();
          }
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          onRatingChange(star);
          break;
        case 'Escape':
          event.preventDefault();
          setHoverRating(0);
          break;
      }
    },
    [readonly, disabled, onRatingChange]
  );

  return (
    <div
      className={`${styles.starRating} ${styles[size]} ${className}`}
      role="group"
      aria-label={`Rating: ${rating} out of 5 stars`}
    >
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`${styles.star} ${styles[getStarFillState(star)]}`}
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onMouseLeave={handleMouseLeave}
            onKeyDown={(e) => handleKeyDown(e, star)}
            disabled={readonly || disabled}
            aria-label={`Rate ${star} stars`}
            aria-pressed={rating === star}
            tabIndex={readonly ? -1 : 0}
          >
            <StarIcon fillState={getStarFillState(star)} />
          </button>
        ))}
      </div>
      {showCount && (
        <span className={styles.count} aria-label={`${totalRatings} ratings`}>
          ({totalRatings})
        </span>
      )}
    </div>
  );
};

export const StarRating = memo(StarRatingBase);
