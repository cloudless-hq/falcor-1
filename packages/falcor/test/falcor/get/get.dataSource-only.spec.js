var falcor = require('./../../../falcor.js');
var Model = falcor.Model;
var Observable = require('rx').Observable;
var noOp = function() {};
var LocalDataSource = require('../../data/LocalDataSource');
var ErrorDataSource = require('../../data/ErrorDataSource');
var isPathValue = require('./../../../lib/support/isPathValue');
var expect = require('chai').expect;
var sinon = require('sinon');
var TestCache = require('./../../data/Cache');
var cacheGenerator = require('./../../CacheGenerator');
var atom = require('@graphistry/falcor-json-graph').atom;
var MaxRetryExceededError = require('./../../../lib/errors/MaxRetryExceededError');
var strip = require('./../../cleanData').stripDerefAndVersionKeys;

describe('DataSource Only', function() {
    var dataSource = new LocalDataSource(cacheGenerator(0, 2, ['title', 'art'], false));

    it('should get all missing paths in a single request', function(done) {
        var serviceCalls = 0;
        var cacheModel = new Model({
            cache: {
                lolomo: {
                    summary: {
                        $type: 'atom',
                        value: 'hello'
                    },
                    0: {
                        summary: {
                            $type: 'atom',
                            value: 'hello-0'
                        }
                    },
                    1: {
                        summary: {
                            $type: 'atom',
                            value: 'hello-1'
                        }
                    },
                    2: {
                        summary: {
                            $type: 'atom',
                            value: 'hello-2'
                        }
                    }
                }
            }
        });
        var model = new Model({ source: {
            get: function(paths) {
                serviceCalls++;
                return cacheModel.get.apply(cacheModel, paths)._toJSONG();
            }
        }});


        var onNext = sinon.spy();
        toObservable(model.
            get('lolomo.summary', 'lolomo[0..2].summary')).
            doAction(onNext, noOp, function() {
                var data = onNext.getCall(0).args[0];
                var json = data.json;
                var lolomo = json.lolomo;
                expect(lolomo.summary).to.be.ok;
                expect(lolomo[0].summary).to.be.ok;
                expect(lolomo[1].summary).to.be.ok;
                expect(lolomo[2].summary).to.be.ok;
                expect(serviceCalls).to.equal(1);
            }).
            subscribe(noOp, done, done);
    });

    it('should report errors from a dataSource.', function(done) {
        var model = new Model({
            source: new ErrorDataSource(500, 'Oops!')
        });
        toObservable(model.
            get(['videos', 0, 'title'])).
            doAction(noOp, function(err) {
                expect(err).to.deep.equals([{
                    path: ['videos', 0, 'title'],
                    value: {
                        message: 'Oops!',
                        status: 500
                    }
                }]);
            }, function() {
                throw new Error('On Completed was called. ' +
                     'OnError should have been called.');
            }).
            subscribe(noOp, function(err) {
                // ensure its the same error
                if (Array.isArray(err) && isPathValue(err[0])) {
                    return done();
                }
                return done(err);
            });
    });

    it('should be able to dispose of getRequests.', function(done) {
        var onGet = sinon.spy();
        var source = new LocalDataSource(cacheGenerator(0, 2), {
            onGet: onGet
        });
        var model = new Model({source: source}).batch();
        var onNext = sinon.spy();
        var disposable = toObservable(model.
            get(['videos', 0, 'title'])).
            doAction(onNext, noOp, function() {
                throw new Error('Should not have completed.');
            }).
            subscribe(noOp, done);

        disposable.dispose();
        setTimeout(function() {
            try {
                expect(onNext.callCount).to.equal(0);
                expect(onGet.callCount).to.equal(0);
            } catch(e) {
                return done(e);
            }
            return done();
        }, 10);
    });

    it('should be able to dispose one of two get requests..', function(done) {
        var onGet = sinon.spy();
        var source = new LocalDataSource(cacheGenerator(0, 2), {
            onGet: onGet
        });
        var model = new Model({source: source}).batch();
        var onNext = sinon.spy();
        var disposable = toObservable(model.
            get(['videos', 0, 'title'])).
            doAction(onNext, noOp, function() {
                throw new Error('Should not have completed.');
            }).
            subscribe(noOp, done);
        var onNext2 = sinon.spy();
        toObservable(model.
            get(['videos', 0, 'title'])).
            doAction(onNext2).
            subscribe(noOp, done);

        disposable.dispose();
        setTimeout(function() {
            try {
                expect(onNext.callCount).to.equal(0);
                expect(onGet.callCount).to.equal(1);
                expect(onNext2.calledOnce, 'onNext2 should have been called').to.be.ok;
                expect(strip(onNext2.getCall(0).args[0])).to.deep.equals({
                    json: {
                        videos: {
                            0: {
                                title: 'Video 0'
                            }
                        }
                    }
                });
            } catch(e) {
                return done(e);
            }
            return done();
        }, 100);
    });
    it('should throw a MaxRetryExceededError.', function(done) {
        var model = new Model({ source: new LocalDataSource({}) });
        toObservable(model.
            get(['videos', 0, 'title'])).
            doAction(noOp, function(e) {
                expect(MaxRetryExceededError.is(e), 'MaxRetryExceededError expected.').to.be.ok;
            }).
            subscribe(noOp, function(e) {
                if (isAssertionError(e)) {
                    return done(e);
                }
                return done();
            }, done.bind('should not complete'));
    });

    describe('Preload Functions', function() {
        it('should get a value from falcor.', function(done) {
            var model = new Model({source: dataSource});
            var onNext = sinon.spy();
            var secondOnNext = sinon.spy();
            toObservable(model.
                preload(['videos', 0, 'title'])).
                doAction(onNext, noOp, function() {
                    expect(onNext.callCount).to.equal(0);
                }).
                defaultIfEmpty({}).
                flatMap(function() {
                    return model.get(['videos', 0, 'title']);
                }).
                doAction(secondOnNext, noOp, function() {
                    expect(secondOnNext.calledOnce).to.be.ok;
                    expect(strip(secondOnNext.getCall(0).args[0])).to.deep.equals({
                        json: {
                            videos: {0: {title: 'Video 0'}}}
                    });
                }).
                subscribe(noOp, done, done);
        });

        it('should perform multiple trips to a dataSource.', function(done) {
            var datasourceGetCount = 0;
            var get = sinon.spy(function(source, paths) {
                datasourceGetCount++;
                if (paths.length === 2) {
                    paths.pop();
                }
            });
            var model = new Model({
                source: new LocalDataSource(cacheGenerator(0, 2, ['title', 'art']), {onGet: get})

            });
            var onNext = sinon.spy();
            var secondOnNext = sinon.spy();
            toObservable(model.
                preload(['videos', 0, 'title'], ['videos', 1, 'art'])).
                doAction(onNext).
                doAction(noOp, noOp, function() {
                    expect(onNext.callCount).to.equal(0);
                    expect(datasourceGetCount).to.equal(2);
                }).
                defaultIfEmpty({}).
                flatMap(function() {
                    return model.get(['videos', 0, 'title']);
                }).
                doAction(secondOnNext).
                doAction(noOp, noOp, function() {
                    expect(datasourceGetCount).to.equal(2);
                    expect(secondOnNext.calledOnce).to.be.ok;
                    expect(strip(secondOnNext.getCall(0).args[0])).to.deep.equals({
                        json: {videos: {0: {title: 'Video 0'}}}
                    });
                }).
                subscribe(noOp, done, done);
        });
    });
    describe('JSON', function() {
        it('should get a value from falcor.', function(done) {
            var model = new Model({source: dataSource});
            var onNext = sinon.spy();
            toObservable(model.
                get(['videos', 0, 'title'])).
                doAction(onNext, noOp, function() {
                    expect(strip(onNext.getCall(0).args[0])).to.deep.equals({
                        json: {videos: {0: {title: 'Video 0'}}}
                    });
                }).
                subscribe(noOp, done, done);
        });
        it('should persist immediately expired values until the next transaction.', function(done) {

            var datasourceGetCount = 0;
            var model = new Model({
                source: new LocalDataSource(TestCache(), {
                    onGet: function() {
                        datasourceGetCount++;
                    }
                })
            });

            var getObs = toObservable(model.
                get(['genreList', 'expires-now', [0, 1], 'summary']));

            Observable.concat(
                Observable.defer(function() {
                    var onNextSpy = sinon.spy();
                    return getObs.doAction(onNextSpy, noOp, validateOnCompleted(1, onNextSpy))
                }),
                Observable.defer(function() {
                    var onNextSpy = sinon.spy();
                    return getObs.doAction(onNextSpy, noOp, validateOnCompleted(2, onNextSpy))
                })
            ).
            subscribe(noOp, done, done);

            function validateOnCompleted(expectedGetCount, onNextSpy) {
                return function() {
                    expect(datasourceGetCount).to.equal(expectedGetCount);
                    expect(strip(onNextSpy.getCall(0).args[0])).to.deep.equals({
                        json: {
                            genreList: {
                                'expires-now': {
                                    0: {
                                        summary: {
                                            'title': 'House of Cards',
                                            'url': '/movies/1234'
                                        }
                                    },
                                    1: {
                                        summary: {
                                            'title': 'Terminator 3',
                                            'url': '/movies/766'
                                        }
                                    }
                                }
                            }
                        }
                    });
                };
            }
        });
    });
    describe('_toJSONG', function() {
        it('should get a value from falcor.', function(done) {
            var model = new Model({source: dataSource});
            var onNext = sinon.spy();
            toObservable(model.
                get(['videos', 0, 'title']).
                _toJSONG()).
                doAction(onNext, noOp, function() {
                    expect(strip(onNext.getCall(0).args[0])).to.deep.equals({
                        jsonGraph: {
                            videos: {
                                0: {
                                    title: atom('Video 0')
                                }
                            }
                        },
                        paths: [['videos', 0, 'title']]
                    });
                }).
                subscribe(noOp, done, done);
        });
    });
});

function isAssertionError(e) {
    return e.hasOwnProperty('expected') && e.hasOwnProperty('actual');
}
