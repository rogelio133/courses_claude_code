import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Course } from "../Course";

describe("Course Component", () => {
  const mockCourse = {
    id: 1,
    title: "React Fundamentals",
    teacher: "John Doe",
    duration: 120,
    thumbnail: "https://example.com/thumbnail.jpg",
    averageRating: 4.5,
    totalRatings: 120,
  };

  it("renders course information correctly", () => {
    render(<Course {...mockCourse} />);

    expect(screen.getByText(mockCourse.title)).toBeDefined();
    expect(screen.getByText(`Profesor: ${mockCourse.teacher}`)).toBeDefined();
    expect(screen.getByText(`Duración: ${mockCourse.duration} minutos`)).toBeDefined();
  });

  it("renders thumbnail with correct alt text", () => {
    render(<Course {...mockCourse} />);

    const thumbnail = screen.getByRole("img");
    expect(thumbnail).toHaveAttribute("src", mockCourse.thumbnail);
    expect(thumbnail).toHaveAttribute("alt", mockCourse.title);
  });

  it("renders with correct structure", () => {
    const { container } = render(<Course {...mockCourse} />);

    expect(container.querySelector("article")).toBeDefined();
    expect(container.querySelector("div > img")).toBeDefined();
    expect(container.querySelector("div > h2")).toBeDefined();
    expect(container.querySelector("div > p")).toBeDefined();
  });

  it("renders rating when averageRating is provided", () => {
    render(<Course {...mockCourse} />);
    const group = screen.getByRole("group");
    expect(group).toBeDefined();
  });

  it("does not render rating when averageRating is not provided", () => {
    const { averageRating: _, totalRatings: __, ...courseWithoutRating } = mockCourse;
    render(<Course {...courseWithoutRating} />);
    expect(screen.queryByRole("group")).toBeNull();
  });
});
