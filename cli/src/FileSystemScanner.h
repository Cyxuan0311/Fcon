#ifndef FILESYSTEM_SCANNER_H
#define FILESYSTEM_SCANNER_H

#include <string>
#include <vector>
#include <map>
#include <filesystem>
#include <nlohmann/json.hpp>

namespace fs = std::filesystem;

struct FileEntry {
    std::string id;
    std::string name;
    std::string type;  // "file" or "directory"
    size_t size;
    std::vector<int> blocks;
    std::string parentId;
    std::string createTime;
    std::string allocationAlgorithm;  // "continuous", "linked", "indexed", or null for directories
};

class FileSystemScanner {
public:
    FileSystemScanner(size_t blockSize, const std::string& fileSystemType);
    
    // 扫描目录
    void scanDirectory(const std::string& path);
    
    // 扫描单个文件
    void scanFile(const std::string& path);
    
    // 生成JSON文件
    void generateJSON(const std::string& outputPath);
    
    // 获取统计信息
    size_t getFileCount() const { return fileCount_; }
    size_t getDirectoryCount() const { return directoryCount_; }
    size_t getTotalSize() const { return totalSize_; }
    size_t getTotalBlocks() const { return totalBlocks_; }

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

private:
    size_t blockSize_;              // 块大小（字节）
    std::string fileSystemType_;    // 文件系统类型
    std::vector<FileEntry> files_;  // 文件列表
    std::map<int, std::string> usedBlocks_;  // 已使用的块 -> 文件ID
    std::vector<int> freeBlocks_;  // 空闲块列表
    
    // 统计信息
    size_t fileCount_;
    size_t directoryCount_;
    size_t totalSize_;
    size_t totalBlocks_;
    int nextFileId_;
    int nextDirectoryId_;
    
    // 块分配状态
    int nextBlockIndex_;
};

#endif // FILESYSTEM_SCANNER_H

