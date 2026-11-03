import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ONBOARDING_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  SAMPLE_PROFILE,
  hasSavedProfile,
  loadSavedProfile,
  profileFromGuide,
  readOnboardingChoice,
  saveProfile,
  shouldPromptProfile,
  skipProfilePrompt,
} from "../src/profile.ts"
import { memoryStore } from "../src/storage.ts"

describe("首访画像", () => {
  it("没填过也没跳过时需要引导，跳过之后不再弹出，也不写入画像", () => {
    const store = memoryStore()
    assert.equal(shouldPromptProfile(store), true)
    assert.equal(hasSavedProfile(store), false)

    skipProfilePrompt(store)

    assert.equal(shouldPromptProfile(store), false)
    assert.equal(readOnboardingChoice(store), "skipped")
    assert.equal(hasSavedProfile(store), false)
    assert.equal(loadSavedProfile(store), null)
    assert.equal(store.getItem(PROFILE_STORAGE_KEY), null)
    assert.equal(store.getItem(ONBOARDING_STORAGE_KEY), "skipped")
  })

  it("学院、专业、年级都有才能保存，保存后不再引导", () => {
    const store = memoryStore()
    assert.equal(profileFromGuide({ college: "  ", major: "软件工程", grade: "大二" }), null)
    assert.equal(profileFromGuide({ college: "计算机学院", major: "软件工程", grade: "高一" }), null)

    const profile = profileFromGuide({ college: " 管理科学学院 ", major: "大数据管理与应用", grade: "大二" })
    assert.deepEqual(profile, {
      school: "成都理工大学",
      college: "管理科学学院",
      major: "大数据管理与应用",
      grade: "大二",
    })
    assert.ok(profile)
    saveProfile(profile, store)

    assert.equal(shouldPromptProfile(store), false)
    assert.equal(readOnboardingChoice(store), "saved")
    assert.equal(loadSavedProfile(store)?.major, "大数据管理与应用")
    assert.equal(loadSavedProfile(store)?.college, "管理科学学院")
  })

  it("以前只存过画像时，不再当成第一次进入", () => {
    const store = memoryStore({
      [PROFILE_STORAGE_KEY]: JSON.stringify(SAMPLE_PROFILE),
    })
    assert.equal(readOnboardingChoice(store), "saved")
    assert.equal(shouldPromptProfile(store), false)
  })
})
