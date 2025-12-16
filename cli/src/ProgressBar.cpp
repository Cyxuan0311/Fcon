#include "ProgressBar.h"
#include <iomanip>
#include <sstream>
#include <thread>

const char* ProgressBar::SPINNER_CHARS = "|/-\\";

ProgressBar::ProgressBar(const std::string& label)
    : label_(label)
    , progress_(0.0)
    , current_(0)
    , total_(0)
    , finished_(false)
    , showSpinner_(false)
    , startTime_(std::chrono::steady_clock::now())
    , lastUpdateTime_(std::chrono::steady_clock::now())
    , spinnerIndex_(0)
{
}

ProgressBar::~ProgressBar() {
    finish();
}

void ProgressBar::update(double progress) {
    if (progress < 0.0) progress = 0.0;
    if (progress > 1.0) progress = 1.0;
    progress_.store(progress);
    render();
}

void ProgressBar::update(size_t current, size_t total) {
    current_.store(current);
    total_.store(total);
    if (total > 0) {
        progress_.store(static_cast<double>(current) / total);
    } else {
        progress_.store(0.0);
    }
    render();
}

void ProgressBar::increment() {
    size_t current = current_.fetch_add(1) + 1;
    size_t total = total_.load();
    if (total > 0) {
        progress_.store(static_cast<double>(current) / total);
    }
    render();
}

void ProgressBar::setLabel(const std::string& label) {
    std::lock_guard<std::mutex> lock(renderMutex_);
    label_ = label;
}

void ProgressBar::setCurrent(size_t current) {
    current_.store(current);
    size_t total = total_.load();
    if (total > 0) {
        progress_.store(static_cast<double>(current) / total);
    }
    render();
}

void ProgressBar::setTotal(size_t total) {
    total_.store(total);
    size_t current = current_.load();
    if (total > 0) {
        progress_.store(static_cast<double>(current) / total);
    }
    render();
}

void ProgressBar::finish() {
    if (finished_.exchange(true)) {
        return;  // 已经完成
    }
    
    progress_.store(1.0);
    showSpinner_.store(false);
    render();
    
    std::lock_guard<std::mutex> lock(renderMutex_);
    std::cout << "\n";  // 换行
}

void ProgressBar::showSpinner() {
    showSpinner_.store(true);
    renderSpinner();
}

void ProgressBar::stopSpinner() {
    showSpinner_.store(false);
}

void ProgressBar::render() {
    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastUpdateTime_);
    
    // 限制更新频率（每100ms更新一次，避免过于频繁的更新）
    if (elapsed.count() < 100 && !finished_.load()) {
        return;
    }
    
    lastUpdateTime_ = now;
    
    if (showSpinner_.load() && total_.load() == 0) {
        renderSpinner();
        return;
    }
    
    renderBar();
}

void ProgressBar::renderBar() {
    std::lock_guard<std::mutex> lock(renderMutex_);
    
    double prog = progress_.load();
    size_t curr = current_.load();
    size_t tot = total_.load();
    
    // 清除当前行（Windows 和 Unix 都支持）
    #ifdef _WIN32
    std::cout << "\r";
    #else
    std::cout << "\r\033[K";
    #endif
    
    // 显示标签
    if (!label_.empty()) {
        std::cout << label_ << " ";
    }
    
    // 显示进度条
    int filled = static_cast<int>(prog * BAR_WIDTH);
    std::cout << "[";
    for (int i = 0; i < BAR_WIDTH; i++) {
        if (i < filled) {
            std::cout << "=";
        } else if (i == filled && !finished_.load()) {
            std::cout << ">";
        } else {
            std::cout << " ";
        }
    }
    std::cout << "] ";
    
    // 显示百分比
    std::cout << std::fixed << std::setprecision(1) << (prog * 100.0) << "%";
    
    // 显示计数（如果有）
    if (tot > 0) {
        std::cout << " (" << curr << "/" << tot << ")";
    } else if (curr > 0) {
        std::cout << " (" << curr << ")";
    }
    
    // 显示时间信息
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - startTime_
    );
    std::cout << " " << formatTime(elapsed);
    
    // 如果完成，显示总时间
    if (finished_.load()) {
        std::cout << " 完成!";
    }
    
    std::cout << std::flush;
}

void ProgressBar::renderSpinner() {
    std::lock_guard<std::mutex> lock(renderMutex_);
    
    // 清除当前行（Windows 和 Unix 都支持）
    #ifdef _WIN32
    std::cout << "\r";
    #else
    std::cout << "\r\033[K";
    #endif
    
    // 显示标签
    if (!label_.empty()) {
        std::cout << label_ << " ";
    }
    
    // 显示旋转指示器
    spinnerIndex_ = (spinnerIndex_ + 1) % 4;
    std::cout << SPINNER_CHARS[spinnerIndex_] << " ";
    
    // 显示计数
    size_t curr = current_.load();
    if (curr > 0) {
        std::cout << "(" << curr << " 项)";
    }
    
    // 显示时间
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - startTime_
    );
    std::cout << " " << formatTime(elapsed);
    
    std::cout << std::flush;
}

std::string ProgressBar::formatBytes(size_t bytes) {
    const char* units[] = {"B", "KB", "MB", "GB", "TB"};
    int unitIndex = 0;
    double size = static_cast<double>(bytes);
    
    while (size >= 1024.0 && unitIndex < 4) {
        size /= 1024.0;
        unitIndex++;
    }
    
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2) << size << " " << units[unitIndex];
    return oss.str();
}

std::string ProgressBar::formatTime(std::chrono::milliseconds ms) {
    auto totalMs = ms.count();
    auto seconds = totalMs / 1000;
    auto minutes = seconds / 60;
    auto hours = minutes / 60;
    
    std::ostringstream oss;
    if (hours > 0) {
        oss << hours << "h " << (minutes % 60) << "m " << (seconds % 60) << "s";
    } else if (minutes > 0) {
        oss << minutes << "m " << (seconds % 60) << "s";
    } else {
        oss << seconds << "s";
    }
    
    return oss.str();
}

