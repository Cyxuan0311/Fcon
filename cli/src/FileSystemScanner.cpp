#include "FileSystemScanner.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <random>
#include <algorithm>
#include <ctime>

FileSystemScanner::FileSystemScanner(size_t blockSize, const std::string& fileSystemType)
    : blockSize_(blockSize)
    , fileSystemType_(fileSystemType)
    , fileCount_(0)
    , directoryCount_(0)
    , totalSize_(0)
    , totalBlocks_(0)
    , nextFileId_(1)
    , nextDirectoryId_(1)
    , nextBlockIndex_(0)
{
}

void FileSystemScanner::scanDirectory(const std::string& path) {
    fs::path rootPath(path);
    
    // 创建根目录条目
    FileEntry rootDir;
    rootDir.id = "root";
    rootDir.name = rootPath.filename().string();
    if (rootDir.name.empty()) {
        rootDir.name = "/";
    }
    rootDir.type = "directory";
    rootDir.size = 0;
    rootDir.parentId = "";
    rootDir.createTime = getFileTime(rootPath);
    rootDir.allocationAlgorithm = "";
    files_.push_back(rootDir);
    directoryCount_++;
    
    // 递归扫描目录
    scanDirectoryRecursive(rootPath, "root");
}

void FileSystemScanner::scanFile(const std::string& path) {
    fs::path filePath(path);
    
    // 创建根目录条目
    FileEntry rootDir;
    rootDir.id = "root";
    rootDir.name = "/";
    rootDir.type = "directory";
    rootDir.size = 0;
    rootDir.parentId = "";
    rootDir.createTime = getFileTime(filePath.parent_path());
    rootDir.allocationAlgorithm = "";
    files_.push_back(rootDir);
    directoryCount_++;
    
    // 添加文件条目
    FileEntry file;
    file.id = generateFileId();
    file.name = filePath.filename().string();
    file.type = "file";
    
    try {
        if (fs::exists(filePath) && fs::is_regular_file(filePath)) {
            file.size = fs::file_size(filePath);
            file.createTime = getFileTime(filePath);
        } else {
            file.size = 0;
            file.createTime = formatTime(fs::file_time_type::clock::now());
        }
    } catch (const std::exception& e) {
        std::cerr << "警告: 无法获取文件大小: " << e.what() << "\n";
        file.size = 0;
        file.createTime = formatTime(fs::file_time_type::clock::now());
    }
    
    file.parentId = "root";
    file.blocks = allocateBlocks(file.size);
    file.allocationAlgorithm = "continuous";
    
    files_.push_back(file);
    fileCount_++;
    totalSize_ += file.size;
}

