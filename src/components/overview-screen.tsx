"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { VisitDetailCard } from "./visit-detail-card";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { WorkspacePicker } from "./workspace-picker";
import { useOverview } from "@/lib/use-overview";
import { DEFAULT_THEME, normalizeTheme } from "@/lib/themes";
import type { OverviewData, OverviewPeriod } from "@/lib/overview";
import "./overview.css";

export function VisitActivity({ data }: { data: OverviewData }) {
  const largest = Math.max(0, ...data.activity.map(value => value.count));
  const max = Math.max(1, largest);
  return <section className="overview-section overview-activity" aria-labelledby="activity-title"><div className="overview-section-heading"><h2 id="activity-title">방문 추이</h2><span>{data.activityLabel}</span></div>
    <div className="overview-chart"><div className="overview-chart-scale" aria-hidden="true"><span>{largest > 0 ? `${largest}회` : ""}</span><span>0회</span></div><div className={`overview-bars ${data.period === "month" ? "daily" : ""}`} role="img" aria-label={`${data.activityLabel}. 구간별 방문 횟수는 아래 수치 표에서 확인할 수 있습니다.`}>{data.activity.map((value, index) => <div className="overview-bar-column" key={value.date}><div className="overview-bar-space"><span className="overview-bar-value">{value.count || ""}</span><div className="overview-bar" style={{ height: `${value.count / max * 100}%` }} title={`${value.date}: 방문 ${value.count}회`} /></div><small className={data.period === "month" && index % 5 !== 0 && index !== data.activity.length - 1 ? "sparse-label" : ""}>{value.label}</small></div>)}</div></div>
    <details className="overview-table"><summary>수치로 보기</summary><table><caption>{data.activityLabel}</caption><thead><tr><th scope="col">기간</th><th scope="col">방문 횟수</th></tr></thead><tbody>{data.activity.map(value => <tr key={value.date}><th scope="row">{value.date}</th><td>{value.count}회</td></tr>)}</tbody></table></details></section>;
}
export function OverviewScreen({ userId, demo = false }: { userId: string; demo?: boolean }) {
  const [selectedVisit, setSelectedVisit] = useState<{ id: string; groupId: string }>();
  const [groupId, setGroupId] = useState<string>();
  const [period, setPeriod] = useState<OverviewPeriod>("all");
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const { data, groups, error, loading, refresh } = useOverview(userId, demo, groupId, period);
  useEffect(() => { const timer = setTimeout(() => setTheme(normalizeTheme(localStorage.getItem("place-memory-theme-v1"))), 0); return () => clearTimeout(timer); }, []);
  const home = groupId ? `/?groupId=${encodeURIComponent(groupId)}` : "/";
  return <main className="journal-app overview-app" data-theme={theme}><div className="overview-shell">
    <header className="overview-header"><Link href="/" aria-label="기록 화면으로"><Brand compact /></Link><nav className="overview-nav" aria-label="지도 보기 방식"><Link href={home}>기록</Link><Link href={`${home}${groupId ? "&" : "?"}view=travel`}>여행 계획</Link><Link href="/overview" aria-current="page">모아보기</Link></nav></header>
    <div className="overview-title"><div><h1>모아보기</h1><p>함께 남긴 방문 기록과 앞으로의 여행을 한눈에.</p></div><Button variant="outline" disabled={loading} onClick={() => void refresh()}>{loading ? "불러오는 중…" : "새로고침"}</Button></div>
    <div className="overview-controls"><div><label>지도 범위</label><WorkspacePicker label="모아보기 지도 범위" value={groupId ?? "all"} options={[{ value: "all", label: "전체 지도" }, ...groups.map(group => ({ value: group.id, label: group.name }))]} onChange={value => setGroupId(value === "all" ? undefined : value)} /></div><div><label>기록 기간</label><WorkspacePicker label="모아보기 기록 기간" value={period} options={[{ value: "all", label: "전체 기간" }, { value: "year", label: "올해" }, { value: "month", label: "이번 달" }]} searchable={false} onChange={value => setPeriod(value as OverviewPeriod)} /></div></div>
    {error && <div className="overview-warning" role="alert"><p>{error}</p><Button variant="outline" onClick={() => void refresh()}>다시 시도</Button>{groupId && <Button variant="ghost" onClick={() => setGroupId(undefined)}>전체 지도로 돌아가기</Button>}<Link href="/">기록으로 돌아가기</Link>{error.includes("로그인") && <Link href="/login?next=%2Foverview">로그인</Link>}</div>}
    {!data && !error && <p className="overview-loading" role="status">방문 기록과 여행을 모으고 있어요…</p>}
    {data && <><dl className="overview-totals" aria-label="방문 완료 기록 요약">{([['장소', data.totals.places, '곳'], ['방문', data.totals.visits, '회'], ['사진', data.totals.photos, '장']] as const).map(([label, count, unit]) => <div key={label}><dt>{label}</dt><dd><strong>{count?.toLocaleString("ko-KR") ?? "—"}</strong><span>{unit}</span></dd></div>)}</dl><p className="overview-summary-note">방문 완료 기록 기준 · 방문 예정과 삭제한 기록 제외</p>
    {data.photoWarning && <div className="overview-warning" role="status"><p>{data.photoWarning}</p><Button variant="outline" disabled={loading} onClick={() => void refresh()}>사진 다시 불러오기</Button></div>}
    <div className="overview-top-grid"><VisitActivity data={data} /><section className="overview-section" aria-labelledby="tags-title"><div className="overview-section-heading"><h2 id="tags-title">자주 쓴 태그</h2><span>상위 5개</span></div>{data.tags.length ? <ol className="overview-tags">{data.tags.map(tag => <li key={tag.name}><span>{tag.name}</span><strong>방문 {tag.count}회</strong></li>)}</ol> : <p className="overview-empty">이 기간에 남긴 태그가 없어요.</p>}</section></div>
    <div className="overview-bottom-grid"><section className="overview-section" aria-labelledby="recent-title"><div className="overview-section-heading"><h2 id="recent-title">최근 방문</h2><span>최신 6개</span></div>{data.recentVisits.length ? <ul className="overview-recent">{data.recentVisits.map(visit => <li key={visit.id}><button type="button" aria-haspopup="dialog" onClick={() => setSelectedVisit({ id: visit.id, groupId: visit.groupId })}>{visit.photoUrl && <Image unoptimized src={visit.photoUrl} width={80} height={64} alt="" />}<div><strong>{visit.placeName}</strong>{visit.title && <span>{visit.title}</span>}<small>{visit.visitedOn} · {visit.groupName}</small></div><span className="overview-link-arrow" aria-hidden="true">→</span></button></li>)}</ul> : <div className="overview-empty"><p>이 기간에 남긴 방문 기록이 없어요.</p><Link href={home}>지도에 기록 남기기 →</Link></div>}</section>
    <section className="overview-section" aria-labelledby="trips-title"><div className="overview-section-heading"><h2 id="trips-title">예정 여행</h2></div><p className="overview-summary-note">진행 중·예정 여행 · 기록 기간과 별도</p>{data.upcomingTrips.length ? <ul className="overview-trips">{data.upcomingTrips.map(trip => <li key={trip.id}><Link href={`/?${new URLSearchParams({ groupId: trip.groupId, tripId: trip.id, view: "travel" })}`}><small>{trip.ongoing ? "진행 중" : "예정"} · {trip.groupName}</small><strong>{trip.name}</strong><span>{trip.startDate} – {trip.endDate}</span></Link></li>)}</ul> : <div className="overview-empty"><p>진행 중이거나 예정된 여행이 없어요.</p><Link href={`${home}${groupId ? "&" : "?"}view=travel`}>여행 계획하기 →</Link></div>}</section></div></>}
    </div>{selectedVisit && <VisitDetailCard key={selectedVisit.id} visitId={selectedVisit.id} groupId={selectedVisit.groupId} groups={groups} demo={demo} onClose={() => setSelectedVisit(undefined)} />}</main>;
}
