"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { SiGoogle, SiKakaotalk, SiNaver } from "react-icons/si";
import type { DemoLoginInput } from "@/lib/demo-auth";

// 부모 화면이 로그인 결과와 안내 토스트를 처리하도록 콜백만 전달받음.
type LoginFormProps = {
  onToast: (message: string) => void;
  onLogin: (input: DemoLoginInput) => void;
};

// 실제 소셜 인증 전까지 사용하는 로그인 버튼 표시 정보.
const socialProviders = [
  { name: "NAVER", icon: SiNaver, className: "bg-[#03c75a] text-white" },
  { name: "KAKAO", icon: SiKakaotalk, className: "bg-[#fee500] text-[#191919]" },
  { name: "Google", icon: SiGoogle, className: "bg-white text-[#4285f4]" },
];

export function LoginForm({ onToast, onLogin }: LoginFormProps) {
  // 입력창과 UI 상태는 로그인 화면 내부에서 관리.
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // 폼 제출로 페이지가 새로고침되는 기본 동작을 막음.
    event.preventDefault();

    if (!userId.trim() || !password) {
      onToast("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    // 실제 인증 판단은 부모 페이지의 데모 인증 로직에 위임.
    onLogin({ userId, password, rememberMe });
  };

  return (
    <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_36px_rgba(15,23,42,0.08)] sm:p-10">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-600">NAVER WORKS CLONE</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">로그인</h1>
        <p className="mt-2 text-sm text-slate-500">업무를 시작하려면 로그인해 주세요.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">아이디</span>
          <input
            type="text"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="아이디를 입력해 주세요"
            autoComplete="username"
            className="h-12 w-full rounded-lg border border-slate-300 px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">비밀번호</span>
          <span className="relative block">
            <input
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              className="h-12 w-full rounded-lg border border-slate-300 px-3.5 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
            <button
              type="button"
              aria-label={isPasswordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
              onClick={() => setIsPasswordVisible((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              {isPasswordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
          />
          로그인 상태 유지
        </label>

        <button
          type="submit"
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          로그인
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        또는
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {socialProviders.map(({ name, icon: Icon, className }) => (
          <button
            key={name}
            type="button"
            aria-label={`${name} 로그인`}
            title={`${name} 로그인`}
            onClick={() => onToast(`${name} 로그인은 준비 중입니다.`)}
            className={`flex h-10 cursor-pointer items-center justify-center rounded-lg border transition hover:-translate-y-0.5 hover:shadow-sm ${className} ${
              name === "Google" ? "border-slate-200" : "border-transparent"
            }`}
          >
            <Icon size={19} aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-slate-500">
        {["아이디 찾기", "비밀번호 찾기", "회원가입"].map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => onToast(`${label} 기능은 준비 중입니다.`)}
            className="cursor-pointer rounded-sm transition hover:text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-7 flex items-center justify-center gap-1 text-xs text-slate-400">
        <LoaderCircle size={13} aria-hidden="true" />
        인증 서버 연동 전 데모 화면입니다.
      </p>
    </section>
  );
}
