<div align="center">

# NaverWorks Clone · Frontend

### 오늘의 업무를 한 화면에, 팀의 대화를 끊김 없이

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![STOMP](https://img.shields.io/badge/STOMP.js-WebSocket-010101?style=for-the-badge)

`Frontend Repository` · `Personal Portfolio Project` · [Backend Repository →](https://github.com/wjsgusdn12/naverworks_clone_api)

</div>

> 네이버웍스의 협업 경험을 참고해 설계한 개인 프로젝트입니다. 특정 서비스의 디자인을 그대로 복제하지 않습니다.
> 이 문서는 프론트의 **전체 설계**를 그림으로 보여 줍니다. 서버 설계는 [백엔드 README](https://github.com/wjsgusdn12/naverworks_clone_api#readme)에 있습니다.

---

## 1. 화면 지도

로그인 뒤 Today 홈이 시작점입니다. 홈에서 메신저·주소록·일정으로 갈라지고, 관리자는 같은 자리에서 활동 대시보드를 봅니다.

<!-- diagram: screen-map -->
```mermaid
flowchart LR
    Login["/ 로그인"] --> Home["/home Today"]
    Home --> Message["/message 메신저<br/>방 목록 · 대화 · 공지"]
    Home --> Address["/addressBook 주소록<br/>조직도 · 즐겨찾기"]
    Address --> Search["/addressBook/search<br/>구성원 검색"]
    Home --> Calendar["/calendar 일정<br/>주 · 월 · 회의실 예약"]
    Home --> Admin["/admin 관리자 대시보드<br/>활동 통계 · Drill-down"]
    Header["Global Header<br/>알림 · 프로필 · 세션 · 프로젝트 소개"] -.-> Home
    Header -.-> Message
    Header -.-> Address
    Header -.-> Calendar
```

모든 화면 위에 공통 헤더가 유지됩니다. 알림 패널·프로필 메뉴·세션 잔여 시간·프로젝트 소개 모달이 여기에 붙습니다.

---

## 2. 앱 구조

App Router 아래에 화면이 있고, 화면은 `components`의 조각과 `lib`의 API·실시간·순수 계산 함수를 조립합니다. 서버 상태는 화면이 직접 들고, 전역 라이브러리는 필요가 증명되기 전까지 넣지 않습니다.

<!-- diagram: app-architecture -->
```mermaid
flowchart TB
    subgraph App["src/app · App Router"]
        P1["login"]
        P2["home"]
        P3["message"]
        P4["addressBook"]
    end
    subgraph Comp["src/components"]
        C1["common<br/>헤더 · 툴팁 · 로딩 · 토스트 · 모달"]
        C2["chat<br/>메뉴 · 리액션 · 공지 패널 · 전달 모달"]
        C3["address-book · home · login · auth"]
    end
    subgraph Lib["src/lib"]
        L1["api/*<br/>fetch 래퍼 · 타입 · ApiClientError"]
        L2["realtime/chat-realtime<br/>STOMP 연결 · 구독 · 이벤트 분기"]
        L3["chat-message-state · message-tokens<br/>순수 함수 · 단위 테스트"]
    end
    API["Spring Boot API"]

    App --> Comp
    App --> Lib
    L1 -->|"REST"| API
    L2 -.->|"WebSocket"| API
```

`lib`의 순수 함수(읽음 수 재계산, URL·멘션 토큰 분리)는 React 없이 node 테스트로 검증합니다.

---

## 3. 인증 UX

Access Token은 메모리에만 두고 만료 1분 전에 조용히 갱신합니다. 세션 전체(7일)가 끝나거나 갱신이 실패하면 로그인 화면으로 보내고, 헤더에는 남은 시간을 표시합니다.

<!-- diagram: auth-ux -->
```mermaid
sequenceDiagram
    participant U as 사용자
    participant F as 화면
    participant S as 세션 관리 (auth)
    participant A as API

    U->>F: 로그인
    F->>A: POST /auth/login
    A-->>S: Access (3h) · Refresh (쿠키)
    S-->>F: 홈으로 이동 · 헤더에 잔여 시간
    loop 만료 1분 전
        S->>A: POST /auth/refresh
        A-->>S: 새 Access
    end
    U->>F: 새로고침
    S->>A: POST /auth/refresh
    A-->>S: 세션 복구
    A--xS: 7일 만료 · 갱신 실패
    S-->>F: 로그인 화면 + "다시 로그인해 주세요"
```

실패는 `alert` 대신 토스트와 입력 피드백으로 알립니다. 역할별 화면 차이는 서버가 돌려준 권한을 받은 뒤에만 적용합니다.

---

## 4. 실시간 동기화

STOMP 연결 하나로 방 토픽과 개인 큐를 구독합니다. 이벤트 종류마다 핸들러가 나뉘고, 현재 보고 있는 방의 이벤트만 화면 상태를 바꿉니다.

<!-- diagram: realtime-sync -->
```mermaid
flowchart LR
    WS["STOMP Client<br/>자동 재연결"]
    WS --> Topic["/topic/chatRoom/{id}<br/>참여 방 전부 구독"]
    WS --> Queue["/user/queue/notification<br/>내 알림"]
    Topic --> MC["MESSAGE_CREATED<br/>목록 미리보기 + 현재 방 추가"]
    Topic --> MU["MESSAGE_UPDATED · DELETED<br/>말풍선 교체"]
    Topic --> RE["REACTION_UPDATED<br/>델타 적용"]
    Topic --> NO["NOTICE_UPDATED<br/>공지 목록 교체"]
    Topic --> RD["READ_UPDATED<br/>커서 갱신 → 읽음 수 재계산"]
    Topic --> TY["TYPING_CHANGED<br/>입력 중 말풍선"]
    Queue --> NT["알림 패널 · 토스트"]
    Presence["/topic/presence<br/>온 · 오프라인"] --> PR["주소록 · 모달 상태 점"]
    WS --> Presence
```

재연결하면 현재 방을 다시 조회해 끊긴 사이의 변화를 메웁니다. Pub/Sub은 저장하지 않기 때문입니다.

---

## 5. 메시지 화면 상태

대화는 50개 단위 윈도우로 다룹니다. 위로 스크롤하면 이전 페이지를 붙이고, 답장 원문으로 점프하면 그 위치 중심의 새 윈도우를 엽니다. 최신으로 돌아오기 전까지는 새 메시지를 "아래 N개" 배지로만 알립니다.

<!-- diagram: message-state -->
```mermaid
stateDiagram-v2
    [*] --> Latest : 방 선택 · 최신 50개
    Latest --> Older : 상단 도달<br/>이전 커서 50개 붙이고 스크롤 보존
    Older --> Older : 계속 위로
    Latest --> Anchored : 답장 · 공지 원문 클릭<br/>원문 기준 윈도우 · 파란 테두리 강조
    Older --> Anchored : 원문 클릭
    Anchored --> Anchored : 위 · 아래로 이어 붙임
    Anchored --> Latest : "최신으로" 버튼 · 메시지 전송
    Older --> Latest : 맨 아래 버튼
    note right of Anchored
        새 메시지는 추가하지 않고
        "아래 N개" 배지로 표시
    end note
```

읽음 수는 서버 값과 참여자 커서를 합쳐 화면이 다시 셉니다. 이벤트 도착 순서가 뒤바뀌어도 숫자가 흔들리지 않습니다.

---

## 6. 메신저 인터랙션

말풍선 하나에 붙는 동작과, 방 상단의 공지 패널이 오가는 모양입니다.

<!-- diagram: messenger-interaction -->
```mermaid
flowchart TB
    subgraph Bubble["말풍선"]
        Menu["⋮ 메뉴 · 우클릭<br/>복사 · 답장 · 전달 · 공지<br/>본인: 수정 · 삭제 (24h)"]
        Smile["😊 리액션 선택<br/>1인 1이모지 · 24h"]
        Chip["리액션 칩 클릭<br/>누른 사람 모달"]
        Read["읽음 수 클릭<br/>읽은 · 안 읽은 사람"]
        Link["URL 자동 링크 · @멘션 강조"]
    end
    subgraph Notice["공지 패널"]
        Line["한 줄<br/>최신 공지 + ∨"]
        List["펼침<br/>전체 목록 · 줄마다 ⋮<br/>4개 초과 시 스크롤"]
        Icon["아이콘<br/>오른쪽 위 확성기"]
        Line -->|"∨"| List
        List -->|"∧"| Line
        List -->|"접기"| Icon
        Icon -->|"클릭 · 새 공지"| Line
    end
    Menu -->|"공지로 등록"| Line
    List -->|"본문 클릭"| Jump["원문으로 점프 · 강조"]
```

메뉴는 포털로 띄워 스크롤 영역에 가려지지 않고, 화면 아래쪽에서는 위로 접힙니다. 모든 확인은 커스텀 모달이고 브라우저 `confirm`은 쓰지 않습니다.

---

## 7. 컴포넌트 트리

메시지 화면이 가장 큽니다. 목록과 말풍선은 `memo`로 감싸 다른 말풍선이 바뀌어도 다시 그리지 않고, 콜백은 참조가 고정된 래퍼로 넘깁니다.

<!-- diagram: component-tree -->
```mermaid
flowchart TB
    Page["MessagePage"]
    Page --> Header["GlobalHeader"]
    Page --> Rooms["RoomList<br/>정렬 · 고정 · 안 읽음 배지"]
    Page --> Panel["NoticePanel"]
    Page --> List["MessageList (memo)"]
    List --> Bubble["MessageBubble (memo)"]
    Bubble --> ActionMenu["MessageActionMenu"]
    Bubble --> Picker["ReactionPicker"]
    Bubble --> Emoji["ReactionEmoji (SVG)"]
    Bubble --> Text["MentionText<br/>URL · 멘션 토큰"]
    Page --> Input["MessageInput<br/>답장 · 수정 · 멘션 자동완성"]
    Page --> Modals["모달들<br/>읽음 · 리액션 · 전달 · 삭제 · 프로필"]
    Modals --> Shell["MessageDialogShell<br/>포커스 트랩 · Esc"]
    Page --> Common["common<br/>Tooltip · Spinner · LoadingInline · LoadingState · Toast"]
```

공통 UI는 한 곳에 두고 어디서든 붙입니다. 로딩 표시 세 가지(아이콘만 · 한 줄 · 영역 전체)를 상황에 맞게 고릅니다.

---

## 8. 공통 UI 체계

브라우저 기본 UI를 쓰지 않고 서비스 전반에 같은 모양을 유지합니다.

<!-- diagram: ui-system -->
```mermaid
flowchart LR
    subgraph Feedback["피드백"]
        Toast["토스트<br/>성공 · 실패 · 재호출"]
        Tooltip["툴팁<br/>지연 표시 · 다중 줄"]
        Loading["로딩<br/>Spinner · Inline · State"]
    end
    subgraph Overlay["오버레이"]
        Dialog["모달<br/>투명 배경 · 포커스 순환 · Esc"]
        Menu["컨텍스트 메뉴<br/>포털 · 화면 밖 보정"]
    end
    subgraph Form["입력"]
        Input["입력칸<br/>Enter 전송 · Shift+Enter 줄바꿈"]
        Mention["@ 자동완성"]
        Check["커스텀 체크박스 · 검색"]
    end
    Style["Tailwind 4 · Pretendard<br/>Prettier printWidth 100"] --> Feedback
    Style --> Overlay
    Style --> Form
```

접근성 속성(`aria-*`, `role`)을 모든 상호작용 요소에 붙이고, 키보드만으로 메뉴와 모달을 다룰 수 있게 합니다.

---

## 9. 배포 흐름

프론트는 Vercel이 main 브랜치를 받아 바로 배포합니다. API 주소는 환경변수 하나로 바뀌고, 서버와는 다른 사이트이므로 쿠키와 CORS를 그에 맞춰 설정합니다.

<!-- diagram: deploy -->
```mermaid
flowchart LR
    Dev["git push main"] --> Vercel["Vercel 빌드 · 배포<br/>nwclone.duckdns.org"]
    Vercel --> Browser["브라우저"]
    Browser -->|"REST · WebSocket<br/>credentials: include"| API["nwclone-api.duckdns.org<br/>nginx → Spring Boot"]
    Env["NEXT_PUBLIC_API_BASE_URL"] -.-> Vercel
    Guide["프로젝트 소개 모달"] -.->|"docs/diagrams/*.svg<br/>GitHub raw"| Browser
```

앱 안의 "프로젝트 소개" 모달은 두 저장소의 README 다이어그램을 그대로 보여 줍니다. README를 고치면 모달도 같이 바뀝니다.

---

## 10. 로드맵

<!-- diagram: roadmap -->
```mermaid
timeline
    title 화면 기준 개발 순서
    section 기반
        로그인 · 세션 : 실제 API 연동 · 자동 갱신 · 세션 표시
        주소록 : 조직도 · 검색 · 즐겨찾기 · 온라인 상태
    section 메신저
        대화 : 방 목록 · 메시지 · 읽음 · 커서 페이징 · 실시간
        확장 : 답장 · 수정 · 삭제 · 리액션 · 전달 · 공지 · 멘션 · 알림
    section 일정 · 홈
        일정 : 주 · 월 보기 · 회의실 예약
        Today : 오늘 일정 · 안 읽은 메시지 · 즐겨찾기 · 예약 현황
        관리자 : 활동 통계 · 기간 선택 · Drill-down
    section 마무리
        AI 요약 · 파일 첨부 · 소셜 로그인 · 공개 배포
```

---

## 기술 스택

| 분류 | 선택 | 이유 |
| --- | --- | --- |
| 프레임워크 | Next.js 16 · App Router · React 19 · TypeScript 5 | 화면 구조와 타입 안정성 |
| 스타일 | Tailwind CSS 4 · Prettier | 빠른 조립과 일관된 포맷 |
| 아이콘 | lucide-react · 직접 그린 리액션 SVG | 가볍고 통일된 선 굵기 |
| 실시간 | @stomp/stompjs | 서버 STOMP 브로커와 연결, 자동 재연결 |
| 상태 | React 상태 · `useStableCallback` · `memo` | 라이브러리 없이 렌더링 범위 제어 |
| 테스트 | node:test · eslint(react-hooks 컴파일러 규칙) · tsc | 순수 함수 검증과 정적 검사 |
| 배포 | Vercel · DuckDNS | 비용 0원 |

## 로컬 실행

```powershell
npm install
# .env.local 에 NEXT_PUBLIC_API_BASE_URL=http://localhost:9090
npm run dev          # http://localhost:3000

npm run lint
npx tsc --noEmit
node --test "tests/**/*.test.mjs"
```

## 문서

- [백엔드 README](https://github.com/wjsgusdn12/naverworks_clone_api#readme) · [전체 설계·요구사항](https://github.com/wjsgusdn12/naverworks_clone_api/blob/main/docs/PROJECT_CONTEXT.md)
- 이 README의 다이어그램은 `scripts/build-diagrams.mjs`가 `docs/diagrams/`에 SVG로 뽑아 두며, 앱의 "프로젝트 소개" 모달이 같은 파일을 보여 줍니다.
