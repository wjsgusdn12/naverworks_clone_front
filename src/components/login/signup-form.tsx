"use client";

import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { CustomSelect } from "@/components/common/custom-select";
import { LoadingInline } from "@/components/common/loading";
import { loginInputClassName } from "@/components/login/login-form";
import { formatPhoneNumber } from "@/lib/phone-format";
import {
  defaultDepartmentId,
  defaultJobGradeId,
  fallbackSignupOptions,
  toJoinTypeOptions,
  toSelectOptions,
  type JoinTypeChoice,
} from "@/lib/signup-options";
import {
  authApi,
  type SignupInput,
  type SignupJoinType,
  type SignupOptions,
  type SignupResult,
} from "@/lib/api/auth-api";

// 칸별 오류 문구.
type SignupFieldError = Partial<
  Record<
    | "loginId"
    | "password"
    | "passwordConfirm"
    | "displayName"
    | "email"
    | "companyName"
    | "inviteCode",
    string
  >
>;

type SignupFormProps = {
  onToast: (message: string) => void;
  // 가입 성공 시 부모가 세션 적용과 복구 코드 안내를 처리.
  onSignedUp: (result: SignupResult) => void;
  onBackToLogin: () => void;
};

// 소속 선택지. 기본은 체험 회사 참여.
const joinTypes: JoinTypeChoice[] = [
  {
    key: "DEMO",
    label: "체험 회사 참여",
    description: "구성원과 그룹방이 이미 있어 바로 써 볼 수 있어요.",
  },
  {
    key: "NEW_COMPANY",
    label: "새 회사 만들기",
    description: "내가 대표가 되고 초대 코드로 사람을 모읍니다.",
  },
  {
    key: "INVITE",
    label: "초대 코드로 참여",
    description: "관리자에게 받은 초대 코드를 입력합니다.",
  },
];

const LOGIN_ID_PATTERN = /^[a-z0-9._-]{4,30}$/;

