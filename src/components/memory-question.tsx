"use client";
import { useState } from "react";
import { MEMORY_QUESTIONS } from "@/lib/journal-delight";
import { Button } from "@/components/ui/button";

export function MemoryQuestion() {
  const [index, setIndex] = useState(0);
  return <div className="memory-question"><span id="memory-question" aria-live="polite">{MEMORY_QUESTIONS[index]}</span><Button size="sm" variant="ghost" onClick={() => setIndex(value => (value + 1) % MEMORY_QUESTIONS.length)}>다른 질문</Button></div>;
}
