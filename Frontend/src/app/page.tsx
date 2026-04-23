import styles from "./page.module.scss";
import { Course, RatingStats } from "@/types";
import { Course as CourseComponent } from "@/components/Course/Course";
import Link from "next/link";

async function getCourses(): Promise<Course[]> {
  const res = await fetch("http://localhost:8000/courses", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

async function getCourseRatingStats(courseId: number): Promise<RatingStats | null> {
  try {
    const res = await fetch(`http://localhost:8000/courses/${courseId}/ratings/stats`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const courses = await getCourses();
  const ratingsStats = await Promise.all(courses.map((c) => getCourseRatingStats(c.id)));

  return (
    <div className={styles.page}>
      <header className={styles.banner}>
        <span className={styles.bannerRed}>PLATZI</span>
        <span className={styles.bannerBlack}>FLIX</span>
        <span className={styles.bannerSub}>CURSOS</span>
      </header>
      <div className={styles.verticalLeft}>PLATZI</div>
      <div className={styles.verticalRight}>FLIX</div>
      <main className={styles.main}>
        <div className={styles.coursesGrid}>
          {courses.map((course, index) => (
            <Link href={`/course/${course.slug}`} key={course.id}>
              <CourseComponent
                id={course.id}
                title={course.title}
                teacher={course.teacher}
                duration={course.duration}
                thumbnail={course.thumbnail}
                ratingStats={ratingsStats[index]}
              />
            </Link>
          ))}
        </div>
      </main>
      <div className={styles.gridBg}></div>
    </div>
  );
}
