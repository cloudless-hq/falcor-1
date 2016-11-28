var getCoreRunner = require('./../getCoreRunner');
var cacheGenerator = require('./../CacheGenerator');
var jsonGraph = require('@graphistry/falcor-json-graph');
var Model = require('./../../lib').Model;
var atom = jsonGraph.atom;
var ref = jsonGraph.ref;
var _ = require('lodash');
var expect = require('chai').expect;
var toFlatBuffer = require('@graphistry/falcor-path-utils').toFlatBuffer;
var computeFlatBufferHash = require('@graphistry/falcor-path-utils').computeFlatBufferHash;

describe('Missing', function() {

    var missingCache = function() {
        return {
            missing: ref(['toMissing']),
            multi: {
                0: ref(['toMissing0']),
                1: {
                    0: ref(['toMissing1'])
                }
            }
        };
    };

    describe('JSON', function() {
        it('should report a missing ref and a missing leaf.', function() {
            getCoreRunner({
                input: [['missing', 'title'], ['multi', 1, 'title']],
                output: { },
                requestedMissingPaths: [['missing', 'title'], ['multi', 1, 'title']],
                optimizedMissingPaths: [['toMissing', 'title'], ['multi', 1, 'title']],
                cache: missingCache
            });
        });
        it('should report a missing path through references.', function() {
            getCoreRunner({
                input: [['multi', {to: 1}, 0, 'title']],
                output: { },
                requestedMissingPaths: [
                    ['multi', 0, 0, 'title'],
                    ['multi', 1, 0, 'title']
                ],
                optimizedMissingPaths: [
                    ['toMissing0', 0, 'title'],
                    ['toMissing1', 'title']
                ],
                cache: missingCache
            });
        });
        it('should report fully materialized values.', function() {
            getCoreRunner({
                input: [
                    ['missing', 'title'],
                    ['multi', {to: 1}, 'title'],
                    ['multi', {to: 1}, {to: 1}, 'title']
                ],
                materialize: true,
                output: {
                    json: {
                        missing: {
                            title: { $type: 'atom' }
                        },
                        multi: {
                            0: {
                                title: { $type: 'atom' },
                                0: { title: { $type: 'atom' } },
                                1: { title: { $type: 'atom' } }
                            },
                            1: {
                                title: { $type: 'atom' },
                                0: { title: { $type: 'atom' } },
                                1: { title: { $type: 'atom' } }
                            }
                        }
                    }
                },
                cache: missingCache
            });
        });
        it('should report missing paths through many complex keys.', function() {
            getCoreRunner({
                input: [[{to:1}, {to:1}, {to:1}, 'summary']],
                output: { },
                optimizedMissingPaths: [
                    [0, 0, 0, 'summary'],
                    [0, 0, 1, 'summary'],
                    [0, 1, 0, 'summary'],
                    [0, 1, 1, 'summary'],
                    [1, 0, {to: 1}, 'summary'],
                    [1, 1, {to: 1}, 'summary'],
                ],
                cache: {
                    0: {
                        0: {
                            // Missing Leaf
                            0: { title: '0', },
                            1: { title: '1', }
                        },
                        1: {
                            // Missing Branch
                            3: { title: '2', },
                            4: { title: '3', }
                        }
                    },
                    // Missing complex key.
                    1: { length: 1 }
                }
            });
        });

        describe('Recycled JSON', function() {
            it('should report fully materialized values.', function() {
                getCoreRunner({
                    input: [
                        ['missing', 'title'],
                        ['multi', {to: 1}, 'title'],
                        ['multi', {to: 1}, {to: 1}, 'title']
                    ],
                    materialize: true,
                    recycleJSON: true,
                    output: {
                        json: {
                            missing: {
                                title: { $type: 'atom' }
                            },
                            multi: {
                                0: {
                                    title: { $type: 'atom' },
                                    0: { title: { $type: 'atom' } },
                                    1: { title: { $type: 'atom' } }
                                },
                                1: {
                                    title: { $type: 'atom' },
                                    0: { title: { $type: 'atom' } },
                                    1: { title: { $type: 'atom' } }
                                }
                            }
                        }
                    },
                    cache: missingCache
                });
            });
            it('should report missing paths through many complex keys.', function() {
                getCoreRunner({
                    input: [[{to:1}, {to:1}, {to:1}, 'summary']],
                    output: { },
                    recycleJSON: true,
                    optimizedMissingPaths: [
                        [0, 0, 0, 'summary'],
                        [0, 0, 1, 'summary'],
                        [0, 1, 0, 'summary'],
                        [0, 1, 1, 'summary'],
                        [1, 0, {from: 0, length: 2}, 'summary'],
                        [1, 1, {from: 0, length: 2}, 'summary'],
                    ],
                    cache: {
                        0: {
                            0: {
                                // Missing Leaf
                                0: { title: '0', },
                                1: { title: '1', }
                            },
                            1: {
                                // Missing Branch
                                3: { title: '2', },
                                4: { title: '3', }
                            }
                        },
                        // Missing complex key.
                        1: { length: 1 }
                    }
                });
            });
            it('should report partial JSON and missing paths through many complex keys.', function() {

                var model = new Model({
                    recycleJSON: true,
                    cache: {
                        0: {
                            0: {
                                // Missing Leaf
                                0: { title: '0', },
                                1: { title: '1', }
                            },
                            1: {
                                // Missing Branch
                                3: { title: '2', },
                                4: { title: '3', }
                            }
                        },
                        // Missing complex key.
                        1: { length: 1 }
                    }
                });

                var x = model._getPathValuesAsPathMap(
                    model,
                    [[{to:1}, {to:1}, {to:1}, ['title', 'summary']]],
                    {}
                ).data;

                x.json[ƒ_meta] = x.json[ƒ_meta];
                x.json[0][ƒ_meta] = x.json[0][ƒ_meta];
                x.json[0][0][ƒ_meta] = x.json[0][0][ƒ_meta];
                x.json[0][0][0][ƒ_meta] = x.json[0][0][0][ƒ_meta];
                x.json[0][0][1][ƒ_meta] = x.json[0][0][1][ƒ_meta];

                expect(x).to.deep.equals({
                    json: {
                        [ƒ_meta]: {
                            '$code':          '__incomplete__',
                            [ƒm_keys]:        { 0: true },
                            [ƒm_abs_path]:    undefined,
                            [ƒm_deref_from]:  undefined,
                            [ƒm_deref_to]:    undefined,
                            [ƒm_version]:     0
                        },
                        0: {
                            [ƒ_meta]: {
                                '$code':          '__incomplete__',
                                [ƒm_keys]:        { 0: true },
                                [ƒm_abs_path]:    ['0'],
                                [ƒm_deref_from]:  undefined,
                                [ƒm_deref_to]:    undefined,
                                [ƒm_version]:     0
                            },
                            0: {
                                [ƒ_meta]: {
                                    '$code':          '__incomplete__',
                                    [ƒm_keys]:        { 0: true, 1: true },
                                    [ƒm_abs_path]:    ['0', '0'],
                                    [ƒm_deref_from]:  undefined,
                                    [ƒm_deref_to]:    undefined,
                                    [ƒm_version]:     0
                                },
                                0: {
                                    [ƒ_meta]: {
                                        '$code':          '__incomplete__',
                                        [ƒm_keys]:        { title: true },
                                        [ƒm_abs_path]:    ['0', '0', '0'],
                                        [ƒm_deref_from]:  undefined,
                                        [ƒm_deref_to]:    undefined,
                                        [ƒm_version]:     0
                                    },
                                    title: '0'
                                },
                                1: {
                                    [ƒ_meta]: {
                                        '$code':          '__incomplete__',
                                        [ƒm_keys]:        { title: true },
                                        [ƒm_abs_path]:    ['0', '0', '1'],
                                        [ƒm_deref_from]:  undefined,
                                        [ƒm_deref_to]:    undefined,
                                        [ƒm_version]:     0
                                    },
                                    title: '1'
                                }
                            }
                        }
                    }
                });
            });
        });
    });

    describe('JSONGraph', function() {
        it('should report a missing ref and a missing leaf.', function() {
            getCoreRunner({
                isJSONG: true,
                input: [['missing', 'title'], ['multi', 1, 'title']],
                output: {
                    jsonGraph: {
                        missing: ref(['toMissing'])
                    }
                },
                requestedMissingPaths: [['missing', 'title'], ['multi', 1, 'title']],
                optimizedMissingPaths: [['toMissing', 'title'], ['multi', 1, 'title']],
                cache: missingCache
            });
        });
        it('should report a missing path through references.', function() {
            getCoreRunner({
                isJSONG: true,
                input: [['multi', {to: 1}, 0, 'title']],
                output: {
                    jsonGraph: {
                        multi: {
                            0: ref(['toMissing0']),
                            1: {
                                0: ref(['toMissing1'])
                            }
                        }
                    }
                },
                requestedMissingPaths: [
                    ['multi', 0, 0, 'title'],
                    ['multi', 1, 0, 'title']
                ],
                optimizedMissingPaths: [
                    ['toMissing0', 0, 'title'],
                    ['toMissing1', 'title']
                ],
                cache: missingCache
            });
        });
        it('should report fully materialized values.', function() {
            getCoreRunner({
                isJSONG: true,
                input: [
                    ['missing', 'title'],
                    ['multi', {to: 1}, 'title'],
                    ['multi', {to: 1}, {to: 1}, 'title']
                ],
                materialize: true,
                output: {
                    paths: [
                        ['missing', 'title'],
                        ['multi', '0', 'title'],
                        ['multi', '1', 'title'],
                        ['multi', '0', {'to': '1'}, 'title'],
                        ['multi', '1', '0', 'title'],
                        ['multi', '1', '1', 'title']
                    ],
                    jsonGraph: {
                        missing: ref(['toMissing']),
                        multi: {
                            0: ref(['toMissing0']),
                            1: {
                                title: { $type: 'atom' },
                                0: ref(['toMissing1']),
                                1: { title: { $type: 'atom' } },
                            }
                        },
                        toMissing: {
                            title: { $type: 'atom' }
                        },
                        toMissing0: {
                            title: { $type: 'atom' },
                            0: { title: { $type: 'atom' } },
                            1: { title: { $type: 'atom' } }
                        },
                        toMissing1: {
                            title: { $type: 'atom' }
                        }
                    }
                },
                cache: missingCache
            });
        });
        it('should report missing paths through many complex keys.', function() {
            getCoreRunner({
                isJSONG: true,
                input: [[{to:1}, {to:1}, {to:1}, 'summary']],
                output: { },
                optimizedMissingPaths: [
                    [0, 0, 0, 'summary'],
                    [0, 0, 1, 'summary'],
                    [0, 1, 0, 'summary'],
                    [0, 1, 1, 'summary'],
                    [1, 0, {to: 1}, 'summary'],
                    [1, 1, {to: 1}, 'summary'],
                ],
                cache: {
                    0: {
                        0: {
                            // Missing Leaf
                            0: { title: '0', },
                            1: { title: '1', }
                        },
                        1: {
                            // Missing Branch
                            3: { title: '2', },
                            4: { title: '3', }
                        }
                    },
                    // Missing complex key.
                    1: { length: 1 }
                }
            });
        });
    });
});

