"use client";

import React, { useState } from 'react';
import { 
  File, 
  Folder, 
  FolderOpen,
  Plus, 
  Star,
  Trash2,
  Edit2,
  Copy,
  MoreVertical,
  Search,
  Clock,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFileManager, NebulaFile } from '@/contexts/FileManagerContext';

export function FileExplorer() {
  const {
    files,
    currentFileId,
    folders,
    createFile,
    openFile,
    deleteFile,
    renameFile,
    duplicateFile,
    moveFile,
    createFolder,
    toggleStar,
    searchFiles,
    getRecentFiles,
  } = useFileManager();

  const [searchQuery, setSearchQuery] = useState('');
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['Recent']));
  const [viewMode, setViewMode] = useState<'all' | 'recent' | 'starred'>('all');

  const filteredFiles = searchQuery 
    ? searchFiles(searchQuery)
    : viewMode === 'recent'
      ? getRecentFiles(10)
      : viewMode === 'starred'
        ? files.filter(f => f.starred)
        : files;

  const handleCreateFile = () => {
    const id = createFile(newFileName || 'Untitled Document', selectedFolder || undefined);
    setNewFileDialogOpen(false);
    setNewFileName('');
    setSelectedFolder('');
  };

  const handleRename = () => {
    if (fileToRename && newName) {
      renameFile(fileToRename, newName);
      setRenameDialogOpen(false);
      setFileToRename(null);
      setNewName('');
    }
  };

  const openRenameDialog = (file: NebulaFile) => {
    setFileToRename(file.id);
    setNewName(file.name);
    setRenameDialogOpen(true);
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const getFilesByFolder = () => {
    const grouped: { [key: string]: NebulaFile[] } = { 'Unfiled': [] };
    
    folders.forEach(folder => {
      grouped[folder] = [];
    });

    filteredFiles.forEach(file => {
      if (file.folder && grouped[file.folder]) {
        grouped[file.folder].push(file);
      } else {
        grouped['Unfiled'].push(file);
      }
    });

    return grouped;
  };

  const groupedFiles = getFilesByFolder();

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Actions */}
      <div className="p-3 space-y-2 border-b">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={() => setNewFileDialogOpen(true)}
            className="h-8 w-8 p-0"
            title="New file"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('all')}
            className="h-7 px-2 text-xs flex-1"
          >
            <FileText className="h-3 w-3 mr-1" />
            All
          </Button>
          <Button
            variant={viewMode === 'recent' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('recent')}
            className="h-7 px-2 text-xs flex-1"
          >
            <Clock className="h-3 w-3 mr-1" />
            Recent
          </Button>
          <Button
            variant={viewMode === 'starred' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('starred')}
            className="h-7 px-2 text-xs flex-1"
          >
            <Star className="h-3 w-3 mr-1" />
            Starred
          </Button>
        </div>
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {viewMode === 'all' ? (
            // Folder view
            <>
              {Object.entries(groupedFiles).map(([folder, folderFiles]) => {
                if (folderFiles.length === 0) return null;
                const isExpanded = expandedFolders.has(folder);

                return (
                  <div key={folder} className="space-y-1">
                    <button
                      onClick={() => toggleFolder(folder)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition text-sm"
                    >
                      {isExpanded ? (
                        <FolderOpen className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Folder className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="font-medium flex-1 text-left">{folder}</span>
                      <Badge variant="secondary" className="text-xs">
                        {folderFiles.length}
                      </Badge>
                    </button>

                    {isExpanded && (
                      <div className="ml-2 space-y-1">
                        {folderFiles.map(file => (
                          <FileItem
                            key={file.id}
                            file={file}
                            isActive={file.id === currentFileId}
                            onOpen={() => openFile(file.id)}
                            onRename={() => openRenameDialog(file)}
                            onDuplicate={() => duplicateFile(file.id)}
                            onDelete={() => deleteFile(file.id)}
                            onToggleStar={() => toggleStar(file.id)}
                            onMove={(folder) => moveFile(file.id, folder)}
                            folders={folders}
                            formatDate={formatDate}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            // List view for recent/starred
            <div className="space-y-1">
              {filteredFiles.map(file => (
                <FileItem
                  key={file.id}
                  file={file}
                  isActive={file.id === currentFileId}
                  onOpen={() => openFile(file.id)}
                  onRename={() => openRenameDialog(file)}
                  onDuplicate={() => duplicateFile(file.id)}
                  onDelete={() => deleteFile(file.id)}
                  onToggleStar={() => toggleStar(file.id)}
                  onMove={(folder) => moveFile(file.id, folder)}
                  folders={folders}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}

          {filteredFiles.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {searchQuery ? 'No files found' : 'No files yet'}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* New File Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">File Name</label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Untitled Document"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Folder (optional)</label>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Unfiled</option>
                {folders.map(folder => (
                  <option key={folder} value={folder}>{folder}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFile}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FileItemProps {
  file: NebulaFile;
  isActive: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onMove: (folder: string) => void;
  folders: string[];
  formatDate: (date: string) => string;
}

function FileItem({
  file,
  isActive,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onToggleStar,
  onMove,
  folders,
  formatDate,
}: FileItemProps) {
  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition cursor-pointer ${
        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
      }`}
      onClick={onOpen}
    >
      <File className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{file.name}</div>
        <div className="text-xs text-muted-foreground">{formatDate(file.updatedAt)}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        className="opacity-0 group-hover:opacity-100 transition"
      >
        <Star
          className={`h-4 w-4 ${file.starred ? 'fill-yellow-500 text-yellow-500' : ''}`}
        />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>
            <Edit2 className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {folders.map(folder => (
            <DropdownMenuItem key={folder} onClick={() => onMove(folder)}>
              <Folder className="h-4 w-4 mr-2" />
              Move to {folder}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
