const store = new Map()

module.exports = {
  calculate: (id, handle, time) => {
    const now = new Date()
    const opts = `${id}:${handle}`
    if (store.has(opts)) {
      const proxy = new Date(store.get(opts))
      global.logger.trace(`Timeout: ${opts}, ${proxy}`)
      const last = proxy.setSeconds(proxy.getSeconds() + time)
      if (now < last) {
        return (last - now) / 1000
      } else {
        store.set(opts, new Date())
        return true
      }
    } else {
      store.set(opts, new Date())
      return true
    }
  },
  _store: store
}
