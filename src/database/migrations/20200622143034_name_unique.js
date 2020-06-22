exports.up = async function (knex) {
  return knex.schema.alterTable('tags', table => {
    table.unique('name')
  })
}

exports.down = async function (knex) {
  return knex.schema.alterTable('tags', table => {
    table.dropUnique('name')
  })
}
