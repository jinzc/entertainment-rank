# 全网文娱榜

这是一个可以直接部署到 GitHub Pages 的静态榜单项目。它会抓取你指定的 10 个 TopHub 文娱相关来源，并通过 GitHub Actions 每小时自动更新一次。

## 包含来源

- 微博·文娱榜
- 抖音·娱乐榜
- 抖音·明星榜
- 百度·电影榜
- 百度·电视剧榜
- 哔哩哔哩·影视榜
- 哔哩哔哩·娱乐榜
- 豆瓣电影·豆瓣新片榜
- 豆瓣电影·正在上映的电影
- 豆瓣电影·热门剧集排行榜

## 使用方法

1. 解压本压缩包。
2. 在 GitHub 新建一个仓库，例如 `entertainment-rank`。
3. 把解压后的全部文件上传到仓库根目录，注意 `.github/workflows/update.yml` 也要上传。
4. 打开仓库 `Settings` → `Pages`，把 `Build and deployment / Source` 设为 `GitHub Actions`。
5. 打开仓库 `Actions` → `Update Entertainment Rank` → `Run workflow`，手动跑一次。
6. 部署成功后，页面地址会显示在 Actions 的部署结果里，之后会按每小时自动更新。

## 自动更新机制

`.github/workflows/update.yml` 中配置了：

```yaml
schedule:
  - cron: '8 * * * *'
```

含义是每小时第 8 分钟自动运行一次。GitHub Actions 的定时任务使用 UTC 时间，但“每小时一次”的频率不受影响。

## 如果某些来源抓取失败

页面不会崩，失败来源会显示在“来源状态”里，其他成功来源仍然展示。

如果 TopHub 对 GitHub Actions 的请求进行了限制，可以在仓库里添加一个 Secret：

- 名称：`TOPHUB_COOKIE`
- 值：你在浏览器登录/访问 TopHub 后复制的 Cookie

添加位置：`Settings` → `Secrets and variables` → `Actions` → `New repository secret`。

一般先不用配置，只有出现连续 403、503 或空页面时再配置。

## 修改来源

编辑：

```text
scripts/sources.js
```

新增或删除来源后，提交到 GitHub 即可触发更新。

## 本地预览

本项目没有外部依赖。电脑上安装 Node.js 22 或以上后，在项目根目录运行：

```bash
npm run build
```

然后用任意静态服务器打开 `public/index.html`。例如：

```bash
npx serve public
```

## 目录说明

```text
.github/workflows/update.yml  # GitHub Actions，每小时抓取并部署
scripts/sources.js            # 榜单来源配置
scripts/update.js             # 抓取、解析、聚合数据
scripts/build.js              # 初始化静态目录和数据文件
public/index.html             # 页面入口
public/app.js                 # 前端交互逻辑
public/styles.css             # 页面样式
public/data/latest.json       # 最新榜单数据，Actions 会自动覆盖
```

## 说明

综合榜不是简单拼接，而是根据“来源内排名 + 热度数字 + 多来源出现次数”计算综合分。不同平台热度口径不完全一致，所以热度数字只做弱加权，主要仍以榜单排名和跨来源出现来排序。
