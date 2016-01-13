var Winston = require('winston');

// Chat Logger

Winston.emitErrs = true;

exports.ChatLog = new Winston.Logger({
  transports: [
    new Winston.transports.DailyRotateFile({
      handleExceptions: false,
      name: 'file:chat',
      filename: __dirname + '/../logs/chat',
      datePattern: '-dd-MM-yyyy.log',
      formatter: function(args) { return args.message; },
      level: 'info',
      json: false
    })
  ]
});

exports.DebugModeLog = new Winston.Logger({
  transports: [
    new Winston.transports.DailyRotateFile({
      handleExceptions: false,
      name: 'file:debugmodelog',
      filename: __dirname + '/../logs/debugmodelog',
      datePattern: 'debugmodelog-dd-MM-yyyy.log',
      formatter: function(args) { return args.message; },
      level: 'debug',
      json: false
    })
  ]
});

exports.VerboseModeLog = new Winston.Logger({
  transports: [
    new Winston.transports.DailyRotateFile({
      handleExceptions: false,
      name: 'file:verbosemodelog',
      filename: __dirname + '/../logs/verbosemodelog',
      datePattern: 'verbosemodelog-dd-MM-yyyy.log',
      formatter: function(args) { return args.message; },
      level: 'debug',
      json: false
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
    new Winston.transports.DailyRotateFile({
      humanReadableUnhandledException: true,
      handleExceptions: true,
      name: 'file:exceptions',
      filename: __dirname + '/../logs/exceptions',
      datePattern: '-dd-MM-yyyy.log',
      level: 'exception',
      json: false
    }),
    new Winston.transports.DailyRotateFile({
      handleExceptions: false,
      name: 'file:error',
      filename: __dirname + '/../logs/errors',
      datePattern: '-dd-MM-yyyy.log',
      level: 'error',
      json: false
    }),
    new Winston.transports.DailyRotateFile({
    	handleExceptions: false,
    	name: 'file:console',
    	filename: __dirname + '/../logs/console',
    	datePattern: '-dd-MM-yyyy.log',
    	level: 'debug',
    	json: false
    }),
    new Winston.transports.Console({
    	handleExceptions: true,
    	level: 'verbose',
    	colorize: true,
    	json: false
    })
  ],
  exitOnError: true
});
