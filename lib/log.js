var path = require("path");
var winston = require("winston");
var logConf = require("winston-config");

logConf.fromFileSync(path.join(__dirname, "../config/log.json"));

var getLogger = exports.getLogger = function(name) {
    return winston.loggers.get(name);
};

// enable web server logging; pipe those log messages through winston
var winstonStream = exports.winstonStream = {
    write: function(message, encoding) {
        winston.info(message);
    }
};