/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Container} from './ReactDOMHostConfig';
import type {RootType} from './ReactDOMRoot';
import type {ReactNodeList} from 'shared/ReactTypes';

import {
  getInstanceFromNode,
  isContainerMarkedAsRoot,
  unmarkContainerAsRoot,
} from './ReactDOMComponentTree';
import {createLegacyRoot, isValidContainer} from './ReactDOMRoot';
import {ROOT_ATTRIBUTE_NAME} from '../shared/DOMProperty';
import {
  DOCUMENT_NODE,
  ELEMENT_NODE,
  COMMENT_NODE,
} from '../shared/HTMLNodeType';

import {
  findHostInstanceWithNoPortals,
  updateContainer,
  unbatchedUpdates,
  getPublicRootInstance,
  findHostInstance,
  findHostInstanceWithWarning,
} from 'react-reconciler/src/ReactFiberReconciler';
import getComponentNameFromType from 'shared/getComponentNameFromType';
import invariant from 'shared/invariant';
import ReactSharedInternals from 'shared/ReactSharedInternals';
import {has as hasInstance} from 'shared/ReactInstanceMap';

const ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;

let topLevelUpdateWarnings;
let warnedAboutHydrateAPI = false;

if (__DEV__) {
  topLevelUpdateWarnings = (container: Container) => {
    if (container._reactRootContainer && container.nodeType !== COMMENT_NODE) {
      const hostInstance = findHostInstanceWithNoPortals(
        container._reactRootContainer._internalRoot.current,
      );
      if (hostInstance) {
        if (hostInstance.parentNode !== container) {
          console.error(
            'render(...): It looks like the React-rendered content of this ' +
              'container was removed without using React. This is not ' +
              'supported and will cause errors. Instead, call ' +
              'ReactDOM.unmountComponentAtNode to empty a container.',
          );
        }
      }
    }

    const isRootRenderedBySomeReact = !!container._reactRootContainer;
    const rootEl = getReactRootElementInContainer(container);
    const hasNonRootReactChild = !!(rootEl && getInstanceFromNode(rootEl));

    if (hasNonRootReactChild && !isRootRenderedBySomeReact) {
      console.error(
        'render(...): Replacing React-rendered children with a new root ' +
          'component. If you intended to update the children of this node, ' +
          'you should instead have the existing children update their state ' +
          'and render the new components instead of calling ReactDOM.render.',
      );
    }

    if (
      container.nodeType === ELEMENT_NODE &&
      ((container: any): Element).tagName &&
      ((container: any): Element).tagName.toUpperCase() === 'BODY'
    ) {
      console.error(
        'render(): Rendering components directly into document.body is ' +
          'discouraged, since its children are often manipulated by third-party ' +
          'scripts and browser extensions. This may lead to subtle ' +
          'reconciliation issues. Try rendering into a container element created ' +
          'for your app.',
      );
    }
  };
}

function getReactRootElementInContainer(container: any) {
  if (!container) {
    return null;
  }

  if (container.nodeType === DOCUMENT_NODE) {
    return container.documentElement;
  } else {
    return container.firstChild;
  }
}

function shouldHydrateDueToLegacyHeuristic(container) {
  const rootElement = getReactRootElementInContainer(container);
  return !!(
    rootElement &&
    rootElement.nodeType === ELEMENT_NODE &&
    rootElement.hasAttribute(ROOT_ATTRIBUTE_NAME)
  );
}

function legacyCreateRootFromDOMContainer(
  container: Container,
  forceHydrate: boolean,
): RootType {
  // 是否ssr
  const shouldHydrate =
    forceHydrate || shouldHydrateDueToLegacyHeuristic(container);
  // First clear any existing content.
  if (!shouldHydrate) {
    // 不是服务器端渲染
    let warned = false;
    let rootSibling;
    // 如果不是服务器端渲染，要清空container容器下的节点，如果是，则会复用节点
    // 清空节点
    /* 
      为什么要清除 container 中的元素
        有时候需要在container 中放置一些占位图 或 loading图以提高首屏加载用户体验
        就会加入一些html标记
        在将 ReactElement 渲染到container之前，必然要先清空 container
     */
    while ((rootSibling = container.lastChild)) {
      if (__DEV__) {
        if (
          !warned &&
          rootSibling.nodeType === ELEMENT_NODE &&
          (rootSibling: any).hasAttribute(ROOT_ATTRIBUTE_NAME)
        ) {
          warned = true;
          console.error(
            'render(): Target node has markup rendered by React, but there ' +
              'are unrelated nodes as well. This is most commonly caused by ' +
              'white-space inserted around server-rendered markup.',
          );
        }
      }
      container.removeChild(rootSibling);
    }
  }
  if (__DEV__) {
    if (shouldHydrate && !forceHydrate && !warnedAboutHydrateAPI) {
      warnedAboutHydrateAPI = true;
      console.warn(
        'render(): Calling ReactDOM.render() to hydrate server-rendered markup ' +
          'will stop working in React v18. Replace the ReactDOM.render() call ' +
          'with ReactDOM.hydrate() if you want React to attach to the server HTML.',
      );
    }
  }

  return createLegacyRoot(
    container,
    shouldHydrate
      ? {
          hydrate: true,
        }
      : undefined,
  );
}

