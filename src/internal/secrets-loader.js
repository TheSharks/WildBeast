if (process.env.SECRETS_LOCATION) {
  require('fs').readdirSync(process.env.SECRETS_LOCATION).forEach(file => {
    process.env[file] = require('fs').readFileSync(`${process.env.SECRETS_LOCATION}/${file}`)
  })
}
