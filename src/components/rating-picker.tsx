"use client";

import { useState, type KeyboardEvent } from "react";
import { Star } from "lucide-react";

const RATING_VALUES = Array.from({ length: 10 }, (_, index) => index + 1);

function normalizeRating(value: number) {
  return Math.min(10, Math.max(1, Math.round(value)));
}

export function RatingPicker({ defaultValue = 5 }: { defaultValue?: number }) {
  const [rating, setRating] = useState(() => normalizeRating(defaultValue));
  const [preview, setPreview] = useState<number | null>(null);
  const visibleRating = preview ?? rating;

  function choose(value: number) {
    setRating(normalizeRating(value));
    setPreview(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, value: number) {
    let next: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(10, value + 1);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(1, value - 1);
    if (event.key === "Home") next = 1;
    if (event.key === "End") next = 10;
    if (next === undefined) return;
    event.preventDefault();
    choose(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-rating="${next}"]`)?.focus();
  }

  return (
    <fieldset className="rating-picker">
      <legend>별점 <output aria-live="polite">{rating}<span>/10</span></output></legend>
      <input type="hidden" name="rating" value={rating} />
      <div className="rating-stars" role="radiogroup" aria-label="별점 선택" onPointerLeave={() => setPreview(null)}>
        {RATING_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            data-rating={value}
            aria-checked={rating === value}
            aria-label={`${value}점`}
            className={`rating-star ${value <= visibleRating ? "is-filled" : ""}`}
            onClick={() => choose(value)}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") setPreview(value); }}
            onFocus={() => setPreview(value)}
            onBlur={() => setPreview(null)}
            onKeyDown={(event) => handleKeyDown(event, value)}
          >
            <Star aria-hidden="true" />
            <span aria-hidden="true">{value}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
