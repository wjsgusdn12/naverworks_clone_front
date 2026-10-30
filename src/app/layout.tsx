import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ChatNotificationProvider } from "@/components/chat/chat-notification-provider";
import { RouteStateBoundary } from "@/components/common/route-state-boundary";
import { RequestProgressBar } from "@/components/common/request-progress-bar";
import { Geist } from "next/font/google";
import "./globals.css";

// 기본 영문 폰트 변수를 만들고, 실제 화면 글꼴은 globals.css의 Pretendard가 우선 적용됨.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// 브라우저 탭과 검색 엔진에 제공할 기본 페이지 정보.
export const metadata: Metadata = {
  title: "Naver Works Clone",
  description: "Naver Works Clone frontend",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 모든 페이지가 공통으로 사용하는 HTML 언어·높이·글꼴 설정.
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* 서버 요청이 진행 중이면 화면 맨 위에 진행 막대. 모든 화면 공통. */}
        <RequestProgressBar />
        {/* 모든 화면이 동일한 메모리 인증 상태를 공유. */}
        <AuthProvider>
          <ChatNotificationProvider>
            <RouteStateBoundary>{children}</RouteStateBoundary>
          </ChatNotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
