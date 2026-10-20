import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DoorOpen,
  MessageCircleMore,
  Plus,
  UsersRound,
} from "lucide-react";

// 카드와 버튼이 눌렸을 때 부모 페이지가 토스트를 표시하도록 전달하는 함수.
type HomeDashboardProps = {
  onFeatureClick: (featureName: string) => void;
};

// API 연동 전 홈 화면 구조를 확인하기 위한 임시 요약 데이터.
const summaryCards = [
  { label: "오늘 일정", value: "3", suffix: "건", icon: CalendarDays, accent: "bg-blue-50 text-blue-600" },
  { label: "안 읽은 메시지", value: "12", suffix: "건", icon: MessageCircleMore, accent: "bg-violet-50 text-violet-600" },
  { label: "온라인 구성원", value: "28", suffix: "명", icon: UsersRound, accent: "bg-emerald-50 text-emerald-600" },
  { label: "회의실 예약", value: "2", suffix: "건", icon: DoorOpen, accent: "bg-amber-50 text-amber-600" },
];

// 오늘 일정 영역에 표시할 임시 일정 데이터.
const scheduleItems = [
  { time: "10:00", title: "주간 개발팀 싱크", place: "회의실 A · 30분" },
  { time: "13:30", title: "프로젝트 UI 리뷰", place: "온라인 미팅 · 1시간" },
  { time: "16:00", title: "스프린트 회고", place: "회의실 B · 1시간" },
];

// 최근 활동 영역에 표시할 임시 활동 데이터.
const activityItems = [
  { title: "신규 공지사항이 등록되었습니다.", detail: "서비스 운영 정책 안내", time: "방금 전" },
  { title: "김하늘님이 메시지를 보냈습니다.", detail: "개발팀 · 프로젝트 논의방", time: "18분 전" },
  { title: "회의실 A 예약이 승인되었습니다.", detail: "오늘 16:00 ~ 17:00", time: "1시간 전" },
];

// 조직 구성원 영역에 표시할 임시 구성원 데이터.
const teamMembers = [
  { name: "김하늘", team: "개발팀", online: true },
  { name: "박민수", team: "기획팀", online: true },
  { name: "이서연", team: "디자인팀", online: false },
];

export function HomeDashboard({ onFeatureClick }: HomeDashboardProps) {
  // 사용자 브라우저의 한국어 형식으로 오늘 날짜를 만듦.
  const today = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
      <section className="mb-7 flex flex-col gap-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-7 text-white shadow-sm sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <p className="text-sm text-slate-300">{today}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">관리자님, 좋은 하루 되세요.</h1>
          <p className="mt-2 text-sm text-slate-300">오늘의 협업 현황과 주요 일정을 한눈에 확인하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => onFeatureClick("새 일정")}
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-md"
        >
          <Plus size={17} />
          새 일정
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 요약 카드 데이터만 추가하면 같은 디자인의 카드가 자동으로 늘어남. */}
        {summaryCards.map(({ label, value, suffix, icon: Icon, accent }) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
                <Icon size={19} />
              </span>
            </div>
            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
              {value}
              <span className="ml-1 text-base font-medium text-slate-500">{suffix}</span>
            </p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-12">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-slate-900">오늘의 일정</p>
              <p className="mt-1 text-sm text-slate-500">예정된 회의와 일정을 확인하세요.</p>
            </div>
            <button
              type="button"
              onClick={() => onFeatureClick("캘린더")}
              className="cursor-pointer rounded-sm text-sm font-medium text-blue-600 transition hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              전체보기
            </button>
          </div>
          <div className="mt-5 space-y-4">
            {/* 일정 배열을 시간 순서대로 반복 표시. */}
            {scheduleItems.map((schedule) => (
              <div key={schedule.time} className="flex gap-4">
                <time className="w-11 pt-0.5 text-sm font-semibold text-blue-600">{schedule.time}</time>
                <span className="relative flex w-px bg-slate-200 before:absolute before:-left-1 before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-blue-500" />
                <div className="pb-3">
                  <p className="font-medium text-slate-800">{schedule.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{schedule.place}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-slate-900">최근 활동</p>
              <p className="mt-1 text-sm text-slate-500">업데이트된 협업 소식입니다.</p>
            </div>
            <BellRing size={19} className="text-slate-400" />
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {/* 활동 항목 전체를 클릭 가능하게 만들어 추후 상세 화면으로 연결 가능. */}
            {activityItems.map((activity) => (
              <button
                key={activity.title}
                type="button"
                onClick={() => onFeatureClick("최근 활동")}
                className="flex w-full cursor-pointer items-start gap-3 rounded-md py-4 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 first:pt-2"
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{activity.title}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{activity.detail}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{activity.time}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-slate-900">조직 구성원</p>
              <p className="mt-1 text-sm text-slate-500">현재 자주 연락하는 구성원</p>
            </div>
            <button
              type="button"
              aria-label="조직도 열기"
              onClick={() => onFeatureClick("조직도")}
              className="cursor-pointer rounded-md p-1 transition hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <ChevronRight size={20} className="text-slate-400" />
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {/* 구성원별 온라인 상태와 메시지 버튼을 반복 표시. */}
            {teamMembers.map((member) => (
              <div key={member.name} className="flex items-center gap-3">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                  {member.name.slice(0, 1)}
                  <span
                    className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                      member.online ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800">{member.name}</span>
                  <span className="block text-xs text-slate-500">{member.team}</span>
                </span>
                <button
                  type="button"
                  aria-label={`${member.name}에게 메시지 보내기`}
                  onClick={() => onFeatureClick("메신저")}
                  className="cursor-pointer rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <MessageCircleMore size={17} />
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-slate-900">빠른 작업</p>
            <Clock3 size={19} className="text-slate-400" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {["메시지 작성", "회의실 예약", "공지 작성"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onFeatureClick(label)}
                className="group flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {label}
                <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={21} />
            </span>
            <div>
              <p className="font-bold text-slate-900">오늘의 업무를 시작할 준비가 됐어요.</p>
              <p className="mt-1 text-sm text-slate-500">로그인·데이터 연동 전의 정적 데모 대시보드입니다.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
