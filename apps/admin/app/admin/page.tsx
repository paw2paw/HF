// apps/admin/app/admin/page.tsx
"use client";

import dynamic from "next/dynamic";
import { Suspense, Component, ReactNode } from "react";

// Error boundary to catch client-side rendering errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Admin page error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#dc2626' }}>
          <h2>Error loading Parameters page</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fee2e2', padding: '12px', borderRadius: '6px' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '12px', padding: '8px 16px', cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// React Admin must run client-side only.
// AdminApp.tsx is a Client Component, but we still dynamically load it to avoid any SSR/router issues.
const AdminApp = dynamic(() => import("./AdminApp"), {
  ssr: false,
  loading: () => <div style={{ padding: '20px' }}>Loading Parameters...</div>
});

export default function Page() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: '20px' }}>Loading...</div>}>
        <AdminApp />
      </Suspense>
    </ErrorBoundary>
  );
}