# 基于 Notion 搭建的私人博客

系统通过调用官方 **notion-js-sdk** 获取 Notion 数据，然后通过本项目展示。

[DEOM演示](https://xingbaifang.com)

## 写在前面

项目 Nodejs 必须 >= 20。

由于 Notion 在国内环境访问比较慢，所以在项目中，不会实时获取数据。

项目会通过**定时任务**获取**Notion**数据，然后保存至 SQLite 数据库中。项目实时从 SQLite 数据库获取数据，并展示页面。

定时任务在 **./app/schedule/** 目录中，定时任务包含：

| 文件    | 定时间隔 | 说明 |
| -------- | ------- | ------ |
| build-robots-txt.js  | 8h    | 生成 /robots.txt 文件 |
| build-sitemap-xml.js  | 8h    | 生成 /sitemap.xml 文件 |
| download-file-to-disk.js  | 1h    | 下载从 Notion 中上传到文件，并下载到本地磁盘。从 Notion 上传的文件，存放到 amazon 服务，有实效性且访问速度慢，这个文件的作用是把 amazon 文件下载下来，为后续转存到自建图床做准备 |
| fetch-notion-post-content-to-database.js  | 1h    | 下载 Notion 文章内容到 SQLite |
| fetch-notion-post-property-to-database.js  | 2h    | 下载 Notion 文章 property 到 SQLite |
| fetch-notion-site-info-to-database.js  | 2h    | 下载站点信息以及站点配置到 SQLite |
| transfer-file-to-aws.js  | 1h    | 使用 rclone 把之前下载到磁盘中的文件，同步到类 AWS 图床中 |
| update-post-views-to-notion.js  | 2h    | 异步更新 Notion Post 浏览数。在 SQLite 存放是缓存数据，不能直接更新 SQLite，折中方案时，把浏览数存放到内存中，然后固定间隔累加浏览数，然后实时更新 Notion 数据 |
| update-rclone-config.js  | 5m    | 把用户从 Notion 配置文件中的 rclone 文件内容，更新到机器中 |
| update-site-info-cache.js  | 5m    | 更新 siteInfo 缓存 |

项目涉及到使用 **[rclone](https://rclone.org/)**，建议在 Docker 部署。如果您的环境已经安装 rclone ，可以不通过 Docker 部署。

字体图标使用[FontAwesome](https://fontawesome.com/)，图标查询，参见：[https://fontawesome.com/search?o=r&m=free](https://fontawesome.com/search?o=r&m=free)

站点评论使用[twikoo](twikoo)。私有化部署在 Docker 中。

> 这里没有使用类 git discussion 评论系统。原因是这类系统，都需要事前登录，而评论用户有时很讨厌登录，所以就放弃了。

## 使用技术

* Eggjs
* Tailwindcss
* notion-js-sdk
* lodash
* rclone
* FontAwesome
* Twikoo

## Docker 部署

假设 Docker 宿主机目录为 /home/user/web/notion-blog，这个目录中，新建 **data** 和 **logs** 目录。

进入到 ./data 目录中，建立 **data.db** 数据库文件。

```bash
touch data.db
```

创建容器

```bash
docker run -d -p 7110:7110 \
  -e NOTION_APP_KEY=auth \
  -e NOTION_DATABASE_ID=database_id \ 
  -e SITE_DOMAIN=site_domain \
  -e LOG_CENTER_SERVER=log-center.server.com \
  -v /home/user/web/notion-blog/logs:/root/logs \
  -v /home/user/web/notion-blog/data:/app/data \
  --name notion-blog xbf321/notion-blog:latest
```

参数说明

| 参数名    | 描述 |
| -------- | ------- |
| NOTION_APP_KEY  | Notion 访问令牌    |
| NOTION_DATABASE_ID  | Notion 空间Id   |
| SITE_DOMAIN  | 博客域名，如 https://xingbaifang.com，不要有尾 /   |
| LOG_CENTER_SERVER  | 上报至日志中心，便于定位问题（若有，选填）  |

如何找到 NOTION_APP_KEY 和 NOTION_DATABASE_ID？

### docker-compose 部署

新建 **docker-compose.yaml** 文件，内容如下：

```shell
version: '3.9'
services:
  notion-blog:
    container_name: notion-blog
    image: xbf321/notion-blog:latest
    volumes:
      - ./notion-blog/logs:/root/logs
      - ./notion-blog/data:/app/data
    environment:
      - NOTION_APP_KEY=key
      - NOTION_DATABASE_ID=id
      - SITE_DOMAIN=https://example.com
      - LOG_CENTER_SERVER=xx
    restart: unless-stopped
    privileged: true
    ports:
      - 7110:7110
```

安装

```shell
docker-compose up -d
```

重新安装，执行：

```shell
# 停止容器
docker-compose down
# 获取最新 image
docker-compose pull xbf321/notion-blog
# 启动
docker-compose up -d
```

## 非 Docker 部署

务必在环境中，提前安装 rclone。

```bash
NOTION_APP_KEY=
NOTION_DATABASE_ID=
SITE_DOMAIN=
LOG_CENTER_SERVER=
npm run start:daemon
npm stop
```


## 已实现的 Block

针对一个小型博客，下面这些 block 能覆盖大部分场景。

* h1/h2/h3/h4
* bulleted_list_item
* child_page
* divider
* image
* numbered_list_item
* paragraph
* quote
* table
* to_do
* code

> 注意：
> text 背景色不支持

## 错误日志处理

为了能及时收到错误信息，系统在发生「ERROR」类型错误时，会通过预先配置的 **LOG_CENTER_SERVER** 变量，发送到远程服务中。发送格式：

```js
// app/lib/remote-error-transport.js
this.options.app.curl(logCenterServer, {
  method: 'POST',
  contentType: 'json',
  data: {
    content: JSON.stringify(message),
  },
});
```

## 配置中心

配置方式分为三种，分别是：

* Github 源代码修改
* Docker 初始化时
* Notion 笔记中修改

### Docker 初始化

下面这些必须在 Docker 初始化配置

* NOTION_APP_KEY
* NOTION_DATABASE_ID
* SITE_DOMAIN
* LOG_CENTER_SERVER

### Notion 笔记中修改

网站的图标、标题、描述、封面图将直接读取您的Notion模板。

## Development

### 创建 data.db 文件 和 blog 表

首次运行，在 ./data 目录中，创建名为 **data.db** 文件。

使用 **SQLite** 可视化工具，如 SQLiteStudio ，创建 **blog** 表。执行下面SQL：

```shell
CREATE TABLE blog (
  name TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL DEFAULT (''),
  last_sync_time TEXT
);
```

线上环境不用这一步，会自动检测 blog 是否存在。

### 在 config 目录中，新建 config.local.js，内容如下

```js
module.exports = () => {
  return {
    notionAppKey: 'key',
    notionDatabaseId: 'id',
    // 本地开发，尽量留空
    siteDomain: '',
  };
};
```

### 开始运行

```bash
npm i
npm run dev
open http://localhost:7110/
```

### Docker 编译和发布

```sh
# 构建 image
docker build -t xbf321/notion-blog .

# 发布到 hub.docker.io
docker push xbf321/notion-blog:latest

# 临时运行
docker run -it --name notion-blog xbf321/notion-blog /bin/bash

# 进入容器内部
docker exec -it notion-blog /bin/bash
```
