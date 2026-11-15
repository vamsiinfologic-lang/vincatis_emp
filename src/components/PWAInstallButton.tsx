import React, { useState } from 'react';
import { Download, Monitor, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'sidebar' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'topbar' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) return;
      return;
    }
    setShowGuideModal(true);
  };

  const buttonClasses =
    variant === 'sidebar'
      ? 'w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap'
      : variant === 'card'
        ? 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap'
        : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={buttonClasses}
        title="Install VEMS as a desktop app or mobile home screen shortcut"
      >
        <Download className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
        <span>{isIOS ? 'Add to Home Screen' : 'Install App'}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="VEMS App Icon"
                  className="w-10 h-10 rounded-lg border border-slate-200 shrink-0"
                />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Install VEMS App</h3>
                  <p className="text-xs text-slate-500">
                    Launch as a standalone desktop window or mobile home screen shortcut.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs text-slate-700">
              {isIOS ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Smartphone className="w-4 h-4 text-blue-700" aria-hidden="true" />
                    <span>iPhone &amp; iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>
                      Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-700" />{' '}
                      <strong>Share</strong> button in Safari&apos;s toolbar.
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong>.
                    </li>
                    <li>
                      Tap <strong>Add</strong> to place the VEMS shortcut icon on your home screen.
                    </li>
                  </ol>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <Monitor className="w-4 h-4 text-blue-700" aria-hidden="true" />
                      <span>Desktop App (Chrome / Edge)</span>
                    </div>
                    <p className="leading-relaxed">
                      Open the app in a dedicated browser tab, then click the{' '}
                      <strong>Install VEMS</strong> icon in the address bar (or open Browser Menu →{' '}
                      <strong>Cast, save, and share</strong> → <strong>Install page as app</strong>
                      ).
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <Smartphone className="w-4 h-4 text-blue-700" aria-hidden="true" />
                      <span>Mobile Home Screen (Android / iOS)</span>
                    </div>
                    <p className="leading-relaxed">
                      <strong>Android Chrome:</strong> Tap the browser menu (⋮) and select{' '}
                      <strong>Add to Home screen</strong> or <strong>Install app</strong>.
                      <br />
                      <strong>iPhone / iPad Safari:</strong> Tap <strong>Share</strong> →{' '}
                      <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-md"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
      <span>Offline mode · Cached workspace active</span>
    </div>
  );
};
