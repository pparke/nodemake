var chalk       = require('chalk');


module.exports = function loggerSetup(options) {

  var debugOn   = options.debug || false;
  var verboseOn = options.verbose || false;
  var silentOn  = options.silent || false;

  var logger = {
    log: function log(){
      console.log.apply(console, arguments);
    },

    warn: function warn(text){
      var args = argsToArray(arguments);
      var toLog = [chalk.yellow.underline("\u26A0 " + text)].concat(args.slice(1));
      console.log.apply(console, toLog);
    },

    error: function error(text){
      var args = argsToArray(arguments);
      var toLog = [chalk.white.bgRed("\u2620 " + text)].concat(args.slice(1));
      console.log.apply(console, toLog);
    },

    ok: function ok(text){
      var args = argsToArray(arguments);
      var toLog = [chalk.green("\u2714 ") + chalk.gray(text)].concat(args.slice(1));
      console.log.apply(console, toLog);
    },

    fail: function fail(text){
      var args = argsToArray(arguments);
      var toLog = [chalk.red("\u2718 ") + chalk.gray(text)].concat(args.slice(1));
      console.log.apply(console, toLog);
    },

    debug: function debug(text){
      if (debugOn){
        var args = argsToArray(arguments);
        var toLog = [chalk.blue("\u21dd ") + chalk.gray(text)].concat(args.slice(1));
        console.log.apply(console, toLog);
      }
    },

    info: function info(text){
      var args = argsToArray(arguments);
      var toLog = [chalk.cyan("\u2691 ") + chalk.grey(text)].concat(args.slice(1));
      console.log.apply(console, toLog);
    },

    cow: function cow(text){
      var args = argsToArray(arguments);
      var toLog = [chalk.white("\ud83d\udc2e \uD83D\uDDE9 ") + chalk.grey(text)].concat(args.slice(1));
      console.log.apply(console, toLog);
    }
  };

  return logger;
};

function argsToArray(args) {
  var arr = [];
  for (var i = 0; i < args.length; i++){
    arr.push(args[i]);
  }
  return arr;
}
