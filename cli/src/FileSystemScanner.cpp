#include "FileSystemScanner.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <random>
#include <algorithm>
#include <ctime>
#include <thread>
#ifdef _WIN32
#include <windows.h>
#include <sddl.h>
#else
#include <sys/stat.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <errno.h>
#include <linux/fs.h>
#include <cstdlib>
#include <cstring>
// fiemap.h 已在头文件中包含
#endif

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
    , stopWorkers_(false)
    , numThreads_(std::max(1u, std::thread::hardware_concurrency()))  // 使用CPU核心数
    , progressCallback_(nullptr)
    , autoSuggestRoot_(false)
    , rootSuggestionShown_(false)
{
}

void FileSystemScanner::notifyProgress() {
    if (progressCallback_) {
        progressCallback_(fileCount_.load(), directoryCount_.load(), totalSize_.load());
    }
}

void FileSystemScanner::scanDirectory(const std::string& path) {
    fs::path rootPath(path);
    
    // 创建根目录条目
    FileEntry rootDir;
    rootDir.id = "root";
    rootDir.name = rootPath.filename().string();
    if (rootDir.name.empty()) {
        // Windows和Linux路径处理
        #ifdef _WIN32
        rootDir.name = rootPath.root_name().string() + rootPath.root_directory().string();
        if (rootDir.name.empty()) {
            rootDir.name = "\\";
        }
        #else
        rootDir.name = "/";
        #endif
    }
    rootDir.type = "directory";
    rootDir.size = 0;
    rootDir.parentId = "";
    rootDir.createTime = getFileTime(rootPath);
    rootDir.allocationAlgorithm = "";
    rootDir.inode = 0;
    rootDir.deviceId = 0;
    rootDir.physicalPath = fs::absolute(rootPath).string();
    rootDir.extents.clear();
    getPhysicalAddress(rootPath, rootDir);
    files_.push_back(rootDir);
    directoryCount_++;
    notifyProgress();
    
    // 使用多线程并行扫描目录
    scanDirectoryRecursiveParallel(rootPath, "root");
}

