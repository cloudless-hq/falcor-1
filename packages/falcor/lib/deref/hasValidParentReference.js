module.exports = hasValidParentReference;

function hasValidParentReference() {
    var reference = this._referenceContainer;

    // Always true when this mode is false.
    if (!this._allowFromWhenceYouCame) {
        return true;
    }

    // If fromWhenceYouCame is true and the first set of keys did not have
    // a reference, this case can happen.  They are always valid.
    if (reference === true) {
        return true;
    }

    // was invalid before even derefing.
    if (reference === false) {
        return false;
    }

    // Its been disconnected (set over or collected) from the graph.
    if (reference && reference[f_parent] === undefined) {
        return false;
    }

    // The reference has expired but has not been collected from the graph.
    if (reference && reference[f_invalidated]) {
        return false;
    }

    return true;
}
