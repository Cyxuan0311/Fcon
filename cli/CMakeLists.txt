cmake_minimum_required(VERSION 3.15)
project(fcon VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Windows特定设置
if(WIN32)
    # 设置Windows子系统为控制台
    set(CMAKE_WIN32_EXECUTABLE FALSE)
    # 设置输出目录
    if(CMAKE_BUILD_TYPE STREQUAL "Release")
        set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin/Release)
    else()
        set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin/Debug)
    endif()
endif()

# 查找nlohmann-json
# 1. 首先尝试查找系统安装的包
find_package(nlohmann_json 3.2.0 QUIET)

if(NOT nlohmann_json_FOUND)
    # 2. 尝试查找本地的nlohmann_json库
    # 检查常见的本地路径
    set(LOCAL_JSON_PATHS
        "${CMAKE_SOURCE_DIR}/third_party/nlohmann_json"
        "${CMAKE_SOURCE_DIR}/third_party/json"
        "${CMAKE_SOURCE_DIR}/vendor/nlohmann_json"
        "${CMAKE_SOURCE_DIR}/vendor/json"
        "${CMAKE_SOURCE_DIR}/external/nlohmann_json"
        "${CMAKE_SOURCE_DIR}/external/json"
        "${CMAKE_SOURCE_DIR}/libs/nlohmann_json"
        "${CMAKE_SOURCE_DIR}/libs/json"
    )
    
    set(LOCAL_JSON_FOUND FALSE)
    foreach(JSON_PATH ${LOCAL_JSON_PATHS})
        if(EXISTS "${JSON_PATH}/include/nlohmann/json.hpp")
            message(STATUS "找到本地nlohmann_json: ${JSON_PATH}")
            add_library(nlohmann_json INTERFACE)
            target_include_directories(nlohmann_json INTERFACE "${JSON_PATH}/include")
            set(JSON_TARGET nlohmann_json)
            set(LOCAL_JSON_FOUND TRUE)
            break()
        endif()
    endforeach()
    
    if(NOT LOCAL_JSON_FOUND)
        # 3. 如果本地也找不到，检查是否在include目录中
        if(EXISTS "${CMAKE_SOURCE_DIR}/include/nlohmann/json.hpp")
            message(STATUS "找到本地nlohmann_json: ${CMAKE_SOURCE_DIR}/include")
            add_library(nlohmann_json INTERFACE)
            target_include_directories(nlohmann_json INTERFACE "${CMAKE_SOURCE_DIR}/include")
            set(JSON_TARGET nlohmann_json)
            set(LOCAL_JSON_FOUND TRUE)
        endif()
    endif()
    
    if(NOT LOCAL_JSON_FOUND)
        # 4. 最后fallback到FetchContent下载
        message(STATUS "未找到本地nlohmann_json，使用FetchContent下载")
        include(FetchContent)
        FetchContent_Declare(
            json
            GIT_REPOSITORY https://github.com/nlohmann/json.git
            GIT_TAG v3.11.2
        )
        FetchContent_MakeAvailable(json)
        set(JSON_TARGET nlohmann_json::nlohmann_json)
    endif()
else()
    message(STATUS "找到系统安装的nlohmann_json")
    set(JSON_TARGET nlohmann_json::nlohmann_json)
endif()

# 查找线程库
find_package(Threads REQUIRED)

# 可执行文件
add_executable(fcon
    src/main.cpp
    src/FileSystemScanner.cpp
    src/FileSystemScanner.h
    src/ProgressBar.cpp
    src/ProgressBar.h
)

target_link_libraries(fcon
    ${JSON_TARGET}
    Threads::Threads
)

# 安装
install(TARGETS fcon
    RUNTIME DESTINATION bin
)

# 设置输出目录（跨平台）
if(WIN32)
    # Windows: 根据构建类型设置输出目录
    set_target_properties(fcon PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY_DEBUG ${CMAKE_BINARY_DIR}/bin/Debug
        RUNTIME_OUTPUT_DIRECTORY_RELEASE ${CMAKE_BINARY_DIR}/bin/Release
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
    )
else()
    # Linux/Unix: 统一输出目录
    set_target_properties(fcon PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
    )
endif()

