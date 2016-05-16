'use strict'
var Winston = require('winston')
var path = require('path')

// Chat Logger

Winston.emitErrs = true

exports.ChatLog = new Winston.Logger({
  transports: [
    new (require('winston-daily-rotate-file'))({
      level: 'info',
      filename: path.resolve(__dirname, '..', '..', 'logs/chatlog'),
      json: false,
      datePattern: '-dd-MM-yyyy.log'
    })
  ]
})

exports.DebugLog = new Winston.Logger({
  transports: [
    new (require('winston-daily-rotate-file'))({
      level: 'info',
      filename: path.resolve(__dirname, '..', '..', 'logs/debuglog'),
      json: false,
      datePattern: '-dd-MM-yyyy.log'
    })
  ]
})

// Command Error Logger

exports.Logger = new Winston.Logger({
  colors: {
    info: 'green',
    warn: 'yellow',
    error: 'red',
    debug: 'blue',
    silly: 'blue'
  },
  transports: [
    new (require('winston-daily-rotate-file'))({
      humanReadableUnhandledException: true,
      name: 'file:exceptions',
      filename: path.resolve(__dirname, '..', '..', 'logs/exceptions'),
      datePattern: '-dd-MM-yyyy.log',
      level: 'exception',
      json: false
    }),
    new (require('winston-daily-rotate-file'))({
      name: 'file:error',
      filename: path.resolve(__dirname, '..', '..', 'logs/errors'),
      datePattern: '-dd-MM-yyyy.log',
      level: 'error',
      json: false
    }),
    new (require('winston-daily-rotate-file'))({
      name: 'file:console',
      filename: path.resolve(__dirname, '..', '..', 'logs/console'),
      datePattern: '-dd-MM-yyyy.log',
      level: 'debug',
      json: false
    }),
    new (Winston.transports.Console)({
      humanReadableUnhandledException: true,
      level: 'verbose',
      colorize: true,
      json: false
    })
  ],
  exitOnError: true
})
