"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useStudentNotifications(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(0);
  const [hasNew, setHasNew] = useState(false);

  const fetchUnread = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/student/notifications");
      const data = await res.json();
      if (data.ok) {
        const newCount = data.unreadCount || 0;
        if (newCount > prevCountRef.current && prevCountRef.current >= 0) {
          setHasNew(true);
        }
        prevCountRef.current = newCount;
        setUnreadCount(newCount);
      }
    } catch {
      // Silent
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [enabled, fetchUnread]);

  const clearNew = useCallback(() => setHasNew(false), []);

  return { unreadCount, hasNew, clearNew, refetch: fetchUnread };
}
