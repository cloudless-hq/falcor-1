var getCoreRunner = require('./../getCoreRunner');
var cacheGenerator = require('./../CacheGenerator');
var toTree = require('@graphistry/falcor-path-utils').toTree;
var jsonGraph = require('@graphistry/falcor-json-graph');
var atom = jsonGraph.atom;
var ref = jsonGraph.ref;
var $ref = require('./../../lib/types/ref');
var $atom = require('./../../lib/types/atom');
var _ = require('lodash');
var Model = require('./../../falcor.js').Model;

describe('Edges', function() {
    // PathMap ----------------------------------------
    it('should report nothing on empty keyset.', function() {
        getCoreRunner({
            input: [['videos', [], 'title']],
            output: { },
            cache: cacheGenerator(0, 1)
        });
    });
    it('should report nothing on empty range.', function() {
        getCoreRunner({
            input: [['videos', {from: 0, to: -1}, 'title']],
            output: { },
            cache: cacheGenerator(0, 1)
        });
        getCoreRunner({
            input: [['videos', {from: 10, length: 0}, 'title']],
            output: { },
            cache: cacheGenerator(0, 1)
        });
        getCoreRunner({
            isJSONG: true,
            input: [['videos', {from: 0, to: -1}, 'title']],
            output: { },
            cache: cacheGenerator(0, 1)
        });
        getCoreRunner({
            isJSONG: true,
            input: [['videos', {from: 10, length: 0}, 'title']],
            output: { },
            cache: cacheGenerator(0, 1)
        });
    });
    it('should report nothing on empty range inside a keyset.', function() {
        getCoreRunner({
            input: [['videos', [{from: 0, to: -1}], 'title']],
            output: { },
            cache: cacheGenerator(0, 1)
        });
        getCoreRunner({
            input: [['videos', [{from: 10, length: 0}], 'title']],
            output: { },
            cache: cacheGenerator(0, 1)
        });
        getCoreRunner({
            isJSONG: true,
            input: [['videos', [{from: 0, to: -1}], 'title']],
            output: { },
            cache: cacheGenerator(0, 1)
        });
        getCoreRunner({
            isJSONG: true,
            input: [['videos', [{from: 10, length: 0}], 'title']],
            output: { },
            cache: cacheGenerator(0, 1)
        });
    });
    it('should not report an atom of undefined in non-materialize mode.', function() {
        getCoreRunner({
            input: [['videos']],
            output: { },
            cache: {
                videos: atom(undefined)
            }
        });
    });
    it('should not report an atom of undefined in non-materialize mode.', function() {
        getCoreRunner({
            input: [['user'], ['gen']],
            output: {
                jsonGraph: {
                    user: {
                        $type: $atom,
                        $hello: 'world',
                        value: 5
                    },
                    gen: 5
                },
                paths: [['user'], ['gen']]
            },
            isJSONG: true,
            cache: {
                user: {
                    $type: $atom,
                    $hello: 'world',
                    value: 5
                },
                gen: 5
            }
        });
    });
    it('should get out a relative expired item.', function() {
        getCoreRunner({
            stripMetadata: false,
            input: [['videos', 1234, 'title']],
            output: {
                json: {
                    [f_meta_data]: {
                        [f_meta_abs_path]: undefined,
                        [f_meta_version]: 0,
                        [f_meta_status]: 'resolved'

                    },
                    videos: {
                        [f_meta_data]: {
                            [f_meta_abs_path]: ['videos'],
                            [f_meta_version]: 0,
                            [f_meta_status]: 'resolved'
                        },
                        1234: {
                            [f_meta_data]: {
                                [f_meta_abs_path]: ['videos', 1234],
                                [f_meta_version]: 0,
                                [f_meta_status]: 'resolved'
                            },
                            title: 'Running Man'
                        }
                    }
                }
            },
            cache: {
                videos: {
                    1234: {
                        title: {
                            $type: $atom,
                            $expires: -60000,
                            value: 'Running Man'
                        }
                    }
                }
            }
        });
    });
    it('should not get out an expired item.', function() {
        getCoreRunner({
            input: [['videos', 1234, 'title']],
            output: { },
            requestedMissingPaths: [['videos', 1234, 'title']],
            cache: {
                videos: {
                    1234: {
                        title: {
                            $type: $atom,
                            $expires: Date.now() - 1000,
                            value: 'Running Man'
                        }
                    }
                }
            }
        });
    });
    it('should not get out an expired item through references.', function() {
        getCoreRunner({
            input: [['videos', 1234, 'title']],
            output: { },
            requestedMissingPaths: [['videos', 1234, 'title']],
            cache: {
                to: {
                    $type: $ref,
                    $expires: Date.now() - 1000,
                    value: ['videos']
                },
                videos: {
                    title: 'Running Man'
                }
            }
        });
    });
    describe('Recycle JSON', function() {
        it('should not get out an expired item.', function() {
            getCoreRunner({
                input: [['videos', 1234, 'title']],
                output: { },
                recycleJSON: true,
                requestedMissingPaths: [['videos', 1234, 'title']],
                cache: {
                    videos: {
                        1234: {
                            title: {
                                $type: $atom,
                                $expires: Date.now() - 1000,
                                value: 'Running Man'
                            }
                        }
                    }
                }
            });
        });
        it('should not get out an expired item through references.', function() {
            getCoreRunner({
                input: [['videos', 1234, 'title']],
                output: { },
                recycleJSON: true,
                requestedMissingPaths: [['videos', 1234, 'title']],
                cache: {
                    to: {
                        $type: $ref,
                        $expires: Date.now() - 1000,
                        value: ['videos']
                    },
                    videos: {
                        title: 'Running Man'
                    }
                }
            });
        });
    });
});

