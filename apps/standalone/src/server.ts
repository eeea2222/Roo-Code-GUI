import fs from "node:fs/promises"
import path from "node:path"
import http, { type IncomingMessage, type ServerResponse } from "node:http"

import type { ExtensionMessage, WebviewMessage } from "@roo-code/types"

import { StandaloneExtensionHost } from "./StandaloneExtensionHost.js"
import { sanitizeRelativePath } from "./path-utils.js"

const repoRoot = path.resolve(import.meta.dirname, "..", "..")
const defaultWorkspacePath = process.env.ROO_WORKSPACE_PATH || repoRoot
const extensionDistPath = process.env.ROO_EXTENSION_DIST || path.join(repoRoot, "src", "dist")
const webviewBuildPath = process.env.ROO_WEBVIEW_DIST || path.join(repoRoot, "src", "webview-ui", "build")
const port = Number(process.env.PORT || "4178")

const host = new StandaloneExtensionHost({
	repoRootPath: repoRoot,
	workspacePath: defaultWorkspacePath,
	extensionDistPath,
})

const sseClients = new Set<ServerResponse>()

const sendJson = (res: ServerResponse, status: number, data: unknown) => {
	res.statusCode = status
	res.setHeader("Content-Type", "application/json")
	res.end(JSON.stringify(data))
}

const readJsonBody = async <T>(req: IncomingMessage): Promise<T> => {
	const chunks: Buffer[] = []
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
	}
	const body = Buffer.concat(chunks).toString("utf8")
	return JSON.parse(body) as T
}

const sendSse = (message: ExtensionMessage) => {
	const payload = `data: ${JSON.stringify(message)}\n\n`
	for (const client of sseClients) {
		client.write(payload)
	}
}

const isExtensionMessage = (value: unknown): value is ExtensionMessage => {
	return !!value && typeof value === "object" && "type" in value
}

host.on("extensionMessage", (message) => sendSse(message))
host.on("extensionWebviewMessage", (message) => {
	if (isExtensionMessage(message)) {
		sendSse(message)
	}
})

const getContentType = (filePath: string): string => {
	if (filePath.endsWith(".html")) return "text/html; charset=utf-8"
	if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8"
	if (filePath.endsWith(".css")) return "text/css; charset=utf-8"
	if (filePath.endsWith(".json")) return "application/json; charset=utf-8"
	if (filePath.endsWith(".svg")) return "image/svg+xml"
	if (filePath.endsWith(".png")) return "image/png"
	if (filePath.endsWith(".woff2")) return "font/woff2"
	if (filePath.endsWith(".woff")) return "font/woff"
	return "application/octet-stream"
}

const serveStatic = async (req: IncomingMessage, res: ServerResponse, requestPath: string) => {
	const relativePath = sanitizeRelativePath(requestPath === "/" ? "/index.html" : requestPath)
	const filePath = path.join(webviewBuildPath, relativePath)

	try {
		const content = await fs.readFile(filePath)
		res.statusCode = 200
		res.setHeader("Content-Type", getContentType(filePath))
		res.end(content)
	} catch (_error) {
		res.statusCode = 404
		res.end("Not found")
	}
}

const start = async () => {
	await host.activate()

	const server = http.createServer(async (req, res) => {
		const method = req.method || "GET"
		const url = new URL(req.url || "/", `http://localhost:${port}`)

		res.setHeader("Access-Control-Allow-Origin", "*")
		res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		res.setHeader("Access-Control-Allow-Headers", "content-type")

		if (method === "OPTIONS") {
			res.statusCode = 204
			res.end()
			return
		}

		if (method === "GET" && url.pathname === "/api/health") {
			sendJson(res, 200, {
				ok: true,
				workspacePath: defaultWorkspacePath,
				extensionDistPath,
				webviewBuildPath,
			})
			return
		}

		if (method === "GET" && url.pathname === "/api/events") {
			res.statusCode = 200
			res.setHeader("Content-Type", "text/event-stream")
			res.setHeader("Cache-Control", "no-cache")
			res.setHeader("Connection", "keep-alive")
			res.write("retry: 2000\n\n")
			sseClients.add(res)
			req.on("close", () => {
				sseClients.delete(res)
			})
			return
		}

		if (method === "POST" && url.pathname === "/api/message") {
			try {
				const message = await readJsonBody<WebviewMessage>(req)
				host.sendToExtension(message)
				sendJson(res, 202, { accepted: true })
			} catch (error) {
				sendJson(res, 400, { accepted: false, error: error instanceof Error ? error.message : String(error) })
			}
			return
		}

		await serveStatic(req, res, url.pathname)
	})

	server.listen(port, () => {
		console.log(`[standalone] running at http://localhost:${port}`)
		console.log(`[standalone] workspace: ${defaultWorkspacePath}`)
		console.log(`[standalone] open: http://localhost:${port}/?standalone=1`)
	})
}

void start()
