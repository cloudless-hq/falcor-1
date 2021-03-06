import compose from 'recompose/compose';
import lifecycle from 'recompose/lifecycle';
import withContext from 'recompose/withContext';
import hoistStatics from 'recompose/hoistStatics';
import mapPropsStream from 'recompose/mapPropsStream';
import setDisplayName from 'recompose/setDisplayName';
import wrapDisplayName from 'recompose/wrapDisplayName';
import setObservableConfig from 'recompose/setObservableConfig';
import rxjsObservableConfig from 'recompose/rxjsObservableConfig';

import invariant from 'invariant';
import PropTypes from 'prop-types';
import { connect as connectRedux } from 'react-redux';

import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Model, FalcorJSON } from '@graphistry/falcor';
import * as Scheduler from 'rxjs/scheduler/async';

import 'rxjs/add/observable/empty';
import 'rxjs/add/operator/let';
import 'rxjs/add/operator/merge';
import 'rxjs/add/operator/publish';
import 'rxjs/add/operator/takeLast';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/switchMapTo';
import 'rxjs/add/operator/timeoutWith';
import 'rxjs/add/operator/throttleTime';
import 'rxjs/add/operator/distinctUntilKeyChanged';

if (!Model.prototype.changes) {
    Model.prototype.changes = function() {
        const { _root } = this;
        let { changes } = _root;
        if (!changes) {
            changes = _root.changes = new BehaviorSubject(this);
            ['onChange', 'onChangesCompleted'].forEach((name) => {
                const handler = _root[name];
                _root[name] = function() {
                    if (handler) {
                        handler.call(this);
                    }
                    changes.next(this);
                }
            });
        }
        return changes;
    }
}

setObservableConfig(rxjsObservableConfig);

const reduxOptions = { pure: false };
const contextTypes = { falcor: PropTypes.object, dispatch: PropTypes.func };

const connect = (BaseComponent, scheduler = Scheduler.async) => hoistStatics(compose(
    connectRedux(mapReduxStoreToProps, null, null, reduxOptions),
    setDisplayName(wrapDisplayName(BaseComponent, 'Falcor')),
    mapPropsStream(mapPropsToDistinctChanges(scheduler)),
    withContext(contextTypes, ({ falcor, dispatch }) => ({
        falcor, dispatch
    })),
    lifecycle({
        componentDidUpdate() {
            this.props.dispatch({
                data: this.props.data,
                type: 'falcor-react-redux/update'
            });
        }
    })
))(BaseComponent);

export { connect };
export default connect;

function mapReduxStoreToProps(data, { falcor }) {

    invariant(falcor, `The top level "connect" container requires a root falcor model.`);

    if (data instanceof FalcorJSON) {
        return { data };
    } else if (falcor._recycleJSON) {
        if (falcor._seed && falcor._seed.json) {
            return { data: falcor._seed.json };
        }
        falcor._seed = {};
        falcor._seed.__proto__ = FalcorJSON.prototype;
        return { data: falcor._seed.json = new FalcorJSON(data) };
    }

    return { data: new FalcorJSON(data) };
}

function mapPropsToDistinctChanges(scheduler) {
    return function innerMapPropsToDistinctChanges(prop$) {
        return prop$.switchMap(
            mapPropsToChanges, mapChangeToProps
        )
        .let(throttleTrailing(0, scheduler))
        .distinctUntilKeyChanged('version');
    }
}

function mapPropsToChanges({ falcor }) {
    return falcor.changes();
}

function mapChangeToProps(props, falcor) {
    return { ...props, falcor, version: falcor.getVersion() };
}

function throttleTrailing(due, scheduler) {
    return function throttleTrailing(source) {
        return source.publish((shared) => Observable.merge(
            shared.throttleTime(due, scheduler),
               shared.auditTime(due, scheduler)
        ));
    }
}
