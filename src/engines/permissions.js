const driver = require('../internal/database-selector')
const masters = process.env['WILDBEAST_MASTERS'].split('|')

module.exports = {
  calculate: (guild, member, required) => {
    return new Promise((resolve, reject) => {
      if (masters.includes(member.id)) return resolve(true)
      if (guild === false) return resolve(required <= 0) // no guild = probably DM
      if (guild.ownerID === member.id) return resolve(required <= 10)
      driver.getPerms(guild).then(data => {
        let result = data.roles['everyone'] || 0
        if (data.users[member.id] && data.users[member.id] > result) result = data.users[member.id]
        for (let role in data.roles) {
          if (result < 0) break
          if (member.roles.includes(role)) {
            if (data.roles[role] > result) result = data.roles[role]
            if (data.roles[role] < 0) result = data.roles[role]
          }
        }
        return resolve((result < 0) ? null : result >= required)
      }).catch(reject)
    })
  },
  modify: (guild, target, value, type = 'users') => {
    value = (value === '0' ? null : value) // setting values to null deletes them, saving data
    return driver.edit(guild.id, {
      perms: {
        [type]: {
          [target]: value
        }
      }
    })
  },
  modifyBulk: (guild, data) => {
    return driver.edit(guild.id, {
      perms: data
    })
  }
}
