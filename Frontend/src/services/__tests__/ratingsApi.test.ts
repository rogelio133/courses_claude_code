import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ratingsApi, ApiError } from '../ratingsApi';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ratingsApi', () => {
  describe('getCourseRatings', () => {
    it('builds the correct URL', async () => {
      mockFetch.mockResolvedValue(mockResponse([]));
      await ratingsApi.getCourseRatings(42);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/42/ratings'),
        expect.any(Object)
      );
    });

    it('returns ratings array on success', async () => {
      const ratings = [
        { id: 1, course_id: 1, user_id: 1, rating: 4, created_at: '', updated_at: '' },
      ];
      mockFetch.mockResolvedValue(mockResponse(ratings));
      const result = await ratingsApi.getCourseRatings(1);
      expect(result).toEqual(ratings);
    });

    it('returns empty array on 404', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 404));
      const result = await ratingsApi.getCourseRatings(1);
      expect(result).toEqual([]);
    });

    it('throws ApiError on 500', async () => {
      mockFetch.mockResolvedValue(mockResponse({ detail: 'Server error' }, 500));
      await expect(ratingsApi.getCourseRatings(1)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('addCourseRating', () => {
    const data = { user_id: 1, rating: 4 };
    const created = { id: 1, course_id: 1, user_id: 1, rating: 4, created_at: '', updated_at: '' };

    it('sends POST with correct headers and body', async () => {
      mockFetch.mockResolvedValue(mockResponse(created, 201));
      await ratingsApi.addCourseRating(1, data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/1/ratings'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      );
    });

    it('throws ApiError on 400 (invalid data)', async () => {
      mockFetch.mockResolvedValue(mockResponse({ detail: 'Invalid rating' }, 400));
      await expect(ratingsApi.addCourseRating(1, data)).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiError on 409 (already rated)', async () => {
      mockFetch.mockResolvedValue(mockResponse({ detail: 'Already rated' }, 409));
      await expect(ratingsApi.addCourseRating(1, data)).rejects.toBeInstanceOf(ApiError);
    });

    it('uses backend error message in ApiError', async () => {
      mockFetch.mockResolvedValue(mockResponse({ detail: 'Rating must be 1-5' }, 400));
      const err = await ratingsApi.addCourseRating(1, data).catch((e) => e);
      expect(err.message).toBe('Rating must be 1-5');
    });
  });

  describe('updateCourseRating', () => {
    const data = { user_id: 1, rating: 5 };
    const updated = { id: 1, course_id: 1, user_id: 1, rating: 5, created_at: '', updated_at: '' };

    it('sends PUT to the correct URL', async () => {
      mockFetch.mockResolvedValue(mockResponse(updated));
      await ratingsApi.updateCourseRating(1, 1, data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/1/ratings/1'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('sends correct JSON body', async () => {
      mockFetch.mockResolvedValue(mockResponse(updated));
      await ratingsApi.updateCourseRating(1, 1, data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: JSON.stringify(data) })
      );
    });

    it('throws ApiError on 404', async () => {
      mockFetch.mockResolvedValue(mockResponse({ detail: 'Not found' }, 404));
      await expect(ratingsApi.updateCourseRating(1, 1, data)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('deleteCourseRating', () => {
    it('sends DELETE to the correct URL', async () => {
      mockFetch.mockResolvedValue(mockResponse(null, 204));
      await ratingsApi.deleteCourseRating(1, 1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/1/ratings/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('resolves without error on 404', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 404));
      await expect(ratingsApi.deleteCourseRating(1, 1)).resolves.toBeUndefined();
    });

    it('throws ApiError on 500', async () => {
      mockFetch.mockResolvedValue(mockResponse({}, 500));
      await expect(ratingsApi.deleteCourseRating(1, 1)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('getCourseWithRatings', () => {
    const baseCourse = {
      id: 1, title: 'React', teacher: 'John', duration: 120,
      thumbnail: '', slug: 'react', description: '', classes: [],
    };

    it('fetches course by slug', async () => {
      mockFetch.mockResolvedValue(mockResponse(baseCourse));
      await ratingsApi.getCourseWithRatings('react');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/courses/react'),
        expect.any(Object)
      );
    });

    it('defaults average_rating and total_ratings to 0 when missing', async () => {
      mockFetch.mockResolvedValue(mockResponse(baseCourse));
      const result = await ratingsApi.getCourseWithRatings('react');
      expect(result.average_rating).toBe(0);
      expect(result.total_ratings).toBe(0);
    });

    it('preserves rating fields when backend sends them', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({ ...baseCourse, average_rating: 4.2, total_ratings: 85 })
      );
      const result = await ratingsApi.getCourseWithRatings('react');
      expect(result.average_rating).toBe(4.2);
      expect(result.total_ratings).toBe(85);
    });
  });

  describe('ApiError', () => {
    it('has correct name, message, status, and code', () => {
      const err = new ApiError('Not found', 404, '404', { detail: 'x' });
      expect(err.name).toBe('ApiError');
      expect(err.message).toBe('Not found');
      expect(err.status).toBe(404);
      expect(err.code).toBe('404');
      expect(err.details).toEqual({ detail: 'x' });
    });

    it('is an instance of Error', () => {
      expect(new ApiError('err', 500)).toBeInstanceOf(Error);
    });
  });

  describe('network errors', () => {
    it('throws ApiError on network failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(ratingsApi.getCourseRatings(1)).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiError with status 0 on network failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      const err = await ratingsApi.getCourseRatings(1).catch((e) => e);
      expect(err.status).toBe(0);
    });
  });
});
