// URL 可能来自命令行、环境变量或配置文件；展示时绝不能带上用户信息或查询参数。
export function redactUrl(value) {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  } catch {
    return '[invalid URL]'
  }
}
