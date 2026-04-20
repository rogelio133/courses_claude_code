from pydantic import BaseModel, Field, field_validator
from typing import Dict
from datetime import datetime


class RatingRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="ID of the user submitting the rating")
    rating: int = Field(..., ge=1, le=5, description="Rating value from 1 (worst) to 5 (best)")

    @field_validator('rating')
    @classmethod
    def validate_rating_range(cls, v):
        if not 1 <= v <= 5:
            raise ValueError('Rating must be between 1 and 5')
        return v


class RatingResponse(BaseModel):
    id: int
    course_id: int
    user_id: int
    rating: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class RatingStatsResponse(BaseModel):
    average_rating: float = Field(..., ge=0.0, le=5.0)
    total_ratings: int = Field(..., ge=0)
    rating_distribution: Dict[int, int]

    class Config:
        json_schema_extra = {
            "example": {
                "average_rating": 4.35,
                "total_ratings": 142,
                "rating_distribution": {1: 5, 2: 10, 3: 25, 4: 50, 5: 52}
            }
        }


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None
