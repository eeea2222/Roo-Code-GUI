import { describe, expect, it } from "vitest"

import { sanitizeRelativePath } from "./path-utils.js"

describe("sanitizeRelativePath", () => {
	it("removes upward traversal prefixes", () => {
		expect(sanitizeRelativePath("../../etc/passwd")).toBe("etc/passwd")
		expect(sanitizeRelativePath("../assets/index.js")).toBe("assets/index.js")
	})

	it("normalizes leading slash", () => {
		expect(sanitizeRelativePath("/index.html")).toBe("index.html")
	})
})
