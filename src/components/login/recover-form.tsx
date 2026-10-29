"use client";

import { Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { LoadingInline } from "@/components/common/loading";
import { loginInputClassName } from "@/components/login/login-form";
import { authApi } from "@/lib/api/auth-api";

// 계정 찾기: 복구 코드 → 아이디 확인 → 새 비밀번호. 메일·전화 없이 복구 코드만으로 진행.
type RecoverFormProps = {
  onToast: (message: string) => void;
  // 재설정 성공 시 부모가 새 복구 코드 안내를 처리.
  onReset: (nextRecoveryCode: string) => void;
  onBackToLogin: () => void;
};

type Step = "code" | "password";

export function RecoverForm({ onToast, onReset, onBackToLogin }: RecoverFormProps) {
  const [step, setStep] = useState<Step>("code");
  // 아이디 또는 이메일. 복구 코드와 함께 맞아야 계정이 확인됨.
  const [loginId, setLoginId] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [account, setAccount] = useState<{ maskedLoginId: string; displayName: string } | null>(
    null,
  );
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = recoveryCode.trim().toUpperCase();
    if (!loginId.trim()) {
      setError("아이디 또는 이메일을 입력해 주세요.");
      return;
    }
    if (!code) {
      setError("복구 코드를 입력해 주세요.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      setAccount(await authApi.recoverLookup(loginId.trim(), code));
      setRecoveryCode(code);
      setStep("password");
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
      onReset((await authApi.recoverReset(loginId.trim(), recoveryCode, newPassword)).recoveryCode);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "비밀번호를 변경하지 못했습니다.";
      setError(message);
      onToast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_36px_rgba(15,23,42,0.08)] sm:p-10">
      <div className="mb-7 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-600">NAVER WORKS CLONE</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">계정 찾기</h1>
        <p className="mt-2 text-sm text-slate-500">
          {step === "code"
            ? "아이디와 가입할 때 받은 복구 코드를 입력해 주세요."
            : "확인된 계정의 새 비밀번호를 설정해 주세요."}
        </p>
      </div>

      {step === "code" ? (
        <form className="space-y-4" noValidate onSubmit={lookup}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              아이디 또는 이메일
            </span>
            <input
              type="text"
              value={loginId}
              autoFocus
              onChange={(event) => {
                setLoginId(event.target.value);
                setError(null);
              }}
              placeholder="아이디 또는 이메일"
              autoComplete="username"
              disabled={isSubmitting}
              className={loginInputClassName(Boolean(error))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">복구 코드</span>
            <span className="relative block">
              <KeyRound
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={recoveryCode}
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
          <p className="text-xs text-slate-500">
            복구 코드를 잃어버렸다면 되찾을 방법이 없습니다. 체험 계정은 새로 가입해 주세요.
          </p>
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
      ) : (
        <form className="space-y-4" noValidate onSubmit={reset}>
          {/* 확인된 계정. 아이디는 일부만 보여 줌. */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
              <UserRound size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <b className="block truncate text-sm text-slate-900">{account?.displayName}</b>
              <span className="block font-mono text-xs text-slate-500">
                {account?.maskedLoginId}
              </span>
            </span>
          </div>
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
