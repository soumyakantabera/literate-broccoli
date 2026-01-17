"use client";

import React from 'react';
import { FileExplorer } from './FileExplorer';
import { useFileManager } from '@/contexts/FileManagerContext';

export function SafeFileExplorer() {
  try {
    // Try to access the context
    const fileManager = useFileManager();
    
    // If we get here, context is available
    return <FileExplorer />;
  } catch (error) {
    // Context not available, show placeholder
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            File manager loading...
          </p>
        </div>
      </div>
    );
  }
}