function warnOnInvalidCallback(callback: mixed, callerName: string): void {
  if (__DEV__) {
    if (callback !== null && typeof callback !== 'function') {
      console.error(
        '%s(...): Expected the last optional `callback` argument to be a ' +
          'function. Instead received: %s.',
        callerName,
        callback,
      );
    }
  }
}
/* 
  将子树渲染到容器中
  初始化Fiber数据结构，创建fiberRoot 以及 rootFiber
*/
function legacyRenderSubtreeIntoContainer(
  parentComponent: ?React$Component<any, any>,
  children: ReactNodeList,
  container: Container,
  forceHydrate: boolean,
  callback: ?Function,
) {
  if (__DEV__) {
    topLevelUpdateWarnings(container);
    warnOnInvalidCallback(callback === undefined ? null : callback, 'render');
  }

  // TODO: Without `any` type, Flow says "Property cannot be accessed on any
  // member of intersection type." 
  /* 
    获取 container 容器对象下_reactRootContainer属性的值
    有值，说明container 已经是初始化过的渲染容器，要执行更新
    没有值，说明是初始渲染
  */
  console.info('container==', container)
  let root: RootType = (container._reactRootContainer: any);
  let fiberRoot;
  if (!root) {
    // 首次渲染
    // Initial mount
    /* 
      初始化根 Fiber
      为container 添加 _reactRootContainer
      为_reactRootContainer 添加 _internalRoot
      _internalRoot 即为 FiberRoot

      legacyCreateRootFromDOMContainer执行 创建了fiberRoot 和 hostRootFiber，并且返回 fiberRoot
      hostRootFiber
    */
    root = container._reactRootContainer = legacyCreateRootFromDOMContainer(
      container,
      forceHydrate,
    );
    fiberRoot = root._internalRoot;
    if (typeof callback === 'function') {
      const originalCallback = callback;
      // 改变 callback this的指向，指向render 第一个参数的真实dom对象。如果是函数组件，则没有this
      callback = function() {
        // 获取container的第一个子元素的实例对象
        const instance = getPublicRootInstance(fiberRoot);
        
        originalCallback.call(instance);
      };
    }
    // Initial mount should not be batched.
    // 挂载
    /* 
      初始化不执行批量更新
        因为批量更新是异步的 是可以被打断的。
        但是初始化渲染应该尽快渲染，不应该被打断，所以不执行批量更新
    */
   
    unbatchedUpdates(() => {
      updateContainer(children, fiberRoot, parentComponent, callback);
    });
  } else {
    fiberRoot = root._internalRoot;
    if (typeof callback === 'function') {
      const originalCallback = callback;
      callback = function() {
        const instance = getPublicRootInstance(fiberRoot);
        originalCallback.call(instance);
      };
    }
    // Update 更新
    updateContainer(children, fiberRoot, parentComponent, callback);
  }
  // 返回 render 方法第一个参数的真实dom对象，作为render方法的返回值
  return getPublicRootInstance(fiberRoot);
}

export function findDOMNode(
  componentOrElement: Element | ?React$Component<any, any>,
): null | Element | Text {
  if (__DEV__) {
    const owner = (ReactCurrentOwner.current: any);
    if (owner !== null && owner.stateNode !== null) {
      const warnedAboutRefsInRender = owner.stateNode._warnedAboutRefsInRender;
      if (!warnedAboutRefsInRender) {
        console.error(
          '%s is accessing findDOMNode inside its render(). ' +
            'render() should be a pure function of props and state. It should ' +
            'never access something that requires stale data from the previous ' +
            'render, such as refs. Move this logic to componentDidMount and ' +
            'componentDidUpdate instead.',
          getComponentNameFromType(owner.type) || 'A component',
        );
      }
      owner.stateNode._warnedAboutRefsInRender = true;
    }
  }
  if (componentOrElement == null) {
    return null;
  }
  if ((componentOrElement: any).nodeType === ELEMENT_NODE) {
    return (componentOrElement: any);
  }
  if (__DEV__) {
    return findHostInstanceWithWarning(componentOrElement, 'findDOMNode');
  }
  return findHostInstance(componentOrElement);
}

