"use client";
import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { useActivityProgress } from "./activity-progress";
function LinkActivity() {
  const { pending } = useLinkStatus();
  useActivityProgress(pending, "화면 이동 중");
  return null;
}
export default function AppLink({ children, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props}>{children}<LinkActivity /></NextLink>;
}
