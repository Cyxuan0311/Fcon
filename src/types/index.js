/**
 * 类型定义
 */

/**
 * 磁盘模型
 * @typedef {Object} Disk
 * @property {string} id - 磁盘唯一标识
 * @property {number} totalBlocks - 总块数
 * @property {number} blockSize - 块大小（字节）
 * @property {number[]} freeBlocks - 空闲块编号
 * @property {Record<number, File>} usedBlocks - 已使用块（块号->文件）
 * @property {number} fragmentRate - 碎片率
 */

/**
 * 文件模型
 * @typedef {Object} File
 * @property {string} id - 文件唯一标识
 * @property {string} name - 文件名
 * @property {'file' | 'directory'} type - 类型（文件/目录）
 * @property {number} size - 大小（字节）
 * @property {number[]} blocks - 占用块编号
 * @property {string} parentId - 父目录ID
 * @property {string} createTime - 创建时间
 * @property {'continuous' | 'linked' | 'indexed'} allocationAlgorithm - 分配算法
 */

/**
 * 性能数据模型
 * @typedef {Object} PerformanceData
 * @property {string} operation - 操作类型（创建/删除/读写/碎片整理）
 * @property {string} timestamp - 操作时间
 * @property {number} duration - 耗时（ms）
 * @property {number} ioCount - IO次数
 * @property {number} throughput - 吞吐量（KB/s）
 * @property {string} fileSystemType - 文件系统类型
 * @property {string} algorithm - 使用的算法
 */

