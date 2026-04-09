import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, FileText, Folder, RefreshCw, Save } from "lucide-react"

import type { ExtensionMessage } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { Button } from "@src/components/ui"
import { vscode } from "@src/utils/vscode"

interface WorkspaceEditorViewProps {
	onDone: () => void
}

interface DirectoryEntry {
	name: string
	path: string
	type: "file" | "folder"
}

const normalizePath = (input: string) => input.replace(/\\/g, "/")

export const WorkspaceEditorView = ({ onDone }: WorkspaceEditorViewProps) => {
	const { cwd } = useExtensionState()

	const [currentDir, setCurrentDir] = useState("")
	const [directoryEntries, setDirectoryEntries] = useState<DirectoryEntry[]>([])
	const [directoryError, setDirectoryError] = useState<string | null>(null)
	const [isDirectoryLoading, setIsDirectoryLoading] = useState(false)

	const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
	const [originalFileContent, setOriginalFileContent] = useState("")
	const [editedFileContent, setEditedFileContent] = useState("")
	const [fileError, setFileError] = useState<string | null>(null)
	const [isFileLoading, setIsFileLoading] = useState(false)
	const [saveStatus, setSaveStatus] = useState<string | null>(null)

	const loadDirectory = useCallback((relativePath: string) => {
		setIsDirectoryLoading(true)
		setDirectoryError(null)
		vscode.postMessage({ type: "listDirectory", text: relativePath })
	}, [])

	const loadFile = useCallback((relativePath: string) => {
		setSelectedFilePath(relativePath)
		setFileError(null)
		setSaveStatus(null)
		setIsFileLoading(true)
		vscode.postMessage({ type: "readFileContent", text: relativePath })
	}, [])

	const saveFile = useCallback(() => {
		if (!selectedFilePath) {
			return
		}
		setSaveStatus(null)
		vscode.postMessage({
			type: "saveFileContent",
			text: selectedFilePath,
			values: { content: editedFileContent },
		})
	}, [selectedFilePath, editedFileContent])

	const openInVsCode = useCallback(() => {
		if (!selectedFilePath) {
			return
		}
		vscode.postMessage({ type: "openFile", text: selectedFilePath })
	}, [selectedFilePath])

	const handleMessage = useCallback((e: MessageEvent) => {
		const message = e.data as ExtensionMessage

		if (message.type === "directoryListing") {
			const payload = message.values as
				| {
						path?: string
						entries?: DirectoryEntry[]
						error?: string
				  }
				| undefined

			setIsDirectoryLoading(false)
			setDirectoryError(payload?.error ?? null)

			if (typeof payload?.path === "string" && Array.isArray(payload?.entries)) {
				setCurrentDir(normalizePath(payload.path))
			}

			if (Array.isArray(payload?.entries)) {
				setDirectoryEntries(payload.entries)
			} else if (!payload?.error) {
				setDirectoryEntries([])
			}
		}

		if (message.type === "fileContent" && message.fileContent) {
			const { path, content, error } = message.fileContent
			const normalizedPath = normalizePath(path)
			if (!selectedFilePath || normalizedPath !== normalizePath(selectedFilePath)) {
				return
			}

			setIsFileLoading(false)

			if (error) {
				setFileError(error)
				return
			}

			const resolvedContent = content ?? ""
			setOriginalFileContent(resolvedContent)
			setEditedFileContent(resolvedContent)
			setFileError(null)
		}

		if (message.type === "fileSaveResult") {
			const payload = message.values as { path?: string; success?: boolean; error?: string } | undefined
			if (!payload?.path || !selectedFilePath || normalizePath(payload.path) !== normalizePath(selectedFilePath)) {
				return
			}

			if (payload.success) {
				setOriginalFileContent(editedFileContent)
				setSaveStatus("Saved")
				setFileError(null)
			} else {
				setSaveStatus(null)
				setFileError(payload.error || "Failed to save file")
			}
		}
	}, [editedFileContent, selectedFilePath])

	useEffect(() => {
		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [handleMessage])

	useEffect(() => {
		loadDirectory("")
	}, [loadDirectory])

	const hasUnsavedChanges = useMemo(
		() => !!selectedFilePath && editedFileContent !== originalFileContent,
		[selectedFilePath, editedFileContent, originalFileContent],
	)

	return (
		<div className="fixed inset-0 flex flex-col overflow-hidden">
			<div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-vscode-panel-border">
				<div className="flex items-center gap-2 min-w-0">
					<Button variant="ghost" size="sm" onClick={onDone}>
						<ChevronLeft className="size-4 mr-1" />
						Back to Chat
					</Button>
					<div className="text-sm text-vscode-descriptionForeground truncate">
						Workspace: {cwd || "No workspace"}
					</div>
				</div>
				<Button variant="secondary" size="sm" onClick={() => loadDirectory(currentDir)} disabled={isDirectoryLoading}>
					<RefreshCw className="size-4 mr-1" />
					Refresh
				</Button>
			</div>

			<div className="flex grow min-h-0 overflow-hidden">
				<div className="w-[38%] min-w-[220px] border-r border-vscode-panel-border flex flex-col min-h-0">
					<div className="px-3 py-2 border-b border-vscode-panel-border text-xs text-vscode-descriptionForeground truncate">
						/{currentDir || ""}
					</div>
					<div className="px-2 py-2 overflow-y-auto min-h-0">
						{currentDir && (
							<button
								className="w-full text-left px-2 py-1 rounded hover:bg-vscode-list-hoverBackground text-sm"
								onClick={() => {
									const parent = currentDir.includes("/") ? currentDir.slice(0, currentDir.lastIndexOf("/")) : ""
									loadDirectory(parent)
								}}>
								.. (Parent)
							</button>
						)}
						{isDirectoryLoading ? (
							<div className="px-2 py-1 text-sm text-vscode-descriptionForeground">Loading folders and files...</div>
						) : directoryError ? (
							<div className="px-2 py-1 text-sm text-vscode-errorForeground">{directoryError}</div>
						) : (
							directoryEntries.map((entry) => (
								<button
									key={`${entry.type}:${entry.path}`}
									className="w-full text-left px-2 py-1 rounded hover:bg-vscode-list-hoverBackground text-sm flex items-center gap-2"
									onClick={() => (entry.type === "folder" ? loadDirectory(entry.path) : loadFile(entry.path))}>
									{entry.type === "folder" ? (
										<Folder className="size-4 shrink-0 text-vscode-charts-blue" />
									) : (
										<FileText className="size-4 shrink-0 text-vscode-descriptionForeground" />
									)}
									<span className="truncate">{entry.name}</span>
								</button>
							))
						)}
					</div>
				</div>

				<div className="grow flex flex-col min-w-0 min-h-0">
					<div className="px-3 py-2 border-b border-vscode-panel-border flex items-center justify-between gap-2">
						<div className="text-sm truncate">{selectedFilePath || "Select a file to edit"}</div>
						<div className="flex items-center gap-2">
							{saveStatus && <span className="text-xs text-vscode-descriptionForeground">{saveStatus}</span>}
							<Button variant="ghost" size="sm" disabled={!selectedFilePath} onClick={openInVsCode}>
								Open in VS Code
							</Button>
							<Button variant="secondary" size="sm" disabled={!hasUnsavedChanges} onClick={saveFile}>
								<Save className="size-4 mr-1" />
								Save
							</Button>
						</div>
					</div>
					{fileError && <div className="px-3 py-2 text-sm text-vscode-errorForeground">{fileError}</div>}
					<div className="grow min-h-0 p-3">
						<textarea
							className="w-full h-full resize-none bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded px-3 py-2 text-sm font-mono outline-none focus:border-vscode-focusBorder"
							value={editedFileContent}
							onChange={(e) => setEditedFileContent(e.target.value)}
							placeholder={selectedFilePath ? "Edit file content..." : "Choose a file from the left panel."}
							disabled={!selectedFilePath || isFileLoading}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}

export default WorkspaceEditorView
