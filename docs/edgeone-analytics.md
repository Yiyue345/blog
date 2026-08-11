# EdgeOne 访问统计后端

该功能仅提供后端 API，当前没有接入任何前端页面，也不会自动发送访问记录。部署后可以先通过 API 验证数据；后续接入无界面的统计请求或可见组件时，再由页面调用 `POST /api/analytics`。

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
  "title": "Example article"
}
```

- 每次合法请求都会增加站点总访问量并更新最近访问时间。
- 只有 `/blog/<slug>/` 形式的路径会同时增加文章浏览量。
- `title` 对文章访问可选；未提供时会从路径中生成。
- 跨域浏览器写入会被拒绝。
- 不存储 IP、User-Agent、Cookie 或其他访客身份数据。

### 查询统计

```http
GET /api/analytics?limit=10
```

返回站点总访问量、最近访问时间和按浏览量降序排列的热门文章。`limit` 默认值为 10，取值范围为 1–20。

## 数据说明

统计数据保存在 `blog-analytics` Blob 命名空间，并使用强一致性读取，确保计数请求能读取到主存储中的最新值。当前计数仍采用“读取后加一再写入”，适合个人博客的简单统计；Blob SDK 没有提供原子自增接口，高并发请求仍可能互相覆盖，因此这些数据应视为近似值。

站点统计保存在 `analytics/site.json`；文章记录保存在 `analytics/articles/` 目录下，并使用路径的 SHA-256 摘要作为文件名。原始文章路径与标题保存在对应 JSON 对象中，用于返回热门文章排行。热门排行最多扫描 256 篇文章，超出时响应中的 `meta.truncated` 为 `true`。

原 KV 中的数据不会自动迁移到 Blob；如果 KV 尚未启用或尚未产生数据，则无需额外处理。

参考：

- <https://pages.edgeone.ai/zh/document/edge-functions>
- <https://pages.edgeone.ai/zh/document/blob-storage>
