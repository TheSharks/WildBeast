const store = new Map()

module.exports = {
  calculate: (ctx, time) => {
    const now = new Date()
    if (store.has(ctx)) {
      const proxy = new Date(store.get(ctx))
      logger.trace('TIMEOUT', `Timeout: ${ctx}, ${proxy}`)
      const last = proxy.setSeconds(proxy.getSeconds() + time)
      if (now < last) {
        return (last - now) / 1000
      } else {
        store.set(ctx, new Date())
        return true
      }
    } else {
      store.set(ctx, new Date())
      return true
    }
  },
  _store: store
}
