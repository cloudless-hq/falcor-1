var falcor = require('./../../../falcor.js');
var Model = falcor.Model;
var Expected = require('../../data/expected');
var Values = Expected.Values;
var Complex = Expected.Complex;
var ReducedCache = require('../../data/ReducedCache');
var Cache = require('../../data/Cache');
var M = ReducedCache.MinimalCache;
var Rx = require('rx');
var getTestRunner = require('./../../getTestRunner');
var testRunner = require('./../../testRunner');
var noOp = function() {};
var LocalDataSource = require('../../data/LocalDataSource');
var ErrorDataSource = require('../../data/ErrorDataSource');
var $error = require('./../../../lib/types/error');
var expect = require('chai').expect;
var sinon = require('sinon');
var strip = require('./../../cleanData').stripDerefAndVersionKeys;

describe('DataSource and Cache', function() {
    it('should accept jsonGraph without paths from the datasource', function(done) {
        var mockDataSource = {
            set: function(jsonGraphEnvelope) {
                return Rx.Observable.return({
                    jsonGraph: {
                        titlesById: {
                            0: {
                                rating: 5
                            }
                        }
                    }
                });
            }
        },
        model = new falcor.Model({
            source: mockDataSource
        });
        toObservable(model.
            setValue('titlesById[0].rating', 5)).
            flatMap(function (valueA) {
                return toObservable(model.
                        withoutDataSource().
                        getValue('titlesById[0].rating')).
                    map(function (valueB) {
                        return testRunner.compare(valueB, valueA, 'value after Model.set without paths not equal to same value retrieved from Model.');
                    })
            })
            .subscribe(noOp, done, done);
    });

    describe('Seeds', function() {
        it('should set a value from falcor.', function(done) {
            var model = new Model({cache: M(), source: new LocalDataSource(Cache())});
            var e1 = {
                newValue: '1'
            };
            var e2 = {
                newValue: '2'
            };
            var next = false;
            toObservable(model.
                set(
                    {path: ['videos', 1234, 'summary'], value: e1},
                    {path: ['videos', 766, 'summary'], value: e2})).
                doAction(function(x) {
                    next = true;
                    testRunner.compare({ json: {
                        videos: {
                            1234: {
                                summary: {
                                    newValue: '1'
                                }
                            },
                            766: {
                                summary: {
                                    newValue: '2'
                                }
                            }
                        }
                    }}, strip(x));
                }, noOp, function() {
                    testRunner.compare(true, next, 'Expect to be onNext at least 1 time.');
                }).
                subscribe(noOp, done, done);
        });
        it('should not send a request to the datasource when the same value is set.', function(done) {
            var datasourceSetCalled = false;
            var model = new Model({
                source: new LocalDataSource(Cache(), {
                    onSet: function(x, y, z) {
                        datasourceSetCalled = true;
                        return z;
                    }
                }),
                cache: {
                    videos: {
                        766: { title: 'Die Hard' },
                        1234: { title: 'House of Cards' }
                    }
                }
            });
            var next = false;
            var version1;
            var version0 = model.getVersion();
            toObservable(model.
                set({ path: ['videos', 766, 'title'], value: 'Die Hard' },
                    { path: ['videos', 1234, 'title'], value: 'House of Cards' })).
                doAction(function(x) {
                    next = true;
                    version1 = model.getVersion();
                    testRunner.compare({ json: {
                        videos: {
                            766: { title: 'Die Hard' },
                            1234: { title: 'House of Cards' }
                        }
                    }}, strip(x));
                }, noOp, function() {
                    testRunner.compare(true, next, 'Expect to be onNext at least 1 time.');
                    testRunner.compare(true, datasourceSetCalled, 'Expect data source set to be called.');
                    testRunner.compare(1, version1 - version0, 'Expect version to be incremented only once.');
                }).
                subscribe(noOp, done, done);
        });
        it('should get a complex argument into a single arg.', function(done) {
            var model = new Model({cache: M(), source: new LocalDataSource(Cache())});
            var expected = {
                newValue: '1'
            };
            var next = false;
            toObservable(model.
                set({path: ['genreList', 0, {to: 1}, 'summary'], value: expected})).
                doAction(function(x) {
                    next = true;
                    testRunner.compare({ json: {
                        genreList: {
                            0: {
                                0: {
                                    summary: {
                                        newValue: '1'
                                    }
                                },
                                1: {
                                    summary: {
                                        newValue: '1'
                                    }
                                }
                            }
                        }
                    }}, strip(x));
                }, noOp, function() {
                    testRunner.compare(true, next, 'Expect to be onNext at least 1 time.');
                }).
                subscribe(noOp, done, done);
        });
        it('should perform multiple trips to a dataSource.', function(done) {
            var count = 0;
            var onSet = sinon.spy(function(source, tmp, jsongEnv) {
                count++;
                if (count === 1) {

                    // Don't do it this way, it will cause memory leaks.
                    model._root.cache.genreList[1][1] = undefined;
                    return {
                        jsonGraph: jsongEnv.jsonGraph,
                        paths: [jsongEnv.paths[0]]
                    };
                }
                return jsongEnv;
            });
            var model = new Model({
                source: new LocalDataSource(Cache(), {
                    onSet: onSet
                })
            });
            var onNext = sinon.spy();
            toObservable(model.
                set(
                    {path: ['genreList', 0, 0, 'summary'], value: 1337},
                    {path: ['genreList', 1, 1, 'summary'], value: 7331})).
                doAction(onNext, noOp, function() {
                    expect(onSet.calledTwice, 'onSet to be called 2x').to.be.ok;
                    expect(onNext.calledOnce, 'onNext to be called 1x').to.be.ok;
                    expect(strip(onNext.getCall(0).args[0])).to.deep.equals({
                        json: {
                            genreList: {
                                0: {
                                    0: {
                                        summary: 1337
                                    }
                                },
                                1: {
                                    1: {
                                        summary: 7331
                                    }
                                }
                            }
                        }
                    });
                }).
                subscribe(noOp, done, done);
        });
    });

    it('should ensure that the jsong sent to server is optimized.', function(done) {
        var model = new Model({
            cache: Cache(),
            source: new LocalDataSource(Cache(), {
                onSet: function(source, tmp, jsongEnv) {
                    sourceCalled = true;
                    testRunner.compare({
                        jsonGraph: {
                            videos: {
                                1234: {
                                    summary: 5
                                }
                            }
                        },
                        paths: [['videos', 1234, 'summary']]
                    }, jsongEnv);
                    return jsongEnv;
                }
            })
        });
        var called = false;
        var sourceCalled = false;
        toObservable(model.
            set({path: ['genreList', 0, 0, 'summary'], value: 5})).
            doAction(function(x) {
                called = true;
            }, noOp, function() {
                testRunner.compare(true, called, 'Expected onNext to be called');
                testRunner.compare(true, sourceCalled, 'Expected source.set to be called.');
            }).
            subscribe(noOp, done, done);
    });

    it('should ensure that the jsong sent to server is optimized with a null last key.', function(done) {
        var model = new Model({
            cache: Cache(),
            source: new LocalDataSource(Cache(), {
                onSet: function(source, tmp, jsongEnv) {
                    sourceCalled = true;
                    testRunner.compare({
                        jsonGraph: {
                            videos: {
                                1234: {
                                    summary: 5
                                }
                            }
                        },
                        paths: [['videos', 1234, 'summary']]
                    }, jsongEnv);
                    return jsongEnv;
                }
            })
        });
        var called = false;
        var sourceCalled = false;
        toObservable(model.
            set({path: ['genreList', 0, 0, 'summary', null], value: 5})).
            doAction(function(x) {
                called = true;
            }, noOp, function() {
                testRunner.compare(true, called, 'Expected onNext to be called');
                testRunner.compare(true, sourceCalled, 'Expected source.set to be called.');
            }).
            subscribe(noOp, done, done);
    });

    it('should project an error from the datasource.', function(done) {
        var model = new Model({
            source: new ErrorDataSource(503, 'Timeout'),
            errorSelector: function mapError(path, value) {
                value.$foo = 'bar';
                return value;
            }
        });
        var called = false;
        toObservable(model.
            boxValues().
            set({path: ['genreList', 0, 0, 'summary'], value: 5})).
            doAction(function(x) {
                expect(false, 'onNext should not be called.').to.be.ok;
            }, function(e) {
                called = true;
                testRunner.compare([{
                    path: ['genreList', 0, 0, 'summary'],
                    value: {
                        $type: $error,
                        $foo: 'bar',
                        value: {
                            message: 'Timeout',
                            status: 503
                        }
                    }
                }], e, {strip: ['$size']});
            }, function() {
                expect(false, 'onNext should not be called.').to.be.ok;
            }).
            subscribe(noOp, function(e) {
                if (Array.isArray(e) && e[0].value.$foo === 'bar' && called) {
                    done();
                    return;
                }
                done(e);
            }, noOp);
    });
});
