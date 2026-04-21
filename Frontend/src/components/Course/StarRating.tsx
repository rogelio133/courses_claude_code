import styles from "./StarRating.module.scss";

interface StarRatingProps {
  rating: number;
  totalRatings: number;
}

export const StarRating = ({ rating, totalRatings }: StarRatingProps) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className={styles.ratingContainer}>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= fullStars;
          const half = !filled && hasHalf && star === fullStars + 1;
          return (
            <span
              key={star}
              className={`${styles.star} ${filled ? styles.filled : half ? styles.half : styles.empty}`}
            >
              ★
            </span>
          );
        })}
      </div>
      <span className={styles.ratingText}>
        {rating.toFixed(1)} <span className={styles.totalRatings}>({totalRatings})</span>
      </span>
    </div>
  );
};
