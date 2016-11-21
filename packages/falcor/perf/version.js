var _ = require('lodash');
var benchmark = require('benchmark');
var TriggerDataSource = require("./TriggerDataSource");
var createCacheWith100Videos = require('./createCacheWith100Videos');
var head = require('../lib/internal/head');
var tail = require('../lib/internal/tail');
var next = require('../lib/internal/next');
var prev = require('../lib/internal/prev');

function noop() {}

var f_meta = require('../internalKeyDefinitions')['ƒ_meta'];

module.exports = _.zip(
        runTestsWithModel(require('falcor/dist/falcor.browser.min').Model, '@netflix/falcor   '),
        runTestsWithModel(require('../dist/falcor.min').Model,             '@graphistry/falcor')
    )
    .reduce(function(suite, tests) {
        return tests.reduce(function(suite, test) {
            return test && suite.add(test.name, test.runner) || suite;
        }, suite);
    }, new benchmark.Suite('Get Version Tests'));

function runTestsWithModel(ModelClass, ModelName) {


    var derefInfo = { $__path: ['lists', 'A', '0'] };
    derefInfo[f_meta] = { abs_path: ['lists', 'A', '0'] };

    var memoizedBoundModel = new ModelClass({
        cache: createCacheWith100Videos()
    }).deref(derefInfo);

    return [{
        name: ModelName + ' getVersion',
        runner: function() {
            memoizedBoundModel.getVersion();
        }
    }];
}
