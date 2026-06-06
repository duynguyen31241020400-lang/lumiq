"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
          <p className="font-mono text-[14px] text-[#999]">
            Có lỗi xảy ra. Tải lại để tiếp tục.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded border border-[#2a2a2a] bg-[#141414] px-4 py-2 font-mono text-[12px] text-[#E8E0D0] hover:border-[#444]"
          >
            Tải lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
