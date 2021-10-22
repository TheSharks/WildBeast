import postgres from 'postgres'
import { trace } from '../utils/logger'

export default postgres(process.env.DATABASE_URL ?? 'postgres://localhost:5432/test', {
  onnotice: (message) => {
    trace(message, 'Postgres')
  }
})
