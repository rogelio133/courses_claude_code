from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from .base import BaseModel


class Course(BaseModel):
    """
    Course model representing online courses in the platform.
    """
    __tablename__ = 'courses'
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    thumbnail = Column(String(500), nullable=False)  # URL to thumbnail image
    slug = Column(String(255), nullable=False, unique=True, index=True)
    
    # Many-to-many relationship with Teacher
    teachers = relationship(
        "Teacher", 
        secondary="course_teachers", 
        back_populates="courses"
    )
    
    # One-to-many relationship with Lesson
    lessons = relationship(
        "Lesson",
        back_populates="course",
        cascade="all, delete-orphan"
    )

    # One-to-many relationship with CourseRating
    ratings = relationship(
        "CourseRating",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy='select'
    )

    @property
    def average_rating(self) -> float:
        active = [r.rating for r in self.ratings if r.deleted_at is None]
        if not active:
            return 0.0
        return round(sum(active) / len(active), 2)

    @property
    def total_ratings(self) -> int:
        return len([r for r in self.ratings if r.deleted_at is None])

    def __repr__(self):
        return f"<Course(id={self.id}, name='{self.name}', slug='{self.slug}')>" 