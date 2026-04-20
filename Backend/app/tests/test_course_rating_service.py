"""Unit tests for CourseService rating methods."""
import pytest
from unittest.mock import Mock, MagicMock
from datetime import datetime
from app.services.course_service import CourseService
from app.models.course import Course
from app.models.course_rating import CourseRating


@pytest.fixture
def mock_db_session():
    return Mock()


@pytest.fixture
def course_service(mock_db_session):
    return CourseService(db=mock_db_session)


@pytest.fixture
def sample_course():
    course = Course(
        id=1,
        name="Test Course",
        description="Test Description",
        thumbnail="https://example.com/thumb.jpg",
        slug="test-course",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        deleted_at=None
    )
    return course


@pytest.fixture
def sample_rating():
    rating = CourseRating(
        id=1,
        course_id=1,
        user_id=42,
        rating=5,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        deleted_at=None
    )
    return rating


class TestGetCourseRatings:

    def test_get_ratings_success(self, course_service, mock_db_session, sample_course, sample_rating):
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_course
        mock_db_session.query.return_value.filter.return_value.order_by.return_value.all.return_value = [sample_rating]

        result = course_service.get_course_ratings(course_id=1)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["rating"] == 5
        assert result[0]["user_id"] == 42

    def test_get_ratings_course_not_found(self, course_service, mock_db_session):
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="Course with id 1 not found"):
            course_service.get_course_ratings(course_id=1)

    def test_get_ratings_empty_list(self, course_service, mock_db_session, sample_course):
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_course
        mock_db_session.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        result = course_service.get_course_ratings(course_id=1)

        assert result == []


class TestAddCourseRating:

    def test_add_new_rating_success(self, course_service, mock_db_session, sample_course):
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_course,
            None
        ]
        mock_db_session.refresh = Mock(side_effect=lambda obj: setattr(obj, 'id', 1))

        result = course_service.add_course_rating(course_id=1, user_id=42, rating=5)

        assert result["rating"] == 5
        assert result["user_id"] == 42
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()

    def test_update_existing_rating(self, course_service, mock_db_session, sample_course, sample_rating):
        sample_rating.rating = 3
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_course,
            sample_rating
        ]

        result = course_service.add_course_rating(course_id=1, user_id=42, rating=5)

        assert sample_rating.rating == 5
        mock_db_session.flush.assert_called_once()
        mock_db_session.commit.assert_called_once()
        mock_db_session.add.assert_not_called()

    def test_add_rating_invalid_range(self, course_service, mock_db_session, sample_course):
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_course

        with pytest.raises(ValueError, match="Rating must be between 1 and 5"):
            course_service.add_course_rating(course_id=1, user_id=42, rating=6)

        with pytest.raises(ValueError, match="Rating must be between 1 and 5"):
            course_service.add_course_rating(course_id=1, user_id=42, rating=0)

    def test_add_rating_course_not_found(self, course_service, mock_db_session):
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="Course with id 999 not found"):
            course_service.add_course_rating(course_id=999, user_id=42, rating=5)


class TestUpdateCourseRating:

    def test_update_rating_success(self, course_service, mock_db_session, sample_rating):
        sample_rating.rating = 3
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_rating

        result = course_service.update_course_rating(course_id=1, user_id=42, rating=5)

        assert sample_rating.rating == 5
        assert result["rating"] == 5
        mock_db_session.commit.assert_called_once()

    def test_update_nonexistent_rating(self, course_service, mock_db_session):
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="No active rating found"):
            course_service.update_course_rating(course_id=1, user_id=42, rating=5)

    def test_update_rating_invalid_range(self, course_service, mock_db_session, sample_rating):
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_rating

        with pytest.raises(ValueError, match="Rating must be between 1 and 5"):
            course_service.update_course_rating(course_id=1, user_id=42, rating=10)


class TestDeleteCourseRating:

    def test_delete_rating_success(self, course_service, mock_db_session, sample_rating):
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_rating

        result = course_service.delete_course_rating(course_id=1, user_id=42)

        assert result is True
        assert sample_rating.deleted_at is not None
        mock_db_session.commit.assert_called_once()

    def test_delete_nonexistent_rating(self, course_service, mock_db_session):
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        result = course_service.delete_course_rating(course_id=1, user_id=42)

        assert result is False
        mock_db_session.commit.assert_not_called()


class TestGetUserCourseRating:

    def test_get_user_rating_exists(self, course_service, mock_db_session, sample_rating):
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_rating

        result = course_service.get_user_course_rating(course_id=1, user_id=42)

        assert result is not None
        assert result["rating"] == 5
        assert result["user_id"] == 42

    def test_get_user_rating_not_exists(self, course_service, mock_db_session):
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        result = course_service.get_user_course_rating(course_id=1, user_id=42)

        assert result is None


class TestGetCourseRatingStats:

    def test_get_stats_with_ratings(self, course_service, mock_db_session, sample_course):
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_course,
            Mock(average=4.5, total=10)
        ]
        distribution_results = [(5, 6), (4, 3), (3, 1)]
        mock_db_session.query.return_value.filter.return_value.group_by.return_value.all.return_value = distribution_results

        result = course_service.get_course_rating_stats(course_id=1)

        assert result["average_rating"] == 4.5
        assert result["total_ratings"] == 10
        assert result["rating_distribution"][5] == 6
        assert result["rating_distribution"][4] == 3
        assert result["rating_distribution"][3] == 1
        assert result["rating_distribution"][2] == 0
        assert result["rating_distribution"][1] == 0

    def test_get_stats_no_ratings(self, course_service, mock_db_session, sample_course):
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_course,
            Mock(average=0.0, total=0)
        ]
        mock_db_session.query.return_value.filter.return_value.group_by.return_value.all.return_value = []

        result = course_service.get_course_rating_stats(course_id=1)

        assert result["average_rating"] == 0.0
        assert result["total_ratings"] == 0
        assert all(count == 0 for count in result["rating_distribution"].values())

    def test_get_stats_course_not_found(self, course_service, mock_db_session):
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="Course with id 999 not found"):
            course_service.get_course_rating_stats(course_id=999)
