#ifndef FILESYSTEM_SCANNER_H
#define FILESYSTEM_SCANNER_H

#include <string>
#include <vector>
#include <map>
#include <filesystem>
#include <nlohmann/json.hpp>
#include <thread>
#include <mutex>
#include <atomic>
#include <queue>
#include <condition_variable>
#include <future>
#include <functional>
#ifdef _WIN32
#include <windows.h>
#include <winioctl.h>
#else
#include <sys/stat.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <linux/fs.h>
// 尝试包含 fiemap.h，如果不存在则手动定义
#ifdef __has_include
#if __has_include(<linux/fiemap.h>)
#include <linux/fiemap.h>
#endif
#else
// 如果没有 __has_include，尝试直接包含
#include <linux/fiemap.h>
#endif
// 确保 FIEMAP 标志已定义
#ifndef FIEMAP_FLAG_SYNC
#define FIEMAP_FLAG_SYNC 0x00000001
#endif
#ifndef FIEMAP_FLAG_MORE
#define FIEMAP_FLAG_MORE 0x00000002
#endif
#endif // _WIN32

namespace fs = std::filesystem;

// 文件索引地址结构（extent）
struct ExtentInfo {
    unsigned long long logicalOffset;   // 逻辑偏移（文件内的字节偏移）
    unsigned long long physicalOffset; // 物理偏移（磁盘上的块号）
    unsigned long long length;         // 长度（字节数）
};

struct FileEntry {
    std::string id;
    std::string name;
    std::string type;  // "file" or "directory"
    size_t size;
    std::vector<int> blocks;
    std::string parentId;
    std::string createTime;
    std::string allocationAlgorithm;  // "continuous", "linked", "indexed", or null for directories
    // 物理地址信息
    unsigned long long inode;      // inode 号（Linux）或文件索引号（Windows）
    unsigned long long deviceId;    // 设备ID
    std::string physicalPath;      // 物理路径（完整路径）
    // 索引地址信息（extent 映射）
    std::vector<ExtentInfo> extents;  // 文件的 extent 列表
};

class FileSystemScanner {
public:
    // 进度回调函数类型：void callback(size_t files, size_t dirs, size_t totalSize)
    using ProgressCallback = std::function<void(size_t, size_t, size_t)>;
    
    FileSystemScanner(size_t blockSize, const std::string& fileSystemType);
    
    // 扫描目录
    void scanDirectory(const std::string& path);
    
    // 扫描单个文件
    void scanFile(const std::string& path);
    
    // 生成JSON文件
    void generateJSON(const std::string& outputPath);
    
    // 设置进度回调
    void setProgressCallback(ProgressCallback callback) { progressCallback_ = callback; }
    
    // 获取统计信息（原子变量需要调用load()）
    size_t getFileCount() const { return fileCount_.load(); }
    size_t getDirectoryCount() const { return directoryCount_.load(); }
    size_t getTotalSize() const { return totalSize_.load(); }
    size_t getTotalBlocks() const { return totalBlocks_.load(); }
    
    // 检查是否有 root 权限
    static bool hasRootPrivileges();
    
    // 尝试使用 sudo 执行命令（仅用于提示）
    static void suggestSudoUsage();
    
    // 设置是否在权限不足时自动提示
    void setAutoSuggestRoot(bool enable) { autoSuggestRoot_ = enable; }

private:
    // 扫描目录（递归）
    void scanDirectoryRecursive(const fs::path& path, const std::string& parentId);
    
    // 分配块给文件
    std::vector<int> allocateBlocks(size_t fileSize, const std::string& algorithm = "continuous");
    
    // 计算碎片率
    double calculateFragmentRate() const;
    
    // 生成文件ID
    std::string generateFileId();
    
    // 生成目录ID
    std::string generateDirectoryId();
    
    // 格式化时间
    std::string formatTime(const fs::file_time_type& time);
    
    // 获取文件系统时间（兼容不同C++标准）
    std::string getFileTime(const fs::path& path);
    
    // 获取文件的物理地址信息（inode、设备ID等）
    void getPhysicalAddress(const fs::path& path, FileEntry& entry);
    
    // 获取文件的索引地址信息（extent 映射）
    void getIndexAddress(const fs::path& path, FileEntry& entry);
    
    // 根据 extent 信息判断分配算法
    std::string determineAllocationAlgorithm(const FileEntry& entry);

private:
    // 多线程扫描目录（并行版本）
    void scanDirectoryRecursiveParallel(const fs::path& path, const std::string& parentId);
    
    // 工作线程函数
    void workerThread();
    
    // 处理单个目录条目
    void processDirectoryEntry(const fs::path& entryPath, const std::string& parentId);
    
    // 线程安全的ID生成
    std::string generateFileIdThreadSafe();
    std::string generateDirectoryIdThreadSafe();
    
    // 线程安全的块分配
    std::vector<int> allocateBlocksThreadSafe(size_t fileSize, const std::string& algorithm = "continuous");

private:
    size_t blockSize_;              // 块大小（字节）
    std::string fileSystemType_;    // 文件系统类型
    std::vector<FileEntry> files_;  // 文件列表
    std::map<int, std::string> usedBlocks_;  // 已使用的块 -> 文件ID
    std::vector<int> freeBlocks_;  // 空闲块列表
    
    // 统计信息（使用原子变量保证线程安全）
    std::atomic<size_t> fileCount_;
    std::atomic<size_t> directoryCount_;
    std::atomic<size_t> totalSize_;
    std::atomic<size_t> totalBlocks_;
    std::atomic<int> nextFileId_;
    std::atomic<int> nextDirectoryId_;
    
    // 块分配状态（使用原子变量保证线程安全）
    std::atomic<int> nextBlockIndex_;
    
    // 多线程同步（mutable 允许在 const 函数中使用）
    mutable std::mutex filesMutex_;          // 保护 files_ 向量
    mutable std::mutex blocksMutex_;         // 保护 usedBlocks_ 和块分配
    std::mutex idMutex_;             // 保护ID生成（如果原子变量不够用）
    
    // 线程池相关
    std::queue<std::pair<fs::path, std::string>> workQueue_;  // 待处理的目录队列
    std::mutex queueMutex_;          // 保护工作队列
    std::condition_variable queueCondition_;  // 工作队列条件变量
    std::vector<std::thread> workerThreads_;  // 工作线程
    std::atomic<bool> stopWorkers_;  // 停止工作线程标志
    size_t numThreads_;              // 线程数量
    
    // 进度回调
    ProgressCallback progressCallback_;
    
    // 是否在权限不足时自动提示
    bool autoSuggestRoot_;
    
    // 是否已经提示过权限问题（避免重复提示）
    mutable bool rootSuggestionShown_;
    
    // 通知进度更新
    void notifyProgress();
};

#endif // FILESYSTEM_SCANNER_H

