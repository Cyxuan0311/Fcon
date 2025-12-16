#include <iostream>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <thread>
#include "FileSystemScanner.h"
#include "ProgressBar.h"

namespace fs = std::filesystem;

void printUsage(const char* programName) {
    std::cout << "用法: " << programName << " <目录或文件路径> [选项]\n\n";
    std::cout << "选项:\n";
    std::cout << "  -o, --output <文件>    指定输出JSON文件路径 (默认: filesystem.json)\n";
    std::cout << "  -b, --block-size <大小> 指定块大小，单位KB (默认: 4)\n";
    std::cout << "  -t, --type <类型>      指定文件系统类型 (FAT32/Ext4/NTFS, 默认: FAT32)\n";
    std::cout << "  -h, --help             显示此帮助信息\n\n";
    std::cout << "示例:\n";
    #ifdef _WIN32
    std::cout << "  " << programName << " C:\\Users\\Username\\Documents\n";
    std::cout << "  " << programName << " C:\\Users\\Username\\Documents -o output.json\n";
    std::cout << "  " << programName << " C:\\Users\\Username\\file.txt -b 8 -t Ext4\n";
    #else
    std::cout << "  " << programName << " /home/user/documents\n";
    std::cout << "  " << programName << " /home/user/documents -o output.json\n";
    std::cout << "  " << programName << " /home/user/file.txt -b 8 -t Ext4\n";
    #endif
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "错误: 缺少参数\n\n";
        printUsage(argv[0]);
        return 1;
    }

    std::string inputPath;
    std::string outputPath = "filesystem.json";
    int blockSizeKB = 4;
    std::string fileSystemType = "FAT32";

    // 解析命令行参数
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        
        if (arg == "-h" || arg == "--help") {
            printUsage(argv[0]);
            return 0;
        } else if (arg == "-o" || arg == "--output") {
            if (i + 1 < argc) {
                outputPath = argv[++i];
            } else {
                std::cerr << "错误: -o 选项需要指定输出文件路径\n";
                return 1;
            }
        } else if (arg == "-b" || arg == "--block-size") {
            if (i + 1 < argc) {
                blockSizeKB = std::stoi(argv[++i]);
                if (blockSizeKB <= 0) {
                    std::cerr << "错误: 块大小必须大于0\n";
                    return 1;
                }
            } else {
                std::cerr << "错误: -b 选项需要指定块大小\n";
                return 1;
            }
        } else if (arg == "-t" || arg == "--type") {
            if (i + 1 < argc) {
                fileSystemType = argv[++i];
                if (fileSystemType != "FAT32" && fileSystemType != "Ext4" && fileSystemType != "NTFS") {
                    std::cerr << "错误: 不支持的文件系统类型: " << fileSystemType << "\n";
                    std::cerr << "支持的类型: FAT32, Ext4, NTFS\n";
                    return 1;
                }
            } else {
                std::cerr << "错误: -t 选项需要指定文件系统类型\n";
                return 1;
            }
        } else if (arg[0] != '-') {
            // 第一个非选项参数作为输入路径
            if (inputPath.empty()) {
                inputPath = arg;
            }
        }
    }

    if (inputPath.empty()) {
        std::cerr << "错误: 未指定输入路径\n\n";
        printUsage(argv[0]);
        return 1;
    }

    // 检查输入路径是否存在
    if (!fs::exists(inputPath)) {
        std::cerr << "错误: 路径不存在: " << inputPath << "\n";
        return 1;
    }

    try {
        std::cout << "正在扫描文件系统: " << inputPath << "\n";
        std::cout << "块大小: " << blockSizeKB << " KB\n";
        std::cout << "文件系统类型: " << fileSystemType << "\n";
        std::cout << "输出文件: " << outputPath << "\n";
        std::cout << "使用多线程加速 (线程数: " << std::thread::hardware_concurrency() << ")\n\n";

        // 创建进度条
        ProgressBar progressBar("扫描进度");
        progressBar.showSpinner();  // 初始显示旋转指示器
        
        // 创建扫描器
        FileSystemScanner scanner(blockSizeKB * 1024, fileSystemType);
        
        // 设置进度回调
        scanner.setProgressCallback([&progressBar](size_t files, size_t dirs, size_t totalSize) {
            // 使用旋转指示器，因为我们不知道总数
            progressBar.setCurrent(files + dirs);
        });
        
        // 扫描文件系统
        if (fs::is_directory(inputPath)) {
            scanner.scanDirectory(inputPath);
        } else if (fs::is_regular_file(inputPath)) {
            scanner.scanFile(inputPath);
        } else {
            std::cerr << "错误: 不支持的路径类型: " << inputPath << "\n";
            return 1;
        }
        
        // 完成扫描进度条
        progressBar.finish();

        // 生成JSON
        ProgressBar jsonProgressBar("生成JSON");
        jsonProgressBar.update(0.0);
        scanner.generateJSON(outputPath);
        jsonProgressBar.update(1.0);
        jsonProgressBar.finish();

        std::cout << "\n✓ 成功生成文件系统JSON: " << outputPath << "\n";
        std::cout << "  总文件数: " << scanner.getFileCount() << "\n";
        std::cout << "  总目录数: " << scanner.getDirectoryCount() << "\n";
        std::cout << "  总大小: " << scanner.getTotalSize() / 1024 << " KB\n";
        std::cout << "  总块数: " << scanner.getTotalBlocks() << "\n";

    } catch (const std::exception& e) {
        std::cerr << "\n错误: " << e.what() << "\n";
        return 1;
    }

    return 0;
}

