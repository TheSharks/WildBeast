const k8s = require('../../internal/k8s-scaling')

module.exports = {
  fn: async () => {
    await k8s.determine()
  },
  interval: (3600000 * 6),
  runCheck: () => !!process.env.WILDBEAST_K8S_AUTOSCALE
}
