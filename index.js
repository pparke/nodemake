#!/usr/bin/env node

var spawn       = require('child_process').spawn;
var exec        = require('child_process').exec;
var fs          = require('fs');
var path        = require('path');
var Q           = require('q');
var _           = require('underscore');
var program     = require('commander');
var pkg         = require(path.join(__dirname, 'package.json'));



program.version(pkg.version)
       .option('-d, --debug', 'Print debug information.')
       .option('-v, --verbose', 'Print long form descriptions.')
       .parse(process.argv);

// setup print
var logger = require('./lib/logger')({
  debug: program.debug,
  verbose: program.verbose
});

// check if file nodemake.json exists
if (!fs.existsSync('nodemake.json')) {
  logger.error('nodemake.json does not exist!');
  process.exit(1);
}

var config = JSON.parse(fs.readFileSync('nodemake.json', 'utf8'));


//var cc              = config.cc;
//var cflags          = config.cflags.split(' ');
//var name            = config.name;
//var todelete        = name + ' *.o';
var libs            = '';
var defaultGoal     = config.defaultGoal || 'all';

var targets         = config.targets;
var targetKeys      = Object.keys(targets);
var targetsToBuild  = [];
var built           = [];
var count           = targetKeys.length;

// check if a name has been declared for each build target
// and if not assign the target key as the name
_.each(targets, function(target, key) {
  if (!target.name) {
    target.name = key;
  }
});

var substitutes = config.variables;

// substitute the defined values for their placeholders
_.each(substitutes, function(sub, subKey) {
  var search = new RegExp('(\\$' + subKey + ')(\\W)|(\\$' + subKey + ')($)', 'g');
  var value = sub + '$2';
  _.each(targets, function(target, targetKey){
    _.each(target, function(field, fieldKey){
        targets[targetKey][fieldKey] = targets[targetKey][fieldKey].replace(search, value);
    });
  });
});


// get all of the targets that need to be built based on the default goal
if (targets[defaultGoal]) {
  // get the prerequisites
  var currentTarget = targets[defaultGoal];
  var stages        = [];
  var stage         = [];
  // this will be the last stage to build
  stage.push(currentTarget);
  stages.push(stage);

  var done = false;

  while(!done) {
    var nextStage = [];
    stage.forEach(function(target) {

      logger.debug('checking prerequisites for %s', target.name);
      // get the prerequisites for this target
      var prerequisites = target.prerequisites.split(' ');
      prerequisites.reduce(function(prev, prereq) {

        // if there is a target defined for this prerequisite
        // it will have to be built as part of the next build stage
        // we will also check it for its own prerequisites
        if (targetKeys.indexOf(prereq) > -1) {
          prev.push(targets[prereq]);
          return prev;
        }

        // otherwise it might be an existing file in which case
        // we'll safely ignore it as long as it exists
        if (fs.existsSync(prereq)) {
          return prev;
        }

        // not a target and doesn't already exist, stop
        logger.error('No rule to make target %s', prereq);
        process.exit(1);
      }, nextStage);
    });
    // check if there's more work to do
    if(nextStage.length > 0){
      // add to the stages that will be built
      stages.push(nextStage);
      // setup next iteration
      stage = nextStage;
      nextStage = [];
    } else {
      done = true;
    }
  }
} else {
  logger.error('No default goal found!');
  process.exit(1);
}

// start with base requirements
stages = stages.reverse();

// draw a tree of the stages if debug is on
if (program.debug) {
  logger.debug('\u250c stages:');
  stages.forEach(function(stage, i) {
    // branch is either vertical and right or up and right
    var branch = i+1 !== stages.length ? '\u251c' : '\u2514';
    // stem is either vertical or empty
    var stem = i+1 !== stages.length ? '\u2502' : ' ';
    stage.forEach(function(substage, j) {
      var lines = '';
      if (j === 0) {
        lines += branch;
        lines += stage.length === 1 ? '\u2500' : '\u252c';
      } else {
        lines += stem;
        lines += j+1 !== stage.length ? '\u251c' : '\u2514'
      }
      logger.debug('%s %s', lines, substage.name)
    });
  });
}


var buildSequence = [];
// build each of the targets in each of the stages in turn
stages.forEach(function(stage) {
  stage.forEach(function(target) {
    logger.debug('Examining target %s', target.name);
    // check if the target file exists
    if (fs.existsSync(target.name)) {
      var targetMTime = fs.statSync(target.name).mtime;
      // check if any of the prerequisites are newer than the target
      var prerequisites = target.prerequisites.split(' ');
      var doBuild = prerequisites.some(function(prereq) {
        logger.debug('Checking file %s', prereq);
        if (fs.existsSync(prereq)){
          var prereqMTime = fs.statSync(prereq).mtime;
          var newer = targetMTime.getTime() < prereqMTime.getTime();
          logger.debug('%s is %s than %s', prereq, newer ? 'newer' : 'older', target.name);

          var dependedOn = buildSequence.indexOf(prereq) > -1;

          return newer || dependedOn;
        }
      });

      // build if newer
      if (doBuild) {
        buildSequence.push(target);
      }
    // target has not been built yet, must build
    } else {
      buildSequence.push(target);
    }
  });
});

if (program.debug) {
  logger.debug('sequence %s', buildSequence.map(function(target){return target.name;}).join(' \u279c '));
}

// build each of the necessary targets in sequence
var buildChain = buildSequence.reduce(function(prev, target) {
  return prev.then(function() {
    var deferred = Q.defer();

    logger.debug('Building target %s with recipe %s', target.name, target.recipe);
    var compile = exec(target.recipe, function(err, stdout, stderr) {
      if (stdout) {
        logger.info(stdout);
      }
      if (stderr) {
        logger.error(stderr);
      }
      if (err !== null) {
        return deferred.reject(err);
      }
      deferred.resolve();
    })

    return deferred.promise;
  });
}, Q.resolve());

buildChain.then(function(stdout, stderr){
  logger.ok('build succeeded');
})
.fail(function(reason) {
  logger.error('build failed');
  logger.debug(reason);
});
