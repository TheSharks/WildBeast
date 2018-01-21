const driver = require('../internal/database-selector')
const masters = process.env['WILDBEAST_MASTERS'].split('|')

module.exports = {
  calculate: (guild, member) => {
    return new Promise((resolve, reject) => {
      if (masters.indexOf(member.id) > -1) return resolve(Infinity)
      driver.getPerms(guild).then(data => {
        let result = data[member.id] || 0
        for (let role in data.roles) {
          result = (result > 0 && data.roles[role] > result || data.roles[role] < 0) ? data.roles[role] : result // eslint-disable-line
        } // FIXME: trash
        return resolve(result)
      })
    })
  }
}
