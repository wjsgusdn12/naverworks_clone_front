"use client";

import { Building2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { CustomSelect } from "@/components/common/custom-select";
import { LoadingInline } from "@/components/common/loading";
import { loginInputClassName } from "@/components/login/login-form";
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
  type AuthTokenResponse,
  type SignupJoinType,
  type SignupOptions,
} from "@/lib/api/auth-api";

// 회사 옮기기·회사 만들기 대화상자. 가입의 소속 선택과 같은 세 갈래.
// 옮기면 이전 회사의 채팅방·즐겨찾기·주소록 그룹에서 모두 빠지므로 경고를 함께 보여 줌.
type CompanyMoveDialogProps = {
  accessToken: string;
  currentCompanyName: string;
  // 처음 열릴 때 고를 방식. 주소록 "회사 만들기"는 NEW_COMPANY로 엶.
  initialJoinType?: SignupJoinType;
  onMoved: (session: AuthTokenResponse) => void;
  onToast: (message: string) => void;
  onClose: () => void;
};

const joinTypes: JoinTypeChoice[] = [
  {
    key: "NEW_COMPANY",
    label: "새 회사 만들기",
    description: "내가 대표가 되고 초대 코드로 사람을 모읍니다.",
  },
  {
    key: "INVITE",
    label: "초대 코드로 참여",
    description: "관리자에게 받은 초대 코드로 들어갑니다.",
  },
  {
    key: "DEMO",
    label: "체험 회사로 돌아가기",
    description: "구성원과 그룹방이 있는 체험 회사에 합류합니다.",
  },
];

export function CompanyMoveDialog({
  accessToken,
  currentCompanyName,
  initialJoinType = "NEW_COMPANY",
  onMoved,
  onToast,
  onClose,
}: CompanyMoveDialogProps) {
  const [joinType, setJoinType] = useState<SignupJoinType>(initialJoinType);
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [jobGradeId, setJobGradeId] = useState("");
  const [options, setOptions] = useState<SignupOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 체험 회사 선택지용 부서·직급. 불러오면 첫 부서·사원을 기본으로 골라 둠. 실패해도 서버가 기본값을 넣어 진행 가능.
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (joinType === "NEW_COMPANY" && !companyName.trim()) {
      setError("회사 이름을 입력해 주세요.");
      return;
    }
    if (joinType === "INVITE" && !inviteCode.trim()) {
      setError("초대 코드를 입력해 주세요.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      onMoved(
        await authApi.moveCompany(accessToken, {
          joinType,
          companyName: joinType === "NEW_COMPANY" ? companyName.trim() : undefined,
          inviteCode: joinType === "INVITE" ? inviteCode.trim().toUpperCase() : undefined,
          departmentId: joinType === "DEMO" && departmentId ? Number(departmentId) : undefined,
          jobGradeId: joinType === "DEMO" && jobGradeId ? Number(jobGradeId) : undefined,
        }),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "회사를 옮기지 못했습니다.";
      setError(message);
      onToast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="company-move-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        noValidate
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Building2 size={18} aria-hidden="true" />
            </span>
            <h2 id="company-move-title" className="text-lg font-bold text-slate-900">
              회사 옮기기
            </h2>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          지금 소속인 <b>{currentCompanyName}</b>의 채팅방·즐겨찾기·주소록 그룹에서 모두 빠집니다.
          방장인 그룹방은 다른 구성원에게 넘어갑니다. 되돌릴 수 없습니다.
        </p>

        <div className="mt-4">
          <span className="mb-2 block text-sm font-medium text-slate-700">옮길 방법</span>
          <CustomSelect
            label="옮길 방법"
            value={joinType}
            onChange={(value) => {
              setJoinType(value as SignupJoinType);
              setError(null);
            }}
            options={toJoinTypeOptions(joinTypes)}
            disabled={isSubmitting}
          />
          <span className="mt-1.5 block text-xs text-slate-500">
            {selectedJoinType.description}
            {joinType === "DEMO" && options && ` (${options.demoCompanyName})`}
          </span>
        </div>

        <div className="mt-4">
          {joinType === "NEW_COMPANY" && (
            <input
              type="text"
              value={companyName}
              autoFocus
              onChange={(event) => {
                setCompanyName(event.target.value);
                setError(null);
              }}
              placeholder="회사 이름"
              disabled={isSubmitting}
              aria-label="회사 이름"
              className={loginInputClassName(Boolean(error))}
            />
          )}
          {joinType === "INVITE" && (
            <input
              type="text"
              value={inviteCode}
              autoFocus
              onChange={(event) => {
                setInviteCode(event.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="XXXX-XXXX"
              disabled={isSubmitting}
              aria-label="초대 코드"
              className={`${loginInputClassName(Boolean(error))} font-mono tracking-widest`}
            />
          )}
          {joinType === "DEMO" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <CustomSelect
                label="부서"
                value={departmentId}
                onChange={setDepartmentId}
                options={toSelectOptions(options?.departments ?? [])}
                placeholder="부서 불러오는 중..."
                disabled={isSubmitting || options === null}
              />
              <CustomSelect
                label="직급"
                value={jobGradeId}
                onChange={setJobGradeId}
                options={toSelectOptions(options?.jobGrades ?? [])}
                placeholder="직급 불러오는 중..."
                disabled={isSubmitting || options === null}
              />
            </div>
          )}
          {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-11 flex-1 cursor-pointer rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting ? (
              <LoadingInline message="옮기는 중..." spinnerClassName="text-white" />
            ) : (
              "옮기기"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
