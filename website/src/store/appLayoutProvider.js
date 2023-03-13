import React, { createContext, useContext, useReducer } from 'react';

const NavigationOptionsHandler = (state, action) => {
  if (action.type === 'SIDE_NAV_IS_OPEN') {
    return { isOpen: action.value };
  }
  return { isOpen: true };
};

const sideNavOptionsContext = createContext();
export function useSideNavOptions() {
  return useContext(sideNavOptionsContext);
}

const sideNavOptionsDispatch = createContext();
export function useSideNavOptionsDispatch() {
  return useContext(sideNavOptionsDispatch);
}

const splitPanelOptionsContext = createContext();
export function useSplitPanelOptions() {
  return useContext(splitPanelOptionsContext);
}

const splitPanelOptionsDispatchContext = createContext();
export function useSplitPanelOptionsDispatch() {
  return useContext(splitPanelOptionsDispatchContext);
}

const splitPanelDefaultSettings = {
  isOpen: false,
  content: <></>,
};

const SplitPanelOptionsHandler = (state, action) => {
  if (action.type === 'UPDATE') {
    return { ...state, ...action.value };
  } else if (action.type === 'RESET') {
    return splitPanelDefaultSettings;
  }
};

export const AppLayoutProvider = (props) => {
  const [sideNavOptions, dispatchNavigationOptions] = useReducer(NavigationOptionsHandler, {
    isOpen: true,
  });
  const [splitPanelOptions, dispatchSplitPanelOptions] = useReducer(
    SplitPanelOptionsHandler,
    splitPanelDefaultSettings
  );

  return (
    // this is the provider providing state
    <splitPanelOptionsContext.Provider value={splitPanelOptions}>
      <splitPanelOptionsDispatchContext.Provider value={dispatchSplitPanelOptions}>
        <sideNavOptionsContext.Provider value={sideNavOptions}>
          <sideNavOptionsDispatch.Provider value={dispatchNavigationOptions}>
            {props.children}
          </sideNavOptionsDispatch.Provider>
        </sideNavOptionsContext.Provider>
      </splitPanelOptionsDispatchContext.Provider>
    </splitPanelOptionsContext.Provider>
  );
};