module.exports = {
  getGuildData () {
    return new Promise((resolve, reject) => {
      resolve({
        options: {
          prefix: '!!'
        }
      })
    })
  },
  getPerms () {
    return new Promise((resolve, reject) => {
      resolve({
        users: {
          '107904023901777920': 100
        },
        roles: {
          '110462143152803840': 75
        }
      })
    })
  }
}
