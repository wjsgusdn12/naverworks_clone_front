"use client";

import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { FormEvent, useState, type RefObject } from "react";
import { Tooltip } from "@/components/common/tooltip";
import { LoadingInline } from "@/components/common/loading";
import { CustomCheckbox } from "@/components/common/custom-checkbox";
import { FcGoogle } from "react-icons/fc";
import { RiKakaoTalkFill } from "react-icons/ri";
import { SiNaver } from "react-icons/si";
import { ApiClientError, type LoginInput } from "@/lib/api/auth-api";

// 입력칸 아래에 보여 줄 오류 문구. 비어 있으면 정상.
type LoginFieldError = {
  email?: string;
  password?: string;
};

// 부모 화면이 로그인 결과와 안내 토스트를 처리하도록 콜백만 전달받음.
// emailInputRef는 헤더 등 바깥에서 이메일 칸으로 포커스를 보낼 때 사용.
type LoginFormProps = {
  onToast: (message: string) => void;
  onLogin: (input: LoginInput) => Promise<void>;
  emailInputRef?: RefObject<HTMLInputElement | null>;
};

// 실제 소셜 인증 전까지 사용하는 로그인 버튼 표시 정보.
const socialProviders = [
  {
    name: "NAVER",
    tooltip: "네이버 로그인",
    icon: SiNaver,
    iconSize: 20,
    className: "bg-[#03c75a] text-white",
  },
  {
    name: "KAKAO",
    tooltip: "카카오 로그인",
    icon: RiKakaoTalkFill,
    iconSize: 24,
    className: "bg-[#fee500] text-[#191919]",
  },
  { name: "Google", tooltip: "Google 로그인", icon: FcGoogle, iconSize: 24, className: "bg-white" },
];

// "@" 뒤에 보여 줄 자주 쓰는 이메일 도메인.
const emailDomains = ["naver.com", "gmail.com", "daum.net", "kakao.com", "outlook.com"];

const inputClassName = (invalid: boolean) =>
  `h-12 w-full rounded-lg border px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
    invalid
      ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-100"
      : "border-slate-300 focus:border-blue-600 focus:ring-blue-100"
  }`;

export function LoginForm({ onToast, onLogin, emailInputRef }: LoginFormProps) {
  // 입력창과 UI 상태는 로그인 화면 내부에서 관리.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 토스트와 함께 어느 입력값을 수정해야 하는지 칸 아래 문구로도 표시.
  const [fieldErrors, setFieldErrors] = useState<LoginFieldError>({});
  // 이메일은 아이디 · @ · 도메인으로 나눠 입력. 도메인은 드롭다운에서 고르거나 직접 침.
  const [emailDomain, setEmailDomain] = useState("");
  // 드롭다운에서 고른 값. "" 이면 직접 입력 상태.
  const [selectedDomain, setSelectedDomain] = useState("");
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  const clearEmailError = () => setFieldErrors((current) => ({ ...current, email: undefined }));

  const selectDomain = (domain: string) => {
    setSelectedDomain(domain);
    setEmailDomain(domain);
    clearEmailError();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // 폼 제출로 페이지가 새로고침되는 기본 동작을 막음.
    event.preventDefault();

    const normalizedEmail = `${email.trim()}@${emailDomain.trim()}`;
    const nextFieldErrors: LoginFieldError = {
      email: !email.trim()
        ? "이메일 아이디를 입력해 주세요."
        : !emailDomain.trim()
          ? "이메일 도메인을 입력하거나 선택해 주세요."
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
            ? "올바른 이메일 주소 형식이 아닙니다."
            : undefined,
      password: !password ? "비밀번호를 입력해 주세요." : undefined,
    };

    if (nextFieldErrors.email || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      onToast(
        nextFieldErrors.email && nextFieldErrors.password
          ? "이메일과 비밀번호를 확인해 주세요."
          : (nextFieldErrors.email ?? nextFieldErrors.password ?? ""),
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
        setFieldErrors({ email: " ", password: "이메일 또는 비밀번호가 올바르지 않습니다." });
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
        <div>
          <label htmlFor="login-email-id" className="mb-2 block text-sm font-medium text-slate-700">
            이메일
          </label>
          {/* 아이디 · @ · 도메인. 도메인은 오른쪽 드롭다운에서 고르면 채워지고, "직접 입력"이면 자유롭게 침. */}
          <div className="flex items-center gap-1.5">
            <input
              id="login-email-id"
              ref={emailInputRef}
              type="text"
              value={email}
              autoFocus
              onChange={(event) => {
                setEmail(event.target.value);
                clearEmailError();
              }}
              placeholder="아이디"
              autoComplete="username"
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.email) || undefined}
              className={`${inputClassName(Boolean(fieldErrors.email))} min-w-0 flex-[1.1]`}
            />
            <span className="shrink-0 text-sm font-semibold text-slate-400">@</span>
            <input
              type="text"
              value={emailDomain}
              onChange={(event) => {
                setEmailDomain(event.target.value);
                // 손으로 고치면 드롭다운은 직접 입력 상태로 돌아감.
                setSelectedDomain("");
                clearEmailError();
              }}
              placeholder="도메인"
              aria-label="이메일 도메인"
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.email) || undefined}
              className={`${inputClassName(Boolean(fieldErrors.email))} min-w-0 flex-1`}
            />
            <span className="relative shrink-0">
              <select
                value={selectedDomain}
                onChange={(event) => selectDomain(event.target.value)}
                aria-label="이메일 도메인 선택"
                disabled={isSubmitting}
                className="h-12 w-11 cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white text-transparent outline-none transition hover:border-blue-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">직접 입력</option>
                {emailDomains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-500"
              />
            </span>
          </div>
          {fieldErrors.email && fieldErrors.email.trim() && (
            <span className="mt-1.5 block text-xs text-red-600">{fieldErrors.email}</span>
          )}
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">비밀번호</span>
          <span className="relative block">
            <input
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              // 키를 누를 때마다 Caps Lock 상태를 읽어 경고를 갱신.
              onKeyDown={(event) => setIsCapsLockOn(event.getModifierState("CapsLock"))}
              onKeyUp={(event) => setIsCapsLockOn(event.getModifierState("CapsLock"))}
              onBlur={() => setIsCapsLockOn(false)}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.password) || undefined}
              className={`${inputClassName(Boolean(fieldErrors.password))} pr-12`}
            />
            <Tooltip
              label={isPasswordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
              className="absolute inset-y-0 right-0 w-12"
            >
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
          {fieldErrors.password ? (
            <span className="mt-1.5 block text-xs text-red-600">{fieldErrors.password}</span>
          ) : (
            isCapsLockOn && (
              <span className="mt-1.5 block text-xs text-amber-600">
                Caps Lock이 켜져 있습니다.
              </span>
            )
          )}
        </label>

        <CustomCheckbox
          label="로그인 상태 유지"
          text="로그인 상태 유지"
          checked={rememberMe}
          onChange={() => setRememberMe((isRemembered) => !isRemembered)}
          disabled={isSubmitting}
          className="-ml-1"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {isSubmitting ? (
            <LoadingInline message="로그인 중..." spinnerClassName="text-white" />
          ) : (
            "로그인"
          )}
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
    </section>
  );
}
