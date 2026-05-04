import styles from "./Course.module.scss";
import { Course as CourseType } from "@/types";
import { StarRating } from "@/components/StarRating/StarRating";

type CourseProps = Omit<CourseType, "slug"> & {
  averageRating?: number;
  totalRatings?: number;
};

export const Course = ({ title, teacher, duration, thumbnail, averageRating, totalRatings }: CourseProps) => {
  return (
    <article className={styles.courseCard}>
      <div className={styles.thumbnailContainer}>
        <img src={thumbnail} alt={title} className={styles.thumbnail} />
      </div>
      <div className={styles.courseInfo}>
        <h2 className={styles.courseTitle}>{title}</h2>
        <p className={styles.teacher}>Profesor: {teacher}</p>
        {typeof averageRating === 'number' && (
          <div className={styles.ratingContainer}>
            <StarRating
              rating={averageRating}
              readonly
              size="small"
              showCount
              totalRatings={totalRatings}
            />
          </div>
        )}
        <p className={styles.duration}>Duración: {duration} minutos</p>
      </div>
    </article>
  );
};
