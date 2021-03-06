var falcor = require('./../../../falcor.js');
var Model = falcor.Model;
var noOp = function() {};
var expect = require('chai').expect;
var sinon = require('sinon');
var LocalDataSource = require('./../../data/LocalDataSource');
var Cache = require('./../../data/Cache');
var strip = require('./../../cleanData').stripDerefAndVersionKeys;

describe('DataSource Only', function() {
    it('should validate args are sent to the dataSource collapsed.', function(done) {
        var onSet = sinon.spy(function(source, tmpGraph, jsonGraphFromSet) {
            return jsonGraphFromSet;
        });
        var dataSource = new LocalDataSource(Cache(), {
            onSet: onSet
        });
        var model = new Model({
            source: dataSource
        });

        toObservable(model.
            set({
                json: {
                    videos: {
                        1234: {
                            rating: 5
                        },
                        444: {
                            rating: 3
                        }
                    }
                }
            })).
            doAction(noOp, noOp, function() {
                expect(onSet.calledOnce).to.be.ok;
                var cleaned = onSet.getCall(0).args[2];
                cleaned.paths[0][1] = cleaned.paths[0][1].concat();
                expect(cleaned).to.deep.equals({
                    jsonGraph: {
                        videos: {
                            1234: {
                                rating: 5
                            },
                            444: {
                                rating: 3
                            }
                        }
                    },
                    paths: [
                        ['videos', [444, 1234], 'rating']
                    ]
                });
            }).
            subscribe(noOp, done, done);
    });

    it('set and send an an empty string to the server.', function(done) {
        var onSet = sinon.spy(function(source, tmpGraph, jsonGraphFromSet) {
            return jsonGraphFromSet;
        });
        var dataSource = new LocalDataSource(Cache(), {
            onSet: onSet
        });
        var model = new Model({
            source: dataSource
        });
        toObservable(model.
            setValue('videos[1234].another_prop', '')).
            doAction(noOp, noOp, function() {
                expect(onSet.calledOnce).to.be.ok;
                var cleaned = onSet.getCall(0).args[2];
                expect(cleaned).to.deep.equals({
                    jsonGraph: {
                        videos: {
                            1234: {
                                another_prop: ''
                            }
                        }
                    },
                    paths: [
                        ['videos', 1234, 'another_prop']
                    ]
                });
            }).
            subscribe(noOp, done, done);
    });

    it('should set and send an undefined value to the server.', function(done) {
        var onSet = sinon.spy(function(source, tmpGraph, jsonGraphFromSet) {
            return jsonGraphFromSet;
        });
        var dataSource = new LocalDataSource(Cache(), {
            onSet: onSet
        });
        var model = new Model({
            source: dataSource
        });
        toObservable(model.
            set({
                json: {
                    videos: {
                        1234: {
                            another_prop: undefined
                        }
                    }
                }
            })).
            doAction(noOp, noOp, function() {
                expect(onSet.calledOnce, 'expected datasource set to be called').to.equal(true);
                var cleaned = onSet.getCall(0).args[2];
                expect(cleaned).to.deep.equals({
                    jsonGraph: {
                        videos: {
                            1234: {
                                another_prop: {
                                    $type: 'atom'
                                }
                            }
                        }
                    },
                    paths: [
                        ['videos', 1234, 'another_prop']
                    ]
                });
            }).
            subscribe(noOp, done, done);
    });

    it('should set and send an atom of undefined to the server.', function(done) {
        var onSet = sinon.spy(function(source, tmpGraph, jsonGraphFromSet) {
            return jsonGraphFromSet;
        });
        var dataSource = new LocalDataSource(Cache(), {
            onSet: onSet
        });
        var model = new Model({
            source: dataSource
        });
        toObservable(model.
            set({
                json: {
                    videos: {
                        1234: {
                            another_prop: {
                                $type: 'atom'
                            }
                        }
                    }
                }
            })).
            doAction(noOp, noOp, function() {
                expect(onSet.calledOnce, 'expected datasource set to be called').to.equal(true);
                var cleaned = onSet.getCall(0).args[2];
                expect(cleaned).to.deep.equals({
                    jsonGraph: {
                        videos: {
                            1234: {
                                another_prop: {
                                    $type: 'atom'
                                }
                            }
                        }
                    },
                    paths: [
                        ['videos', 1234, 'another_prop']
                    ]
                });
            }).
            subscribe(noOp, done, done);
    });

    it('should report paths progressively.', function(done) {
        var onSet = function(source, tmpGraph, jsonGraphFromSet) {
            jsonGraphFromSet.jsonGraph.videos[444].rating = 5;
            return jsonGraphFromSet;
        };
        var dataSource = new LocalDataSource(Cache(), {
            onSet: onSet
        });
        var model = new Model({
            source: dataSource
        });

        var count = 0;
        toObservable(model.
            set({
                json: {
                    videos: {
                        1234: {
                            rating: 5
                        },
                        444: {
                            rating: 3
                        }
                    }
                }
            }).
            progressively()).
            doAction(function(x) {
                if (count === 0) {
                    expect(strip(x)).to.deep.equals({
                        json: {
                            videos: {
                                1234: {
                                    rating: 5
                                },
                                444: {
                                    rating: 3
                                }
                            }
                        }
                    });
                }

                else {
                    expect(strip(x)).to.deep.equals({
                        json: {
                            videos: {
                                1234: {
                                    rating: 5
                                },
                                444: {
                                    rating: 5
                                }
                            }
                        }
                    });
                }

                count++;
            }, noOp, function() {
                expect(count, 'expected onNext to be called twice').to.equal(2);
            }).
            subscribe(noOp, done, done);
    });
});
