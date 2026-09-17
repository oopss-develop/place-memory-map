"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

const STAR_VALUES = Array.from({ length: 5 }, (_, index) => index + 1);
const PARTICLE_COLORS = [
  "var(--rating-gold)",
  "color-mix(in srgb, var(--rating-gold) 76%, var(--white))",
  "color-mix(in srgb, var(--rating-gold) 46%, var(--white))",
  "var(--white)",
];

type RatingEffect = {
  id: number;
  kind: "particle" | "fall";
  star: number;
  half?: "left" | "right";
  x: number;
  y: number;
  rotation: number;
  delay: number;
  size: number;
  color: string;
};

function normalizeRating(value: number) {
  return Math.min(5, Math.max(0.5, Math.round(value * 2) / 2));
}

function variedValue(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
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
  const [effects, setEffects] = useState<RatingEffect[]>([]);
  const effectId = useRef(0);
  const cleanupTimers = useRef<number[]>([]);
  const visibleRating = preview ?? rating;

  useEffect(() => () => cleanupTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  function playEffects(nextRating: number) {
    const created: RatingEffect[] = [];
    if (nextRating > rating) {
      const star = Math.ceil(nextRating);
      for (let index = 0; index < 9; index += 1) {
        const id = effectId.current += 1;
        const angle = variedValue(id * 3) * Math.PI * 2;
        const distance = 14 + variedValue(id * 5) * 16;
        created.push({
          id,
          kind: "particle",
          star,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 6,
          rotation: Math.round(variedValue(id * 7) * 180),
          delay: Math.round(variedValue(id * 11) * 70),
          size: 3 + Math.round(variedValue(id * 13) * 3),
          color: PARTICLE_COLORS[Math.floor(variedValue(id * 17) * PARTICLE_COLORS.length)],
        });
      }
    } else if (nextRating < rating) {
      let removedValue = rating;
      let order = 0;
      while (removedValue > nextRating) {
        const id = effectId.current += 1;
        created.push({
          id,
          kind: "fall",
          star: Math.ceil(removedValue),
          half: Number.isInteger(removedValue) ? "right" : "left",
          x: -11 + variedValue(id * 19) * 22,
          y: 40 + variedValue(id * 23) * 14,
          rotation: -45 + variedValue(id * 29) * 90,
          delay: order * 38 + Math.round(variedValue(id * 31) * 24),
          size: 22,
          color: "var(--rating-gold)",
        });
        removedValue -= 0.5;
        order += 1;
      }
    }
    if (!created.length) return;
    const ids = new Set(created.map((effect) => effect.id));
    setEffects((current) => [...current, ...created]);
    cleanupTimers.current.push(window.setTimeout(() => {
      setEffects((current) => current.filter((effect) => !ids.has(effect.id)));
    }, 760));
  }

  function choose(value: number) {
    const nextRating = normalizeRating(value);
    if (nextRating === rating) return setPreview(null);
    playEffects(nextRating);
    setRating(nextRating);
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
              {effects.filter((effect) => effect.star === star).map((effect) => effect.kind === "particle"
                ? <span key={effect.id} className="rating-particle" style={{ "--effect-x": `${effect.x}px`, "--effect-y": `${effect.y}px`, "--effect-rotation": `${effect.rotation}deg`, "--effect-size": `${effect.size}px`, animationDelay: `${effect.delay}ms`, color: effect.color } as CSSProperties} aria-hidden="true" />
                : <span key={effect.id} className={`rating-fall-fragment ${effect.half}`} style={{ "--effect-x": `${effect.x}px`, "--effect-y": `${effect.y}px`, "--effect-rotation": `${effect.rotation}deg`, animationDelay: `${effect.delay}ms`, color: effect.color } as CSSProperties} aria-hidden="true"><SquareSpark /></span>)}
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}
