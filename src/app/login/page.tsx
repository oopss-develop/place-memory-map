import { LoginForm } from "@/components/login-form";
import { Brand } from "@/components/brand";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = typeof query.next === "string" && query.next.startsWith("/") && !query.next.startsWith("//") ? query.next : "/";
  const error = typeof query.error === "string" ? query.error : "";
  const initialMessage = error === "expired"
    ? "로그인 링크가 만료되었어요. 새 링크를 받아 주세요."
    : error === "invite"
      ? "초대 링크가 만료되었거나 이미 사용됐어요. 새 초대를 요청해 주세요."
      : error === "not-allowed"
        ? "등록되지 않은 이메일입니다. 관리자에게 등록을 요청해 주세요."
        : "";
  return (
    <main className="login-page">
      <section className="login-panel">
        <Brand />
        <div className="login-copy">
          <h1>로그인</h1>
          <p>방문한 장소와 여행 계획을 함께 관리하세요.<br />등록된 이메일과 키워드로 시작할 수 있습니다.</p>
        </div>
        <LoginForm next={next} initialMessage={initialMessage} />
        <p className="login-privacy">지도와 기록은 등록된 구성원에게만 공유됩니다.</p>
      </section>
    </main>
  );
}
