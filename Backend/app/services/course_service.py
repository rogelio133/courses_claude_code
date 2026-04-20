from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.models.course import Course
from app.models.lesson import Lesson
from app.models.teacher import Teacher
from app.models.course_rating import CourseRating


class CourseService:
    """
    Service class for handling course-related operations.
    Implements the contract specifications for course endpoints.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_all_courses(self) -> List[Dict[str, Any]]:
        """
        Get all courses with basic information (no teachers or lessons).
        
        Returns:
            List of course dictionaries with: id, name, description, thumbnail, slug
        """
        courses = self.db.query(Course).filter(Course.deleted_at.is_(None)).all()
        
        return [
            {
                "id": course.id,
                "name": course.name,
                "description": course.description,
                "thumbnail": course.thumbnail,
                "slug": course.slug
            }
            for course in courses
        ]

    def get_course_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        """
        Get course details by slug including teachers and lessons.
        
        Args:
            slug: The course slug
            
        Returns:
            Course dictionary with teachers and lessons, or None if not found
        """
        course = (
            self.db.query(Course)
            .options(
                joinedload(Course.teachers),
                joinedload(Course.lessons)
            )
            .filter(Course.slug == slug)
            .filter(Course.deleted_at.is_(None))
            .first()
        )
        
        if not course:
            return None

        try:
            rating_stats = self.get_course_rating_stats(course.id)
        except ValueError:
            rating_stats = {
                "average_rating": 0.0,
                "total_ratings": 0,
                "rating_distribution": {i: 0 for i in range(1, 6)}
            }

        return {
            "id": course.id,
            "name": course.name,
            "description": course.description,
            "thumbnail": course.thumbnail,
            "slug": course.slug,
            "teacher_id": [teacher.id for teacher in course.teachers],
            "classes": [
                {
                    "id": lesson.id,
                    "name": lesson.name,
                    "description": lesson.description,
                    "slug": lesson.slug
                }
                for lesson in course.lessons
                if lesson.deleted_at is None
            ],
            "average_rating": rating_stats["average_rating"],
            "total_ratings": rating_stats["total_ratings"],
            "rating_distribution": rating_stats["rating_distribution"]
        }

    def get_course_ratings(self, course_id: int) -> List[Dict[str, Any]]:
        course = self.db.query(Course).filter(
            Course.id == course_id,
            Course.deleted_at.is_(None)
        ).first()

        if not course:
            raise ValueError(f"Course with id {course_id} not found")

        ratings = (
            self.db.query(CourseRating)
            .filter(
                CourseRating.course_id == course_id,
                CourseRating.deleted_at.is_(None)
            )
            .order_by(CourseRating.created_at.desc())
            .all()
        )

        return [rating.to_dict() for rating in ratings]

    def add_course_rating(self, course_id: int, user_id: int, rating: int) -> Dict[str, Any]:
        if not 1 <= rating <= 5:
            raise ValueError("Rating must be between 1 and 5")

        course = self.db.query(Course).filter(
            Course.id == course_id,
            Course.deleted_at.is_(None)
        ).first()

        if not course:
            raise ValueError(f"Course with id {course_id} not found")

        existing_rating = (
            self.db.query(CourseRating)
            .filter(
                CourseRating.course_id == course_id,
                CourseRating.user_id == user_id,
                CourseRating.deleted_at.is_(None)
            )
            .first()
        )

        if existing_rating:
            existing_rating.rating = rating
            existing_rating.updated_at = datetime.utcnow()
            self.db.flush()
            self.db.commit()
            self.db.refresh(existing_rating)
            return existing_rating.to_dict()
        else:
            new_rating = CourseRating(
                course_id=course_id,
                user_id=user_id,
                rating=rating
            )
            self.db.add(new_rating)
            self.db.commit()
            self.db.refresh(new_rating)
            return new_rating.to_dict()

    def update_course_rating(self, course_id: int, user_id: int, rating: int) -> Dict[str, Any]:
        if not 1 <= rating <= 5:
            raise ValueError("Rating must be between 1 and 5")

        existing_rating = (
            self.db.query(CourseRating)
            .filter(
                CourseRating.course_id == course_id,
                CourseRating.user_id == user_id,
                CourseRating.deleted_at.is_(None)
            )
            .first()
        )

        if not existing_rating:
            raise ValueError(f"No active rating found for user {user_id} on course {course_id}")

        existing_rating.rating = rating
        existing_rating.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(existing_rating)

        return existing_rating.to_dict()

    def delete_course_rating(self, course_id: int, user_id: int) -> bool:
        rating_to_delete = (
            self.db.query(CourseRating)
            .filter(
                CourseRating.course_id == course_id,
                CourseRating.user_id == user_id,
                CourseRating.deleted_at.is_(None)
            )
            .first()
        )

        if not rating_to_delete:
            return False

        rating_to_delete.deleted_at = datetime.utcnow()
        rating_to_delete.updated_at = datetime.utcnow()
        self.db.commit()

        return True

    def get_user_course_rating(self, course_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        rating = (
            self.db.query(CourseRating)
            .filter(
                CourseRating.course_id == course_id,
                CourseRating.user_id == user_id,
                CourseRating.deleted_at.is_(None)
            )
            .first()
        )

        if not rating:
            return None

        return rating.to_dict()

    def get_course_rating_stats(self, course_id: int) -> Dict[str, Any]:
        course = self.db.query(Course).filter(
            Course.id == course_id,
            Course.deleted_at.is_(None)
        ).first()

        if not course:
            raise ValueError(f"Course with id {course_id} not found")

        stats = (
            self.db.query(
                func.coalesce(func.avg(CourseRating.rating), 0.0).label('average'),
                func.count(CourseRating.id).label('total')
            )
            .filter(
                CourseRating.course_id == course_id,
                CourseRating.deleted_at.is_(None)
            )
            .first()
        )

        distribution_query = (
            self.db.query(
                CourseRating.rating,
                func.count(CourseRating.id).label('count')
            )
            .filter(
                CourseRating.course_id == course_id,
                CourseRating.deleted_at.is_(None)
            )
            .group_by(CourseRating.rating)
            .all()
        )

        rating_distribution = {i: 0 for i in range(1, 6)}
        for rating_value, count in distribution_query:
            rating_distribution[rating_value] = count

        return {
            "average_rating": round(float(stats.average), 2),
            "total_ratings": stats.total,
            "rating_distribution": rating_distribution
        }