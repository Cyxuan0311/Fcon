# fcon - 文件系统JSON生成工具

一个用C++开发的跨平台命令行工具，用于扫描文件系统并生成对应的JSON配置文件。支持Linux、macOS和Windows系统。

## 功能特性

- 扫描目录或单个文件
- 生成符合项目格式的JSON文件
- 支持自定义块大小和文件系统类型
- 自动计算碎片率
- 支持FAT32、Ext4、NTFS文件系统类型

## 依赖要求

- C++17 或更高版本
- CMake 3.15 或更高版本
- nlohmann-json 库（3.2.0或更高版本）

## 安装nlohmann-json库

### 方法1: 使用系统包管理器安装

#### Linux

**Ubuntu/Debian:**
```bash
sudo apt-get install nlohmann-json3-dev
```

**Fedora/RHEL:**
```bash
sudo dnf install nlohmann-json-devel
```

**Arch Linux:**
```bash
sudo pacman -S nlohmann-json
```

#### Windows

**使用vcpkg（推荐）:**
```cmd
vcpkg install nlohmann-json
```

**使用Conan:**
```cmd
conan install nlohmann_json/3.11.2@
```

#### macOS

```bash
brew install nlohmann-json
```

### 方法2: 使用本地库（推荐）

1. 下载nlohmann-json到项目目录：
```bash
cd cli
git clone https://github.com/nlohmann/json.git third_party/nlohmann_json
```

或者手动下载并解压到以下任一目录：
- `cli/third_party/nlohmann_json`
- `cli/third_party/json`
- `cli/vendor/nlohmann_json`
- `cli/vendor/json`
- `cli/external/nlohmann_json`
- `cli/external/json`
- `cli/libs/nlohmann_json`
- `cli/libs/json`

2. 确保目录结构如下：
```
cli/
  third_party/
    nlohmann_json/
      include/
        nlohmann/
          json.hpp
```

### 方法3: 放在include目录

也可以直接将`json.hpp`放在`cli/include/nlohmann/`目录下。

## 编译

### Linux/macOS

```bash
cd cli
mkdir build
cd build
cmake ..
make
```

编译后的可执行文件位于 `build/bin/fcon`

### Windows

#### 使用Visual Studio

```cmd
cd cli
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
```

或者使用CMake GUI：
1. 打开CMake GUI
2. 设置源代码目录为 `cli`
3. 设置构建目录为 `cli/build`
4. 点击Configure，选择Visual Studio生成器
5. 点击Generate
6. 在Visual Studio中打开生成的解决方案并构建

编译后的可执行文件位于：
- Debug: `build/bin/Debug/fcon.exe`
- Release: `build/bin/Release/fcon.exe`

#### 使用MinGW

```cmd
cd cli
mkdir build
cd build
cmake .. -G "MinGW Makefiles"
cmake --build .
```

编译后的可执行文件位于 `build/bin/fcon.exe`

## 安装

### Linux/macOS

```bash
cd build
sudo make install
```

默认安装到 `/usr/local/bin/fcon`

### Windows

#### 使用CMake安装

```cmd
cd build
cmake --install . --config Release
```

默认安装到 `C:\Program Files\fcon\bin\fcon.exe`

#### 手动安装

将编译好的 `fcon.exe` 复制到系统PATH目录，例如：
- `C:\Windows\System32`
- 或添加到用户PATH环境变量中的自定义目录

## 使用方法

### 基本用法

#### Linux/macOS

```bash
# 扫描目录
fcon /home/user/documents

# 扫描单个文件
fcon /home/user/file.txt

# 指定输出文件
fcon /home/user/documents -o output.json

# 指定块大小（KB）
fcon /home/user/documents -b 8

# 指定文件系统类型
fcon /home/user/documents -t Ext4

# 组合使用
fcon /home/user/documents -o filesystem.json -b 4 -t FAT32
```

#### Windows

