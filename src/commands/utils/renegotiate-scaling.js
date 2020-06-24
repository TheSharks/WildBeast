const Command = require('../../classes/Command')

module.exports = new Command(async msg => {
  const scaling = require('../../internal/k8s-scaling')
  if (!process.env.WILDBEAST_K8S_AUTOSCALE) return msg.channel.createMessage('K8S scaling is disabled!')
  await msg.channel.sendTyping()
  const newscale = await scaling.renegotiate(true)
  await msg.channel.createMessage(`Scale renegotiated to ${newscale}, this shard will now reidentify`)
  await scaling.determine()
}, {
  hidden: true,
  prereqs: ['masterUser']
})
