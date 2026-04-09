import { describe, expect, it } from "vitest"

import { inferMonacoLanguageFromPath } from "../WorkspaceEditorView"

describe("WorkspaceEditorView inferMonacoLanguageFromPath", () => {
	it("maps common file extensions to Monaco languages", () => {
		expect(inferMonacoLanguageFromPath("index.ts")).toBe("typescript")
		expect(inferMonacoLanguageFromPath("index.tsx")).toBe("typescript")
		expect(inferMonacoLanguageFromPath("app.js")).toBe("javascript")
		expect(inferMonacoLanguageFromPath("file.py")).toBe("python")
		expect(inferMonacoLanguageFromPath("README.md")).toBe("markdown")
		expect(inferMonacoLanguageFromPath("unknown.custom")).toBe("plaintext")
	})
})