export function SignupForm({ onToast, onSignedUp, onBackToLogin }: SignupFormProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [joinType, setJoinType] = useState<SignupJoinType>("DEMO");
  const [departmentId, setDepartmentId] = useState("");
  const [jobGradeId, setJobGradeId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [options, setOptions] = useState<SignupOptions | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldError>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 체험 회사의 부서·직급 목록. 불러오면 첫 부서·사원을 기본으로 골라 둠. 실패해도 가입 자체는 가능(서버가 기본값을 넣음).
  useEffect(() => {
    let cancelled = false;
    authApi
      .signupOptions()
      .then((result) => {
        if (cancelled) return;
        setOptions(result);
        setDepartmentId(defaultDepartmentId(result));
        setJobGradeId(defaultJobGradeId(result));
      })
      .catch(() => {
        if (!cancelled) setOptions(fallbackSignupOptions);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedJoinType = joinTypes.find((type) => type.key === joinType) ?? joinTypes[0];

  const clearError = (key: keyof SignupFieldError) =>
    setFieldErrors((current) => ({ ...current, [key]: undefined }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedLoginId = loginId.trim().toLowerCase();
    const normalizedEmail = email.trim();
    const errors: SignupFieldError = {
      loginId: !normalizedLoginId
        ? "아이디를 입력해 주세요."
        : !LOGIN_ID_PATTERN.test(normalizedLoginId)
          ? "영문 소문자·숫자·. _ - 조합 4~30자로 입력해 주세요."
          : undefined,
      password: password.length < 8 ? "비밀번호는 8자 이상이어야 합니다." : undefined,
      passwordConfirm: password !== passwordConfirm ? "비밀번호가 서로 다릅니다." : undefined,
      displayName: !displayName.trim() ? "이름을 입력해 주세요." : undefined,
      email:
        normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
          ? "올바른 이메일 주소 형식이 아닙니다."
          : // 화면에서는 앞 일부만 보이고 나머지를 가리므로 @ 앞은 4자 이상.
            normalizedEmail && normalizedEmail.indexOf("@") < 4
            ? "이메일은 @ 앞부분이 4자 이상이어야 합니다."
            : undefined,
      companyName:
        joinType === "NEW_COMPANY" && !companyName.trim()
          ? "회사 이름을 입력해 주세요."
          : undefined,
      inviteCode:
        joinType === "INVITE" && !inviteCode.trim() ? "초대 코드를 입력해 주세요." : undefined,
    };
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      onToast("입력 내용을 확인해 주세요.");
      return;
    }

    const input: SignupInput = {
      loginId: normalizedLoginId,
      password,
      displayName: displayName.trim(),
      email: normalizedEmail || undefined,
      phoneNumber: phoneNumber.trim() || undefined,
      joinType,
      departmentId: joinType === "DEMO" && departmentId ? Number(departmentId) : undefined,
      jobGradeId: joinType === "DEMO" && jobGradeId ? Number(jobGradeId) : undefined,
      companyName: joinType === "NEW_COMPANY" ? companyName.trim() : undefined,
      inviteCode: joinType === "INVITE" ? inviteCode.trim().toUpperCase() : undefined,
    };

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      onSignedUp(await authApi.signup(input));
    } catch (error) {
      const message = error instanceof Error ? error.message : "가입을 처리하지 못했습니다.";
      // 서버가 알려 준 중복·코드 오류는 해당 칸 아래에도 표시.
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code === "AUTH_LOGIN_ID_TAKEN") setFieldErrors({ loginId: message });
      else if (code === "AUTH_EMAIL_TAKEN" || code === "AUTH_EMAIL_TOO_SHORT")
        setFieldErrors({ email: message });
      else if (code === "AUTH_COMPANY_NAME_TAKEN" || code === "AUTH_COMPANY_NAME_REQUIRED")
        setFieldErrors({ companyName: message });
      else if (code === "AUTH_INVITE_CODE_INVALID") setFieldErrors({ inviteCode: message });
      onToast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_36px_rgba(15,23,42,0.08)] sm:p-10">
      <div className="mb-7 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-600">NAVER WORKS CLONE</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">회원가입</h1>
        <p className="mt-2 text-sm text-slate-500">이메일 없이 아이디만으로 가입할 수 있습니다.</p>
      </div>

      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <Field label="아이디" error={fieldErrors.loginId}>
          <input
            type="text"
            value={loginId}
            autoFocus
            onChange={(event) => {
              setLoginId(event.target.value);
              clearError("loginId");
            }}
            placeholder="영문 소문자·숫자 4~30자"
            autoComplete="username"
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.loginId) || undefined}
            className={loginInputClassName(Boolean(fieldErrors.loginId))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="비밀번호" error={fieldErrors.password}>
            <span className="relative block">
              <input
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError("password");
                  clearError("passwordConfirm");
                }}
                placeholder="8자 이상"
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.password) || undefined}
                className={`${loginInputClassName(Boolean(fieldErrors.password))} pr-12`}
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
          </Field>
          <Field label="비밀번호 확인" error={fieldErrors.passwordConfirm}>
            <input
              type={isPasswordVisible ? "text" : "password"}
              value={passwordConfirm}
              onChange={(event) => {
                setPasswordConfirm(event.target.value);
                clearError("passwordConfirm");
              }}
              placeholder="한 번 더 입력"
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.passwordConfirm) || undefined}
              className={loginInputClassName(Boolean(fieldErrors.passwordConfirm))}
            />
          </Field>
        </div>

        <Field label="이름" error={fieldErrors.displayName}>
          <input
            type="text"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              clearError("displayName");
            }}
            placeholder="주소록과 대화에 보이는 이름"
            autoComplete="name"
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.displayName) || undefined}
            className={loginInputClassName(Boolean(fieldErrors.displayName))}
          />
        </Field>

        {/* 소속 선택. 고른 방식의 설명을 아래에 보여 줌. */}
        <div className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">소속</span>
          <CustomSelect
            label="소속"
            value={joinType}
            onChange={(value) => setJoinType(value as SignupJoinType)}
            options={toJoinTypeOptions(joinTypes)}
            disabled={isSubmitting}
          />
          <span className="mt-1.5 block text-xs text-slate-500">
            {selectedJoinType.description}
            {joinType === "DEMO" && options && ` (${options.demoCompanyName})`}
          </span>
        </div>

        {joinType === "DEMO" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="부서">
              <CustomSelect
                label="부서"
                value={departmentId}
                onChange={setDepartmentId}
                placeholder="불러오는 중..."
                options={toSelectOptions(options?.departments ?? [])}
                disabled={isSubmitting || options === null}
              />
            </Field>
            <Field label="직급">
              <CustomSelect
                label="직급"
                value={jobGradeId}
                onChange={setJobGradeId}
                placeholder="불러오는 중..."
                options={toSelectOptions(options?.jobGrades ?? [])}
                disabled={isSubmitting || options === null}
              />
            </Field>
          </div>
        )}
        {joinType === "NEW_COMPANY" && (
          <Field label="회사 이름" error={fieldErrors.companyName}>
            <input
              type="text"
              value={companyName}
              onChange={(event) => {
                setCompanyName(event.target.value);
                clearError("companyName");
              }}
              placeholder="예: 우리 스타트업"
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.companyName) || undefined}
              className={loginInputClassName(Boolean(fieldErrors.companyName))}
            />
          </Field>
        )}
        {joinType === "INVITE" && (
          <Field label="초대 코드" error={fieldErrors.inviteCode}>
            <input
              type="text"
              value={inviteCode}
              onChange={(event) => {
                setInviteCode(event.target.value.toUpperCase());
                clearError("inviteCode");
              }}
              placeholder="XXXX-XXXX"
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.inviteCode) || undefined}
              className={`${loginInputClassName(Boolean(fieldErrors.inviteCode))} font-mono tracking-widest`}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="이메일 (선택)" error={fieldErrors.email}>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError("email");
              }}
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.email) || undefined}
              className={loginInputClassName(Boolean(fieldErrors.email))}
            />
          </Field>
          <Field label="전화번호 (선택)">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(formatPhoneNumber(event.target.value))}
              placeholder="010-0000-0000"
              inputMode="numeric"
              autoComplete="tel"
              disabled={isSubmitting}
              className={loginInputClassName(false)}
            />
          </Field>
        </div>
        {/* 이메일·전화번호 쓰임새와 화면 표시 방식 안내. 예시는 가짜 값. */}
        <div className="rounded-lg bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-500">
          <p>
            이메일과 전화번호는 <b className="font-semibold text-slate-700">아이디·비밀번호 찾기</b>
            에 쓰입니다. 둘 다 입력해야 이름·이메일·전화번호로 아이디와 비밀번호를 찾을 수 있고,
            하나라도 비우면 복구 코드로만 찾을 수 있습니다.
          </p>
          <p className="mt-1.5">
            프로젝트 안에서는 가려서 표시됩니다. 이메일은 @ 앞 4자 이상이어야 합니다. 예)
            user11@example.com → us****@example.com · 010-1234-5678 → 010-12**-56**
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-wait disabled:opacity-70"
        >
          {isSubmitting ? (
            <LoadingInline message="가입 중..." spinnerClassName="text-white" />
          ) : (
            "가입하고 시작하기"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        이미 계정이 있으신가요?{" "}
        <button
          type="button"
          onClick={onBackToLogin}
          className="cursor-pointer font-semibold text-blue-600 hover:underline"
        >
          로그인
        </button>
      </p>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
