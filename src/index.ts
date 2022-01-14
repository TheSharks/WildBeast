import cluster from './structures/cluster'
import dirImport from './utils/dir-import'
import { fatal, info, warn } from './utils/logger'

cluster.on('clusterProcess', ({ clusterProcess }) => {
  clusterProcess.on('ready', () => {
    info('Cluster has reported ready', `Cluster ${clusterProcess.clusterId}`)
  })
  clusterProcess.on('warn', ctx => {
    warn(ctx.error, `Cluster ${clusterProcess.clusterId}`)
  })
});

(async () => {
  await cluster.run()
  info(`Now running ${cluster.clusterCount} clusters with ${cluster.shardsPerCluster} shards on each one`, 'Clustering')
  await dirImport('@(dist|src)/jobs/**/*.cluster.[?jt]s')
})().catch(e => fatal(e, 'Clustering'))
