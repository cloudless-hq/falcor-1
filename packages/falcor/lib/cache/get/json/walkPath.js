var isArray = Array.isArray;
var onValue = require("./onValue");
var $ref = require("../../../types/ref");
var FalcorJSON = require("./FalcorJSON");
var onValueType = require("../onValueType");
var isExpired = require("../../isExpired");
var originalOnMissing = require("../onMissing");
var getReferenceTarget = require("./getReferenceTarget");
var NullInPathError = require("../../../errors/NullInPathError");
var InvalidKeySetError = require("../../../errors/InvalidKeySetError");

module.exports = walkPathAndBuildOutput;

/* eslint-disable camelcase */
/* eslint-disable no-cond-assign */
/* eslint-disable no-constant-condition */
function walkPathAndBuildOutput(cacheRoot, node, json, path,
                                depth, seed, results,
                                requestedPath, requestedLength,
                                optimizedPath, optimizedLength,
                                fromReference, referenceContainer,
                                modelRoot, expired, expireImmediate,
                                branchSelector, boxValues, materialized,
                                hasDataSource, treatErrorsAsValues,
                                allowFromWhenceYouCame) {

    var type, refTarget;

    // ============ Check for base cases ================

    // If there's nowhere to go, we've reached a terminal node, or hit
    // the end of the path, stop now. Either build missing paths or report the value.
    if (node === undefined || (
        type = node.$type) || (
        depth === requestedLength)) {
        return onValueType(node, type, json,
                           path, depth, seed, results,
                           requestedPath, requestedLength,
                           optimizedPath, optimizedLength,
                           fromReference, modelRoot, expired, expireImmediate,
                           branchSelector, boxValues, materialized, hasDataSource,
                           treatErrorsAsValues, onValue, onMissing);
    }

    var f_meta;

    var next, nextKey,
        keyset, keyIsRange,
        nextDepth = depth + 1,
        rangeEnd, keysOrRanges,
        nextJSON, nextReferenceContainer,
        keysetIndex = -1, keysetLength = 0,
        nextOptimizedLength, nextOptimizedPath,
        optimizedLengthNext = optimizedLength + 1,
        refContainerAbsPath, refContainerRefPath;

    keyset = path[depth];

    // If `null` appears before the end of the path, throw an error.
    // If `null` is at the end of the path, but the reference doesn't
    // point to a sentinel value, throw an error.
    //
    // Inserting `null` at the end of the path indicates the target of a ref
    // should be returned, rather than the ref itself. When `null` is the last
    // key, the path is lengthened by one, ensuring that if a ref is encountered
    // just before the `null` key, the reference is followed before terminating.
    if (null === keyset) {
        if (nextDepth < requestedLength) {
            throw new NullInPathError();
        }
        return json;
    }

    if (allowFromWhenceYouCame && referenceContainer) {
        refContainerRefPath = referenceContainer.value;
        refContainerAbsPath = referenceContainer[ƒ_abs_path];
    }

    if (json) {
        if (typeof json !== 'object') {
            json = undefined;
        } else if (f_meta = json[ƒ_meta]) {
            f_meta[ƒm_version] = node[ƒ_version];
            f_meta[ƒm_abs_path] = node[ƒ_abs_path];
            f_meta[ƒm_deref_to] = refContainerRefPath;
            f_meta[ƒm_deref_from] = refContainerAbsPath;
        }
    }

    // Iterate over every key in the keyset. This loop is perhaps a bit clever,
    // but we do it this way because this is a performance-sensitive code path.
    // This loop simulates a recursive function if we encounter a Keyset that
    // contains Keys or Ranges. This is accomplished by a nifty dance between an
    // outer loop and an inner loop.
    //
    // The outer loop is responsible for identifying if the value at this depth
    // is a Key, Range, or Keyset. If it encounters a Keyset, the `keysetIndex`,
    // `keysetLength`, and `keysOrRanges` variables are assigned and the outer
    // loop restarts. If it encounters a Key or Range, `nextKey`, `keyIsRange`,
    // and `rangeEnd` are assigned values which signal whether the inner loop
    // should iterate a Range or exit after the first run.
    //
    // The inner loop steps `nextKey` one level down in the cache. If a Range
    // was encountered in the outer loop, the inner loop will iterate until the
    // Range has been exhausted. If a Key was encountered, the inner loop exits
    // after the first execution.
    //
    // After the inner loop exits, the outer loop iterates the `keysetIndex`
    // until the Keyset is exhausted. `keysetIndex` and `keysetLength` are
    // initialized to -1 and 0 respectively, so if a Keyset wasn't encountered
    // at this depth in the path, then the outer loop exits after one execution.

    iteratingKeyset: do {

        // If the keyset is a primitive value, we've found our `nextKey`.
        if ("object" !== typeof keyset) {
            nextKey = keyset;
            rangeEnd = undefined;
            keyIsRange = false;
        }
        // If we encounter a Keyset, either iterate through the Keys and Ranges,
        // or throw an error if we're already iterating a Keyset. Keysets cannot
        // contain other Keysets.
        else if (isArray(keyset)) {
            // If we've already encountered an Array keyset, throw an error.
            if (keysOrRanges !== undefined) {
                throw new InvalidKeySetError(path, keysOrRanges);
            }
            keysetIndex = 0;
            keysOrRanges = keyset;
            keysetLength = keyset.length;
            // If an Array of keys or ranges is empty, terminate the graph walk
            // and return the json constructed so far. An example of an empty
            // Keyset is: ['lolomo', [], 'summary']. This should short circuit
            // without building missing paths.
            if (0 === keysetLength) {
                break iteratingKeyset;
            }
            // Assign `keyset` to the first value in the Keyset. Re-entering the
            // outer loop mimics a singly-recursive function call.
            keyset = keysOrRanges[keysetIndex];
            continue iteratingKeyset;
        }
        // If the Keyset isn't a primitive or Array, then it must be a Range.
        else {
            rangeEnd = keyset.to;
            nextKey = keyset.from || 0;
            if ("number" !== typeof rangeEnd) {
                rangeEnd = nextKey + (keyset.length || 0) - 1;
            }
            if ((rangeEnd - nextKey) < 0) {
                break iteratingKeyset;
            }
            keyIsRange = true;
        }

        // Now that we have the next key, step down one level in the cache.
        do {
            fromReference = false;
            nextJSON = json && json[nextKey];
            nextOptimizedPath = optimizedPath;
            nextOptimizedLength = optimizedLengthNext;
            nextReferenceContainer = referenceContainer;

            next = node[nextKey];
            requestedPath[depth] = nextKey;
            optimizedPath[optimizedLength] = nextKey;

            // If we encounter a ref, inline the reference target and continue
            // evaluating the path.
            if (next &&
                nextDepth < requestedLength &&
                // If the reference is expired, it will be invalidated and
                // reported as missing in the next call to walkPath below.
                next.$type === $ref && !isExpired(next, expireImmediate)) {

                // Retrieve the reference target and next referenceContainer (if
                // this reference points to other references) and continue
                // following the path. If the reference resolves to a missing
                // path or leaf node, it will be handled in the next call to
                // walkPath.
                refTarget = getReferenceTarget(cacheRoot, next, modelRoot, expireImmediate);

                next = refTarget[0];
                fromReference = true;
                nextOptimizedPath = refTarget[1];
                nextReferenceContainer = refTarget[2];
                nextOptimizedLength = nextOptimizedPath.length;
                refTarget[0] = refTarget[1] = refTarget[2] = undefined;
            }

            // Continue following the path

            nextJSON = walkPathAndBuildOutput(
                cacheRoot, next, nextJSON, path, nextDepth, seed,
                results, requestedPath, requestedLength, nextOptimizedPath,
                nextOptimizedLength, fromReference, nextReferenceContainer,
                modelRoot, expired, expireImmediate, branchSelector, boxValues,
                materialized, hasDataSource, treatErrorsAsValues, allowFromWhenceYouCame
            );

            // Inspect the return value from the step and determine whether to
            // create or write into the JSON branch at this level.
            //
            // 1. If the next node was a leaf value, nextJSON is the value.
            // 2. If the next node was a missing path, nextJSON is undefined.
            // 3. If the next node was a branch, then nextJSON will either be an
            //    Object or undefined. If nextJSON is undefined, all paths under
            //    this step resolved to missing paths. If it's an Object, then
            //    at least one path resolved to a successful leaf value.
            //
            // This check defers creating branches until we see at least one
            // cache hit. Otherwise, don't waste the cycles creating a branch
            // if everything underneath is a cache miss.

            if (undefined !== nextJSON) {
                // The json value will initially be undefined. If we're here,
                // then at least one leaf value was encountered, so create a
                // branch to contain it.
                if (f_meta === undefined) {
                    f_meta = {};
                    f_meta[ƒm_version] = node[ƒ_version];
                    f_meta[ƒm_abs_path] = node[ƒ_abs_path];
                    f_meta[ƒm_deref_to] = refContainerRefPath;
                    f_meta[ƒm_deref_from] = refContainerAbsPath;
                    // Empower developers to instrument branch node creation by
                    // providing a custom function. If they do, delegate branch
                    // node creation to them.
                    json = branchSelector && branchSelector({
                        [ƒ_meta]: f_meta, __proto__: FalcorJSON.prototype }) || {
                        [ƒ_meta]: f_meta, __proto__: FalcorJSON.prototype };
                }

                // Set the reported branch or leaf into this branch.
                json[nextKey] = nextJSON;
            }
        }
        // Re-enter the inner loop and continue iterating the Range, or exit
        // here if we encountered a Key.
        while (keyIsRange && ++nextKey <= rangeEnd);

        // If we've exhausted the Keyset (or never encountered one at all),
        // exit the outer loop.
        if (++keysetIndex === keysetLength) {
            break iteratingKeyset;
        }

        // Otherwise get the next Key or Range from the Keyset and re-enter the
        // outer loop from the top.
        keyset = keysOrRanges[keysetIndex];
    } while (true);

    // `json` will be a branch if any cache hits, or undefined if all cache misses
    return json;
}
/* eslint-enable */

function onMissing(path, depth, results,
                   requestedPath, requestedLength, fromReference,
                   optimizedPath, optimizedLength, reportMissing,
                   json, reportMaterialized, branchSelector) {

    var createMaterializedBranch = !branchSelector ?
        createDefaultMaterializedBranch :
        wrapMaterializedBranchSelector(branchSelector);

    return originalOnMissing(path, depth, results,
                             requestedPath, requestedLength, fromReference,
                             optimizedPath, optimizedLength, reportMissing,
                             json, reportMaterialized, createMaterializedBranch);
}

function wrapMaterializedBranchSelector(branchSelector) {
    return function(path, _depth, node) {
        return branchSelector(
            node = createDefaultMaterializedBranch(path, _depth, node)
        ) || node;
    }
}

function createDefaultMaterializedBranch(path, _depth, node) {
    f_meta = {};
    f_meta[ƒm_version] = 0;
    f_meta[ƒm_abs_path] = path.slice(0, _depth);
    return { [ƒ_meta]: f_meta, __proto__: FalcorJSON.prototype };
 }