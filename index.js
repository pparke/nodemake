#!/usr/bin/env node

var spawn       = require('child_process').spawn;
var exec        = require('child_process').exec;
var fs          = require('fs');
var path        = require('path');
var Q           = require('q');
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
var stuck           = false;

// check if a name has been declared for each build target
// and if not assign the target key as the name
for (var key in targets) {
  if (targets.hasOwnProperty(key)){
    var target = targets[key];
    if (!target.name) {
      target.name = key;
    }
  }
}

var substitutes = config.variables;

// substitute the defined values for their placeholders
for (var sub in substitutes){
  if (substitutes.hasOwnProperty(sub)){
    var search = new RegExp('(\\$' + sub + ')(\\W)|(\\$' + sub + ')($)', 'g');
    var value = substitutes[sub] + '$2';
    for (var key in targets) {
      if (targets.hasOwnProperty(key)){
        var target = targets[key];
        for (var key2 in target){
          if (target.hasOwnProperty(key2)){
            targets[key][key2] = targets[key][key2].replace(search, value);
          }
        }
      }
    }
  }
}

logger.debug('targets are now', targets)


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
        // we will also check it for it's own prerequisites
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

logger.debug('stages', stages);

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


var buildChain = buildSequence.reduce(function(prev, target) {
  return prev.then(function() {
    var deferred = Q.defer();

    logger.debug('Building target %s', target.name);
    var command   = target.recipe.split(' ')[0];
    var args      = target.recipe.split(' ').slice(1);
    //logger.debug('command is %s, args are %s', command, args);
    var compile   = spawn(command, args);

    var out = 'STDOUT: ';
    var err = 'STDERR: ';

    compile.stdout.on('data', function(data) {
      out += data.toString();
    });

    compile.stderr.on('data', function(data) {
      err += data.toString();
    });

    compile.on('close', function(code) {
      logger.info(out);
      logger.error(err);
      if (err) {
        //deferred.reject();
        deferred.resolve();
      } else {
        deferred.resolve();
      }
    });

    return deferred.promise;
  });
}, Q.resolve());

buildChain.then(function(){
  logger.ok('build succeeded');
})
.fail(function(reason) {
  logger.error('build failed', reason);
});

/*
process.exit(0);

compile.stdout.pipe(process.stdout);
compile.stderr.pipe(process.stdout);

*/
