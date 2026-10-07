"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="dashboard-error"><h1>기록을 불러오지 못했어요.</h1><p>연결을 확인하고 다시 시도해 주세요.</p><Button onClick={reset}>다시 시도</Button></main>;
}
