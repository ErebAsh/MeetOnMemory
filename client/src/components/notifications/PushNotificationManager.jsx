import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  BellOff,
  Send,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { toast } from "react-toastify";
import { notificationApi } from "../../services/notificationApi.js";

function urlBase64ToUint8Array(base64String) {
  try {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch {
    return new Uint8Array();
  }
}

const PushNotificationManager = () => {
  const [isSupported, setIsSupported] = useState(true);
  const [permission, setPermission] = useState("default"); // 'default' | 'granted' | 'denied'
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setIsSupported(false);
        setLoading(false);
        return;
      }

      setPermission(Notification.permission);

      if (Notification.permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error("Error checking push subscription:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const handleSubscribe = async () => {
    try {
      setActionLoading(true);

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        toast.error(
          "Notification permission was not granted. Please enable notifications in your browser settings.",
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // Fetch VAPID key
      let vapidKey = "";
      try {
        const keyRes = await notificationApi.getVapidPublicKey();
        vapidKey = keyRes.data?.data?.publicKey || "";
      } catch {
        console.warn("Using default fallback VAPID key");
      }

      const subscribeOptions = {
        userVisibleOnly: true,
        ...(vapidKey && {
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }),
      };

      const subscription =
        await registration.pushManager.subscribe(subscribeOptions);

      // Register with backend
      await notificationApi.subscribePush(subscription.toJSON());

      setIsSubscribed(true);
      toast.success("Web push notifications enabled successfully!");
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Failed to enable push notifications.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      setActionLoading(true);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await notificationApi.unsubscribePush(endpoint);
      }

      setIsSubscribed(false);
      toast.info("Push notifications disabled.");
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      toast.error("Failed to disable push notifications.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      setTestLoading(true);
      const res = await notificationApi.sendTestPush();

      // Trigger local browser test notification via SW if permitted
      if (
        Notification.permission === "granted" &&
        "serviceWorker" in navigator
      ) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          const payload = res.data?.data?.payload || {
            title: "Test Notification",
            body: "Push notifications are working properly on your device!",
            icon: "/favicon.ico",
          };
          await registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon,
            badge: payload.badge,
            data: { url: payload.url || "/settings" },
          });
        }
      }

      toast.success("Test push notification sent successfully!");
    } catch (error) {
      console.error("Error sending test push:", error);
      toast.error("Failed to send test push notification.");
    } finally {
      setTestLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div
        data-testid="push-unsupported"
        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2.5"
      >
        <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          Web Push notifications are not supported on this browser or platform.
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="push-notification-manager"
      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl ${
              isSubscribed
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}
          >
            {isSubscribed ? (
              <Bell className="w-5 h-5" />
            ) : (
              <BellOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Browser Web Push Notifications
              {isSubscribed && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Receive real-time meeting reminders and AI processing alerts even
              when the tab is closed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
          ) : isSubscribed ? (
            <button
              type="button"
              data-testid="disable-push-btn"
              disabled={actionLoading}
              onClick={handleUnsubscribe}
              className="px-3.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800/60 rounded-xl transition-all cursor-pointer"
            >
              {actionLoading ? "Updating..." : "Disable Push"}
            </button>
          ) : (
            <button
              type="button"
              data-testid="enable-push-btn"
              disabled={actionLoading || permission === "denied"}
              onClick={handleSubscribe}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-400 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              {actionLoading ? "Enabling..." : "Enable Push"}
            </button>
          )}
        </div>
      </div>

      {/* Permission Denied Warning */}
      {permission === "denied" && (
        <div
          data-testid="push-permission-denied"
          className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Notification permission is blocked</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-400">
              Notifications were blocked in your browser. To enable them, click
              the lock or settings icon in your browser address bar and allow
              notifications.
            </p>
          </div>
        </div>
      )}

      {/* Send Test Notification Button */}
      {isSubscribed && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Verify push notification delivery on this device:
          </span>
          <button
            type="button"
            data-testid="send-test-push-btn"
            disabled={testLoading}
            onClick={handleSendTestNotification}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            {testLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            )}
            <span>Send Test Notification</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PushNotificationManager;
