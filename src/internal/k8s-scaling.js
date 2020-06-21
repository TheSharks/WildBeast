const fs = require('fs').promises
const SA = require('superagent')
const client = require('../components/client')
const logger = require('./logger')
const stall = require('util').promisify(setTimeout)

module.exports = {
  keys: {},
  init: async function () {
    logger.log('K8S-SCALE', 'Starting up k8s autonomous scaling...')
    // determine some vars first
    this.keys.namespace = (await fs.readFile('/var/run/secrets/kubernetes.io/serviceaccount/namespace')).toString()
    this.keys.token = (await fs.readFile('/var/run/secrets/kubernetes.io/serviceaccount/token')).toString()
    this.keys.ca = await fs.readFile('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt')
    // whats the name of the replicaset the current pod is owned by?
    this.keys.replicaset = (await SA
      .get(`https://${process.env.KUBERNETES_SERVICE_HOST}/api/v1/namespaces/${this.keys.namespace}/pods/${require('os').hostname()}`)
      .ca(this.keys.ca)
      .set({
        Authorization: `Bearer ${this.keys.token}`
      })).body.metadata.ownerReferences.filter(x => x.kind === 'ReplicaSet')[0].name
    // whats the name of the deployment the replicaset is owned by?
    this.keys.deployment = (await SA
      .get(`https://${process.env.KUBERNETES_SERVICE_HOST}/apis/apps/v1/namespaces/${this.keys.namespace}/replicasets/${this.keys.replicaset}`)
      .ca(this.keys.ca)
      .set({
        Authorization: `Bearer ${this.keys.token}`
      })).body.metadata.ownerReferences.filter(x => x.kind === 'Deployment')[0].name
    logger.debug('K8S-SCALE', `Namespace: ${this.keys.namespace}, ReplicaSet: ${this.keys.replicaset}, Deployment: ${this.keys.deployment}`)
    // do we need to trigger a renegotiation immediatly?
    const workload = await this.getCurrentWorkload()
    if (workload.body.spec.replicas === 1) {
      logger.log('K8S-SCALE', 'Deployment has only 1 replica!')
      const scale = await this.renegotiate()
      while (true) {
        const res = await this.determine(false)
        if (res !== scale) {
          logger.log('K8S-SCALE', 'Retrying in 10 seconds, pod index seems to be inaccurate')
          await stall(10000)
        } else break
      }
    } else {
      logger.log('K8S-SCALE', 'Not renegotiating since workload seems to already be scaled')
      await this.determine(false)
    }
  },
  renegotiate: async function (force = false) {
    // only shard 0 needs to renegotiate
    if (client.options.firstShardID !== 0 && !force) return logger.log('K8S-SCALE', 'Renegotiation cancelled, this client does not manage shard 0')
    logger.log('K8S-SCALE', 'Renegotiating scale...')
    // what scale runs the deployment at right now?
    // ask discord what the recommended shard count is and edit the deployment to start as many replicas as shards
    const discord = await client.getBotGateway()
    const workload = await this.getCurrentWorkload()
    if (discord.shards > workload.body.spec.replicas) {
      logger.log('K8S-SCALE', `Scale inadequate! Discord recommends ${discord.shards} shards but client has ${client.options.maxShards}`)
      logger.log('K8S-SCALE', `Telling k8s to scale Deployment ${this.keys.deployment} to ${discord.shards} replicas...`)
      await this.patchCurrentWorkload(discord.shards)
      logger.log('K8S-SCALE', `Scale changed! New scale is now ${discord.shards}`)
    } else logger.log('K8S-SCALE', 'Scale adequate!')
    return discord.shards
  },
  determine: async function (autoconnect = true) {
    // the index of the workload in the set is needed to determine what shards this client needs to support
    logger.log('K8S-SCALE', 'Determining workload index...')
    const res = await this.getNamespacePods()
    // filter pods int the current namespace based on their owner, since we only care about pods that are in the same replicaset
    const thisworkload = res.body.items.filter(x =>
      x.metadata.ownerReferences.filter(x => x.kind === 'ReplicaSet' && x.name === this.keys.replicaset).length > 0 &&
      ['Pending', 'Running'].includes(x.status.phase)
    ).map(x => x.metadata.name).sort()
    const index = thisworkload.indexOf(require('os').hostname())
    logger.log('K8S-SCALE', `Index determined! This pod is ${index} with ${thisworkload.length} total`)
    if (client.options.maxShards !== thisworkload.length) {
      logger.log('K8S-SCALE', 'This pod is not supporting required shards, reidentifying...')
      client.options.autoreconnect = false
      await client.disconnect()
      client.options.firstShardID = index
      client.options.lastShardID = index
      client.options.maxShards = thisworkload.length
      if (autoconnect) await client.connect()
      client.options.autoreconnect = true
    }
    return thisworkload.length
  },
  getCurrentWorkload: async function () {
    return SA
      .get(`https://${process.env.KUBERNETES_SERVICE_HOST}/apis/apps/v1/namespaces/${this.keys.namespace}/deployments/${this.keys.deployment}`)
      .ca(this.keys.ca)
      .set({
        Authorization: `Bearer ${this.keys.token}`
      })
  },
  getNamespacePods: async function () {
    return SA
      .get(`https://${process.env.KUBERNETES_SERVICE_HOST}/api/v1/namespaces/${this.keys.namespace}/pods`)
      .ca(this.keys.ca)
      .set({
        Authorization: `Bearer ${this.keys.token}`
      })
  },
  patchCurrentWorkload: async function (shards) {
    return SA
      .patch(`https://${process.env.KUBERNETES_SERVICE_HOST}/apis/apps/v1/namespaces/${this.keys.namespace}/deployments/${this.keys.deployment}`)
      .ca(this.keys.ca)
      .set({
        Authorization: `Bearer ${this.keys.token}`,
        'Content-Type': 'application/strategic-merge-patch+json'
      })
      .send({
        spec: { replicas: shards }
      })
  }
}
