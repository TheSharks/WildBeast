import type { Client, SessionInfo } from 'discord.js'

// Like session persistence, this uses discord.js's internal @discordjs/ws manager.
export async function stopGatewayForHandoff(client: Client): Promise<void> {
  if (!('_ws' in client.ws)) {
    throw new Error(
      'discord.js internals changed: handoff needs WebSocketManager#_ws',
    )
  }
  const ws = client.ws as unknown as {
    destroyed: boolean
    _ws: {
      options: {
        updateSessionInfo(id: number, session: SessionInfo | null): unknown
      }
      destroy(options: { code: number; reason: string }): Promise<void>
    } | null
  }
  const manager = ws._ws
  if (!manager) return
  const updateSessionInfo = manager.options.updateSessionInfo
  // A destroy without recovery clears local session info even with a resumable
  // close code. Keep the final sequence, including updates during teardown.
  manager.options.updateSessionInfo = (id, session) => {
    if (session !== null) return updateSessionInfo(id, session)
  }
  ws.destroyed = true
  try {
    // 4200 preserves the remote session. Omit recovery so this worker cannot reconnect.
    await manager.destroy({ code: 4200, reason: 'Shard ownership handoff' })
  } finally {
    manager.options.updateSessionInfo = updateSessionInfo
  }
}
