import { MIGRATIONS_CHECK_IF_EXISTS, MIGRATIONS_CREATE, MIGRATION_STEP_TEMPLATE } from './constants'
import { Row, RowList } from 'postgres'
import SQL from '../driver'
import { basename, extname, join, resolve } from 'path'
import { writeFile } from 'fs/promises'
import { glob } from 'glob'
import { debug, error, info, trace } from '../../utils/logger'

export interface MigrationStep {
  up: (db: typeof SQL) => Promise<void>
  down: (db: typeof SQL) => Promise<void>
}

export async function setup (): Promise<RowList<Row[]>> {
  await SQL.unsafe(MIGRATIONS_CREATE)
  return await SQL.unsafe(MIGRATIONS_CHECK_IF_EXISTS)
}

export async function check (all = false): Promise<string[]> {
  const files = glob.sync('src/database/migrations/exec/*.ts').map(x => basename(x, extname(x)))
  const exists = await setup()
  const migrations = files.filter(f => !exists.some(e => e.name === f))
  trace([files, exists, migrations])
  return all ? files : migrations
}

export async function create (filename: string = 'unnamed'): Promise<string> {
  const prefix = Date.now() / 1e3 | 0
  const name = `${prefix}-${filename}.ts`
  const dir = resolve(__dirname, './exec')
  const file = join(dir, name)
  await writeFile(file, MIGRATION_STEP_TEMPLATE)
  return name
}

export async function up (): Promise<string[]> {
  const migrations = await check()
  for (const file of migrations) {
    debug(`Trying to 'up' ${file}`, 'Migrations')
    if (Symbol.for('ts-node.register.instance') in process) {
      const { up } = await import(resolve(__dirname, `./exec/${file}.ts`)) as MigrationStep
      await up(SQL)
    } else {
      const { up } = await import(resolve(process.cwd(), `./dist/database/migrations/exec/${file}.js`)) as MigrationStep
      await up(SQL)
    }
    await SQL`INSERT INTO migrations (name) VALUES (${file})`
    info(`Migration ${file} applied`, 'Migrations')
  }
  return migrations
}

export async function down (): Promise<string> {
  const current = await setup()
  const migrations = await check(true)
  const file = current.map(x => x.name).reverse()[0] as string
  if (!migrations.includes(file)) {
    throw new Error(`Migration ${file} not found`)
  }
  debug(`Trying to 'down' ${file}`, 'Migrations')
  if (Symbol.for('ts-node.register.instance') in process) {
    const { down } = await import(resolve(__dirname, `./exec/${file}.ts`)) as MigrationStep
    await down(SQL)
  } else {
    const { down } = await import(resolve(process.cwd(), `./dist/database/migrations/exec/${file}.js`)) as MigrationStep
    await down(SQL)
  }
  await SQL`DELETE FROM migrations WHERE name = ${file}`
  info(`Migration ${file} reverted`, 'Migrations')
  return file
}

export async function cli (fun: string): Promise<void> {
  try {
    switch (fun) {
      case 'up':
        await up()
        break
      case 'down':
        await down()
        break
      case 'create': {
        const val = await create(process.argv[1])
        info(`Created migration ${val}`, 'Migrations')
        break
      }
      default:
        throw new Error(`Unknown function ${fun}`)
    }
  } catch (e) {
    error(e as any, 'Migrations')
  } finally {
    await SQL.end()
    process.exit(0)
  }
}