```cmd
# 扫描目录
fcon.exe C:\Users\Username\Documents

# 扫描单个文件
fcon.exe C:\Users\Username\file.txt

# 指定输出文件
fcon.exe C:\Users\Username\Documents -o output.json

# 指定块大小（KB）
fcon.exe C:\Users\Username\Documents -b 8

# 指定文件系统类型
fcon.exe C:\Users\Username\Documents -t Ext4

# 组合使用
fcon.exe C:\Users\Username\Documents -o filesystem.json -b 4 -t FAT32
```

**注意**: Windows路径可以使用正斜杠或反斜杠，两种方式都支持：
- `C:\Users\Documents` (反斜杠)
- `C:/Users/Documents` (正斜杠)

### 命令行选项

- `-o, --output <文件>`: 指定输出JSON文件路径（默认: filesystem.json）
- `-b, --block-size <大小>`: 指定块大小，单位KB（默认: 4）
- `-t, --type <类型>`: 指定文件系统类型（FAT32/Ext4/NTFS，默认: FAT32）
- `-h, --help`: 显示帮助信息

## 输出格式

生成的JSON文件格式如下：

```json
{
  "fileSystemType": "FAT32",
  "disk": {
    "id": "disk-1",
    "totalBlocks": 1000,
    "blockSize": 4096,
    "fragmentRate": 5.2,
    "freeBlocks": [0, 1, 2, ...],
    "usedBlocks": {},
    "files": [
      {
        "id": "file-1",
        "name": "example.txt",
        "type": "file",
        "size": 8192,
        "blocks": [10, 11],
        "parentId": "root",
        "createTime": "2024-01-01T10:00:00.000Z",
        "allocationAlgorithm": "continuous"
      }
    ]
  }
}
```

## 示例

### Linux/macOS

```bash
# 扫描当前目录
fcon .

# 扫描用户主目录并保存为特定文件名
fcon ~ -o my_filesystem.json

# 使用8KB块大小扫描
fcon /var/log -b 8 -t Ext4 -o log_filesystem.json
```

### Windows

```cmd
# 扫描当前目录
fcon.exe .

# 扫描用户主目录并保存为特定文件名
fcon.exe %USERPROFILE% -o my_filesystem.json

# 使用8KB块大小扫描
fcon.exe C:\Windows\Logs -b 8 -t NTFS -o log_filesystem.json

# 扫描Program Files目录
fcon.exe "C:\Program Files" -o program_files.json
```

## 注意事项

- 扫描大型目录可能需要一些时间
- 某些文件可能无法访问（权限问题），会显示警告但不会中断扫描
- 生成的JSON文件可以直接导入到文件系统可视化工具中使用

## 故障排除

### 找不到nlohmann-json

如果CMake找不到nlohmann-json库，请确保：

1. 库已正确安装在系统路径中，或
2. 库已放置在支持的本地目录中（见上面的方法2），或
3. 库已放置在`cli/include/nlohmann/`目录中

### 编译错误

#### Linux/macOS

确保使用C++17或更高版本的编译器：
```bash
g++ --version  # 应该显示7.0或更高版本
```

#### Windows

- **Visual Studio**: 确保使用Visual Studio 2019或更高版本
- **MinGW**: 确保使用GCC 7.0或更高版本
- 如果遇到filesystem相关错误，可能需要链接`stdc++fs`库（GCC）或使用`/std:c++17`选项（MSVC）

### 权限错误

如果遇到权限问题，确保对要扫描的目录有读取权限。

#### Windows特定

- 某些系统目录（如`C:\Windows\System32`）可能需要管理员权限
- 如果遇到"拒绝访问"错误，尝试以管理员身份运行命令提示符

### Windows路径问题

- 如果路径包含空格，请使用引号：`fcon.exe "C:\Program Files"`
- 支持相对路径和绝对路径
- 支持UNC路径（网络路径）：`\\server\share\folder`

