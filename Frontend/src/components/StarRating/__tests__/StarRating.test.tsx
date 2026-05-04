import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StarRating } from '../StarRating';

describe('StarRating Component', () => {
  describe('Rendering', () => {
    it('renders 5 stars', () => {
      render(<StarRating rating={3} />);
      expect(screen.getAllByRole('button')).toHaveLength(5);
    });

    it('shows count when showCount=true', () => {
      render(<StarRating rating={4} showCount totalRatings={42} />);
      expect(screen.getByText('(42)')).toBeInTheDocument();
    });

    it('does not show count when showCount=false', () => {
      render(<StarRating rating={4} showCount={false} totalRatings={42} />);
      expect(screen.queryByText('(42)')).not.toBeInTheDocument();
    });

    it('shows (0) when showCount=true and totalRatings defaults to 0', () => {
      render(<StarRating rating={4} showCount />);
      expect(screen.getByText('(0)')).toBeInTheDocument();
    });

    it('applies small size class', () => {
      const { container } = render(<StarRating rating={3} size="small" />);
      expect(container.firstChild).toHaveClass('small');
    });

    it('applies medium size class by default', () => {
      const { container } = render(<StarRating rating={3} />);
      expect(container.firstChild).toHaveClass('medium');
    });

    it('applies large size class', () => {
      const { container } = render(<StarRating rating={3} size="large" />);
      expect(container.firstChild).toHaveClass('large');
    });
  });

  describe('Interactivity', () => {
    it('calls onRatingChange when a star is clicked', () => {
      const onRatingChange = vi.fn();
      render(<StarRating rating={0} onRatingChange={onRatingChange} />);
      fireEvent.click(screen.getAllByRole('button')[2]);
      expect(onRatingChange).toHaveBeenCalledWith(3);
    });

    it('does not call onRatingChange when readonly', () => {
      const onRatingChange = vi.fn();
      render(<StarRating rating={3} onRatingChange={onRatingChange} readonly />);
      fireEvent.click(screen.getAllByRole('button')[2]);
      expect(onRatingChange).not.toHaveBeenCalled();
    });

    it('does not call onRatingChange when disabled', () => {
      const onRatingChange = vi.fn();
      render(<StarRating rating={3} onRatingChange={onRatingChange} disabled />);
      fireEvent.click(screen.getAllByRole('button')[2]);
      expect(onRatingChange).not.toHaveBeenCalled();
    });

    it('buttons are disabled when readonly=true', () => {
      render(<StarRating rating={3} readonly />);
      screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled());
    });

    it('buttons are disabled when disabled=true', () => {
      render(<StarRating rating={3} disabled />);
      screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled());
    });

    it('shows full stars up to hovered star on mouseEnter', () => {
      render(<StarRating rating={1} />);
      const buttons = screen.getAllByRole('button');
      fireEvent.mouseEnter(buttons[3]); // hover star 4
      expect(buttons[0]).toHaveClass('full');
      expect(buttons[1]).toHaveClass('full');
      expect(buttons[2]).toHaveClass('full');
      expect(buttons[3]).toHaveClass('full');
    });

    it('reverts to original rating on mouseLeave', () => {
      render(<StarRating rating={1} />);
      const buttons = screen.getAllByRole('button');
      fireEvent.mouseEnter(buttons[3]);
      fireEvent.mouseLeave(buttons[3]);
      expect(buttons[0]).toHaveClass('full');
      expect(buttons[1]).toHaveClass('empty');
    });

    it('does not change hover state in readonly mode', () => {
      render(<StarRating rating={1} readonly />);
      const buttons = screen.getAllByRole('button');
      fireEvent.mouseEnter(buttons[3]);
      expect(buttons[3]).toHaveClass('empty');
    });

    it('does not throw when no onRatingChange provided and star is clicked', () => {
      render(<StarRating rating={3} />);
      expect(() => fireEvent.click(screen.getAllByRole('button')[2])).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('has correct group aria-label', () => {
      render(<StarRating rating={4} />);
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-label',
        'Rating: 4 out of 5 stars'
      );
    });

    it('each star has correct aria-label', () => {
      render(<StarRating rating={3} />);
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: `Rate ${i} stars` })).toBeInTheDocument();
      }
    });

    it('selected star has aria-pressed=true, others false', () => {
      render(<StarRating rating={3} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons[2]).toHaveAttribute('aria-pressed', 'true');
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
      expect(buttons[4]).toHaveAttribute('aria-pressed', 'false');
    });

    it('all stars have tabIndex=-1 in readonly mode', () => {
      render(<StarRating rating={3} readonly />);
      screen.getAllByRole('button').forEach((btn) => {
        expect(btn).toHaveAttribute('tabindex', '-1');
      });
    });

    it('all stars have tabIndex=0 in interactive mode', () => {
      render(<StarRating rating={3} />);
      screen.getAllByRole('button').forEach((btn) => {
        expect(btn).toHaveAttribute('tabindex', '0');
      });
    });
  });

  describe('Keyboard navigation', () => {
    let onRatingChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onRatingChange = vi.fn();
    });

    it('moves focus to next star on ArrowRight', () => {
      render(<StarRating rating={3} onRatingChange={onRatingChange} />);
      const buttons = screen.getAllByRole('button');
      buttons[1].focus();
      fireEvent.keyDown(buttons[1], { key: 'ArrowRight' });
      expect(buttons[2]).toHaveFocus();
    });

    it('moves focus to previous star on ArrowLeft', () => {
      render(<StarRating rating={3} onRatingChange={onRatingChange} />);
      const buttons = screen.getAllByRole('button');
      buttons[2].focus();
      fireEvent.keyDown(buttons[2], { key: 'ArrowLeft' });
      expect(buttons[1]).toHaveFocus();
    });

    it('does not move focus past last star on ArrowRight', () => {
      render(<StarRating rating={5} onRatingChange={onRatingChange} />);
      const buttons = screen.getAllByRole('button');
      buttons[4].focus();
      fireEvent.keyDown(buttons[4], { key: 'ArrowRight' });
      expect(buttons[4]).toHaveFocus();
    });

    it('does not move focus before first star on ArrowLeft', () => {
      render(<StarRating rating={1} onRatingChange={onRatingChange} />);
      const buttons = screen.getAllByRole('button');
      buttons[0].focus();
      fireEvent.keyDown(buttons[0], { key: 'ArrowLeft' });
      expect(buttons[0]).toHaveFocus();
    });

    it('calls onRatingChange on Enter key', () => {
      render(<StarRating rating={0} onRatingChange={onRatingChange} />);
      fireEvent.keyDown(screen.getAllByRole('button')[3], { key: 'Enter' });
      expect(onRatingChange).toHaveBeenCalledWith(4);
    });

    it('calls onRatingChange on Space key', () => {
      render(<StarRating rating={0} onRatingChange={onRatingChange} />);
      fireEvent.keyDown(screen.getAllByRole('button')[1], { key: ' ' });
      expect(onRatingChange).toHaveBeenCalledWith(2);
    });

    it('Escape resets hover without calling onRatingChange', () => {
      render(<StarRating rating={2} onRatingChange={onRatingChange} />);
      const buttons = screen.getAllByRole('button');
      fireEvent.mouseEnter(buttons[4]);
      fireEvent.keyDown(buttons[4], { key: 'Escape' });
      expect(onRatingChange).not.toHaveBeenCalled();
      expect(buttons[4]).toHaveClass('empty');
    });

    it('does not respond to keyboard when readonly', () => {
      render(<StarRating rating={3} onRatingChange={onRatingChange} readonly />);
      fireEvent.keyDown(screen.getAllByRole('button')[2], { key: 'Enter' });
      expect(onRatingChange).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('all stars empty when rating=0', () => {
      render(<StarRating rating={0} />);
      screen.getAllByRole('button').forEach((btn) => expect(btn).toHaveClass('empty'));
    });

    it('renders half star at position 4 for rating=3.5', () => {
      render(<StarRating rating={3.5} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons[2]).toHaveClass('full');
      expect(buttons[3]).toHaveClass('half');
      expect(buttons[4]).toHaveClass('empty');
    });

    it('renders all stars full when rating=5', () => {
      render(<StarRating rating={5} />);
      screen.getAllByRole('button').forEach((btn) => expect(btn).toHaveClass('full'));
    });
  });
});
