import { EDIT_WINDOW_HOURS } from "@/components/chat/message-action-menu";
import { chatApi, type ChatMessage, type ChatReadMember } from "@/lib/api/chat-api";

// 보낸 지 24시간이 지나지 않은 메시지만 수정·삭제·리액션 가능(서버도 같은 기준으로 거부).
export const isMessageEditable = (message: ChatMessage) =>
  Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_HOURS * 60 * 60 * 1000;

// 읽음/안 읽음 목록을 함께 보관해 탭 전환 시 다시 조회하지 않음.
export type ReadModalState = {
  message: ChatMessage;
  readMembers: ChatReadMember[];
  unreadMembers: ChatReadMember[];
  read: boolean;
};
// 메시지에 리액션한 사람 목록 모달(누가 어떤 이모지를 눌렀는지).
export type ReactionModalState = {
  message: ChatMessage;
  members: Awaited<ReturnType<typeof chatApi.reactionMembers>>;
};
