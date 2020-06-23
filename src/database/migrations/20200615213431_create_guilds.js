exports.up = async function (knex) {
  return knex.schema.createTable('guilds', table => {
    table.string('guild_id').primary().notNullable()
    table.text('imported_tags', 'longtext').notNullable().defaultsTo(JSON.stringify([]))
  })
}

exports.down = async function (knex) {
  return knex.schema.dropTable('guilds')
}
