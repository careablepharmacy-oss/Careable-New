/**
 * Unified Storage Service
 * Handles secure storage for both Native (Capacitor Preferences) and PWA (localStorage)
 * 
 * Native: Uses Capacitor Preferences (encrypted)
 * PWA: Uses localStorage (standard web storage)
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const TAG = '[StorageService]';

class StorageService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    console.log(`${TAG} Initialized - Platform: ${this.isNative ? 'Native' : 'Web'}`);
  }

  /**
   * Set item in storage
   */
  async setItem(key, value) {
    try {
      if (this.isNative) {
        // Native: Use Capacitor Preferences (encrypted)
        await Preferences.set({
          key: key,
          value: value
        });
        console.log(`${TAG} [Native] Set ${key}`);
      } else {
        // Web: Use localStorage
        localStorage.setItem(key, value);
        console.log(`${TAG} [Web] Set ${key}`);
      }
    } catch (error) {
      console.error(`${TAG} Error setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get item from storage
   */
  async getItem(key) {
    try {
      if (this.isNative) {
        // Native: Use Capacitor Preferences
        const { value } = await Preferences.get({ key: key });
        console.log(`${TAG} [Native] Get ${key}: ${value ? 'found' : 'not found'}`);
        return value;
      } else {
        // Web: Use localStorage
        const value = localStorage.getItem(key);
        console.log(`${TAG} [Web] Get ${key}: ${value ? 'found' : 'not found'}`);
        return value;
      }
    } catch (error) {
      console.error(`${TAG} Error getting ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove item from storage
   */
  async removeItem(key) {
    try {
      if (this.isNative) {
        // Native: Use Capacitor Preferences
        await Preferences.remove({ key: key });
        console.log(`${TAG} [Native] Removed ${key}`);
      } else {
        // Web: Use localStorage
        localStorage.removeItem(key);
        console.log(`${TAG} [Web] Removed ${key}`);
      }
    } catch (error) {
      console.error(`${TAG} Error removing ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  async clear() {
    try {
      if (this.isNative) {
        // Native: Clear Capacitor Preferences
        await Preferences.clear();
        console.log(`${TAG} [Native] Cleared all storage`);
      } else {
        // Web: Clear localStorage
        localStorage.clear();
        console.log(`${TAG} [Web] Cleared all storage`);
      }
    } catch (error) {
      console.error(`${TAG} Error clearing storage:`, error);
      throw error;
    }
  }

  /**
   * Get all keys (for debugging)
   */
  async keys() {
    try {
      if (this.isNative) {
        // Native: Get all keys from Preferences
        const { keys } = await Preferences.keys();
        console.log(`${TAG} [Native] Keys:`, keys);
        return keys;
      } else {
        // Web: Get all keys from localStorage
        const keys = Object.keys(localStorage);
        console.log(`${TAG} [Web] Keys:`, keys);
        return keys;
      }
    } catch (error) {
      console.error(`${TAG} Error getting keys:`, error);
      return [];
    }
  }

  /**
   * Helper: Store session token
   */
  async setSessionToken(token) {
    return await this.setItem('session_token', token);
  }

  /**
   * Helper: Get session token
   */
  async getSessionToken() {
    return await this.getItem('session_token');
  }

  /**
   * Helper: Remove session token
   */
  async removeSessionToken() {
    return await this.removeItem('session_token');
  }

  /**
   * Helper: Store auth flag
   */
  async setAuthenticated(value) {
    return await this.setItem('isAuthenticated', value);
  }

  /**
   * Helper: Get auth flag
   */
  async getAuthenticated() {
    return await this.getItem('isAuthenticated');
  }

  /**
   * Helper: Remove auth flag
   */
  async removeAuthenticated() {
    return await this.removeItem('isAuthenticated');
  }

  /**
   * Helper: Store user data (as JSON)
   */
  async setUserData(userData) {
    return await this.setItem('userData', JSON.stringify(userData));
  }

  /**
   * Helper: Get user data (parse JSON)
   */
  async getUserData() {
    const data = await this.getItem('userData');
    return data ? JSON.parse(data) : null;
  }

  /**
   * Helper: Remove user data
   */
  async removeUserData() {
    return await this.removeItem('userData');
  }
}

// Export singleton instance
console.log('[StorageService] Creating singleton instance...');
const storageService = new StorageService();
console.log('[StorageService] Singleton created, exporting...');
export default storageService;
