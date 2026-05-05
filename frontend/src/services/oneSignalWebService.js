/**
 * OneSignal Web Push Service
 *
 * Handles web push notification subscriptions for caregivers
 * who access the app through a browser (not the native APK).
 *
 * Uses the OneSignal Web SDK v16 (CDN).
 */

const ONESIGNAL_APP_ID = '2341392e-475c-4924-98fb-4dcf24dc03f2';
const TAG = '[OneSignalWeb]';
let sdkLoaded = false;
let initPromise = null;

/**
 * Load the OneSignal Web SDK script if not already loaded.
 */
function loadSDK() {
  if (sdkLoaded || document.getElementById('onesignal-web-sdk')) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'onesignal-web-sdk';
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onload = () => {
      sdkLoaded = true;
      console.log(TAG, 'SDK script loaded');
      resolve();
    };
    script.onerror = (err) => {
      console.warn(TAG, 'Failed to load SDK script:', err);
      reject(err);
    };
    document.head.appendChild(script);
  });
}

/**
 * Initialize OneSignal Web SDK and log in the given user.
 * Safe to call multiple times – subsequent calls are no-ops.
 *
 * @param {string} userId  The app-level user id (external_id in OneSignal)
 */
async function initAndLogin(userId) {
  if (!userId) {
    console.warn(TAG, 'No userId provided, skipping');
    return;
  }

  // Deduplicate concurrent calls
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await loadSDK();

      // The SDK attaches itself to window.OneSignalDeferred
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        try {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: true,
          });
          console.log(TAG, 'SDK initialized');

          // Login sets the external_id so the backend can target this user
          await OneSignal.login(userId);
          console.log(TAG, 'Logged in as', userId);

          // Request permission (shows browser prompt)
          const permission = await OneSignal.Notifications.requestPermission();
          console.log(TAG, 'Notification permission:', permission);
        } catch (innerErr) {
          console.warn(TAG, 'Init/login error (non-critical):', innerErr);
        }
      });
    } catch (err) {
      console.warn(TAG, 'SDK load error (non-critical):', err);
    }
  })();

  return initPromise;
}

const oneSignalWebService = { initAndLogin };
export default oneSignalWebService;
