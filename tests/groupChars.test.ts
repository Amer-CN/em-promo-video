import test from "node:test";
import assert from "node:assert/strict";
import {groupChars} from "../src/utils/groupChars.ts";

test("欢迎使用本产品 -> 4+2", () => {
  assert.deepEqual(groupChars("欢迎使用本产品"), ["欢迎使用", "本产品"]);
});

test("三步完成配置 -> 4+2", () => {
  assert.deepEqual(groupChars("三步完成配置"), ["三步完成", "配置"]);
});

test("马上开始吧 -> 3+2 (剩余5取3, 避免4+1)", () => {
  assert.deepEqual(groupChars("马上开始吧"), ["马上开", "始吧"]);
});

test("本月新增合同额，同比增长 32%", () => {
  assert.deepEqual(groupChars("本月新增合同额，同比增长 32%"), ["本月新增", "合同额，", "同比增长", "32%"]);
});

test("空串 -> []", () => {
  assert.deepEqual(groupChars(""), []);
});

test("单个汉字 -> 保持", () => {
  assert.deepEqual(groupChars("好"), ["好"]);
});

test("纯英文串按空白切分且整词保留", () => {
  assert.deepEqual(groupChars("OpenAI GPT-4o is awesome"), ["OpenAI", "GPT", "4o", "is", "awesome"]);
});
