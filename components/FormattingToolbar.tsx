"use client";

import React, { useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Indent,
  Outdent,
  Quote,
  Code,
  Code2,
  Link,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Type,
  Paintbrush,
  Eraser,
  Undo,
  Redo,
  ChevronDown,
  WrapText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FormattingToolbarProps {
  onFormat?: (command: string, value?: string) => void;
  activeFormats?: Set<string>;
}

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Sans Serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const FONT_SIZES = [
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '14px' },
  { label: 'Medium', value: '16px' },
  { label: 'Large', value: '18px' },
  { label: 'Huge', value: '24px' },
];

const LINE_HEIGHTS = [
  { label: 'Single', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Double', value: '2' },
];

export function FormattingToolbar({ onFormat, activeFormats = new Set() }: FormattingToolbarProps) {
  const [textColor, setTextColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffff00');
  const [selectedFont, setSelectedFont] = useState('Default');
  const [selectedSize, setSelectedSize] = useState('Normal');
  const [selectedLineHeight, setSelectedLineHeight] = useState('Single');

  const handleFormat = (command: string, value?: string) => {
    if (onFormat) {
      onFormat(command, value);
    }
  };

  const ToolbarButton = ({ 
    icon: Icon, 
    command, 
    value,
    tooltip, 
    active = false 
  }: { 
    icon: any; 
    command: string; 
    value?: string;
    tooltip: string; 
    active?: boolean;
  }) => (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={() => handleFormat(command, value)}
      title={tooltip}
      className={`h-8 w-8 p-0 transition-colors ${
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
      }`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="sticky top-0 z-50 border-b bg-[hsl(var(--toolbar-bg))] backdrop-blur-sm shadow-sm transition-colors">
      <div className="mx-auto max-w-full px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Text Formatting Group */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={Bold}
              command="bold"
              tooltip="Bold (Ctrl+B)"
              active={activeFormats.has('bold')}
            />
            <ToolbarButton
              icon={Italic}
              command="italic"
              tooltip="Italic (Ctrl+I)"
              active={activeFormats.has('italic')}
            />
            <ToolbarButton
              icon={Underline}
              command="underline"
              tooltip="Underline (Ctrl+U)"
              active={activeFormats.has('underline')}
            />
            <ToolbarButton
              icon={Strikethrough}
              command="strikethrough"
              tooltip="Strikethrough"
              active={activeFormats.has('strikethrough')}
            />
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Font Family */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 gap-1 hover:bg-muted"
                title="Font family"
              >
                <Type className="h-4 w-4" />
                <span className="text-xs max-w-[80px] truncate">{selectedFont}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              <DropdownMenuLabel>Font Family</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {FONT_FAMILIES.map((font) => (
                <DropdownMenuItem
                  key={font.value}
                  onClick={() => {
                    setSelectedFont(font.label);
                    handleFormat('fontFamily', font.value);
                  }}
                  style={{ fontFamily: font.value || 'inherit' }}
                >
                  {font.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Font Size */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 gap-1 hover:bg-muted"
                title="Font size"
              >
                <span className="text-xs">{selectedSize}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Font Size</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {FONT_SIZES.map((size) => (
                <DropdownMenuItem
                  key={size.value}
                  onClick={() => {
                    setSelectedSize(size.label);
                    handleFormat('fontSize', size.value);
                  }}
                >
                  {size.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          {/* Color Pickers */}
          <div className="flex items-center gap-0.5">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-muted relative"
                title="Text color"
                onClick={() => document.getElementById('text-color-picker')?.click()}
              >
                <Type className="h-4 w-4" />
                <div 
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded"
                  style={{ backgroundColor: textColor }}
                />
              </Button>
              <input
                id="text-color-picker"
                type="color"
                value={textColor}
                onChange={(e) => {
                  setTextColor(e.target.value);
                  handleFormat('foreColor', e.target.value);
                }}
                className="absolute opacity-0 w-0 h-0"
              />
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-muted relative"
                title="Background color"
                onClick={() => document.getElementById('bg-color-picker')?.click()}
              >
                <Paintbrush className="h-4 w-4" />
                <div 
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded"
                  style={{ backgroundColor: bgColor }}
                />
              </Button>
              <input
                id="bg-color-picker"
                type="color"
                value={bgColor}
                onChange={(e) => {
                  setBgColor(e.target.value);
                  handleFormat('backColor', e.target.value);
                }}
                className="absolute opacity-0 w-0 h-0"
              />
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={AlignLeft}
              command="justifyLeft"
              tooltip="Align left"
              active={activeFormats.has('alignLeft')}
            />
            <ToolbarButton
              icon={AlignCenter}
              command="justifyCenter"
              tooltip="Align center"
              active={activeFormats.has('alignCenter')}
            />
            <ToolbarButton
              icon={AlignRight}
              command="justifyRight"
              tooltip="Align right"
              active={activeFormats.has('alignRight')}
            />
            <ToolbarButton
              icon={AlignJustify}
              command="justifyFull"
              tooltip="Justify"
              active={activeFormats.has('alignJustify')}
            />
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Line Height */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 gap-1 hover:bg-muted"
                title="Line spacing"
              >
                <WrapText className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Line Spacing</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LINE_HEIGHTS.map((height) => (
                <DropdownMenuItem
                  key={height.value}
                  onClick={() => {
                    setSelectedLineHeight(height.label);
                    handleFormat('lineHeight', height.value);
                  }}
                >
                  {height.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Indentation */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={Outdent}
              command="outdent"
              tooltip="Decrease indent"
            />
            <ToolbarButton
              icon={Indent}
              command="indent"
              tooltip="Increase indent"
            />
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Lists */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={List}
              command="insertUnorderedList"
              tooltip="Bullet list"
              active={activeFormats.has('bulletList')}
            />
            <ToolbarButton
              icon={ListOrdered}
              command="insertOrderedList"
              tooltip="Numbered list"
              active={activeFormats.has('orderedList')}
            />
            <ToolbarButton
              icon={CheckSquare}
              command="insertCheckbox"
              tooltip="Checklist"
            />
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Headings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 gap-1 hover:bg-muted"
                title="Headings"
              >
                <Heading1 className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Headings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleFormat('formatBlock', 'h1')} className="gap-2">
                <Heading1 className="h-4 w-4" /> Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFormat('formatBlock', 'h2')} className="gap-2">
                <Heading2 className="h-4 w-4" /> Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFormat('formatBlock', 'h3')} className="gap-2">
                <Heading3 className="h-4 w-4" /> Heading 3
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFormat('formatBlock', 'h4')} className="gap-2">
                <Heading4 className="h-4 w-4" /> Heading 4
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFormat('formatBlock', 'h5')} className="gap-2">
                <Heading5 className="h-4 w-4" /> Heading 5
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFormat('formatBlock', 'h6')} className="gap-2">
                <Heading6 className="h-4 w-4" /> Heading 6
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Advanced Formatting */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={Quote}
              command="formatBlock"
              value="blockquote"
              tooltip="Block quote"
            />
            <ToolbarButton
              icon={Code2}
              command="formatBlock"
              value="pre"
              tooltip="Code block"
            />
            <ToolbarButton
              icon={Code}
              command="code"
              tooltip="Inline code"
            />
            <ToolbarButton
              icon={Link}
              command="createLink"
              tooltip="Insert link"
            />
            <ToolbarButton
              icon={Minus}
              command="insertHorizontalRule"
              tooltip="Horizontal rule"
            />
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Actions */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={Eraser}
              command="removeFormat"
              tooltip="Clear formatting"
            />
            <ToolbarButton
              icon={Undo}
              command="undo"
              tooltip="Undo (Ctrl+Z)"
            />
            <ToolbarButton
              icon={Redo}
              command="redo"
              tooltip="Redo (Ctrl+Y)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
