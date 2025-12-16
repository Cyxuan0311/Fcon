import * as echarts from 'echarts'

/**
 * ECharts图表渲染器
 * 封装ECharts实例，实现性能数据的图表渲染与更新
 */
export class ChartRenderer {
  constructor(container) {
    this.container = container
    this.chart = null
  }
  
  /**
   * 初始化图表
   */
  init() {
    if (!this.container) {
      console.error('Chart container is not available')
      return null
    }
    
    // 检查容器是否有尺寸
    if (this.container.clientWidth === 0 || this.container.clientHeight === 0) {
      console.warn('Chart container has no dimensions, will retry initialization')
      // 延迟初始化
      setTimeout(() => {
        if (this.container && this.container.clientWidth > 0 && this.container.clientHeight > 0) {
          this.init()
        }
      }, 100)
      return null
    }
    
    try {
      this.chart = echarts.init(this.container, null, {
        renderer: 'canvas',
        useDirtyRect: true // 启用脏矩形优化，提升性能
      })
      
      // 监听窗口大小变化，自动调整图表大小
      const resizeHandler = () => {
        if (this.chart) {
          this.chart.resize()
        }
      }
      window.addEventListener('resize', resizeHandler)
      
      // 保存 resize handler 以便后续清理
      this.resizeHandler = resizeHandler
      
      return this.chart
    } catch (error) {
      console.error('Failed to initialize ECharts:', error)
      return null
    }
  }
  
