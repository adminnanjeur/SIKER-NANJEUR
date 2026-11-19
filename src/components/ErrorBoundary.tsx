import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  isPermissionError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
    isPermissionError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    let parsedMessage = error.message;
    let isPerm = false;
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        isPerm = parsed.error.toLowerCase().includes('permission') || parsed.error.toLowerCase().includes('insufficient');
        parsedMessage = isPerm
          ? `Akses ditolak pada operasi ${parsed.operationType ?? 'data'} (${parsed.path ?? 'koleksi'}). Pastikan akun Anda memiliki peran dan izin yang sesuai.`
          : parsed.error;
      }
    } catch {
      // Plain error message
    }
    return {
      hasError: true,
      errorMessage: parsedMessage,
      isPermissionError: isPerm,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', isPermissionError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-lg font-semibold text-slate-900">
                  {this.state.isPermissionError ? 'Akses Dibatasi Sistem (RBAC)' : 'Terjadi Kendala Aplikasi'}
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {this.state.errorMessage || 'Terjadi kesalahan saat memproses data ke server.'}
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={this.handleReset}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Muat Ulang Aplikasi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
