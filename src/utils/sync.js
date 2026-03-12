/**
 * WebDAV 云同步工具
 */

import { createClient } from 'webdav'

const STORAGE_KEY = 'eb-sync-config'

// 默认配置（坚果云）
const DEFAULT_CONFIG = {
  serverUrl: 'https://dav.jianguoyun.com/dav/',
  username: '',
  password: '',
  enabled: false
}

/**
 * 获取同步配置
 */
export function getSyncConfig() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }
  return { ...DEFAULT_CONFIG }
}

/**
 * 保存同步配置（加密）
 */
export function saveSyncConfig(config) {
  const configToSave = {
    ...config,
    // 简单 Base64 编码（实际生产环境建议使用更安全的加密）
    password: btoa(encodeURIComponent(config.password || ''))
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave))
}

/**
 * 获取解码后的密码
 */
export function getDecodedPassword() {
  const config = getSyncConfig()
  if (config.password) {
    try {
      return decodeURIComponent(atob(config.password))
    } catch {
      return ''
    }
  }
  return ''
}

/**
 * 创建 WebDAV 客户端
 */
function createWebDAVClient() {
  const config = getSyncConfig()
  if (!config.serverUrl || !config.username || !config.password) {
    return null
  }

  return createClient(config.serverUrl, {
    username: config.username,
    password: getDecodedPassword()
  })
}

/**
 * 上传数据到 WebDAV
 */
export async function uploadData(studyData, books) {
  const client = createWebDAVClient()
  if (!client) {
    console.log('WebDAV 未配置，跳过上传')
    return { success: false, reason: 'not_configured' }
  }

  try {
    const dataToUpload = JSON.stringify({
      studyData,
      books,
      timestamp: Date.now(),
      version: '1.0'
    }, null, 2)

    await client.putFileContents('/study_data.json', dataToUpload, {
      overwrite: true
    })

    console.log('✅ 数据已上传到云端')
    return { success: true }
  } catch (error) {
    console.error('❌ 上传失败:', error)
    return { success: false, reason: error.message }
  }
}

/**
 * 从 WebDAV 下载数据
 */
export async function downloadData() {
  const client = createWebDAVClient()
  if (!client) {
    console.log('WebDAV 未配置，跳过下载')
    return { success: false, reason: 'not_configured' }
  }

  try {
    // 检查文件是否存在
    const exists = await client.exists('/study_data.json')
    if (!exists) {
      console.log('云端暂无数据')
      return { success: false, reason: 'no_data' }
    }

    // 下载文件
    const content = await client.getFileContents('/study_data.json', {
      format: 'text'
    })

    const parsed = JSON.parse(content)

    console.log('✅ 数据已从云端下载')
    return {
      success: true,
      data: parsed
    }
  } catch (error) {
    console.error('❌ 下载失败:', error)
    return { success: false, reason: error.message }
  }
}

/**
 * 检查 WebDAV 连接
 */
export async function testConnection(config) {
  const tempClient = createClient(config.serverUrl, {
    username: config.username,
    password: config.password
  })

  try {
    await tempClient.getDirectoryContents('/')
    return { success: true }
  } catch (error) {
    return { success: false, reason: error.message }
  }
}

/**
 * 防抖函数
 */
export function debounce(fn, delay) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}
