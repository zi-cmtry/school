import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  HIDDEN_STORAGE_KEY,
  hideOpportunity,
  isHidden,
  omitHidden,
  parseHidden,
  readHidden,
  unhideOpportunity,
} from "../src/hidden.ts"
import { memoryStore } from "../src/storage.ts"

describe("不感兴趣", () => {
  it("按 id 隐藏，列表去掉它并保持其余顺序", () => {
    const store = memoryStore()
    const items = [
      { id: "1", kind: "internship", title: "实习甲" },
      { id: "2", kind: "competition", title: "竞赛乙" },
      { id: "3", kind: "campus_recruit", title: "校招丙" },
    ]
    hideOpportunity({ id: "2", title: "竞赛乙" }, store)
    const hidden = readHidden(store)
    assert.deepEqual(hidden, [{ id: "2", title: "竞赛乙" }])
    assert.equal(isHidden("2", store), true)
    assert.equal(isHidden("1", store), false)
    assert.deepEqual(
      omitHidden(items, hidden).map((item) => item.id),
      ["1", "3"],
    )
    assert.deepEqual(
      items.map((item) => item.id),
      ["1", "2", "3"],
    )
  })

  it("只存 id 和标题，重复标记不产生第二条，解除后重新出现", () => {
    const store = memoryStore()
    hideOpportunity({ id: "9", title: "德邦宣讲" }, store)
    hideOpportunity({ id: "9", title: "德邦宣讲" }, store)
    const raw: unknown = JSON.parse(store.getItem(HIDDEN_STORAGE_KEY) ?? "null")
    assert.deepEqual(raw, [{ id: "9", title: "德邦宣讲" }])
    assert.equal(Array.isArray(raw) && raw[0] && Object.hasOwn(raw[0], "company"), false)

    assert.deepEqual(unhideOpportunity("9", store), [])
    assert.equal(isHidden("9", store), false)
    assert.deepEqual(omitHidden([{ id: "9", title: "德邦宣讲" }], readHidden(store)), [{ id: "9", title: "德邦宣讲" }])
  })

  it("坏数据和空 id 丢掉", () => {
    assert.deepEqual(parseHidden("nope"), [])
    assert.deepEqual(parseHidden([null, { id: "  " }, { title: "没有编号" }, "  "]), [])
    assert.deepEqual(parseHidden(["7", { id: 7, title: "重复" }, { id: "8", title: "另一条" }]), [
      { id: "7", title: "" },
      { id: "8", title: "另一条" },
    ])
    const store = memoryStore({ [HIDDEN_STORAGE_KEY]: "{" })
    assert.deepEqual(readHidden(store), [])
  })
})
