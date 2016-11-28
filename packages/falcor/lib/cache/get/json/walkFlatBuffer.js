var arr = new Array(2);
var onValue = require("./onValue");
var $ref = require("../../../types/ref");
var FalcorJSON = require("./FalcorJSON");
var onValueType = require("../onValueType");
var isExpired = require("../../isExpired");
var originalOnMissing = require("../onMissing");
var getReferenceTarget = require("./getReferenceTarget");
var NullInPathError = require("../../../errors/NullInPathError");
var InvalidKeySetError = require("../../../errors/InvalidKeySetError");
var getHashCode = require("@graphistry/falcor-path-utils/lib/getHashCode");
var flatBufferToPaths = require("@graphistry/falcor-path-utils/lib/flatBufferToPaths");

module.exports = walkPathAndBuildOutput;

/* eslint-disable camelcase */
/* eslint-disable no-cond-assign */
/* eslint-disable no-constant-condition */
function walkPathAndBuildOutput(cacheRoot, node, json, path, depth, seed, results,
                                requestedPath, optimizedPath, optimizedLength,
                                fromReference, referenceContainer,
                                modelRoot, expired, expireImmediate, branchSelector,
                                boxValues, materialized, hasDataSource,
                                treatErrorsAsValues, allowFromWhenceYouCame) {

    var type, refTarget;

    // ============ Check for base cases ================

    // If there's nowhere to go, we've reached a terminal node, or hit
    // the end of the path, stop now. Either build missing paths or report the value.
    if (undefined === node ||
        undefined !== (type = node.$type) ||
        undefined === path) {
        arr[1] = false;
        arr[0] = onValueType(node, type, json,
                             path, depth, seed, results,
                             requestedPath, depth,
                             optimizedPath, optimizedLength,
                             fromReference, modelRoot, expired, expireImmediate,
                             branchSelector, boxValues, materialized, hasDataSource,
                             treatErrorsAsValues, onValue, onMissing);
        return arr;
    }

    var f_meta, f_old_keys, f_new_keys, f_code = "";

    var next, nextKey,
        keyset, keyIsRange,
        keys = path["$keys"],
        nextDepth = depth + 1, rangeEnd,
        nextJSON, nextReferenceContainer,
        nextOptimizedLength, nextOptimizedPath,
        optimizedLengthNext = optimizedLength + 1,
        refContainerAbsPath, refContainerRefPath;

    if (allowFromWhenceYouCame && referenceContainer) {
        refContainerRefPath = referenceContainer.value;
        refContainerAbsPath = referenceContainer[ƒ_abs_path];
    }

    if (json) {
        if (typeof json !== 'object') {
            json = undefined;
        } else if (f_meta = json[ƒ_meta]) {
            if (!branchSelector && !(json instanceof FalcorJSON)) {
                json = { [ƒ_meta]: f_meta, __proto__: FalcorJSON.prototype };
            } else if (
                f_meta[ƒm_version]  === node[ƒ_version] &&
                f_meta["$code"]     === path["$code"] &&
                f_meta[ƒm_abs_path] === node[ƒ_abs_path]) {
                results.hasValue = true;
                arr[0] = json;
                arr[1] = false;
                return arr;
            }
            f_old_keys = f_meta[ƒm_keys];
            f_meta[ƒm_version] = node[ƒ_version];
            f_meta[ƒm_abs_path] = node[ƒ_abs_path];
            f_meta[ƒm_deref_to] = refContainerRefPath;
            f_meta[ƒm_deref_from] = refContainerAbsPath;
        }
    }

    f_new_keys = {};

    var keysIndex = -1;
    var keysLength = keys.length;
    var nextPath, nextPathKey,
        hasMissingPath = false,
        nextMeta, nextMetaPath;

    iteratingKeyset:
    while (++keysIndex < keysLength) {

        keyset = keys[keysIndex];
        nextPath = path[keysIndex];
        nextMeta = undefined;
        nextMetaPath = undefined;

        // If `null` appears before the end of the path, throw an error.
        // If `null` is at the end of the path, but the reference doesn't
        // point to a sentinel value, throw an error.
        //
        // Inserting `null` at the end of the path indicates the target of a ref
        // should be returned, rather than the ref itself. When `null` is the last
        // key, the path is lengthened by one, ensuring that if a ref is encountered
        // just before the `null` key, the reference is followed before terminating.
        if (null === keyset) {
            if (nextPath !== undefined) {
                throw new NullInPathError();
            }
            f_code = "" + getHashCode("" + f_code + "null");
            continue;
        }
        // If the keyset is a primitive value, we've found our `nextKey`.
        else if ("object" !== typeof keyset) {
            nextKey = keyset;
            rangeEnd = undefined;
            keyIsRange = false;
            nextPathKey = nextKey;
        }
        // If the Keyset isn't null or primitive, then it must be a Range.
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
            nextPathKey = "{from:" + nextKey + ",length:" + (rangeEnd - nextKey + 1) + "}";
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
                nextPath !== undefined &&
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

            arr = walkPathAndBuildOutput(
                cacheRoot, next, nextJSON, nextPath, nextDepth, seed,
                results, requestedPath, nextOptimizedPath,
                nextOptimizedLength, fromReference, nextReferenceContainer,
                modelRoot, expired, expireImmediate, branchSelector, boxValues,
                materialized, hasDataSource, treatErrorsAsValues, allowFromWhenceYouCame
            );

            nextJSON = arr[0];
            hasMissingPath = hasMissingPath || arr[1];

            if (!seed) {
                continue;
            }

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

                f_new_keys[nextKey] = true;
                if (f_old_keys && f_old_keys.hasOwnProperty(nextKey)) {
                    f_old_keys[nextKey] = false;
                }
                // Set the reported branch or leaf into this branch.
                json[nextKey] = nextJSON;
            } else {
                hasMissingPath = true;
                if (json && json.hasOwnProperty(nextKey)) {
                    delete json[nextKey];
                }
            }
        }
        // Re-enter the inner loop and continue iterating the Range, or exit
        // here if we encountered a Key.
        while (keyIsRange && ++nextKey <= rangeEnd);

        if (!hasMissingPath) {
            if (undefined === nextPath) {
                f_code = "" + getHashCode("" + f_code + nextPathKey);
            } else {
                f_code = "" + getHashCode("" + f_code + nextPathKey + nextPath["$code"]);
            }
        }
    }

    if (hasMissingPath) {
        f_code = "__incomplete__";
    }

    if (f_meta) {
        f_meta["$code"] = f_code;
        f_meta[ƒm_keys] = f_new_keys;
        if (f_old_keys) {
            for (nextKey in f_old_keys) {
                if (f_old_keys[nextKey]) {
                    delete json[nextKey];
                }
            }
        }
    }

    // `json` will be a branch if any cache hits, or undefined if all cache misses

    arr[0] = json;
    arr[1] = hasMissingPath;

    return arr;
}
/* eslint-enable */

function onMissing(path, depth, results,
                   requestedPath, requestedLength, fromReference,
                   optimizedPath, optimizedLength, reportMissing,
                   json, reportMaterialized, branchSelector) {

    var suffix;
    var paths = path ? flatBufferToPaths(path) : [[]];
    var rPath = requestedPath.slice(0, requestedLength);
    var createMaterializedBranch = !branchSelector ?
        createDefaultMaterializedBranch :
        wrapMaterializedBranchSelector(branchSelector);

    return paths.reduce(function(json, restPath) {
        requestedLength = depth + restPath.length;
        return originalOnMissing(rPath.concat(restPath), depth,
                                 results, requestedPath, requestedLength, fromReference,
                                 optimizedPath, optimizedLength, reportMissing, json,
                                 reportMaterialized, createMaterializedBranch);
    }, json);
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