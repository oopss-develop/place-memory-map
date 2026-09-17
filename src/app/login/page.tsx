import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = typeof query.next === "string" && query.next.startsWith("/") ? query.next : "/";
  return (
    <main className="login-page">
      <section className="login-notebook">
        <div className="brand-mark"><img src="/map-pins/yellow-sparkle-round.png" alt="" /><span>PLACE MEMORY MAP</span></div>
        <div className="login-copy">
          <h1>함께 간 곳은<br />함께 기억해요.</h1>
          <p>우리만 볼 수 있는 지도에 방문한 장소와 그날의 이야기를 차곡차곡 남겨보세요.</p>
        </div>
        <LoginForm next={next} />
      </section>
      <aside className="login-map" aria-label="서울 방문 기록 예시 지도">
        <div className="map-label map-label-one">서촌 · 08.23</div>
        <div className="map-label map-label-two">서울숲 · 07.12</div>
        <div className="map-thread" />
        <span className="pin pin-one" /><span className="pin pin-two" />
        <p>나중에 이 지도를 펼쳤을 때,<br />그날의 온도까지 떠오르도록.</p>
      </aside>
    </main>
  );
}
