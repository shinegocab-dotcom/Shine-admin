import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { FirestoreErrorInfo } from '../lib/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  firestoreInfo: FirestoreErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      firestoreInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let firestoreInfo: FirestoreErrorInfo | null = null;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === 'object' && 'operationType' in parsed) {
        firestoreInfo = parsed as FirestoreErrorInfo;
      }
    } catch {
      // Standard runtime error
    }

    return {
      hasError: true,
      errorMessage: firestoreInfo ? firestoreInfo.error : error.message || 'Unexpected error',
      firestoreInfo,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Unhandled application boundary error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', firestoreInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6 text-[#111111]">
          <div className="max-w-lg w-full bg-white border border-[#E5E7EB] rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-red-50 border border-red-200 flex items-center justify-center shrink-0 text-[#DC2626]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h1 className="text-base font-bold text-[#111111]">
                  {this.state.firestoreInfo
                    ? 'Database Authorization or Connection Error'
                    : 'Application Runtime Error'}
                </h1>
                <p className="text-sm text-[#4B5563]">{this.state.errorMessage}</p>
              </div>
            </div>

            {this.state.firestoreInfo && (
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-3 text-xs font-mono text-[#374151] space-y-1">
                <div>Operation: {this.state.firestoreInfo.operationType}</div>
                <div>Path: {this.state.firestoreInfo.path || 'root'}</div>
                <div>User: {this.state.firestoreInfo.authInfo.email || 'anonymous'}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#111111] text-white text-sm font-semibold hover:bg-[#1F2937] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Admin Panel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
