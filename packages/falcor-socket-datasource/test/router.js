import { Observable } from "rxjs";
import FalcorRouter from "@graphistry/falcor-router";

export default class Router extends FalcorRouter.createClass([
    {
        route: ["bar"],
        call(path, args) {
            return [{
                path: ["foo", "bar"],
                value: args && args[0]
            }];
        }
    }, {
        route: ["foo", "bar"],
        set(jsonGraph) { return { jsonGraph }; },
        get() { return { jsonGraph: { foo: { bar: "foo" } } }; }
    }, {
        route: `streaming[{keys: names}]`,
        set({ streaming }) {
            return Observable
                .from(Object.keys(streaming))
                .concatMap((key) => Observable.of({
                    value: streaming[key],
                    path: ['streaming', key]
                }).delay(50));
        },
        get({ names }) {
            return Observable
                .interval(50)
                .take(names.length)
                .map((x, idx) => ({
                    value: names[idx] + '-val',
                    path: ['streaming', names[idx]]
                }));
        },
        call(path, names) {
            return Observable
                .interval(50)
                .take(names.length)
                .map((x, idx) => ({
                    value: 'call-' + names[idx] + '-val',
                    path: ['streaming', names[idx]]
                }))
                .merge(Observable
                    .interval(65)
                    .take((names.length / 2) | 0)
                    .map((x, idx) => ({
                        invalidated: true,
                        path: ['streaming', names[idx]]
                    })));
        }
    }, {
        route: ["long", "running", "operation"],
        get() {
            return Observable.timer(5000).map((value) => {
                return {
                    path: ["long", "running", "operation"], value
                };
            });
        }
    }
]) {
    constructor(props) {
        super(props);
    }
}
