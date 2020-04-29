const required = [ // this is the absolute minimum required to run wildbeast
  'BOT_TOKEN',
  'BOT_PREFIX',
  'WILDBEAST_MASTERS'
]

for (const x of required) {
  if (!process.env[x]) {
    global.logger.error(`Missing environment variable ${x}`, true)
  }
}
