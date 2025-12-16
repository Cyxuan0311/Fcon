#ifndef PROGRESS_BAR_H
#define PROGRESS_BAR_H

#include <string>
#include <atomic>
#include <chrono>
#include <mutex>
#include <iostream>

class ProgressBar {
public:
    ProgressBar(const std::string& label = "");
    ~ProgressBar();
    
    // 更新进度（0.0 到 1.0）
    void update(double progress);
    
    // 更新进度（当前值 / 最大值）
    void update(size_t current, size_t total);
    
    // 增加计数（用于不确定总数的情况）
    void increment();
    
    // 设置标签
    void setLabel(const std::string& label);
    
    // 设置当前值和最大值
    void setCurrent(size_t current);
    void setTotal(size_t total);
    
    // 完成进度条
    void finish();
    
    // 显示简单的旋转指示器（用于不确定进度的情况）
    void showSpinner();
    
    // 停止旋转指示器
    void stopSpinner();

private:
    void render();
    void renderBar();
    void renderSpinner();
    std::string formatBytes(size_t bytes);
    std::string formatTime(std::chrono::milliseconds ms);

private:
    std::string label_;
    std::atomic<double> progress_;  // 0.0 到 1.0
    std::atomic<size_t> current_;
    std::atomic<size_t> total_;
    std::atomic<bool> finished_;
    std::atomic<bool> showSpinner_;
    
    std::chrono::time_point<std::chrono::steady_clock> startTime_;
    std::chrono::time_point<std::chrono::steady_clock> lastUpdateTime_;
    
    mutable std::mutex renderMutex_;  // 保护渲染输出
    int spinnerIndex_;
    
    static const int BAR_WIDTH = 50;
    static const char* SPINNER_CHARS;
};

#endif // PROGRESS_BAR_H