  /**
   * 渲染性能对比柱状图
   * @param {Array} data - 性能数据
   */
  renderBarChart(data) {
    if (!data || data.length === 0) return
    if (!this.chart) {
      console.warn('Chart not initialized, skipping render')
      return
    }
    
    // B端专业配色方案
    const colorMap = {
      '创建文件': '#1890ff',
      '删除文件': '#ff4d4f',
      '碎片整理': '#faad14'
    }
    
    const option = {
      backgroundColor: 'transparent',
      title: {
        text: '操作耗时对比',
        left: 'left',
        top: 0,
        textStyle: {
          color: '#262626',
          fontSize: 14,
          fontWeight: 600
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        backgroundColor: '#fff',
        borderColor: '#d9d9d9',
        borderWidth: 1,
        textStyle: {
          color: '#262626',
          fontSize: 12
        },
        formatter: (params) => {
          const param = params[0]
          return `<div style="padding: 4px 0;">
            <div style="font-weight: 600; margin-bottom: 4px;">${param.name}</div>
            <div>${param.seriesName}: <span style="color: #1890ff; font-weight: 600;">${param.value} ms</span></div>
          </div>`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.map(item => item.operation),
        axisLabel: {
          color: '#595959',
          fontSize: 12,
          rotate: 0
        },
        axisLine: {
          lineStyle: {
            color: '#d9d9d9'
          }
        },
        axisTick: {
          lineStyle: {
            color: '#d9d9d9'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '耗时 (ms)',
        nameTextStyle: {
          color: '#8c8c8c',
          fontSize: 12
        },
        axisLabel: {
          color: '#595959',
          fontSize: 12
        },
        axisLine: {
          lineStyle: {
            color: '#d9d9d9'
          }
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'solid'
          }
        }
      },
      series: [{
        name: '耗时',
        data: data.map(item => ({
          value: item.duration,
          itemStyle: {
            color: colorMap[item.operation] || '#1890ff'
          }
        })),
        type: 'bar',
        barWidth: '50%',
        barMaxWidth: 60,
        label: {
          show: true,
          position: 'top',
          color: '#595959',
          fontSize: 11,
          formatter: '{c} ms'
        },
        animation: true,
        animationDuration: 600,
        animationEasing: 'cubicOut'
      }]
    }
    
    this.chart.setOption(option, { notMerge: false })
  }
  
  /**
   * 渲染吞吐量折线图
   * @param {Array} data - 性能数据
   */
  renderLineChart(data) {
    if (!data || data.length === 0) return
    if (!this.chart) {
      console.warn('Chart not initialized, skipping render')
      return
    }
    
    // 格式化时间戳
    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
    }
    
    const option = {
      backgroundColor: 'transparent',
      title: {
        text: 'IO吞吐量变化趋势',
        left: 'left',
        top: 0,
        textStyle: {
          color: '#262626',
          fontSize: 14,
          fontWeight: 600
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#d9d9d9',
        borderWidth: 1,
        textStyle: {
          color: '#262626',
          fontSize: 12
        },
        formatter: (params) => {
          const param = params[0]
          return `<div style="padding: 4px 0;">
            <div style="font-weight: 600; margin-bottom: 4px;">${param.name}</div>
            <div>吞吐量: <span style="color: #1890ff; font-weight: 600;">${param.value} KB/s</span></div>
          </div>`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.map(item => formatTime(item.timestamp)),
        boundaryGap: false,
        axisLabel: {
          color: '#595959',
          fontSize: 11,
          rotate: 45
        },
        axisLine: {
          lineStyle: {
            color: '#d9d9d9'
          }
        },
        axisTick: {
          lineStyle: {
            color: '#d9d9d9'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '吞吐量 (KB/s)',
        nameTextStyle: {
          color: '#8c8c8c',
          fontSize: 12
        },
        axisLabel: {
          color: '#595959',
          fontSize: 12
        },
        axisLine: {
          lineStyle: {
            color: '#d9d9d9'
          }
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'solid'
          }
        }
      },
      series: [{
        name: '吞吐量',
        data: data.map(item => item.throughput),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: {
          color: '#1890ff',
          width: 2
        },
        itemStyle: {
          color: '#1890ff',
          borderColor: '#fff',
          borderWidth: 1
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.2)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
          ])
        },
        animation: true,
        animationDuration: 600,
        animationEasing: 'cubicOut'
      }]
    }
    
    this.chart.setOption(option, { notMerge: false })
  }
  
  /**
   * 渲染磁盘空间占比饼图
   * @param {Object} diskData - 磁盘数据 {used, free, blockSize}
   */
  renderPieChart(diskData) {
    if (!diskData || (diskData.used === 0 && diskData.free === 0)) return
    if (!this.chart) {
      console.warn('Chart not initialized, skipping render')
      return
    }
    
    const total = diskData.used + diskData.free
    const blockSize = diskData.blockSize || 4096
    const usedPercent = ((diskData.used / total) * 100).toFixed(1)
    const freePercent = ((diskData.free / total) * 100).toFixed(1)
    
    // 格式化文件大小
    const formatSize = (blocks) => {
      const bytes = blocks * blockSize
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
    }
    
    const option = {
      backgroundColor: 'transparent',
      title: {
        text: '磁盘空间占比',
        left: 'left',
        top: 0,
        textStyle: {
          color: '#262626',
          fontSize: 14,
          fontWeight: 600
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#d9d9d9',
        borderWidth: 1,
        textStyle: {
          color: '#262626',
          fontSize: 12
        },
        formatter: (params) => {
          const size = formatSize(params.value)
          return `
            <div style="padding: 4px 0;">
              <div style="font-weight: 600; margin-bottom: 4px; color: #262626;">${params.name}</div>
              <div style="margin: 2px 0; color: #595959;">块数: <span style="color: #1890ff; font-weight: 600;">${params.value}</span></div>
              <div style="margin: 2px 0; color: #595959;">大小: <span style="color: #1890ff; font-weight: 600;">${size}</span></div>
              <div style="margin: 2px 0; color: #595959;">占比: <span style="color: #1890ff; font-weight: 600;">${params.percent}%</span></div>
            </div>
          `
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: '5%',
        left: 'center',
        itemGap: 30,
        textStyle: {
          color: '#595959',
          fontSize: 12
        },
        icon: 'circle'
      },
      graphic: [
        {
          type: 'group',
          left: 'center',
          top: 'center',
          children: [
            {
              type: 'text',
              z: 100,
              left: 'center',
              top: 'middle',
              style: {
                text: '总计',
                textAlign: 'center',
                fill: '#9ca3af',
                fontSize: 12
              }
            },
            {
              type: 'text',
              z: 100,
              left: 'center',
              top: 'middle',
              style: {
                text: total,
                textAlign: 'center',
                fill: '#ffffff',
                fontSize: 20,
                fontWeight: 'bold'
              },
              y: 20
            },
            {
              type: 'text',
              z: 100,
              left: 'center',
              top: 'middle',
              style: {
                text: '块',
                textAlign: 'center',
                fill: '#9ca3af',
                fontSize: 10
              },
              y: 40
            }
          ]
        }
      ],
      series: [{
        type: 'pie',
        radius: ['45%', '75%'], // 环形图，稍微调整大小
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 2,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'outside',
          formatter: (params) => {
            return `${params.name}\n${params.percent}%`
          },
          color: '#595959',
          fontSize: 11,
          fontWeight: 'normal',
          lineHeight: 16,
          rich: {
            name: {
              fontSize: 11,
              color: '#595959'
            },
            percent: {
              fontSize: 12,
              fontWeight: 600,
              color: '#262626'
            }
          }
        },
        labelLine: {
          show: true,
          length: 15,
          length2: 10,
          lineStyle: {
            color: '#d9d9d9',
            width: 1
          }
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 600
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowOffsetY: 2,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          },
          scale: true,
          scaleSize: 5
        },
        data: [
          { 
            value: diskData.used, 
            name: '已使用',
            itemStyle: {
              color: '#1890ff'
            }
          },
          { 
            value: diskData.free, 
            name: '空闲',
            itemStyle: {
              color: '#d9d9d9'
            }
          }
        ],
        animation: true,
        animationType: 'scale',
        animationEasing: 'cubicOut',
        animationDuration: 600,
        animationDelay: (idx) => idx * 100
      }]
    }
    
    this.chart.setOption(option, { notMerge: false })
  }
  
  /**
   * 更新图表数据
   * @param {Object} option - ECharts配置项
   * @param {boolean} notMerge - 是否不合并配置（true=替换，false=合并）
   */
  updateChart(option, notMerge = false) {
    if (this.chart) {
      try {
        this.chart.setOption(option, { notMerge })
      } catch (error) {
        console.error('Failed to update chart:', error)
      }
    }
  }
  
  /**
   * 调整图表大小（响应式）
   */
  resize() {
    if (this.chart) {
      this.chart.resize()
    }
  }
  
  /**
   * 销毁图表
   */
  dispose() {
    // 移除窗口大小监听
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
      this.resizeHandler = null
    }
    
    if (this.chart) {
      this.chart.dispose()
      this.chart = null
    }
  }
}

