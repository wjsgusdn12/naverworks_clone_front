import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMessageChange,
  applyReactionChange,
  applyReadCursors,
  applyRoomMessageChange,
  DELETED_MESSAGE_CONTENT,
} from "../src/lib/chat-message-state.ts";

const message = (overrides = {}) => ({
  id: 10,
  senderMembershipId: 1,
  senderName: "작성자",
  content: "원문",
  type: "TEXT",
  createdAt: "2026-10-27T00:00:00Z",
  readCount: 1,
  unreadCount: 1,
  mentionedMembershipIds: [],
  reply: null,
  editedAt: null,
  deletedAt: null,
  version: 0,
  ...overrides,
});
const room = (overrides = {}) => ({
  id: 1,
  lastMessageId: 10,
  lastMessageVersion: 0,
  lastMessage: "원문",
  lastMessageMentioned: false,
  lastMessageAt: "2026-10-27T00:00:00Z",
  unreadCount: 3,
  ...overrides,
});

const ME = 1;
const OTHER = 2;

test("읽음 수는 구성원별 읽은 위치로 계산하고, 같은 이벤트가 반복돼도 늘지 않음", () => {
  const state = { memberIds: [1, 2, 3], cursors: { 2: 10, 3: 5 } };
  const list = [
    message({ id: 5, readCount: 0, unreadCount: 2 }),
    message({ id: 10, readCount: 0, unreadCount: 2 }),
  ];
  const once = applyReadCursors(list, state);
  // 5번은 2·3 모두 읽음, 10번은 2만 읽음. 보낸 사람(1)은 수신자에서 제외.
  assert.deepEqual(
    once.map((item) => [item.readCount, item.unreadCount]),
    [
      [2, 0],
      [1, 1],
    ],
  );
  // 같은 상태로 다시 계산하면 수가 그대로이고 객체도 그대로(불필요한 재렌더링 없음).
  assert.equal(applyReadCursors(once, state), once);
});

test("읽음 위치가 전진하면 그 사이 메시지만 읽음으로 바뀌고, 서버가 준 더 높은 수는 낮추지 않음", () => {
  const list = [message({ id: 10, readCount: 1, unreadCount: 1 })];
  const stale = applyReadCursors(list, { memberIds: [1, 2, 3], cursors: {} });
  assert.equal(stale[0].readCount, 1);
  const advanced = applyReadCursors(list, { memberIds: [1, 2, 3], cursors: { 2: 12, 3: 12 } });
  assert.equal(advanced[0].readCount, 2);
  assert.equal(advanced[0].unreadCount, 0);
  // 시스템 안내·삭제된 메시지는 건드리지 않음.
  const skipped = applyReadCursors(
    [message({ type: "SYSTEM", readCount: 0 }), message({ deletedAt: "2026-10-27T00:00:00Z" })],
    { memberIds: [1, 2], cursors: { 2: 99 } },
  );
  assert.equal(skipped[0].readCount, 0);
  assert.equal(skipped[1].readCount, 1);
});

test("리액션 추가 변화분은 새 이모지 묶음을 만들고, 같은 이모지는 수만 올림", () => {
  const one = applyReactionChange(
    [],
    { emoji: "thumbs_up", membershipId: OTHER, action: "added" },
    ME,
  );
  assert.deepEqual(one, [{ emoji: "thumbs_up", count: 1, reactedByMe: false }]);
  const two = applyReactionChange(
    one,
    { emoji: "thumbs_up", membershipId: ME, action: "added" },
    ME,
  );
  assert.deepEqual(two, [{ emoji: "thumbs_up", count: 2, reactedByMe: true }]);
});

test("내 추가 응답과 실시간 이벤트가 둘 다 와도 수가 두 번 오르지 않음", () => {
  const once = applyReactionChange([], { emoji: "heart", membershipId: ME, action: "added" }, ME);
  const twice = applyReactionChange(
    once,
    { emoji: "heart", membershipId: ME, action: "added" },
    ME,
  );
  assert.equal(twice, once);
});

