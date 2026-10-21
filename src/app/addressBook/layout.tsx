import "./address-book.css";
import type { ReactNode } from "react";

// 주소록과 하위 검색 결과 화면에만 목록 행 스타일을 적용.
export default function AddressBookLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
