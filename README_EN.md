# File System Visualization Project

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.4+-4FC08D?logo=vue.js)](https://vuejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.161+-000000?logo=three.js)](https://threejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-339933?logo=node.js)](https://nodejs.org/)
[![C++](https://img.shields.io/badge/C++-17+-00599C?logo=cplusplus)](https://isocpp.org/)
[![CMake](https://img.shields.io/badge/CMake-3.15+-064F8C?logo=cmake)](https://cmake.org/)

An interactive file system visualization teaching tool based on Vue3 + Three.js, demonstrating core file system principles and operations through 3D visualization.

## ✨ Features

- 🎨 **3D Visualization**: 3D visualization of disk blocks and directory trees using Three.js
- 📊 **Performance Monitoring**: Real-time monitoring of disk utilization, fragmentation rate, IO throughput, and more
- 🔧 **File Operations**: Support for file creation, deletion, directory management, and more
- 📈 **Data Charts**: Multiple chart types for performance data visualization
- 💻 **Terminal Emulation**: Unix-like terminal interface with common file system commands
- 📚 **Teaching Guide**: Complete operation guide and principle explanations

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

## 📖 Documentation

For detailed documentation, please see the [docs](./docs/) directory:

- [Installation Guide](./docs/installation.md) - Detailed installation and configuration instructions
- [Features](./docs/features.md) - Complete feature list and descriptions
- [Architecture](./docs/architecture.md) - System architecture and module design
- [Usage Guide](./docs/usage.md) - Detailed usage instructions and examples
- [Development Guide](./docs/development.md) - Development environment setup and coding standards

## 🛠️ Tech Stack

- **Frontend Framework**: Vue 3 (Composition API)
- **State Management**: Pinia
- **3D Rendering**: Three.js
- **Data Charts**: ECharts
- **UI Components**: Ant Design Vue
- **Animation**: GSAP
- **Build Tool**: Vite
- **Styling**: Tailwind CSS

## 📁 Project Structure

```
file_system_view/
├── src/              # Source code
├── cli/              # C++ command-line tool
├── docs/             # Documentation
├── example/           # Example files
└── package.json
```

## 🎯 Core Features

### File System Operations
- File creation/deletion
- Directory creation/navigation
- Three allocation algorithms (Contiguous/Linked/Indexed)
- Defragmentation

### Visualization
- 3D disk block grid
- 3D directory tree structure
- Real-time status updates
- Interactive selection

### Performance Monitoring
- Real-time metrics monitoring
- Multiple chart types
- Data export functionality

## 📝 Command Line Tool (fcon)

The project includes a C++ command-line tool `fcon` for scanning Linux file systems and generating JSON configuration files, making it easy to quickly import file system data.

### Features

- 🔍 **File System Scanning**: Recursively scan directories or individual files
- 📄 **JSON Generation**: Automatically generate JSON configuration files in the project format
- ⚙️ **Flexible Configuration**: Support custom block size and file system types
- 📊 **Auto Calculation**: Automatically calculate fragmentation rate and block allocation
- 🎯 **Multiple Algorithms**: Support contiguous, linked, and indexed allocation algorithms

### Quick Start

#### Install Dependencies

```bash
cd cli
# Install nlohmann-json library (recommended using system package manager)
sudo apt-get install nlohmann-json3-dev  # Ubuntu/Debian
# Or download to local
git clone https://github.com/nlohmann/json.git third_party/nlohmann_json
```

#### Build

```bash
cd cli
mkdir build && cd build
cmake ..
make
```

#### Usage Examples

```bash
# Scan directory
./bin/fcon /home/user/documents

# Specify output file and parameters
./bin/fcon /home/user/documents -o output.json -b 4 -t FAT32

# Scan single file
./bin/fcon /path/to/file.txt
```

### Command Line Options

- `-o, --output <file>`: Specify output JSON file path (default: filesystem.json)
- `-b, --block-size <size>`: Specify block size in KB (default: 4)
- `-t, --type <type>`: Specify file system type (FAT32/Ext4/NTFS, default: FAT32)
- `-h, --help`: Show help information

### Output Format

The generated JSON file can be directly imported into the visualization tool. Format example:

```json
{
  "fileSystemType": "FAT32",
  "disk": {
    "totalBlocks": 1000,
    "blockSize": 4096,
    "fragmentRate": 5.2,
    "freeBlocks": [...],
    "files": [...]
  }
}
```

For detailed information, please see [cli/README.md](./cli/README.md)

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

MIT License

## 🔗 Related Links

- [Vue 3 Documentation](https://vuejs.org/)
- [Three.js Documentation](https://threejs.org/)
- [Ant Design Vue](https://antdv.com/)

