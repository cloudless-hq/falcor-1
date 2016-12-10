var isArray = Array.isArray;
var slice = Array.prototype.slice;
var isInternalKey = require('../../../lib/support/isInternalKey');

module.exports = function strip(cache, allowedKeys) {
    if (cache == null || typeof cache !== 'object') {
        return cache;
    } else if (isArray(cache)) {
        return slice.call(cache, 0);
    } else {
        allowedKeys = allowedKeys || [];
        return Object
            .keys(cache).sort()
            .reduce(function(obj, key) {
                var val = cache[key];
                if (val === undefined) {
                    return obj;
                } else if (!isInternalKey(key) || ~allowedKeys.indexOf(key)) {
                    obj[key] = strip(cache[key], allowedKeys);
                }
                return obj;
            }, {});
    }
};