void FileSystemScanner::scanFile(const std::string& path) {
    fs::path filePath(path);
    
    // 创建根目录条目
    FileEntry rootDir;
    rootDir.id = "root";
    #ifdef _WIN32
    rootDir.name = "\\";
    #else
    rootDir.name = "/";
    #endif
    rootDir.type = "directory";
    rootDir.size = 0;
    rootDir.parentId = "";
    rootDir.createTime = getFileTime(filePath.parent_path());
    rootDir.allocationAlgorithm = "";
    files_.push_back(rootDir);
    directoryCount_++;
    notifyProgress();
    
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
    file.inode = 0;
    file.deviceId = 0;
    file.physicalPath = fs::absolute(filePath).string();
    file.extents.clear();
    getPhysicalAddress(filePath, file);
    if (file.type == "file") {
        getIndexAddress(filePath, file);
        // getIndexAddress 内部会设置 allocationAlgorithm
        if (file.allocationAlgorithm.empty()) {
            file.allocationAlgorithm = "continuous";  // 如果无法判断，默认连续
        }
    } else {
        file.allocationAlgorithm = "";
    }
    
    files_.push_back(file);
    fileCount_++;
    totalSize_ += file.size;
    notifyProgress();
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
                    dir.inode = 0;
                    dir.deviceId = 0;
                    dir.physicalPath = fs::absolute(entry.path()).string();
                    dir.extents.clear();
                    getPhysicalAddress(entry.path(), dir);
                    
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
                    file.inode = 0;
                    file.deviceId = 0;
                    file.physicalPath = fs::absolute(entry.path()).string();
                    file.extents.clear();
                    getPhysicalAddress(entry.path(), file);
                    getIndexAddress(entry.path(), file);
                    // getIndexAddress 内部会设置 allocationAlgorithm
                    if (file.allocationAlgorithm.empty()) {
                        file.allocationAlgorithm = "continuous";  // 如果无法判断，默认连续
                    }
                    
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
    size_t currentTotalBlocks = totalBlocks_.load();
    if (currentTotalBlocks == 0) {
        return 0.0;
    }
    
    // 计算碎片率：非连续块的数量 / 总块数
    int fragmentedBlocks = 0;
    std::vector<int> sortedBlocks;
    
    // 需要加锁读取 files_，因为可能正在被其他线程修改
    std::lock_guard<std::mutex> lock(filesMutex_);
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
    
    return (fragmentedBlocks * 100.0) / currentTotalBlocks;
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

// 线程安全的ID生成
std::string FileSystemScanner::generateFileIdThreadSafe() {
    int id = nextFileId_.fetch_add(1);
    std::ostringstream oss;
    oss << "file-" << id;
    return oss.str();
}

std::string FileSystemScanner::generateDirectoryIdThreadSafe() {
    int id = nextDirectoryId_.fetch_add(1);
    std::ostringstream oss;
    oss << "dir-" << id;
    return oss.str();
}

// 线程安全的块分配
std::vector<int> FileSystemScanner::allocateBlocksThreadSafe(size_t fileSize, const std::string& algorithm) {
    size_t requiredBlocks = (fileSize + blockSize_ - 1) / blockSize_;
    std::vector<int> blocks;
    
    if (requiredBlocks == 0) {
        return blocks;
    }
    
    std::lock_guard<std::mutex> lock(blocksMutex_);
    
    if (algorithm == "continuous") {
        // 连续分配：从nextBlockIndex_开始分配连续块
        int startIndex = nextBlockIndex_.load();
        for (size_t i = 0; i < requiredBlocks; i++) {
            int blockNum = startIndex + static_cast<int>(i);
            blocks.push_back(blockNum);
            usedBlocks_[blockNum] = "";  // 文件ID稍后设置
        }
        nextBlockIndex_ = startIndex + static_cast<int>(requiredBlocks);
        totalBlocks_ += requiredBlocks;
    } else {
        // 默认使用连续分配
        int startIndex = nextBlockIndex_.load();
        for (size_t i = 0; i < requiredBlocks; i++) {
            int blockNum = startIndex + static_cast<int>(i);
            blocks.push_back(blockNum);
            usedBlocks_[blockNum] = "";
        }
        nextBlockIndex_ = startIndex + static_cast<int>(requiredBlocks);
        totalBlocks_ += requiredBlocks;
    }
    
    return blocks;
}

// 处理单个目录条目（线程安全）
void FileSystemScanner::processDirectoryEntry(const fs::path& entryPath, const std::string& parentId) {
    try {
        if (fs::is_directory(entryPath)) {
            // 创建目录条目
            FileEntry dir;
            dir.id = generateDirectoryIdThreadSafe();
            dir.name = entryPath.filename().string();
            dir.type = "directory";
            dir.size = 0;
            dir.parentId = parentId;
            dir.createTime = getFileTime(entryPath);
            dir.allocationAlgorithm = "";
            dir.blocks = {};
            dir.inode = 0;
            dir.deviceId = 0;
            dir.physicalPath = fs::absolute(entryPath).string();
            dir.extents.clear();
            getPhysicalAddress(entryPath, dir);
            
            {
                std::lock_guard<std::mutex> lock(filesMutex_);
                files_.push_back(dir);
            }
            directoryCount_++;
            notifyProgress();
            
            // 将子目录添加到工作队列
            {
                std::lock_guard<std::mutex> lock(queueMutex_);
                workQueue_.push({entryPath, dir.id});
            }
            queueCondition_.notify_one();
            
        } else if (fs::is_regular_file(entryPath)) {
            // 创建文件条目
            FileEntry file;
            file.id = generateFileIdThreadSafe();
            file.name = entryPath.filename().string();
            file.type = "file";
            
            try {
                file.size = fs::file_size(entryPath);
                file.createTime = getFileTime(entryPath);
            } catch (const std::exception& e) {
                std::cerr << "警告: 无法获取文件大小 " << entryPath << ": " << e.what() << "\n";
                file.size = 0;
                file.createTime = formatTime(fs::file_time_type::clock::now());
            }
            
            file.parentId = parentId;
            file.blocks = allocateBlocksThreadSafe(file.size);
            file.inode = 0;
            file.deviceId = 0;
            file.physicalPath = fs::absolute(entryPath).string();
            file.extents.clear();
            getPhysicalAddress(entryPath, file);
            getIndexAddress(entryPath, file);
            // getIndexAddress 内部会设置 allocationAlgorithm
            if (file.allocationAlgorithm.empty()) {
                file.allocationAlgorithm = "continuous";  // 如果无法判断，默认连续
            }
            
            {
                std::lock_guard<std::mutex> lock(filesMutex_);
                files_.push_back(file);
            }
            fileCount_++;
            totalSize_ += file.size;
            notifyProgress();
        }
    } catch (const std::exception& e) {
        std::cerr << "警告: 跳过条目 " << entryPath << ": " << e.what() << "\n";
    }
}

// 工作线程函数
void FileSystemScanner::workerThread() {
    while (true) {
        std::unique_lock<std::mutex> lock(queueMutex_);
        
        // 等待工作或停止信号
        queueCondition_.wait(lock, [this] {
            return !workQueue_.empty() || stopWorkers_;
        });
        
        // 如果停止标志被设置且队列为空，退出
        if (stopWorkers_ && workQueue_.empty()) {
            break;
        }
        
        // 获取工作项
        if (!workQueue_.empty()) {
            auto work = workQueue_.front();
            workQueue_.pop();
            lock.unlock();
            
            // 处理目录
            try {
                for (const auto& entry : fs::directory_iterator(work.first)) {
                    processDirectoryEntry(entry.path(), work.second);
                }
            } catch (const std::exception& e) {
                std::cerr << "警告: 无法扫描目录 " << work.first << ": " << e.what() << "\n";
            }
        }
    }
}

// 多线程并行扫描目录
void FileSystemScanner::scanDirectoryRecursiveParallel(const fs::path& path, const std::string& parentId) {
    // 启动工作线程
    stopWorkers_ = false;
    workerThreads_.clear();
    for (size_t i = 0; i < numThreads_; i++) {
        workerThreads_.emplace_back(&FileSystemScanner::workerThread, this);
    }
    
    // 处理根目录的条目，并将子目录添加到工作队列
    try {
        for (const auto& entry : fs::directory_iterator(path)) {
            processDirectoryEntry(entry.path(), parentId);
        }
    } catch (const std::exception& e) {
        std::cerr << "警告: 无法扫描目录 " << path << ": " << e.what() << "\n";
    }
    
    // 等待所有工作完成
    while (true) {
        std::unique_lock<std::mutex> lock(queueMutex_);
        if (workQueue_.empty()) {
            // 等待一小段时间确保没有新工作
            lock.unlock();
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            lock.lock();
            if (workQueue_.empty()) {
                break;
            }
        }
        lock.unlock();
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
    
    // 停止工作线程
    stopWorkers_ = true;
    queueCondition_.notify_all();
    
    // 等待所有线程完成
    for (auto& thread : workerThreads_) {
        if (thread.joinable()) {
            thread.join();
        }
    }
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

void FileSystemScanner::getPhysicalAddress(const fs::path& path, FileEntry& entry) {
    try {
#ifdef _WIN32
        // Windows 系统：使用 GetFileInformationByHandle 获取文件信息
        HANDLE hFile = CreateFileW(
            path.wstring().c_str(),
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            NULL,
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,  // 允许打开目录
            NULL
        );
        
        if (hFile != INVALID_HANDLE_VALUE) {
            BY_HANDLE_FILE_INFORMATION fileInfo;
            if (GetFileInformationByHandle(hFile, &fileInfo)) {
                // Windows 使用文件索引号作为 inode 的等价物
                // 将两个 DWORD 合并为一个 64 位值
                entry.inode = (static_cast<unsigned long long>(fileInfo.nFileIndexHigh) << 32) | 
                              static_cast<unsigned long long>(fileInfo.nFileIndexLow);
                entry.deviceId = (static_cast<unsigned long long>(fileInfo.dwVolumeSerialNumber));
            }
            CloseHandle(hFile);
        }
#else
        // Linux/Unix 系统：使用 stat 系统调用
        struct stat fileStat;
        if (stat(path.c_str(), &fileStat) == 0) {
            entry.inode = static_cast<unsigned long long>(fileStat.st_ino);
            entry.deviceId = static_cast<unsigned long long>(fileStat.st_dev);
        }
#endif
    } catch (const std::exception& e) {
        // 如果获取失败，保持默认值（0）
        std::cerr << "警告: 无法获取物理地址信息 " << path << ": " << e.what() << "\n";
    }
}

void FileSystemScanner::getIndexAddress(const fs::path& path, FileEntry& entry) {
    // 只处理文件，目录没有索引地址
    if (entry.type != "file" || entry.size == 0) {
        return;
    }
    
    try {
        // 静默失败，不输出警告（某些文件系统不支持 extent 查询是正常的）
#ifdef _WIN32
        // Windows 系统：使用 FSCTL_GET_RETRIEVAL_POINTERS 获取簇映射
        HANDLE hFile = CreateFileW(
            path.wstring().c_str(),
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            NULL,
            OPEN_EXISTING,
            FILE_FLAG_NO_BUFFERING,
            NULL
        );
        
        if (hFile != INVALID_HANDLE_VALUE) {
            // 获取卷信息以确定簇大小
            DWORD sectorsPerCluster, bytesPerSector, numberOfFreeClusters, totalNumberOfClusters;
            std::wstring rootPath = path.root_path().wstring();
            if (rootPath.empty()) {
                // 如果 root_path() 为空，尝试从完整路径提取根路径
                std::wstring fullPath = path.wstring();
                size_t pos = fullPath.find(L'\\');
                if (pos != std::wstring::npos) {
                    rootPath = fullPath.substr(0, pos + 1);
                } else {
                    rootPath = L"C:\\"; // 默认值
                }
            }
            
            if (GetDiskFreeSpaceW(
                rootPath.c_str(),
                &sectorsPerCluster,
                &bytesPerSector,
                &numberOfFreeClusters,
                &totalNumberOfClusters
            )) {
                DWORD clusterSize = sectorsPerCluster * bytesPerSector;
                
                // 准备获取检索指针
                STARTING_VCN_INPUT_BUFFER inputBuffer;
                inputBuffer.StartingVcn.QuadPart = 0;
                
                // 分配缓冲区
                DWORD bufferSize = sizeof(RETRIEVAL_POINTERS_BUFFER) + (entry.size / clusterSize + 1) * sizeof(LARGE_INTEGER);
                std::vector<BYTE> buffer(bufferSize);
                RETRIEVAL_POINTERS_BUFFER* outputBuffer = reinterpret_cast<RETRIEVAL_POINTERS_BUFFER*>(buffer.data());
                
                DWORD bytesReturned;
                if (DeviceIoControl(
                    hFile,
                    FSCTL_GET_RETRIEVAL_POINTERS,
                    &inputBuffer,
                    sizeof(inputBuffer),
                    outputBuffer,
                    bufferSize,
                    &bytesReturned,
                    NULL
                )) {
                    // 解析检索指针
                    ULONGLONG currentVcn = outputBuffer->StartingVcn.QuadPart;
                    DWORD extentCount = outputBuffer->ExtentCount;
                    
                    for (DWORD i = 0; i < extentCount; i++) {
                        ExtentInfo extent;
                        extent.logicalOffset = currentVcn * clusterSize;
                        extent.physicalOffset = outputBuffer->Extents[i].Lcn.QuadPart * clusterSize;
                        extent.length = outputBuffer->Extents[i].NextVcn.QuadPart * clusterSize - extent.logicalOffset;
                        
                        if (extent.length > 0 && extent.physicalOffset != (ULONGLONG)-1) {
                            entry.extents.push_back(extent);
                        }
                        
                        currentVcn = outputBuffer->Extents[i].NextVcn.QuadPart;
                    }
                }
            }
            CloseHandle(hFile);
        }
#else
        // Linux 系统：使用 FIEMAP ioctl 获取 extent 映射
        int fd = open(path.c_str(), O_RDONLY);
        if (fd >= 0) {
            // 获取文件系统块大小
            struct stat fileStat;
            if (fstat(fd, &fileStat) == 0) {
                unsigned long blockSize = fileStat.st_blksize;
                if (blockSize == 0) {
                    blockSize = 4096; // 默认 4KB
                }
                
                // 准备 FIEMAP 请求
                struct fiemap* fiemap = nullptr;
                size_t fiemapSize = sizeof(struct fiemap) + sizeof(struct fiemap_extent);
                fiemap = (struct fiemap*)malloc(fiemapSize);
                if (fiemap) {
                    memset(fiemap, 0, fiemapSize);
                    fiemap->fm_start = 0;
                    fiemap->fm_length = entry.size;
                    fiemap->fm_flags = FIEMAP_FLAG_SYNC;
                    fiemap->fm_extent_count = 1;
                    
                    // 循环获取所有 extent
                    unsigned long long offset = 0;
                    while (offset < entry.size) {
                        fiemap->fm_start = offset;
                        fiemap->fm_length = entry.size - offset;
                        
                        if (ioctl(fd, FS_IOC_FIEMAP, fiemap) == 0) {
                            if (fiemap->fm_mapped_extents == 0) {
                                break; // 没有更多 extent
                            }
                            
                            // 处理获取到的 extent
                            for (unsigned int i = 0; i < fiemap->fm_mapped_extents; i++) {
                                ExtentInfo extent;
                                extent.logicalOffset = fiemap->fm_extents[i].fe_logical;
                                extent.physicalOffset = fiemap->fm_extents[i].fe_physical;
                                extent.length = fiemap->fm_extents[i].fe_length;
                                
                                entry.extents.push_back(extent);
                                offset = fiemap->fm_extents[i].fe_logical + fiemap->fm_extents[i].fe_length;
                            }
                            
                            // 如果还有更多 extent，需要重新分配更大的缓冲区
                            if (fiemap->fm_flags & FIEMAP_FLAG_MORE) {
                                // 扩展缓冲区以获取更多 extent
                                size_t newSize = sizeof(struct fiemap) + 
                                                (fiemap->fm_mapped_extents + 1) * sizeof(struct fiemap_extent);
                                struct fiemap* newFiemap = (struct fiemap*)realloc(fiemap, newSize);
                                if (newFiemap) {
                                    fiemap = newFiemap;
                                    memset((char*)fiemap + fiemapSize, 0, newSize - fiemapSize);
                                    fiemap->fm_extent_count = fiemap->fm_mapped_extents + 1;
                                    fiemapSize = newSize;
                                } else {
                                    break; // 内存分配失败
                                }
                            } else {
                                break; // 没有更多 extent
                            }
                        } else {
                            // ioctl 失败，可能不支持 FIEMAP，尝试使用 FIBMAP（较老的方法）
                            // 注意：FIBMAP 需要 root 权限，在 WSL2 中可能无法使用
                            if (errno == ENOTTY || errno == EOPNOTSUPP || errno == EPERM) {
                                // 不支持 FIEMAP 或没有权限，尝试使用 FIBMAP 作为后备方案
                                // FIBMAP 需要 root 权限
                                bool permissionIssue = (errno == EPERM && !hasRootPrivileges());
                                
                                if (permissionIssue && autoSuggestRoot_ && !rootSuggestionShown_) {
                                    // 只在第一次遇到权限问题时提示一次
                                    rootSuggestionShown_ = true;
                                    std::cerr << "\n提示: 检测到权限不足，无法获取真实的文件物理块映射信息。\n";
                                    std::cerr << "      使用 sudo 运行程序可获取更准确的信息。\n\n";
                                }
                                
                                unsigned long blockNum = 0;
                                unsigned long long fileOffset = 0;
                                bool fibmapWorked = false;
                                
                                while (fileOffset < entry.size && blockNum < 100) {  // 限制检查的块数
                                    int blockIndex = static_cast<int>(fileOffset / blockSize);
                                    if (ioctl(fd, FIBMAP, &blockIndex) == 0 && blockIndex != 0) {
                                        fibmapWorked = true;
                                        ExtentInfo extent;
                                        extent.logicalOffset = fileOffset;
                                        extent.physicalOffset = static_cast<unsigned long long>(blockIndex) * blockSize;
                                        extent.length = blockSize;
                                        
                                        // 尝试合并连续的块
                                        if (!entry.extents.empty() && 
                                            entry.extents.back().physicalOffset + entry.extents.back().length == extent.physicalOffset &&
                                            entry.extents.back().logicalOffset + entry.extents.back().length == extent.logicalOffset) {
                                            entry.extents.back().length += extent.length;
                                        } else {
                                            entry.extents.push_back(extent);
                                        }
                                    } else {
                                        // FIBMAP 失败（可能是权限问题），停止尝试
                                        break;
                                    }
                                    fileOffset += blockSize;
                                    blockNum++;
                                }
                            }
                            // 静默失败，不输出错误（某些文件系统不支持是正常的）
                            break;
                        }
                    }
                    if (fiemap) {
                        free(fiemap);
                        fiemap = nullptr;
                    }
                }
            }
            close(fd);
        }
#endif
    } catch (const std::exception& e) {
        // 如果获取失败，保持 extents 为空（静默失败，某些文件系统不支持是正常的）
        // 不输出警告，因为这在 WSL2/NTFS 等文件系统上是预期的行为
    }
    
    // Fallback: 如果无法获取真实的extent信息，根据blocks数组生成模拟的extent信息
    // 这对于不支持FIEMAP/FIBMAP的文件系统（如WSL2/NTFS）很有用
    if (entry.extents.empty() && !entry.blocks.empty() && entry.size > 0) {
        // 使用块大小（从disk配置或默认值）
        unsigned long long blockSize = static_cast<unsigned long long>(blockSize_);
        if (blockSize == 0) {
            blockSize = 4096; // 默认4KB
        }
        
        // 根据blocks数组生成extent信息
        // 对于连续分配，blocks数组中的值就是物理块号
        // 对于链式或索引分配，我们假设blocks数组中的值也是物理块号
        unsigned long long logicalOffset = 0;
        
        // 优化：合并连续的块为单个extent
        for (size_t i = 0; i < entry.blocks.size(); i++) {
            unsigned long long physicalBlock = static_cast<unsigned long long>(entry.blocks[i]);
            unsigned long long physicalOffset = physicalBlock * blockSize;
            
            // 计算这个块的长度
            unsigned long long remainingSize = entry.size - logicalOffset;
            unsigned long long blockLength = (remainingSize < blockSize) ? remainingSize : blockSize;
            
            // 检查是否可以与上一个extent合并（连续分配且物理块连续）
            if (!entry.extents.empty()) {
                ExtentInfo& lastExtent = entry.extents.back();
                unsigned long long expectedNextPhysical = lastExtent.physicalOffset + lastExtent.length;
                unsigned long long expectedNextLogical = lastExtent.logicalOffset + lastExtent.length;
                
                // 如果物理块和逻辑块都连续，合并extent
                if (physicalOffset == expectedNextPhysical && logicalOffset == expectedNextLogical) {
                    lastExtent.length += blockLength;
                    logicalOffset += blockLength;
                    continue;
                }
            }
            
            // 创建新的extent
            ExtentInfo extent;
            extent.logicalOffset = logicalOffset;
            extent.physicalOffset = physicalOffset;
            extent.length = blockLength;
            entry.extents.push_back(extent);
            
            logicalOffset += blockLength;
            
            // 如果已经覆盖了整个文件，停止
            if (logicalOffset >= entry.size) {
                break;
            }
        }
    }
    
    // 根据 extent 信息判断分配算法
    entry.allocationAlgorithm = determineAllocationAlgorithm(entry);
}

std::string FileSystemScanner::determineAllocationAlgorithm(const FileEntry& entry) {
    // 目录没有分配算法
    if (entry.type != "file" || entry.size == 0) {
        return "";
    }
    
    // 优先根据 extent 信息判断
    if (!entry.extents.empty()) {
        // 计算 extent 覆盖的总长度
        unsigned long long totalExtentLength = 0;
        for (const auto& extent : entry.extents) {
            totalExtentLength += extent.length;
        }
        
        // 如果只有一个 extent，且覆盖整个文件（或接近），则是连续分配
        if (entry.extents.size() == 1) {
            const auto& extent = entry.extents[0];
            // 检查 extent 是否从文件开头开始，且长度覆盖整个文件（允许小的误差）
            if (extent.logicalOffset == 0 && 
                (extent.length >= entry.size || 
                 (extent.length >= entry.size * 0.95))) {  // 允许5%的误差
                return "continuous";
            }
        }
        
        // 如果有多个 extent，则是非连续分配
        // 根据 extent 数量判断是链式还是索引分配
        if (entry.extents.size() > 1) {
            // 如果 extent 数量较少（<= 10），可能是索引分配
            // 如果 extent 数量很多，可能是链式分配
            // 这里我们使用一个简单的阈值
            if (entry.extents.size() <= 10) {
                return "indexed";
            } else {
                return "linked";
            }
        }
        
        // 如果只有一个 extent 但不完全覆盖，可能是部分连续
        return "continuous";
    }
    
    // 如果没有 extent 信息，根据 blocks 数组判断
    if (!entry.blocks.empty()) {
        // 检查 blocks 数组是否连续
        bool isContinuous = true;
        for (size_t i = 1; i < entry.blocks.size(); i++) {
            if (entry.blocks[i] != entry.blocks[i-1] + 1) {
                isContinuous = false;
                break;
            }
        }
        
        if (isContinuous) {
            return "continuous";
        } else {
            // 根据块数量判断是链式还是索引分配
            if (entry.blocks.size() <= 10) {
                return "indexed";
            } else {
                return "linked";
            }
        }
    }
    
    // 如果既没有 extent 也没有 blocks，无法判断
    return "";
}

bool FileSystemScanner::hasRootPrivileges() {
#ifdef _WIN32
    // Windows: 检查是否有管理员权限
    BOOL isAdmin = FALSE;
    PSID adminGroup = nullptr;
    SID_IDENTIFIER_AUTHORITY ntAuthority = SECURITY_NT_AUTHORITY;
    
    if (AllocateAndInitializeSid(&ntAuthority, 2, SECURITY_BUILTIN_DOMAIN_RID,
                                 DOMAIN_ALIAS_RID_ADMINS, 0, 0, 0, 0, 0, 0, &adminGroup)) {
        CheckTokenMembership(nullptr, adminGroup, &isAdmin);
        FreeSid(adminGroup);
    }
    
    return isAdmin == TRUE;
#else
    // Linux/Unix: 检查是否是 root 用户 (UID 0)
    return geteuid() == 0;
#endif
}

void FileSystemScanner::suggestSudoUsage() {
#ifndef _WIN32
    if (!hasRootPrivileges()) {
        std::cerr << "\n";
        std::cerr << "═══════════════════════════════════════════════════════════════\n";
        std::cerr << "提示: 需要 root 权限以获取更准确的文件分配信息\n";
        std::cerr << "═══════════════════════════════════════════════════════════════\n";
        std::cerr << "某些文件系统操作（如 FIBMAP）需要 root 权限才能获取真实的\n";
        std::cerr << "文件物理块映射信息。如果当前没有 root 权限，程序将使用模拟\n";
        std::cerr << "的块分配信息，可能无法准确反映文件的真实分配状态。\n\n";
        
        // 尝试获取程序名称
        const char* programName = std::getenv("_");
        if (!programName) {
            programName = "filesystem-scanner";
        }
        
        std::cerr << "要获取更准确的信息，请使用 sudo 运行程序：\n";
        std::cerr << "  sudo " << programName << " <参数>\n\n";
        std::cerr << "或者使用 --require-root 选项，程序会在需要时提示您。\n";
        std::cerr << "═══════════════════════════════════════════════════════════════\n";
        std::cerr << "\n";
    }
#endif
}

void FileSystemScanner::generateJSON(const std::string& outputPath) {
    nlohmann::json json;
    
    // 设置文件系统类型
    json["fileSystemType"] = fileSystemType_;
    
    // 计算总块数（至少为已使用的块数，可以设置一个合理的上限）
    size_t currentTotalBlocks = totalBlocks_.load();
    size_t calculatedTotalBlocks = std::max(currentTotalBlocks, size_t(1000));
    if (currentTotalBlocks > 0) {
        // 添加一些空闲块
        calculatedTotalBlocks = currentTotalBlocks + (currentTotalBlocks / 10);  // 增加10%的空闲块
    }
    
    // 生成空闲块列表（需要加锁保护）
    std::vector<int> freeBlocksList;
    {
        std::lock_guard<std::mutex> lock(blocksMutex_);
        for (int i = 0; i < static_cast<int>(calculatedTotalBlocks); i++) {
            if (usedBlocks_.find(i) == usedBlocks_.end()) {
                freeBlocksList.push_back(i);
            }
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
    
    // 构建文件数组（需要加锁保护）
    nlohmann::json filesArray = nlohmann::json::array();
    {
        std::lock_guard<std::mutex> lock(filesMutex_);
        for (const auto& file : files_) {
            nlohmann::json fileJson;
            fileJson["id"] = file.id;
            fileJson["name"] = file.name;
            fileJson["type"] = file.type;
            fileJson["size"] = static_cast<int>(file.size);
            fileJson["blocks"] = file.blocks;
            fileJson["parentId"] = file.parentId;
            fileJson["createTime"] = file.createTime;
            
            // 添加物理地址信息
            fileJson["inode"] = file.inode;
            fileJson["deviceId"] = file.deviceId;
            fileJson["physicalPath"] = file.physicalPath;
            
            // 添加索引地址信息（extent 映射）
            if (!file.extents.empty()) {
                nlohmann::json extentsArray = nlohmann::json::array();
                for (const auto& extent : file.extents) {
                    nlohmann::json extentJson;
                    extentJson["logicalOffset"] = extent.logicalOffset;
                    extentJson["physicalOffset"] = extent.physicalOffset;
                    extentJson["length"] = extent.length;
                    extentsArray.push_back(extentJson);
                }
                fileJson["extents"] = extentsArray;
            } else {
                fileJson["extents"] = nlohmann::json::array();
            }
            
            if (file.type == "file" && !file.allocationAlgorithm.empty()) {
                fileJson["allocationAlgorithm"] = file.allocationAlgorithm;
            } else {
                fileJson["allocationAlgorithm"] = nullptr;
            }
            
            filesArray.push_back(fileJson);
        }
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

