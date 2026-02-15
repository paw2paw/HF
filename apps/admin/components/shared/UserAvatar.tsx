"use client";

import React from "react";

export const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "#dc2626",
  ADMIN: "#ea580c",
  OPERATOR: "#2563eb",
  EDUCATOR: "#059669",
  SUPER_TESTER: "#7c3aed",
  TESTER: "#6b7280",
  DEMO: "#a3a3a3",
  VIEWER: "#6b7280",
};

export const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #10b981, #14b8a6)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
];

export function getAvatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

interface UserAvatarProps {
  name: string | null;
  role?: string;
  userId?: string;
  image?: string | null;
  size?: number;
  useGradient?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function UserAvatar({
  name,
  role,
  userId,
  image,
  size = 32,
  useGradient,
  className,
  style,
}: UserAvatarProps) {
  const initial = ((name || "?")[0] || "?").toUpperCase();
  const fontSize = Math.round(size * 0.4);

  const bg =
    useGradient && userId
      ? getAvatarGradient(userId)
      : role
        ? ROLE_COLORS[role] || "#6b7280"
        : "#6b7280";

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...style,
  };

  if (image) {
    return (
      <img
        src={image}
        alt={name || "User"}
        className={className}
        style={{ ...baseStyle, objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        ...baseStyle,
        background: bg,
        color: "#fff",
        fontSize,
        fontWeight: 700,
      }}
    >
      {initial}
    </div>
  );
}
