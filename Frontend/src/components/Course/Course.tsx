import styles from "./Course.module.scss";
import { Course as CourseType } from "@/types";
import { StarRating } from "./StarRating";

type CourseProps = Omit<CourseType, "slug">;

const MOCK_RATINGS: Record<number, { rating: number; totalRatings: number }> = {
  1: { rating: 4.8, totalRatings: 312 },
  2: { rating: 4.5, totalRatings: 187 },
  3: { rating: 4.2, totalRatings: 95 },
  4: { rating: 3.7, totalRatings: 142 },
  5: { rating: 4.9, totalRatings: 428 },
  6: { rating: 4.1, totalRatings: 76 },
  7: { rating: 4.6, totalRatings: 253 },
  8: { rating: 3.5, totalRatings: 61 },
};

function getMockRating(id: number) {
  return MOCK_RATINGS[id] ?? { rating: 4.0, totalRatings: 100 };
}

export const Course = ({ id, title, teacher, duration, thumbnail }: CourseProps) => {
  const { rating, totalRatings } = getMockRating(id);

  return (
    <article className={styles.courseCard}>
      <div className={styles.thumbnailContainer}>
        <img src={thumbnail} alt={title} className={styles.thumbnail} />
      </div>
      <div className={styles.courseInfo}>
        <h2 className={styles.courseTitle}>{title}</h2>
        <p className={styles.teacher}>Profesor: {teacher}</p>
        <StarRating rating={rating} totalRatings={totalRatings} />
        <p className={styles.duration}>Duración: {duration} minutos</p>
      </div>
    </article>
  );
};
