import { createRequire } from "node:module"
import { EventEmitter } from "node:events"
import path from "node:path"

import { createVSCodeAPI } from "@roo-code/vscode-shim"
import type { ExtensionMessage, WebviewMessage } from "@roo-code/types"

type ExtensionModule = {
	activate: (context: unknown) => Promise<unknown>
	deactivate?: () => Promise<void>
}

type WebviewViewProvider = {
	resolveWebviewView?: (webviewView: unknown, context: unknown, token: unknown) => void | Promise<void>
}

export interface StandaloneHostOptions {
	repoRootPath: string
	workspacePath: string
	extensionDistPath: string
}

export class StandaloneExtensionHost extends EventEmitter {
	private readonly options: StandaloneHostOptions
	private vscode: ReturnType<typeof createVSCodeAPI> | null = null
	private extensionModule: ExtensionModule | null = null
	private isReady = false

	constructor(options: StandaloneHostOptions) {
		super()
		this.options = options
	}

	public async activate(): Promise<void> {
		const bundlePath = path.join(this.options.extensionDistPath, "extension.js")
		const require = createRequire(import.meta.url)
		const Module = require("module")

		this.vscode = createVSCodeAPI(this.options.extensionDistPath, this.options.workspacePath, undefined, {
			appRoot: this.options.repoRootPath,
		})
		;(global as Record<string, unknown>).vscode = this.vscode
		;(global as Record<string, unknown>).__extensionHost = this

		const originalResolve = Module._resolveFilename
		let resolverPatched = false

		try {
			// This mirrors the existing CLI host strategy and ensures any extension import of
			// "vscode" resolves to the shim during standalone runtime activation.
			Module._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options: unknown) {
				if (request === "vscode") {
					return "vscode-mock"
				}
				return originalResolve.call(this, request, parent, isMain, options)
			}
			resolverPatched = true

			require.cache["vscode-mock"] = {
				id: "vscode-mock",
				filename: "vscode-mock",
				loaded: true,
				exports: this.vscode,
				children: [],
				paths: [],
				path: "",
				isPreloading: false,
				parent: null,
				require,
			} as unknown as NodeJS.Module

			this.extensionModule = require(bundlePath) as ExtensionModule
			await this.extensionModule.activate(this.vscode.context)
		} finally {
			if (resolverPatched) {
				Module._resolveFilename = originalResolve
			}
		}
	}

	public registerWebviewProvider(_viewId: string, _provider: WebviewViewProvider): void {}

	public unregisterWebviewProvider(_viewId: string): void {}

	public markWebviewReady(): void {
		this.isReady = true
	}

	public isInInitialSetup(): boolean {
		return !this.isReady
	}

	public sendToExtension(message: WebviewMessage): void {
		if (!this.isReady) {
			return
		}
		this.emit("webviewMessage", message)
	}

	public relayFromExtension(message: ExtensionMessage): void {
		this.emit("extensionMessage", message)
	}

	public async dispose(): Promise<void> {
		if (this.extensionModule?.deactivate) {
			await this.extensionModule.deactivate()
		}
		delete (global as Record<string, unknown>).vscode
		delete (global as Record<string, unknown>).__extensionHost
	}
}
