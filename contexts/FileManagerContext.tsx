"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface NebulaFile {
  id: string;
  name: string;
  markdown: string;
  xml: string;
  createdAt: string;
  updatedAt: string;
  folder?: string;
  tags?: string[];
  starred?: boolean;
}

interface FileManagerContextType {
  files: NebulaFile[];
  currentFileId: string | null;
  currentFile: NebulaFile | null;
  folders: string[];
  createFile: (name: string, folder?: string) => string;
  openFile: (id: string) => void;
  updateFile: (id: string, updates: Partial<NebulaFile>) => void;
  deleteFile: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
  duplicateFile: (id: string) => string;
  moveFile: (id: string, folder: string) => void;
  createFolder: (name: string) => void;
  deleteFolder: (name: string) => void;
  toggleStar: (id: string) => void;
  searchFiles: (query: string) => NebulaFile[];
  getRecentFiles: (limit?: number) => NebulaFile[];
}

const FileManagerContext = createContext<FileManagerContextType | undefined>(undefined);

const STORAGE_KEY_FILES = 'nebula:files:v2';
const STORAGE_KEY_CURRENT = 'nebula:current-file';

export function FileManagerProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<NebulaFile[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>(['Personal', 'Work', 'Projects']);
  const [mounted, setMounted] = useState(false);

  // Load files from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedFiles = localStorage.getItem(STORAGE_KEY_FILES);
    const savedCurrentId = localStorage.getItem(STORAGE_KEY_CURRENT);

    if (savedFiles) {
      try {
        const parsedFiles = JSON.parse(savedFiles);
        setFiles(parsedFiles);
        
        if (savedCurrentId && parsedFiles.find((f: NebulaFile) => f.id === savedCurrentId)) {
          setCurrentFileId(savedCurrentId);
        } else if (parsedFiles.length > 0) {
          setCurrentFileId(parsedFiles[0].id);
        } else {
          // Create a default file if none exist
          const defaultFile = createDefaultFile();
          setFiles([defaultFile]);
          setCurrentFileId(defaultFile.id);
        }
      } catch (e) {
        console.error('Failed to load files:', e);
        const defaultFile = createDefaultFile();
        setFiles([defaultFile]);
        setCurrentFileId(defaultFile.id);
      }
    } else {
      // Create a default file
      const defaultFile = createDefaultFile();
      setFiles([defaultFile]);
      setCurrentFileId(defaultFile.id);
    }
  }, []);

  // Save files to localStorage whenever they change
  useEffect(() => {
    if (mounted && files.length > 0) {
      localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(files));
    }
  }, [files, mounted]);

  // Save current file ID to localStorage
  useEffect(() => {
    if (mounted && currentFileId) {
      localStorage.setItem(STORAGE_KEY_CURRENT, currentFileId);
    }
  }, [currentFileId, mounted]);

  const createDefaultFile = (): NebulaFile => {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      name: 'Untitled Document',
      markdown: '# Welcome to Nebula\n\nStart editing your document here...',
      xml: '',
      createdAt: now,
      updatedAt: now,
    };
  };

  const currentFile = files.find(f => f.id === currentFileId) || null;

  const createFile = (name: string, folder?: string): string => {
    const now = new Date().toISOString();
    const newFile: NebulaFile = {
      id: uuidv4(),
      name: name || 'Untitled Document',
      markdown: '',
      xml: '',
      createdAt: now,
      updatedAt: now,
      folder,
    };
    setFiles(prev => [newFile, ...prev]);
    setCurrentFileId(newFile.id);
    return newFile.id;
  };

  const openFile = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file) {
      setCurrentFileId(id);
    }
  };

  const updateFile = (id: string, updates: Partial<NebulaFile>) => {
    setFiles(prev => prev.map(f => 
      f.id === id 
        ? { ...f, ...updates, updatedAt: new Date().toISOString() }
        : f
    ));
  };

  const deleteFile = (id: string) => {
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      
      // If we're deleting the current file, switch to another
      if (id === currentFileId) {
        if (filtered.length > 0) {
          setCurrentFileId(filtered[0].id);
        } else {
          // Create a new default file if all files are deleted
          const defaultFile = createDefaultFile();
          setFiles([defaultFile]);
          setCurrentFileId(defaultFile.id);
          return [defaultFile];
        }
      }
      
      return filtered;
    });
  };

  const renameFile = (id: string, newName: string) => {
    updateFile(id, { name: newName });
  };

  const duplicateFile = (id: string): string => {
    const file = files.find(f => f.id === id);
    if (!file) return '';

    const now = new Date().toISOString();
    const newFile: NebulaFile = {
      ...file,
      id: uuidv4(),
      name: `${file.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    setFiles(prev => [newFile, ...prev]);
    return newFile.id;
  };

  const moveFile = (id: string, folder: string) => {
    updateFile(id, { folder: folder || undefined });
  };

  const createFolder = (name: string) => {
    if (name && !folders.includes(name)) {
      setFolders(prev => [...prev, name]);
    }
  };

  const deleteFolder = (name: string) => {
    setFolders(prev => prev.filter(f => f !== name));
    // Remove folder from all files
    setFiles(prev => prev.map(f => 
      f.folder === name ? { ...f, folder: undefined } : f
    ));
  };

  const toggleStar = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file) {
      updateFile(id, { starred: !file.starred });
    }
  };

  const searchFiles = (query: string): NebulaFile[] => {
    const lowerQuery = query.toLowerCase();
    return files.filter(f => 
      f.name.toLowerCase().includes(lowerQuery) ||
      f.markdown.toLowerCase().includes(lowerQuery) ||
      f.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  };

  const getRecentFiles = (limit: number = 5): NebulaFile[] => {
    return [...files]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <FileManagerContext.Provider value={{
      files,
      currentFileId,
      currentFile,
      folders,
      createFile,
      openFile,
      updateFile,
      deleteFile,
      renameFile,
      duplicateFile,
      moveFile,
      createFolder,
      deleteFolder,
      toggleStar,
      searchFiles,
      getRecentFiles,
    }}>
      {children}
    </FileManagerContext.Provider>
  );
}

export function useFileManager() {
  const context = useContext(FileManagerContext);
  if (context === undefined) {
    throw new Error('useFileManager must be used within a FileManagerProvider');
  }
  return context;
}
