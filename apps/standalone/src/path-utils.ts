import path from "node:path"

export const sanitizeRelativePath = (requestPath: string): string => {
	const normalized = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "")
	return normalized.startsWith("/") ? normalized.slice(1) : normalized
}
