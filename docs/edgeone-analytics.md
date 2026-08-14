# EdgeOne 访问统计后端

该功能已经接入前端页面。每次页面加载会调用 `POST /api/analytics` 记录访问，并在以下位置展示统计结果：

- 全站页脚：当前浏览器对应的访客序号与网站运行时间；
- 文章头图元信息：当前文章浏览次数；
- Blog 文章列表：浏览次数前三的热门文章；
- About：GitHub 热力图下方继续显示过去一年的贡献数。

网站建立时间配置在 `src/config/site.ts` 的 `siteCreatedAt`，页脚计时器每秒更新一次。

## 部署前配置

无需申请 KV，也无需在控制台手动创建或绑定存储变量。项目已安装官方 `@edgeone/pages-blob` SDK；部署后第一次调用统计 API 时，EdgeOne 会自动为当前项目创建 `blog-analytics` Blob 命名空间。

重新部署项目，使 `edge-functions/api/analytics.js` 和新增依赖生效。触发一次 API 请求后，可在控制台的 Blob 存储页面只读查看命名空间和对象。

Edge Functions 会根据目录自动生成 `/api/analytics` 路由。

## API

### 记录一次访问

```http
POST /api/analytics
Content-Type: application/json

{
  "path": "/blog/example/",
  "title": "Example article",
  "type": "article",
  "countSiteVisit": true
}
```

- 前端使用 `localStorage` 缓存 24 小时访客标记与访客序号；缓存有效时，普通页面直接显示本地序号，不再请求统计接口。
- 文章页仍会在后台发送 `countSiteVisit: false`，只更新文章浏览量，不重复增加站点访客数或覆盖本地序号。
- 缓存到期后会先显示旧序号，再在后台重新计数并更新缓存，避免页脚等待接口响应。
- `countSiteVisit` 省略时默认为 `true`，保持旧客户端兼容；无论其取值如何，合法请求都会更新最近访问时间。
- 只有 `/blog/<slug>/` 形式的路径会同时增加文章浏览量。
- `title` 对文章访问可选；未提供时会从路径中生成。
- 前端会明确发送 `type: "article"` 或 `type: "page"`，避免把 `/blog/2/` 这样的分页路径误判为文章；未提供 `type` 的旧请求仍按路径判断。
- 跨域浏览器写入会被拒绝。
- 服务端不存储 IP、User-Agent、Cookie 或其他访客身份数据；浏览器本地只保存计数时间和访客序号。

### 查询统计

```http
GET /api/analytics?limit=10
```

返回站点累计访客数、最近访问时间和按浏览量降序排列的热门文章。`limit` 默认值为 10，取值范围为 1–20。

## 数据说明

统计数据保存在 `blog-analytics` Blob 命名空间，并使用强一致性读取，确保计数请求能读取到主存储中的最新值。当前计数仍采用“读取后加一再写入”，适合个人博客的简单统计；Blob SDK 没有提供原子自增接口，高并发请求仍可能互相覆盖，因此这些数据应视为近似值。

站点统计保存在 `analytics/site.json`；文章记录保存在 `analytics/articles/` 目录下，并使用路径的 SHA-256 摘要作为文件名。原始文章路径与标题保存在对应 JSON 对象中，用于返回热门文章排行。热门排行最多扫描 256 篇文章，超出时响应中的 `meta.truncated` 为 `true`。

原 KV 中的数据不会自动迁移到 Blob；如果 KV 尚未启用或尚未产生数据，则无需额外处理。

参考：

- <https://pages.edgeone.ai/zh/document/edge-functions>
- <https://pages.edgeone.ai/zh/document/blob-storage>
