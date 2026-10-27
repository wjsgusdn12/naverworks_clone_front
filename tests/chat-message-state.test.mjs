import assert from "node:assert/strict";
import test from "node:test";
import { applyMessageChange, applyRoomMessageChange, DELETED_MESSAGE_CONTENT } from "../src/lib/chat-message-state.ts";

const message = (overrides = {}) => ({
  id: 10, senderMembershipId: 1, senderName: "작성자", content: "원문", type: "TEXT",
  createdAt: "2026-10-27T00:00:00Z", readCount: 1, unreadCount: 1, mentionedMembershipIds: [],
  reply: null, editedAt: null, deletedAt: null, version: 0, ...overrides,
});
const room = (overrides = {}) => ({
  id: 1, lastMessageId: 10, lastMessageVersion: 0, lastMessage: "원문", lastMessageMentioned: false,
  lastMessageAt: "2026-10-27T00:00:00Z", unreadCount: 3, ...overrides,
});

test("늦게 도착한 REST 응답으로 최신 수정·삭제를 되돌리지 않음", () => {
  const newest = message({ version: 2, content: "최신" });
  assert.equal(applyMessageChange(newest, message({ version: 1, content: "과거" })), newest);
});

test("수정 응답이 늦게 도착해도 먼저 처리한 읽음 수를 줄이지 않음", () => {
  const result = applyMessageChange(message({ readCount: 2, unreadCount: 0 }), message({ version: 1, content: "수정", readCount: 1, unreadCount: 1 }));
  assert.equal(result.content, "수정");
  assert.equal(result.readCount, 2);
  assert.equal(result.unreadCount, 0);
});

test("원문 삭제 이벤트를 받으면 이미 보이는 답장 인용도 가림", () => {
  const reply = message({ id: 20, reply: { messageId: 10, senderName: "작성자", content: "삭제할 원문" } });
  const result = applyMessageChange(reply, message({ version: 1, content: DELETED_MESSAGE_CONTENT, deletedAt: "2026-10-27T01:00:00Z" }));
  assert.equal(result.reply.content, DELETED_MESSAGE_CONTENT);
  assert.equal(result.reply.deleted, true);
  assert.equal(result.content, reply.content);
});

test("삭제되지 않은 원문 수정은 기존 답장 스냅샷을 바꾸지 않음", () => {
  const reply = message({ id: 20, reply: { messageId: 10, senderName: "작성자", content: "인용 당시" } });
  assert.equal(applyMessageChange(reply, message({ version: 1, content: "새 원문" })), reply);
});

test("마지막 메시지를 수정해도 안 읽음 수와 정렬 시각은 그대로 유지", () => {
  const current = room();
  const result = applyRoomMessageChange(current, message({ version: 1, content: "수정 내용", mentionedMembershipIds: [2] }), 2);
  assert.equal(result.lastMessage, "수정 내용");
  assert.equal(result.lastMessageMentioned, true);
  assert.equal(result.unreadCount, current.unreadCount);
  assert.equal(result.lastMessageAt, current.lastMessageAt);
});

test("이전 메시지 수정으로 더 최근 미리보기를 덮어쓰지 않음", () => {
  const current = room({ lastMessageId: 11 });
  assert.equal(applyRoomMessageChange(current, message({ version: 1, content: "옛 메시지 수정" }), 2), current);
});

test("낮은 버전의 이벤트로 목록의 삭제 안내를 되돌리지 않음", () => {
  const current = room({ lastMessageVersion: 2, lastMessage: DELETED_MESSAGE_CONTENT });
  assert.equal(applyRoomMessageChange(current, message({ version: 1 }), 2), current);
});
