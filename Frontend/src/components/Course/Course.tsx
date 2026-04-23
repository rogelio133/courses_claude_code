import styles from "./Course.module.scss";
import { Course as CourseType, RatingStats } from "@/types";
import { StarRating } from "./StarRating";

type CourseProps = Omit<CourseType, "slug"> & {
  ratingStats: RatingStats | null;
};

export const Course = ({ id, title, teacher, duration, thumbnail, ratingStats }: CourseProps) => {
  return (
    <article className={styles.courseCard}>
      <div className={styles.thumbnailContainer}>
        <img src={thumbnail} alt={title} className={styles.thumbnail} />
      </div>
      <div className={styles.courseInfo}>
        <h2 className={styles.courseTitle}>{title}</h2>
        <p className={styles.teacher}>Profesor: {teacher}</p>
        {ratingStats && (
          <StarRating
            rating={ratingStats.average_rating}
            totalRatings={ratingStats.total_ratings}
          />
        )}
        <p className={styles.duration}>Duración: {duration} minutos</p>
      </div>
    </article>
  );
};
