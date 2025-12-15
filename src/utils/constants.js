/**
 * 常量定义
 */

// 文件系统类型
export const FILE_SYSTEM_TYPES = {
  FAT32: 'FAT32',
  EXT4: 'Ext4',
  NTFS: 'NTFS'
}

// 分配算法
export const ALLOCATION_ALGORITHMS = {
  CONTINUOUS: 'continuous',
  LINKED: 'linked',
  INDEXED: 'indexed'
}

// 磁盘调度算法
export const SCHEDULING_ALGORITHMS = {
  FCFS: 'FCFS',
  SSTF: 'SSTF',
  SCAN: 'SCAN'
}

// 块状态
export const BLOCK_STATUS = {
  FREE: 'free',
  USED: 'used',
  FRAGMENT: 'fragment'
}

// 操作类型
export const OPERATION_TYPES = {
  CREATE_FILE: 'create_file',
  DELETE_FILE: 'delete_file',
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  DEFRAGMENT: 'defragment'
}

