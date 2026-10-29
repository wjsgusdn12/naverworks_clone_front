import type { SelectOption } from "@/components/common/custom-select";
import type { SignupJoinType, SignupOption, SignupOptions } from "@/lib/api/auth-api";

// 가입·회사 옮기기에서 함께 쓰는 소속 선택지와 부서·직급 기본값 규칙.

// 새 회사를 만든 사람만 가질 수 있는 직급. 드롭다운에서는 보여 주지 않음.
export const OWNER_GRADE_NAME = "대표";
// 직급을 따로 고르지 않았을 때의 기본값.
export const DEFAULT_GRADE_NAME = "사원";

export type JoinTypeChoice = { key: SignupJoinType; label: string; description: string };

// 소속 선택지를 드롭다운 항목으로.
export const toJoinTypeOptions = (choices: JoinTypeChoice[]): SelectOption[] =>
  choices.map((choice) => ({ value: choice.key, label: choice.label }));

// 서버의 {id, name} 목록을 드롭다운 항목으로. "미지정" 없이 항상 하나가 선택됨.
export const toSelectOptions = (items: SignupOption[]): SelectOption[] =>
  items
    .filter((item) => item.name !== OWNER_GRADE_NAME)
    .map((item) => ({ value: String(item.id), label: item.name }));

// 부서 기본값: 목록의 첫 부서.
export const defaultDepartmentId = (options: SignupOptions) =>
  options.departments[0] ? String(options.departments[0].id) : "";

// 직급 기본값: "사원"이 있으면 그것, 없으면 대표를 뺀 첫 직급.
export const defaultJobGradeId = (options: SignupOptions) => {
  const grades = options.jobGrades.filter((grade) => grade.name !== OWNER_GRADE_NAME);
  const employee = grades.find((grade) => grade.name === DEFAULT_GRADE_NAME) ?? grades[0];
  return employee ? String(employee.id) : "";
};

// 옵션을 못 불러왔을 때 쓰는 빈 값.
export const fallbackSignupOptions: SignupOptions = {
  demoCompanyName: "체험 회사",
  departments: [],
  jobGrades: [],
};
