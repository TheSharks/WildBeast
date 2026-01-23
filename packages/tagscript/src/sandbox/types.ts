export interface SandboxResult {
  text: string
  attachment?: { data: Uint8Array; type: string }
}

export interface Sandbox {
  execute(code: string): Promise<SandboxResult>
}
