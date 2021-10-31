import { ClusterManager } from 'detritus-client'

const IS_TS_NODE = Symbol.for('ts-node.register.instance') in process

// the filename is NOT relative to this file
// but to where the file is being run first
// which in this case is the index.ts file
const manager = new ClusterManager(IS_TS_NODE ? './entry.ts' : './entry.js', process.env.BOT_TOKEN ?? '')

export default manager
