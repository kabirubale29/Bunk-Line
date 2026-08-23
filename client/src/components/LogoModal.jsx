import React from 'react';
import { X } from 'lucide-react';

export default function LogoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full bg-brand-card border border-brand-border p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center space-y-4 transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 rounded-full bg-brand-cardEl hover:bg-brand-border text-brand-textMuted hover:text-brand-text transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>

        <div className="py-4 px-2">
          <img
            src="/logo.png"
            alt="Bunk Line Official Logo"
            className="w-72 max-w-full h-auto object-contain mx-auto drop-shadow-[0_10px_35px_rgba(22,163,74,0.4)] animate-pulse"
          />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-black text-brand-text tracking-tight">
            Bunk Line
          </h2>
          <p className="text-xs font-bold text-brand-primary uppercase tracking-widest">
            Track Today &middot; Plan Smarter
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-2 px-6 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primaryHover text-white text-xs font-extrabold uppercase tracking-wider shadow-md transition-all active:scale-95"
        >
          Close Viewer
        </button>
      </div>
    </div>
  );
}
