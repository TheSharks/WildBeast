/**
 * Track connections (Redis clients, sockets, ...) created during a test so
 * they can all be torn down in one afterEach call.
 */
export function connectionPool<T extends { disconnect(): void }>(
  factory: () => T,
): { connect(): T; disconnectAll(): void } {
  const connections: T[] = []
  return {
    connect(): T {
      const connection = factory()
      connections.push(connection)
      return connection
    },
    disconnectAll(): void {
      for (const connection of connections) {
        connection.disconnect()
      }
      connections.length = 0
    },
  }
}
