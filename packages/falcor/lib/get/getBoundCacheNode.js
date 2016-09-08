var getCachePosition = require("./../get/getCachePosition");

module.exports = getBoundCacheNode;

function getBoundCacheNode(model, path = model._path) {
    var node = model._node;
    if (!node || node.ツparent === undefined || node.ツinvalidated) {
        model._node = null;
        if (path.length === 0) {
            node = model._root.cache;
        } else {
            model._node = node = getCachePosition(model._root.cache, path);
        }
    }
    return node;
}