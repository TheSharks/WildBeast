const knex = require('../../components/knex')

module.exports = {
  get: async (name) => {
    return await knex
      .select('*')
      .from('tags')
      .where({ name })
  },
  delete: async (name) => {
    return await knex
      .from('tags')
      .where({ name })
      .del()
  },
  create: async (ctx) => {
    return await knex
      .insert(ctx)
      .into('tags')
  },
  edit: async (ctx) => {
    return await knex
      .from('tags')
      .where({ id: ctx.id })
      .update(ctx)
  }
}
