const joi = require('@hapi/joi')

const schema = joi.object().keys({
  BOT_TOKEN: joi.string().required()
})

const res = joi.validate(process.env, schema, {
  allowUnknown: true
})
if (res.error) logger.error('ENV', chalk`{yellow ${res.error.details[0].message}}`, true)
