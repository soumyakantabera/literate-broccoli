# Nebula Editor

An advanced Markdown ↔ NebulaXML document editor with bidirectional synchronization, built with Next.js and React.

## 🌟 Features

- **Visual Mode**: WYSIWYG-style editing with real-time rendering
- **Markdown Mode**: Direct markdown editing with Monaco Editor
- **NebulaXML Mode**: Edit the canonical XML representation
- **Bidirectional Sync**: Changes in any mode automatically sync to others
- **Command Palette**: Quick access to all commands (Ctrl/⌘ + K)
- **Find & Replace**: Search and replace across the document (Ctrl/⌘ + F)
- **Outline Navigation**: Jump to any heading in your document
- **Version History**: Save snapshots and restore previous versions
- **Comments & Highlights**: Add annotations to specific text selections
- **Import/Export**: Support for Markdown and NebulaXML formats
- **Dark Mode**: Built-in dark theme support

## 🚀 Live Demo

Visit the live demo at: [https://soumyakantabera.github.io/literate-broccoli/](https://soumyakantabera.github.io/literate-broccoli/)

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI primitives)
- **Editor**: Monaco Editor
- **Markdown**: marked, turndown
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/soumyakantabera/literate-broccoli.git

# Navigate to the project directory
cd literate-broccoli

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🏗️ Build

```bash
# Build for production
npm run build

# The static files will be generated in the 'out' directory
```

## 📝 Usage

1. **Edit in Visual Mode**: Click in the visual editor to edit content directly
2. **Switch to Markdown**: Use the Markdown tab to edit raw markdown
3. **View XML**: See the canonical NebulaXML representation
4. **Use Commands**: Press `Ctrl/⌘ + K` to open the command palette
5. **Find & Replace**: Press `Ctrl/⌘ + F` to search in the document
6. **Save Snapshots**: Click Save or press `Ctrl/⌘ + S` to create restore points
7. **Export**: Download your work as Markdown or NebulaXML

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Editor powered by [Monaco Editor](https://microsoft.github.io/monaco-editor/)
