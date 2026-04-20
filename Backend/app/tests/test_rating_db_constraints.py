"""Database constraint tests for course_ratings table. Requires test database."""
import pytest
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from app.db.base import SessionLocal
from app.models.course import Course
from app.models.course_rating import CourseRating


@pytest.fixture
def db_session():
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def sample_course(db_session):
    course = Course(
        name="Test Course",
        description="Test Description",
        thumbnail="https://example.com/thumb.jpg",
        slug=f"test-course-{datetime.utcnow().timestamp()}"
    )
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)
    return course


class TestRatingConstraints:

    def test_rating_check_constraint_min(self, db_session, sample_course):
        rating = CourseRating(course_id=sample_course.id, user_id=42, rating=0)
        db_session.add(rating)

        with pytest.raises(IntegrityError, match="ck_course_ratings_rating_range"):
            db_session.commit()

    def test_rating_check_constraint_max(self, db_session, sample_course):
        rating = CourseRating(course_id=sample_course.id, user_id=42, rating=6)
        db_session.add(rating)

        with pytest.raises(IntegrityError, match="ck_course_ratings_rating_range"):
            db_session.commit()

    def test_unique_constraint_prevents_duplicate_active_ratings(self, db_session, sample_course):
        rating1 = CourseRating(course_id=sample_course.id, user_id=42, rating=5)
        db_session.add(rating1)
        db_session.commit()

        rating2 = CourseRating(course_id=sample_course.id, user_id=42, rating=3)
        db_session.add(rating2)

        with pytest.raises(IntegrityError, match="uq_course_ratings_user_course_deleted"):
            db_session.commit()

    def test_unique_constraint_allows_soft_deleted_duplicates(self, db_session, sample_course):
        rating1 = CourseRating(course_id=sample_course.id, user_id=42, rating=5)
        db_session.add(rating1)
        db_session.commit()

        rating1.deleted_at = datetime.utcnow()
        db_session.commit()

        rating2 = CourseRating(course_id=sample_course.id, user_id=42, rating=3)
        db_session.add(rating2)
        db_session.commit()

        db_session.refresh(rating2)
        assert rating2.id is not None
        assert rating2.rating == 3

    def test_foreign_key_constraint(self, db_session):
        rating = CourseRating(course_id=99999, user_id=42, rating=5)
        db_session.add(rating)

        with pytest.raises(IntegrityError, match="fk_course_ratings_course_id"):
            db_session.commit()
