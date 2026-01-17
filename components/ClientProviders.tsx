"use client";

import { ThemeProvider } from '@/contexts/ThemeContext';
import { FileManagerProvider } from '@/contexts/FileManagerContext';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <FileManagerProvider>
        {children}
      </FileManagerProvider>
    </ThemeProvider>
  );
}
