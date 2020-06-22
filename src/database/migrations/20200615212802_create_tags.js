exports.up = async function (knex) {
  return knex.schema.createTable('tags', table => {
    table.increments('id')
    table.string('name').notNullable()
    table.string('content', 4000).notNullable()
    table.string('owner_id').notNullable()
    table.string('guild_id').notNullable()
    table.boolean('global').notNullable().defaultTo(false)
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

exports.down = async function (knex) {
  return knex.schema.dropTable('tags')
}
