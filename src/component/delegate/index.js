/* @flow */

import { onCloseWindow } from 'cross-domain-utils/src';
import { type ZalgoPromise } from 'zalgo-promise/src';

import { BaseComponent } from '../base';
import { ParentComponent } from '../parent';
import { RENDER_DRIVERS, type ContextDriverType } from '../parent/drivers';
import { type Component } from '../component';

export type DelegatePropsType = {
    uid : string,
    dimensions : DimensionsType,
    onClose : () => ?ZalgoPromise<void>,
    onDisplay : () => ?ZalgoPromise<void>
};

export type DelegateOptionsType = {
    context : string,
    props : DelegatePropsType,
    childWindowName : string,
    overrides : {
        focus : () => ZalgoPromise<void>,
        userClose : (string) => ZalgoPromise<void>,
        getDomain : () => ZalgoPromise<string>,
        error : (mixed) => ZalgoPromise<void>,
        on : (string, () => void) => CancelableType
    }
};

export class DelegateComponent<P> extends BaseComponent<P> {

    source : CrossDomainWindowType
    context : string
    props : DelegatePropsType

    focus : () => ZalgoPromise<void>
    userClose : (string) => ZalgoPromise<void>
    getDomain : () => ZalgoPromise<string>
    error : (mixed) => ZalgoPromise<void>
    on : (string, () => void) => CancelableType

    childWindowName : string

    constructor(component : Component<P>, source : CrossDomainWindowType, options : DelegateOptionsType) {
        super();

        this.component = component;
        this.clean.set('source', source);

        this.context = options.context;

        this.props = {
            uid:        options.props.uid,
            dimensions: options.props.dimensions,
            onClose:    options.props.onClose,
            onDisplay:  options.props.onDisplay
        };

        for (let propName of component.getPropNames()) {
            // $FlowFixMe
            let prop = this.component.getProp(propName);

            if (prop.allowDelegate) {
                this.props[propName] = options.props[propName];
            }
        }

        this.focus     = options.overrides.focus;
        this.userClose = options.overrides.userClose;
        this.getDomain = options.overrides.getDomain;
        this.error     = options.overrides.error;
        this.on        = options.overrides.on;

        let delegateOverrides = RENDER_DRIVERS[options.context].delegateOverrides;

        for (let key of Object.keys(delegateOverrides)) {
            // $FlowFixMe
            this[key] = ParentComponent.prototype[key];
        }

        this.childWindowName = options.childWindowName;

        ParentComponent.prototype.registerActiveComponent.call(this);

        this.watchForClose();
    }

    get driver() : ContextDriverType {

        if (!this.context) {
            throw new Error('Context not set');
        }

        return RENDER_DRIVERS[this.context];
    }

    watchForClose() {
        let closeWindowListener = onCloseWindow(this.source, () => this.destroy(), 3000);
        this.clean.register('destroyCloseWindowListener', closeWindowListener.cancel);
    }

    getOverrides(context : string) : { [string] : mixed } {

        let delegateOverrides = RENDER_DRIVERS[context].delegateOverrides;

        let overrides = {};

        let self = this;

        for (let key of Object.keys(delegateOverrides)) {
            overrides[key] = function() : mixed {
                // $FlowFixMe
                return ParentComponent.prototype[key].apply(self, arguments);
            };
        }

        return overrides;
    }

    destroy() : ZalgoPromise<void> {
        return this.clean.all();
    }
}
