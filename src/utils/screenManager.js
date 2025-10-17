/**
 * Screen Manager - Manages screen visibility and loading states
 * Only loads content for visible screens, keeps last visited screen in memory
 */

import { useRef, useEffect } from 'react';
import { AppState } from 'react-native';

class ScreenManagerClass {
  constructor() {
    this.activeScreen = null;
    this.lastVisitedScreen = null;
    this.screenStates = new Map();
    this.listeners = new Set();
  }

  setActiveScreen(screenName) {
    if (this.activeScreen !== screenName) {
      this.lastVisitedScreen = this.activeScreen;
      this.activeScreen = screenName;
      this.notifyListeners();
      console.log(`📱 Active screen: ${screenName}, Last: ${this.lastVisitedScreen}`);
    }
  }

  getActiveScreen() {
    return this.activeScreen;
  }

  getLastVisitedScreen() {
    return this.lastVisitedScreen;
  }

  isScreenActive(screenName) {
    return this.activeScreen === screenName;
  }

  shouldLoadScreen(screenName) {
    // Load if it's the active screen or the last visited screen
    return this.activeScreen === screenName || this.lastVisitedScreen === screenName;
  }

  setScreenState(screenName, state) {
    this.screenStates.set(screenName, state);
  }

  getScreenState(screenName) {
    return this.screenStates.get(screenName);
  }

  clearScreenState(screenName) {
    this.screenStates.delete(screenName);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  clearInactiveScreens() {
    // Keep only active and last visited screen data
    const screensToKeep = new Set([this.activeScreen, this.lastVisitedScreen]);
    
    for (const [screenName] of this.screenStates) {
      if (!screensToKeep.has(screenName)) {
        this.screenStates.delete(screenName);
        console.log(`🗑️ Cleared inactive screen: ${screenName}`);
      }
    }
  }
}

export const ScreenManager = new ScreenManagerClass();

/**
 * Hook to track screen focus and manage loading
 */
export const useScreenManager = (screenName) => {
  const isActive = useRef(false);

  useEffect(() => {
    ScreenManager.setActiveScreen(screenName);
    isActive.current = true;

    return () => {
      isActive.current = false;
    };
  }, [screenName]);

  return {
    isActive: () => isActive.current,
    shouldLoad: () => ScreenManager.shouldLoadScreen(screenName),
    isLastVisited: () => ScreenManager.getLastVisitedScreen() === screenName
  };
};

/**
 * Hook to manage app state and clear inactive screens
 */
export const useAppStateManager = () => {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        // Clear inactive screens when app goes to background
        ScreenManager.clearInactiveScreens();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);
};
