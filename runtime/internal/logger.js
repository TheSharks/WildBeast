'use strict'
var Winston = require('winston')
var path = require('path')
var config = require('../../config.json')
var Elasticsearch = require('winston-elasticsearch')

Winston.emitErrs = true

var Logger

if (config.elasticsearch.use === true) {
  var elasticsearch = require('elasticsearch')
  var esTransportOpts = {
    level: 'silly',
    consistency: false,
    client: new elasticsearch.Client(config.elasticsearch.client),
    indexPrefix: 'wildbeast'
  }
  Logger = new Winston.Logger({
    colors: {
      info: 'green',
      warn: 'yellow',
      error: 'red',
      debug: 'blue',
      silly: 'blue'
    },
    transports: [
      new Elasticsearch(esTransportOpts),
      new (Winston.transports.Console)({
        humanReadableUnhandledException: true,
        level: 'verbose',
        colorize: true,
        json: false
      })
    ],
    exitOnError: true
  })
} else {
  Logger = new Winston.Logger({
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
}

exports.Logger = Logger