void FileSystemScanner::scanDirectoryRecursive(const fs::path& path, const std::string& parentId) {
    try {
        for (const auto& entry : fs::directory_iterator(path)) {
            try {
                if (entry.is_directory()) {
                    // 创建目录条目
                    FileEntry dir;
                    dir.id = generateDirectoryId();
                    dir.name = entry.path().filename().string();
                    dir.type = "directory";
                    dir.size = 0;
                    dir.parentId = parentId;
                    dir.createTime = getFileTime(entry.path());
                    dir.allocationAlgorithm = "";
                    dir.blocks = {};
                    
                    files_.push_back(dir);
                    directoryCount_++;
                    
                    // 递归扫描子目录
                    scanDirectoryRecursive(entry.path(), dir.id);
                } else if (entry.is_regular_file()) {
                    // 创建文件条目
                    FileEntry file;
                    file.id = generateFileId();
                    file.name = entry.path().filename().string();
                    file.type = "file";
                    
                    try {
                        file.size = fs::file_size(entry.path());
                        file.createTime = getFileTime(entry.path());
                    } catch (const std::exception& e) {
                        std::cerr << "警告: 无法获取文件大小 " << entry.path() << ": " << e.what() << "\n";
                        file.size = 0;
                        file.createTime = formatTime(fs::file_time_type::clock::now());
                    }
                    
                    file.parentId = parentId;
                    file.blocks = allocateBlocks(file.size);
                    file.allocationAlgorithm = "continuous";
                    
                    files_.push_back(file);
                    fileCount_++;
                    totalSize_ += file.size;
                }
            } catch (const std::exception& e) {
                std::cerr << "警告: 跳过条目 " << entry.path() << ": " << e.what() << "\n";
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "警告: 无法扫描目录 " << path << ": " << e.what() << "\n";
    }
}

std::vector<int> FileSystemScanner::allocateBlocks(size_t fileSize, const std::string& algorithm) {
    size_t requiredBlocks = (fileSize + blockSize_ - 1) / blockSize_;  // 向上取整
    std::vector<int> blocks;
    
    if (requiredBlocks == 0) {
        return blocks;
    }
    
    if (algorithm == "continuous") {
        // 连续分配：从nextBlockIndex_开始分配连续块
        for (size_t i = 0; i < requiredBlocks; i++) {
            int blockNum = nextBlockIndex_++;
            blocks.push_back(blockNum);
            usedBlocks_[blockNum] = "";  // 文件ID稍后设置
            totalBlocks_++;
        }
    } else if (algorithm == "linked") {
        // 链接分配：随机分配块
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_int_distribution<> dis(0, 10000);
        
        for (size_t i = 0; i < requiredBlocks; i++) {
            int blockNum = nextBlockIndex_++;
            blocks.push_back(blockNum);
            usedBlocks_[blockNum] = "";
            totalBlocks_++;
        }
    } else {
        // 默认使用连续分配
        for (size_t i = 0; i < requiredBlocks; i++) {
            int blockNum = nextBlockIndex_++;
            blocks.push_back(blockNum);
            usedBlocks_[blockNum] = "";
            totalBlocks_++;
        }
    }
    
    return blocks;
}

double FileSystemScanner::calculateFragmentRate() const {
    if (totalBlocks_ == 0) {
        return 0.0;
    }
    
    // 计算碎片率：非连续块的数量 / 总块数
    int fragmentedBlocks = 0;
    std::vector<int> sortedBlocks;
    
    for (const auto& file : files_) {
        if (file.type == "file" && !file.blocks.empty()) {
            sortedBlocks.insert(sortedBlocks.end(), file.blocks.begin(), file.blocks.end());
        }
    }
    
    if (sortedBlocks.size() < 2) {
        return 0.0;
    }
    
    std::sort(sortedBlocks.begin(), sortedBlocks.end());
    
    for (size_t i = 1; i < sortedBlocks.size(); i++) {
        if (sortedBlocks[i] != sortedBlocks[i-1] + 1) {
            fragmentedBlocks++;
        }
    }
    
    return (fragmentedBlocks * 100.0) / totalBlocks_;
}

std::string FileSystemScanner::generateFileId() {
    std::ostringstream oss;
    oss << "file-" << nextFileId_;
    nextFileId_++;
    return oss.str();
}

std::string FileSystemScanner::generateDirectoryId() {
    std::ostringstream oss;
    oss << "dir-" << nextDirectoryId_;
    nextDirectoryId_++;
    return oss.str();
}

std::string FileSystemScanner::formatTime(const fs::file_time_type& time) {
    // 转换为system_clock
    auto sctp = std::chrono::time_point_cast<std::chrono::system_clock::duration>(
        time - fs::file_time_type::clock::now() + std::chrono::system_clock::now()
    );
    
    std::time_t tt = std::chrono::system_clock::to_time_t(sctp);
    std::tm* tm = std::gmtime(&tt);
    
    std::ostringstream oss;
    oss << std::put_time(tm, "%Y-%m-%dT%H:%M:%S.000Z");
    return oss.str();
}

std::string FileSystemScanner::getFileTime(const fs::path& path) {
    try {
        if (fs::exists(path)) {
            auto ftime = fs::last_write_time(path);
            return formatTime(ftime);
        }
    } catch (const std::exception& e) {
        // 忽略错误，使用当前时间
    }
    
    // 如果无法获取文件时间，使用当前时间
    auto now = std::chrono::system_clock::now();
    auto tt = std::chrono::system_clock::to_time_t(now);
    std::tm* tm = std::gmtime(&tt);
    
    std::ostringstream oss;
    oss << std::put_time(tm, "%Y-%m-%dT%H:%M:%S.000Z");
    return oss.str();
}

void FileSystemScanner::generateJSON(const std::string& outputPath) {
    nlohmann::json json;
    
    // 设置文件系统类型
    json["fileSystemType"] = fileSystemType_;
    
    // 计算总块数（至少为已使用的块数，可以设置一个合理的上限）
    size_t calculatedTotalBlocks = std::max(totalBlocks_, size_t(1000));
    if (totalBlocks_ > 0) {
        // 添加一些空闲块
        calculatedTotalBlocks = totalBlocks_ + (totalBlocks_ / 10);  // 增加10%的空闲块
    }
    
    // 生成空闲块列表
    std::vector<int> freeBlocksList;
    for (int i = 0; i < static_cast<int>(calculatedTotalBlocks); i++) {
        if (usedBlocks_.find(i) == usedBlocks_.end()) {
            freeBlocksList.push_back(i);
        }
    }
    
    // 构建磁盘对象
    nlohmann::json disk;
    disk["id"] = "disk-1";
    disk["totalBlocks"] = calculatedTotalBlocks;
    disk["blockSize"] = static_cast<int>(blockSize_);
    disk["fragmentRate"] = calculateFragmentRate();
    disk["freeBlocks"] = freeBlocksList;
    disk["usedBlocks"] = nlohmann::json::object();  // 空对象，因为usedBlocks在JSON中不需要
    
    // 构建文件数组
    nlohmann::json filesArray = nlohmann::json::array();
    for (const auto& file : files_) {
        nlohmann::json fileJson;
        fileJson["id"] = file.id;
        fileJson["name"] = file.name;
        fileJson["type"] = file.type;
        fileJson["size"] = static_cast<int>(file.size);
        fileJson["blocks"] = file.blocks;
        fileJson["parentId"] = file.parentId;
        fileJson["createTime"] = file.createTime;
        
        if (file.type == "file" && !file.allocationAlgorithm.empty()) {
            fileJson["allocationAlgorithm"] = file.allocationAlgorithm;
        } else {
            fileJson["allocationAlgorithm"] = nullptr;
        }
        
        filesArray.push_back(fileJson);
    }
    
    disk["files"] = filesArray;
    json["disk"] = disk;
    
    // 写入文件
    std::ofstream outFile(outputPath);
    if (!outFile.is_open()) {
        throw std::runtime_error("无法打开输出文件: " + outputPath);
    }
    
    outFile << json.dump(2);  // 缩进2个空格，美化输出
    outFile.close();
}

