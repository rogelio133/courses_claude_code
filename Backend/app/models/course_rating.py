from sqlalchemy import Column, Integer, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from .base import BaseModel


class CourseRating(BaseModel):
    __tablename__ = 'course_ratings'

    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    rating = Column(
        Integer,
        CheckConstraint('rating >= 1 AND rating <= 5', name='ck_course_ratings_rating_range'),
        nullable=False
    )

    course = relationship("Course", back_populates="ratings")

    def __repr__(self):
        return f"<CourseRating(id={self.id}, course_id={self.course_id}, user_id={self.user_id}, rating={self.rating})>"

    def to_dict(self):
        return {
            "id": self.id,
            "course_id": self.course_id,
            "user_id": self.user_id,
            "rating": self.rating,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
