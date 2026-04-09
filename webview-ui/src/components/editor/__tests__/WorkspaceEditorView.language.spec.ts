import { describe, expect, it } from "vitest"

import { inferLanguage } from "../WorkspaceEditorView"

describe("WorkspaceEditorView inferLanguage", () => {
	it("maps common file extensions to Monaco languages", () => {
		expect(inferLanguage("index.ts")).toBe("typescript")
		expect(inferLanguage("index.tsx")).toBe("typescript")
		expect(inferLanguage("app.js")).toBe("javascript")
		expect(inferLanguage("file.py")).toBe("python")
		expect(inferLanguage("README.md")).toBe("markdown")
		expect(inferLanguage("unknown.custom")).toBe("plaintext")
	})
})