export function hydrate(
  element: React$Node,
  container: Container,
  callback: ?Function,
) {
  invariant(
    isValidContainer(container),
    'Target container is not a DOM element.',
  );
  if (__DEV__) {
    const isModernRoot =
      isContainerMarkedAsRoot(container) &&
      container._reactRootContainer === undefined;
    if (isModernRoot) {
      console.error(
        'You are calling ReactDOM.hydrate() on a container that was previously ' +
          'passed to ReactDOM.createRoot(). This is not supported. ' +
          'Did you mean to call createRoot(container, {hydrate: true}).render(element)?',
      );
    }
  }
  // TODO: throw or warn if we couldn't hydrate?
  return legacyRenderSubtreeIntoContainer(
    null,
    element,
    container,
    true,
    callback,
  );
}
/* 
  element 要进行渲染的ReactElement
  container 渲染容器
  callback 渲染完成后执行的回调函数
*/
export function render(
  element: React$Element<any>,
  container: Container,
  callback: ?Function,
) {
  /* 
    isValidContainer
      检查container是否是符合要求的渲染容器
      即检查container是否是真实的dom对象，不符合就报错
  */
  invariant(
    isValidContainer(container),
    'Target container is not a DOM element.',
  );
  
  if (__DEV__) {
    const isModernRoot =
      isContainerMarkedAsRoot(container) &&
      container._reactRootContainer === undefined;
    if (isModernRoot) {
      console.error(
        'You are calling ReactDOM.render() on a container that was previously ' +
          'passed to ReactDOM.createRoot(). This is not supported. ' +
          'Did you mean to call root.render(element)?',
      );
    }
  }
  return legacyRenderSubtreeIntoContainer(
    // 父组件  初始渲染没有父组件，传null
    null,
    element,
    container,
    false, // 是否为服务端渲染
    callback,
  );
}

export function unstable_renderSubtreeIntoContainer(
  parentComponent: React$Component<any, any>,
  element: React$Element<any>,
  containerNode: Container,
  callback: ?Function,
) {
  invariant(
    isValidContainer(containerNode),
    'Target container is not a DOM element.',
  );
  invariant(
    parentComponent != null && hasInstance(parentComponent),
    'parentComponent must be a valid React Component',
  );
  return legacyRenderSubtreeIntoContainer(
    parentComponent,
    element,
    containerNode,
    false,
    callback,
  );
}

export function unmountComponentAtNode(container: Container) {
  invariant(
    isValidContainer(container),
    'unmountComponentAtNode(...): Target container is not a DOM element.',
  );

  if (__DEV__) {
    const isModernRoot =
      isContainerMarkedAsRoot(container) &&
      container._reactRootContainer === undefined;
    if (isModernRoot) {
      console.error(
        'You are calling ReactDOM.unmountComponentAtNode() on a container that was previously ' +
          'passed to ReactDOM.createRoot(). This is not supported. Did you mean to call root.unmount()?',
      );
    }
  }

  if (container._reactRootContainer) {
    if (__DEV__) {
      const rootEl = getReactRootElementInContainer(container);
      const renderedByDifferentReact = rootEl && !getInstanceFromNode(rootEl);
      if (renderedByDifferentReact) {
        console.error(
          "unmountComponentAtNode(): The node you're attempting to unmount " +
            'was rendered by another copy of React.',
        );
      }
    }

    // Unmount should not be batched.
    unbatchedUpdates(() => {
      legacyRenderSubtreeIntoContainer(null, null, container, false, () => {
        // $FlowFixMe This should probably use `delete container._reactRootContainer`
        container._reactRootContainer = null;
        unmarkContainerAsRoot(container);
      });
    });
    // If you call unmountComponentAtNode twice in quick succession, you'll
    // get `true` twice. That's probably fine?
    return true;
  } else {
    if (__DEV__) {
      const rootEl = getReactRootElementInContainer(container);
      const hasNonRootReactChild = !!(rootEl && getInstanceFromNode(rootEl));

      // Check if the container itself is a React root node.
      const isContainerReactRoot =
        container.nodeType === ELEMENT_NODE &&
        isValidContainer(container.parentNode) &&
        !!container.parentNode._reactRootContainer;

      if (hasNonRootReactChild) {
        console.error(
          "unmountComponentAtNode(): The node you're attempting to unmount " +
            'was rendered by React and is not a top-level container. %s',
          isContainerReactRoot
            ? 'You may have accidentally passed in a React root node instead ' +
                'of its container.'
            : 'Instead, have the parent component update its state and ' +
                'rerender in order to remove this component.',
        );
      }
    }

    return false;
  }
}
