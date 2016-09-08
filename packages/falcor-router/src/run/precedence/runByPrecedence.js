var Observable = require('../../rx').Observable;
var getExecutableMatches = require('./getExecutableMatches');

/**
 * Sorts and strips the set of available matches given the pathSet.
 */
module.exports = function runByPrecedence(pathSet, matches, actionRunner) {

    // Precendence matching
    var sortedMatches = matches.
        sort(sortByPrecedence);

    var execs = getExecutableMatches(sortedMatches, [pathSet]);

    var setOfMatchedPaths = Observable.
        from(execs.matchAndPaths).
        flatMap(actionRunner).

        // Note: We do not wait for each observable to finish,
        // but repeat the cycle per onNext.
        map(function(actionTuple) {

            return {
                match: actionTuple[0],
                value: actionTuple[1]
            };
        });

    if (execs.unhandledPaths) {
        setOfMatchedPaths = setOfMatchedPaths.
            concat(Observable.of({
                match: {suffix: []},
                value: {
                    isMessage: true,
                    unhandledPaths: execs.unhandledPaths
                }
            }));
    }

    return setOfMatchedPaths;
};

function sortByPrecedence(a, b) {

    var aPrecedence = a.precedence;
    var bPrecedence = b.precedence;

    if (aPrecedence < bPrecedence) {
        return 1;
    } else if (aPrecedence > bPrecedence) {
        return -1;
    }

    return 0;
}