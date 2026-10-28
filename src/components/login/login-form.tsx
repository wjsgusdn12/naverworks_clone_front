"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { Tooltip } from "@/components/common/tooltip";
import { FcGoogle } from "react-icons/fc";
import { RiKakaoTalkFill } from "react-icons/ri";
import { SiNaver } from "react-icons/si";
import { ApiClientError, type LoginInput } from "@/lib/api/auth-api";

type LoginFieldError = {
  email?: boolean;
  password?: boolean;
};

// 부모 화면이 로그인 결과와 안내 토스트를 처리하도록 콜백만 전달받음.
type LoginFormProps = {
  onToast: (message: string) => void;
  onLogin: (input: LoginInput) => Promise<void>;
};

// 실제 소셜 인증 전까지 사용하는 로그인 버튼 표시 정보.
const socialProviders = [
  { name: "NAVER", tooltip: "네이버 로그인", icon: SiNaver, iconSize: 20, className: "bg-[#03c75a] text-white" },
  { name: "KAKAO", tooltip: "카카오 로그인", icon: RiKakaoTalkFill, iconSize: 24, className: "bg-[#fee500] text-[#191919]" },
  { name: "Google", tooltip: "Google 로그인", icon: FcGoogle, iconSize: 24, className: "bg-white" },
];

export function LoginForm({ onToast, onLogin }: LoginFormProps) {
  // 입력창과 UI 상태는 로그인 화면 내부에서 관리.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 토스트와 함께 어느 입력값을 수정해야 하는지 시각적으로 표시.
  const [fieldErrors, setFieldErrors] = useState<LoginFieldError>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // 폼 제출로 페이지가 새로고침되는 기본 동작을 막음.
    event.preventDefault();

    const normalizedEmail = email.trim();
    const nextFieldErrors: LoginFieldError = {
      email: !normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail),
      password: !password,
    };

    if (nextFieldErrors.email || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      onToast(
        nextFieldErrors.email && nextFieldErrors.password
          ? "이메일과 비밀번호를 확인해 주세요."
          : nextFieldErrors.email
            ? "올바른 이메일 주소를 입력해 주세요."
            : "비밀번호를 입력해 주세요.",
      );
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      // API 요청과 성공 후 화면 이동은 부모 페이지가 담당.
      await onLogin({ email: normalizedEmail, password, rememberMe });
    } catch (error) {
      // 인증 실패는 어느 값이 틀렸는지 노출하지 않고 두 입력칸을 함께 표시.
      if (error instanceof ApiClientError && error.code === "AUTHENTICATION_FAILED") {
        setFieldErrors({ email: true, password: true });
      }
    } finally {
      // 성공 시에는 페이지가 이동하고, 실패 시에는 버튼을 다시 활성화.
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_36px_rgba(15,23,42,0.08)] sm:p-10">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-600">NAVER WORKS CLONE</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">로그인</h1>
        <p className="mt-2 text-sm text-slate-500">업무를 시작하려면 로그인해 주세요.</p>
      </div>

      {/* noValidate로 브라우저 기본 팝업을 끄고 프로젝트 토스트 UX만 사용. */}
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((currentErrors) => ({ ...currentErrors, email: false }));
            }}
            placeholder="이메일을 입력해 주세요"
            autoComplete="email"
            disabled={isSubmitting}
            aria-invalid={fieldErrors.email || undefined}
            className={`h-12 w-full rounded-lg border px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
              fieldErrors.email
                ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-100"
                : "border-slate-300 focus:border-blue-600 focus:ring-blue-100"
            }`}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">비밀번호</span>
          <span className="relative block">
            <input
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((currentErrors) => ({ ...currentErrors, password: false }));
              }}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              disabled={isSubmitting}
              aria-invalid={fieldErrors.password || undefined}
              className={`h-12 w-full rounded-lg border px-3.5 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                fieldErrors.password
                  ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-100"
                  : "border-slate-300 focus:border-blue-600 focus:ring-blue-100"
              }`}
            />
            <Tooltip label={isPasswordVisible ? "비밀번호 숨기기" : "비밀번호 보기"} className="absolute inset-y-0 right-0 w-12">
              <button
                type="button"
                aria-label={isPasswordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                disabled={isSubmitting}
                className="flex h-full w-full cursor-pointer items-center justify-center text-slate-500 transition hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
              >
                {isPasswordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </Tooltip>
          </span>
        </label>

        <button
          type="button"
          role="checkbox"
          aria-checked={rememberMe}
          onClick={() => setRememberMe((isRemembered) => !isRemembered)}
          disabled={isSubmitting}
          className="custom-checkbox-button group flex cursor-pointer items-center gap-2 rounded-md pt-1 text-sm text-slate-600"
        >
          <span
            aria-hidden="true"
            className={`custom-checkbox-control flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-white group-hover:border-blue-400 ${
              rememberMe ? "border-blue-600 bg-blue-600 scale-105" : "border-slate-300 bg-white"
            }`}
          >
            {rememberMe && (
              <span
                aria-hidden="true"
                className="checkbox-check-mark"
                style={{ color: "#ffffff", fontSize: "15px", fontWeight: 800, lineHeight: 1 }}
              >
                ✓
              </span>
            )}
          </span>
          로그인 상태 유지
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        또는
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {socialProviders.map(({ name, tooltip, icon: Icon, iconSize, className }) => (
          // 브라우저 기본 title 대신 프로젝트 공통 툴팁으로 안내.
          <Tooltip key={name} label={tooltip} className="w-full">
            <button
              type="button"
              aria-label={tooltip}
              onClick={() => onToast(`${name} 로그인은 준비 중입니다.`)}
              className={`flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border transition hover:-translate-y-0.5 hover:shadow-sm ${className} ${
                name === "Google" ? "border-slate-200" : "border-transparent"
              }`}
            >
              <Icon size={iconSize} aria-hidden="true" />
            </button>
          </Tooltip>
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
        이메일 계정으로 로그인해 주세요.
      </p>
    </section>
  );
}