test("마지막 사람이 취소하면 묶음이 사라지고, 누른 적 없는 취소는 무시", () => {
  const start = [{ emoji: "laugh", count: 2, reactedByMe: true }];
  const afterOther = applyReactionChange(
    start,
    { emoji: "laugh", membershipId: OTHER, action: "removed" },
    ME,
  );
  assert.deepEqual(afterOther, [{ emoji: "laugh", count: 1, reactedByMe: true }]);
  const afterMe = applyReactionChange(
    afterOther,
    { emoji: "laugh", membershipId: ME, action: "removed" },
    ME,
  );
  assert.deepEqual(afterMe, []);
  assert.equal(
    applyReactionChange(afterMe, { emoji: "laugh", membershipId: ME, action: "removed" }, ME),
    afterMe,
  );
});

test("수정 이벤트를 병합해도 내 화면의 리액션 집계(reactedByMe)는 유지", () => {
  const mine = message({ reactions: [{ emoji: "pray", count: 1, reactedByMe: true }] });
  const result = applyMessageChange(
    mine,
    message({
      version: 1,
      content: "수정",
      reactions: [{ emoji: "pray", count: 1, reactedByMe: false }],
    }),
  );
  assert.equal(result.content, "수정");
  assert.equal(result.reactions[0].reactedByMe, true);
});

test("늦게 도착한 REST 응답으로 최신 수정·삭제를 되돌리지 않음", () => {
  const newest = message({ version: 2, content: "최신" });
  assert.equal(applyMessageChange(newest, message({ version: 1, content: "과거" })), newest);
});

test("수정 응답이 늦게 도착해도 먼저 처리한 읽음 수를 줄이지 않음", () => {
  const result = applyMessageChange(
    message({ readCount: 2, unreadCount: 0 }),
    message({ version: 1, content: "수정", readCount: 1, unreadCount: 1 }),
  );
  assert.equal(result.content, "수정");
  assert.equal(result.readCount, 2);
  assert.equal(result.unreadCount, 0);
});

test("원문 삭제 이벤트를 받으면 이미 보이는 답장 인용도 가림", () => {
  const reply = message({
    id: 20,
    reply: { messageId: 10, senderName: "작성자", content: "삭제할 원문" },
  });
  const result = applyMessageChange(
    reply,
    message({ version: 1, content: DELETED_MESSAGE_CONTENT, deletedAt: "2026-10-27T01:00:00Z" }),
  );
  assert.equal(result.reply.content, DELETED_MESSAGE_CONTENT);
  assert.equal(result.reply.deleted, true);
  assert.equal(result.content, reply.content);
});

test("삭제되지 않은 원문 수정은 기존 답장 스냅샷을 바꾸지 않음", () => {
  const reply = message({
    id: 20,
    reply: { messageId: 10, senderName: "작성자", content: "인용 당시" },
  });
  assert.equal(applyMessageChange(reply, message({ version: 1, content: "새 원문" })), reply);
});

test("마지막 메시지를 수정해도 안 읽음 수와 정렬 시각은 그대로 유지", () => {
  const current = room();
  const result = applyRoomMessageChange(
    current,
    message({ version: 1, content: "수정 내용", mentionedMembershipIds: [2] }),
    2,
  );
  assert.equal(result.lastMessage, "수정 내용");
  assert.equal(result.lastMessageMentioned, true);
  assert.equal(result.unreadCount, current.unreadCount);
  assert.equal(result.lastMessageAt, current.lastMessageAt);
});

test("이전 메시지 수정으로 더 최근 미리보기를 덮어쓰지 않음", () => {
  const current = room({ lastMessageId: 11 });
  assert.equal(
    applyRoomMessageChange(current, message({ version: 1, content: "옛 메시지 수정" }), 2),
    current,
  );
});

test("낮은 버전의 이벤트로 목록의 삭제 안내를 되돌리지 않음", () => {
  const current = room({ lastMessageVersion: 2, lastMessage: DELETED_MESSAGE_CONTENT });
  assert.equal(applyRoomMessageChange(current, message({ version: 1 }), 2), current);
});
