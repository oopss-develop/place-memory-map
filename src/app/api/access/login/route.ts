import { NextResponse } from "next/server";
import { ACCESS_COOKIE, getAccessMember } from "@/lib/access-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const member = getAccessMember(code);

  if (!member) return NextResponse.json({ error: "입장 코드를 확인해 주세요." }, { status: 401 });

  const response = NextResponse.json({ displayName: member.displayName });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: code,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
