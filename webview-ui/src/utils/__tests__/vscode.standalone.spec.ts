import { beforeEach, describe, expect, it, vi } from "vitest"

describe("vscode standalone bridge", () => {
	beforeEach(() => {
		vi.resetModules()
		localStorage.clear()
		delete (window as Window & { __rooStandaloneBridge?: unknown }).__rooStandaloneBridge
		Reflect.deleteProperty(globalThis as typeof globalThis & Record<string, unknown>, "acquireVsCodeApi")
	})

	it("uses standalone bridge when VS Code API is unavailable", async () => {
		const postMessage = vi.fn()
		const getState = vi.fn(() => ({ hello: "world" }))
		const setState = vi.fn((newState: unknown) => newState)

		;(window as Window & { __rooStandaloneBridge?: unknown }).__rooStandaloneBridge = {
			postMessage,
			getState,
			setState: setState as <T extends unknown | undefined>(newState: T) => T,
		}

		const { vscode } = await import("../vscode")
		vscode.postMessage({ type: "webviewDidLaunch" })

		expect(postMessage).toHaveBeenCalledWith({ type: "webviewDidLaunch" })
		expect(vscode.getState()).toEqual({ hello: "world" })
		expect(vscode.setState({ test: true })).toEqual({ test: true })
		expect(setState).toHaveBeenCalledWith({ test: true })
	})

	it("falls back to localStorage when no host bridge exists", async () => {
		const { vscode } = await import("../vscode")
		expect(vscode.getState()).toBeUndefined()

		vscode.setState({ persisted: true })
		expect(vscode.getState()).toEqual({ persisted: true })
	})
})
