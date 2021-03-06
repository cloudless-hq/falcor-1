var R = require('../../../src/Router');
var Routes = require('./../../data');
var noOp = function() {};
var chai = require('chai');
var expect = chai.expect;
var falcor = require('@graphistry/falcor');
var $ref = falcor.Model.ref;
var $atom = falcor.Model.atom;
var Scheduler = require('rxjs').Scheduler;
var Observable = require('rxjs').Observable;
var Promise = require('promise');

describe('Collapse and Batch', function() {
    it('should ensure that collapse is being run.', function(done) {
        var videos = Routes().Videos.Integers.Summary(function(path) {
            expect(path.concat()).to.deep.equal(['videos', [0, 1], 'summary']);
        });
        var genreLists = Routes().Genrelists.Ranges(function(incomingPaths) {
            expect(incomingPaths.concat()).to.deep.equal(['genreLists', [{from: 0, to: 1}]]);
        }, 0, true);
        var router = new R(videos.concat(genreLists));
        var obs = router.
            get([['genreLists', [0, 1], 'summary']]);
        var called = false;
        obs.
            do(function(res) {
                expect(res).to.deep.equals({
                    paths: [['genreLists', {'from': 0, 'to': 1}, 'summary']],
                    jsonGraph: {
                        genreLists: {
                            0: $ref('videos[0]'),
                            1: $ref('videos[1]')
                        },
                        videos: {
                            0: {
                                summary: 'Some Movie 0'
                            },
                            1: {
                                summary: 'Some Movie 1'
                            }
                        }
                    }
                });
                called = true;
            }, noOp, function() {
                expect(called, 'expect onNext called 1 time.').to.equal(true);
            }).
            subscribe(noOp, done, done);
    });

    it('should validate that paths are run in parallel, not sequentially.', function(done) {
        var calls;
        var serviceCalls = 0;
        var testedTwo = false;
        function called(res) {
            if (!calls) {
                calls = [];
            }
            calls[calls.length] = res;
            serviceCalls++;
            process.nextTick(function() {
                if (calls.length === 0) {
                    return;
                }

                expect(serviceCalls).to.equal(2);
                expect(calls.length).to.equal(2);
                calls.length = 0;
                testedTwo = true;
            });
        }
        var routes = [{
            route: 'one[{integers:ids}]',
            get: function(aliasMap) {
                return Observable.
                    from(aliasMap.ids).
                    delay(50).
                    map(function(id) {
                        if (id === 0) {
                            return {
                                path: ['one', id],
                                value: $ref('two.be[956]')
                            };
                        }
                        return {
                            path: ['one', id],
                            value: $ref('three.four[111]')
                        };
                    });
            }
        }, {
            route: 'two.be[{integers:ids}].summary',
            get: function(aliasMap) {
                called(1);
                return Observable.
                    from(aliasMap.ids).
                    delay(200).
                    map(function(id) {
                        return {
                            path: ['two', 'be', id, 'summary'],
                            value: 'hello world'
                        };
                    });
            }
        }, {
            route: 'three.four[{integers:ids}].summary',
            get: function(aliasMap) {
                called(2);
                return Observable.
                    from(aliasMap.ids).
                    delay(200).
                    map(function(id) {
                        return {
                            path: ['three', 'four', id, 'summary'],
                            value: 'hello saturn'
                        };
                    });
            }
        }];
        var router = new R(routes);
        var obs = router.
            get([['one', [0, 1], 'summary']]);
        var count = 0;
        var time = Date.now();
        obs.
            do(function(res) {
                var nextTime = Date.now();
                expect(nextTime - time >= 400).to.equal(false);
                count++;
            }, noOp, function() {
                expect(count, 'expect onNext called 1 time.').to.equal(1);
                expect(testedTwo, 'process.nextTick').to.equal(true);
            }).
            subscribe(noOp, done, done);
    });

    it('should validate that optimizedPathSets strips out already found data and collapse makes one request.', function(done) {
        var serviceCalls = 0;
        var routes = [{
            route: 'lists[{keys:ids}]',
            get: function(aliasMap) {
                return Observable.
                    from(aliasMap.ids).
                    map(function(id) {
                        if (id === 0) {
                            return {
                                path: ['lists', id],
                                value: $ref('two.be[956]')
                            };
                        }
                        return {
                            path: ['lists', id],
                            value: $ref('lists[0]')
                        };
                    }).

                    // Note: this causes the batching to work.
                    toArray();
            }
        }, {
            route: 'two.be[{integers:ids}].summary',
            get: function(aliasMap) {
                return Observable.
                    from(aliasMap.ids).
                    map(function(id) {
                        serviceCalls++;
                        return {
                            path: ['two', 'be', id, 'summary'],
                            value: 'hello world'
                        };
                    });
            }
        }];
        var router = new R(routes);
        var obs = router.
            get([['lists', [0, 1], 'summary']]);
        var count = 0;
        obs.
            do(function(res) {
                expect(res).to.deep.equals({
                    paths: [['lists', {from: 0, to: 1}, 'summary']],
                    jsonGraph: {
                        lists: {
                            0: $ref('two.be[956]'),
                            1: $ref('lists[0]')
                        },
                        two: {
                            be: {
                                956: {
                                    summary: 'hello world'
                                }
                            }
                        }
                    }
                });
                count++;
            }, noOp, function() {
                expect(count, 'expect onNext called 1 time.').to.equal(1);
                expect(serviceCalls).to.equal(1);
            }).
            subscribe(noOp, done, done);
    });

    xit('should validate that optimizedPathSets strips out already found data and collapse makes two requests.', function(done) {
        var serviceCalls = 0;
        var routes = [{
            route: 'lists[{keys:ids}]',
            get: function(aliasMap) {
                return Observable.
                    from(aliasMap.ids).
                    map(function(id) {
                        if (id === 0) {
                            return {
                                path: ['lists', id],
                                value: $ref('lists[1]')
                            };
                        }
                        return {
                            path: ['lists', id],
                            value: $ref('two.be[956]')
                        };
                    });
            }
        }, {
            route: 'two.be[{integers:ids}].summary',
            get: function(aliasMap) {
                serviceCalls++;
                return Observable.
                    from(aliasMap.ids).
                    map(function(id) {
                        return {
                            path: ['two', 'be', id, 'summary'],
                            value: 'hello world'
                        };
                    });
            }
        }];
        var router = new R(routes);
        var obs = router.
            get([['lists', [0, 1], 'summary']]);
        var count = 0;
        obs.
            do(function(res) {
                expect(res).to.deep.equals({
                    paths: [['lists', {from: 0, to: 1}, 'summary']],
                    jsonGraph: {
                        lists: {
                            0: $ref('lists[1]'),
                            1: $ref('two.be[956]')
                        },
                        two: {
                            be: {
                                956: {
                                    summary: 'hello world'
                                }
                            }
                        }
                    }
                });
                count++;
            }, noOp, function() {
                expect(count, 'expect onNext called 1 time.').to.equal(1);
                expect(serviceCalls).to.equal(2);
            }).
            subscribe(noOp, done, done);
    });

    it('should validate that a Promise that emits an array gets properly batched.', function(done) {
        var serviceCalls = 0;
        var routes = [{
            route: 'promise[{integers:ids}]',
            get: function(aliasMap) {
                return new Promise(function(resolve) {
                    var pVs = aliasMap.ids.map(function(id) {
                        return {
                            path: ['promise', id],
                            value: $ref(['two', 'be', id, 'summary'])
                        };
                    });

                    resolve(pVs);
                });
            }
        }, {
            route: 'two.be[{integers:ids}].summary',
            get: function(aliasMap) {
                serviceCalls++;
                return aliasMap.ids.map(function(id) {
                    return {
                        path: ['two', 'be', id, 'summary'],
                        value: 'hello promise'
                    };
                });
            }
        }];
        var router = new R(routes);
        router.
            get([['promise', [0, 1], 'summary']]).
            do(noOp, noOp, function() {
                expect(serviceCalls).to.equal(1);
            }).
            subscribe(noOp, done, done);
    });
});
