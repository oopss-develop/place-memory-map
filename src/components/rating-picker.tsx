"use client";

import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

const STAR_VALUES = Array.from({ length: 5 }, (_, index) => index + 1);

function normalizeRating(value: number) {
  return Math.min(5, Math.max(0.5, Math.round(value * 2) / 2));
}

function SquareSpark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1.5C12.8 7.8 16.2 11.2 22.5 12C16.2 12.8 12.8 16.2 12 22.5C11.2 16.2 7.8 12.8 1.5 12C7.8 11.2 11.2 7.8 12 1.5Z" />
    </svg>
  );
}

export function RatingPicker({ defaultValue = 5 }: { defaultValue?: number }) {
  const [rating, setRating] = useState(() => normalizeRating(defaultValue));
  const [preview, setPreview] = useState<number | null>(null);
  const visibleRating = preview ?? rating;

  function choose(value: number) {
    setRating(normalizeRating(value));
    setPreview(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next = rating;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 0.5;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 0.5;
    else if (event.key === "Home") next = 0.5;
    else if (event.key === "End") next = 5;
    else return;
    event.preventDefault();
    choose(next);
  }

  function ratingFromPointer(event: PointerEvent<HTMLSpanElement>, star: number) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return star - ((event.clientX - bounds.left) < bounds.width / 2 ? 0.5 : 0);
  }

  return (
    <fieldset className="rating-picker">
      <legend>별점 <output aria-live="polite">{rating.toFixed(1)}<span>/5.0</span></output></legend>
      <input type="hidden" name="rating" value={rating} />
      <div
        className="rating-stars"
        role="slider"
        tabIndex={0}
        aria-label="별점 선택"
        aria-valuemin={0.5}
        aria-valuemax={5}
        aria-valuenow={rating}
        aria-valuetext={`${rating.toFixed(1)}점`}
        onKeyDown={handleKeyDown}
        onPointerLeave={() => setPreview(null)}
      >
        {STAR_VALUES.map((star) => {
          const fill = Math.min(1, Math.max(0, visibleRating - (star - 1)));
          return (
            <span
              key={star}
              className={`rating-star ${star === Math.ceil(rating) ? "is-current" : ""}`}
              onPointerMove={(event) => { if (event.pointerType === "mouse") setPreview(ratingFromPointer(event, star)); }}
              onPointerDown={(event) => { choose(ratingFromPointer(event, star)); event.currentTarget.parentElement?.focus(); }}
            >
              <span className="rating-star-icon" aria-hidden="true">
                <SquareSpark className="rating-star-empty" />
                <span className="rating-star-fill" style={{ "--rating-fill": `${fill * 100}%` } as CSSProperties}><SquareSpark /></span>
              </span>
              <span aria-hidden="true">{star}</span>
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}
