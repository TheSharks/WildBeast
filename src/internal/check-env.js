const joi = require('joi')

const schema = joi.object().keys({
  BOT_TOKEN: joi.string().required(),
  BOT_PREFIX: joi.string().required(),
  SENTRY_DSN: joi.string(),
  ENABLE_METRICS: joi.boolean(),
  METRICS_INTERVAL: joi.number(),
  WILDBEAST_MASTERS: joi.string().required().regex(/([0-9]{17,},?)\1?/)
})

const res = schema.validate(process.env, { allowUnknown: true })
if (process.env.WILDBEAST_ENV_CHECK_DISABLED && res.error) logger.warn('ENV', 'Found environment warnings, but checking is disabled!')
else if (res.error) logger.error('ENV', res.error.details[0].message, true)
