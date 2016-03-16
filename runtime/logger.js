var Winston = require('winston');

// Chat Logger

Winston.emitErrs = true;

exports.ChatLog = new Winston.Logger({
  transports: [
    new (require('winston-daily-rotate-file'))({
      level: 'info',
      filename: __dirname + '/../logs/chatlog',
      json: false,
      datePattern: '-dd-MM-yyyy.log'
    })
  ]
});

exports.DebugModeLog = new Winston.Logger({
  transports: [
    new (require('winston-daily-rotate-file'))({
      level: 'debug',
      filename: __dirname + '/../logs/debugmodelog',
      json: false,
      datePattern: '-dd-MM-yyyy.log'
    })
  ]
});

exports.VerboseModeLog = new Winston.Logger({
  transports: [
    new (require('winston-daily-rotate-file'))({
      level: 'info',
      datePattern: '-dd-MM-yyyy.log',
      json: false,
      filename: __dirname + '/../logs/verbosemodelog'
    })
  ]
});

// Command Error Logger

exports.Logger = new Winston.Logger({
  colors: {
    verbose: 'orange',
    debug: 'blue',
    info: 'green',
    warn: 'yellow',
    error: 'red'
  },
  transports: [
    new (require('winston-daily-rotate-file'))({
      humanReadableUnhandledException: true,
      name: 'file:exceptions',
      filename: __dirname + '/../logs/exceptions',
      datePattern: '-dd-MM-yyyy.log',
      level: 'exception',
      json: false
    }),
    new (require('winston-daily-rotate-file'))({
      name: 'file:error',
      filename: __dirname + '/../logs/errors',
      datePattern: '-dd-MM-yyyy.log',
      level: 'error',
      json: false
    }),
    new (require('winston-daily-rotate-file'))({
      name: 'file:console',
      filename: __dirname + '/../logs/console',
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
});
