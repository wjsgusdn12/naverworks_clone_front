"use client";

import { Check, Copy, Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { CustomSelect } from "@/components/common/custom-select";
import { LoadingInline } from "@/components/common/loading";
import { loginInputClassName } from "@/components/login/login-form";
import { formatPhoneNumber } from "@/lib/phone-format";
import { authApi, type RecoverCredentials, type RecoverLookupResult } from "@/lib/api/auth-api";

// 계정 찾기. 찾는 방법을 하나 고름:
// - 본인 정보: 가입 때 넣은 이름·이메일·전화번호가 모두 맞으면 비밀번호를 새로 설정.
// - 복구 코드: 가입 때 받은 코드로 계정을 확인하고 비밀번호를 새로 설정.
type RecoverFormProps = {
  onToast: (message: string) => void;
  // 재설정 성공 시 부모가 새 복구 코드 안내를 처리.
  onReset: (nextRecoveryCode: string) => void;
  onBackToLogin: () => void;
};

type Method = "IDENTITY" | "RECOVERY_CODE";
// lookup: 정보 입력 → found: 찾은 아이디 확인 → password: 새 비밀번호 설정
type Step = "lookup" | "found" | "password";

const methodOptions: { value: Method; label: string; description: string }[] = [
  {
    value: "IDENTITY",
    label: "이름·이메일·전화번호",
    description: "가입할 때 이메일과 전화번호를 모두 입력한 계정만 찾을 수 있습니다.",
  },
  {
    value: "RECOVERY_CODE",
    label: "복구 코드",
    description: "가입할 때 받은 복구 코드로 계정을 확인합니다.",
  },
];

export function RecoverForm({ onToast, onReset, onBackToLogin }: RecoverFormProps) {
  const [method, setMethod] = useState<Method>("IDENTITY");
  const [step, setStep] = useState<Step>("lookup");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  // 1단계에서 확인한 정보. 2단계 재설정 때 서버가 한 번 더 대조.
  const [credentials, setCredentials] = useState<RecoverCredentials | null>(null);
  const [account, setAccount] = useState<RecoverLookupResult | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 찾은 아이디 복사 완료 표시(잠깐 체크 아이콘).
  const [copied, setCopied] = useState(false);

  const copyLoginId = async (loginId: string) => {
    try {
      await navigator.clipboard.writeText(loginId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      onToast("아이디를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  };

  const selectedMethod =
    methodOptions.find((option) => option.value === method) ?? methodOptions[0];

  const lookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let input: RecoverCredentials;
    if (method === "IDENTITY") {
      if (!displayName.trim() || !email.trim() || !phoneNumber.trim()) {
        setError("이름·이메일·전화번호를 모두 입력해 주세요.");
        return;
      }
      input = {
        displayName: displayName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
      };
    } else {
      const code = recoveryCode.trim().toUpperCase();
      if (!code) {
        setError("복구 코드를 입력해 주세요.");
        return;
      }
      input = { recoveryCode: code };
    }
    setIsSubmitting(true);
    setError(null);
    try {
      setAccount(await authApi.recoverLookup(input));
      setCredentials(input);
      setStep("found");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "계정을 확인하지 못했습니다.";
      setError(message);
      onToast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!credentials) return;
    if (newPassword.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== passwordConfirm) {
      setError("비밀번호가 서로 다릅니다.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      onReset((await authApi.recoverReset(credentials, newPassword)).recoveryCode);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "비밀번호를 변경하지 못했습니다.";
      setError(message);
      onToast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 입력칸 하나. 값이 바뀌면 오류 문구를 지움.
  const field = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { placeholder: string; type?: string; autoComplete: string; autoFocus?: boolean },
  ) => (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={options.type ?? "text"}
        value={value}
        autoFocus={options.autoFocus}
        onChange={(event) => {
          onChange(event.target.value);
          setError(null);
        }}
        placeholder={options.placeholder}
        autoComplete={options.autoComplete}
        disabled={isSubmitting}
        aria-invalid={Boolean(error) || undefined}
        className={loginInputClassName(Boolean(error))}
      />
    </label>
  );

  return (
    <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_36px_rgba(15,23,42,0.08)] sm:p-10">
      <div className="mb-7 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-600">NAVER WORKS CLONE</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          아이디·비밀번호 찾기
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {step === "lookup"
            ? "계정을 찾을 방법을 고르고 입력해 주세요."
            : step === "found"
              ? "가입한 아이디를 찾았습니다."
              : "확인된 계정의 새 비밀번호를 설정해 주세요."}
        </p>
      </div>

      {step === "lookup" && (
        <form className="space-y-4" noValidate onSubmit={lookup}>
          <div className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">찾을 방법</span>
            <CustomSelect
              label="찾을 방법"
              value={method}
              onChange={(value) => {
                setMethod(value as Method);
                setError(null);
              }}
              options={methodOptions.map(({ value, label }) => ({ value, label }))}
              disabled={isSubmitting}
            />
            <span className="mt-1.5 block text-xs text-slate-500">
              {selectedMethod.description}
            </span>
          </div>

          {method === "IDENTITY" ? (
            <>
              {field("이름", displayName, setDisplayName, {
                placeholder: "가입할 때 입력한 이름",
                autoComplete: "name",
                autoFocus: true,
              })}
              {field("이메일", email, setEmail, {
                placeholder: "name@example.com",
                type: "email",
                autoComplete: "email",
              })}
              {field("전화번호", phoneNumber, (value) => setPhoneNumber(formatPhoneNumber(value)), {
                placeholder: "010-0000-0000",
                type: "tel",
                autoComplete: "tel",
              })}
              {error && <span className="block text-xs text-red-600">{error}</span>}
            </>
          ) : (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">복구 코드</span>
              <span className="relative block">
                <KeyRound
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  key="recoveryCode"
                  type="text"
                  value={recoveryCode}
                  autoFocus
                  onChange={(event) => {
                    setRecoveryCode(event.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(error) || undefined}
                  className={`${loginInputClassName(Boolean(error))} pl-11 font-mono tracking-widest`}
                />
              </span>
              {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
            </label>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting ? (
              <LoadingInline message="확인 중..." spinnerClassName="text-white" />
            ) : (
              "계정 확인"
            )}
          </button>
        </form>
      )}

      {step !== "lookup" && account && (
        // 찾은 계정. 일반 아이디는 전체, 이메일 형식 아이디는 가려서 옴.
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
            <UserRound size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm text-slate-900">{account.displayName}</b>
            <span className="block truncate font-mono text-sm text-slate-700">
              {account.loginId}
            </span>
          </span>
          {/* 가린 아이디는 복사해도 쓸모가 없어 일반 아이디일 때만 복사 버튼을 둠. */}
          {!account.loginId.includes("*") && (
            <button
              type="button"
              aria-label="아이디 복사"
              onClick={() => void copyLoginId(account.loginId)}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-slate-700"
            >
              {copied ? (
                <Check size={15} aria-hidden="true" className="text-emerald-600" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      )}

      {step === "found" && (
        // 아이디만 잊었다면 바로 로그인, 비밀번호도 잊었다면 재설정으로.
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onBackToLogin}
            className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-600"
          >
            로그인하러 가기
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep("password");
            }}
            className="flex h-12 cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
          >
            비밀번호 재설정
          </button>
        </div>
      )}

      {step === "password" && (
        <form className="space-y-4" noValidate onSubmit={reset}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">새 비밀번호</span>
            <span className="relative block">
              <input
                type={isPasswordVisible ? "text" : "password"}
                value={newPassword}
                autoFocus
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError(null);
                }}
                placeholder="8자 이상"
                autoComplete="new-password"
                disabled={isSubmitting}
                className={`${loginInputClassName(Boolean(error))} pr-12`}
              />
              <button
                type="button"
                aria-label={isPasswordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-slate-500 transition hover:text-blue-600"
              >
                {isPasswordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">새 비밀번호 확인</span>
            <input
              type={isPasswordVisible ? "text" : "password"}
              value={passwordConfirm}
              onChange={(event) => {
                setPasswordConfirm(event.target.value);
                setError(null);
              }}
              placeholder="한 번 더 입력"
              autoComplete="new-password"
              disabled={isSubmitting}
              className={loginInputClassName(Boolean(error))}
            />
            {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting ? (
              <LoadingInline message="변경 중..." spinnerClassName="text-white" />
            ) : (
              "비밀번호 변경"
            )}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        <button
          type="button"
          onClick={onBackToLogin}
          className="cursor-pointer font-semibold text-blue-600 hover:underline"
        >
          로그인으로 돌아가기
        </button>
      </p>
    </section>
  );
}
