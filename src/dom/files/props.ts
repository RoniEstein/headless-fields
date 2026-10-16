import {
    cloneElement,
    createElement,
    isValidElement,
    type CSSProperties,
    type ReactElement,
    type ReactNode,
    type Ref,
} from 'react';

/** Props a getter returns: anything a DOM element accepts. */
export type ElementProps = Record<string, unknown>;

/**
 * Lets a part render your own element or component. An element is cloned
 * with the part's props merged in (its own props win, handlers and classes
 * combine). A function receives the props and the part's state and returns
 * whatever it likes, as long as it spreads the props onto a DOM element.
 */
export type RenderProp<S> = ReactElement | ((props: ElementProps, state: S) => ReactNode);

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
    if (typeof ref === 'function') ref(value);
    else if (ref && typeof ref === 'object') (ref as { current: T | null }).current = value;
}

/**
 * Merges the consumer's props into ours. Event handlers both run, the
 * consumer's first; calling event.preventDefault() skips ours. Classes join,
 * styles merge, refs both receive the node. Anything else: theirs wins.
 */
export function mergeProps(ours: ElementProps, theirs: ElementProps = {}): ElementProps {
    const merged: ElementProps = { ...ours, ...theirs };
    for (const key of Object.keys(theirs)) {
        const a = ours[key];
        const b = theirs[key];
        if (/^on[A-Z]/.test(key) && typeof a === 'function' && typeof b === 'function') {
            merged[key] = (event: { defaultPrevented?: boolean }, ...rest: unknown[]) => {
                b(event, ...rest);
                if (!event?.defaultPrevented) a(event, ...rest);
            };
        } else if (key === 'className' && a && b) {
            merged[key] = `${a} ${b}`;
        } else if (key === 'style' && a && b) {
            merged[key] = { ...(a as CSSProperties), ...(b as CSSProperties) };
        } else if (key === 'ref' && a && b) {
            merged[key] = (node: unknown) => {
                assignRef(a as Ref<unknown>, node);
                assignRef(b as Ref<unknown>, node);
            };
        }
    }
    return merged;
}

export function renderPart<S>(
    tag: string,
    props: ElementProps,
    render: RenderProp<S> | undefined,
    state: S,
): ReactNode {
    if (typeof render === 'function') return render(props, state);
    if (isValidElement<ElementProps>(render)) {
        const own = render.props;
        const merged = mergeProps(props, own);
        // The part's children (which may include required nodes, such as the
        // trigger's input) win over the element's own.
        if (props.children !== undefined) merged.children = props.children;
        return cloneElement(render, merged);
    }
    return createElement(tag, props);
}

/** Hidden from sight, still focusable and announced. Positioned inside its
 *  label so focusing it never scrolls the page somewhere else. */
export const visuallyHidden: CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
};
