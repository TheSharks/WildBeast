const joi = require('@hapi/joi')

const schema = joi.object().keys({
  BOT_TOKEN: joi.string().required().regex(/[a-zA-Z0-9]{24}\.[a-zA-Z0-9]{6}\.[a-zA-Z0-9]{27}/),
  BOT_PREFIX: joi.string().required(),
  SENTRY_DSN: joi.string()
})

const res = joi.validate(process.env, schema, {
  allowUnknown: true
})
if (process.env.WILDBEAST_ENV_CHECK_DISABLED && res.error) logger.warn('ENV', 'Found environment warnings, but checking is disabled!')
else if (res.error) logger.error('ENV', res.error.details[0].message, true)
