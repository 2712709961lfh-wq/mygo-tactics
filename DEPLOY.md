# 分享与部署指南

本项目是**纯静态网页**：没有构建步骤、没有后端、没有外部图片依赖。  
把整个 `mygo-tactics` 文件夹放到任意静态托管上，别人打开生成的网址就能玩。

> 注意：直接分享 `D:\deepseek\工作区\mygo-tactics\index.html` 的本地路径，别人是打不开的。  
> `localhost` 和 `file://` 也都只对本机有效，必须部署到公网。

---

## 只显示文字、没有画面？

这通常不是游戏代码坏了，而是 **`styles.css`、`entry.css`、`soul-ui.css`、`diary-ui.css` 和 `src/` 没有和 `index.html` 一起部署**。

打开下面这个地址测试：

```text
https://你的站点/styles.css
```

- 如果显示的是 CSS 代码，说明样式已上传；
- 如果显示的仍然是游戏标题页 HTML，说明服务器把所有路径都回退到了 `index.html`，CSS 和 JS 实际上没有被加载。

这时浏览器只能渲染无样式的 HTML，画布也不会启动，所以看起来就是“只有文字”。

修复方式：把 `styles.css`、`entry.css`、`soul-ui.css`、`diary-ui.css`、整个 `src/`、`assets/` 与 `map_assets/` 目录按原结构一起上传，或者使用下面的单文件方案。

---

## 单文件方案（微信直接发文件 / 只能上传一个 HTML）

在项目根目录双击：

```text
制作单文件版.bat
```

或在终端执行：

```bash
node build-standalone.js
```

会生成：

```text
standalone.html
```

这个文件把 CSS 和全部 JS 都内联进去了，**只需分享或上传这一个文件**。  
注意：单文件版修改代码后需要重新运行一次打包脚本。

---

## 方案 A：Netlify Drop（最快，拖拽即可）

1. 打开 <https://app.netlify.com/drop>
2. 上传以下文件与目录（保持它们在同一个站点根目录）：
   - `index.html`
   - `styles.css`
   - `entry.css`
   - `soul-ui.css`
   - `diary-ui.css`
   - `src` 文件夹
   - `assets` 文件夹
   - `map_assets` 文件夹
3. 等待上传完成，按页面提示登录并领取站点（Claim site）
4. 复制生成的网址，通常是：

   ```text
   https://随机名称.netlify.app
   ```

5. 用手机或无痕窗口打开一次，确认能进入标题画面。

要点：

- **不要直接拖整个项目文件夹**：里面可能包含 `.edge-profile`（测试残留）、截图、测试文件，容易上传无用内容。
- 入口文件必须叫 `index.html`，本项目已经满足。
- 不需要填写 Build command；发布目录就是站点根目录。
- 以后更新：重新上传上述文件与目录覆盖，或把站点连接到 Git 仓库。

---

## 方案 B：GitHub Pages（免费、长期）

1. 新建一个 GitHub 仓库。
2. 把 `mygo-tactics` **文件夹里面的内容**上传到仓库根目录：
   - `index.html`
   - `styles.css`
   - `entry.css`
   - `soul-ui.css`
   - `diary-ui.css`
   - `src/`
   - `assets/`
   - `map_assets/`
   - `docs/`
   - `tests/`
   - `README.md`
3. 打开仓库的 `Settings` → `Pages`。
4. `Build and deployment` 选择 `Deploy from a branch`。
5. 分支选 `main`，目录选 `/ (root)`，保存。
6. 等待 1～2 分钟，访问：

   ```text
   https://你的用户名.github.io/仓库名/
   ```

仓库根目录必须能直接看到 `index.html`，不要多套一层文件夹。

---

## 方案 C：Vercel / Cloudflare Pages

这两个平台也支持纯静态站点：

- Vercel：导入 Git 仓库，Framework Preset 选 `Other`，Build Command 留空，Output Directory 填 `.`。
- Cloudflare Pages：连接仓库，Build command 留空，Build output directory 填 `/`。

部署完成后平台会给出 `*.vercel.app` 或 `*.pages.dev` 链接。

---

## 方案 D：临时公网链接（需要本机终端）

如果只想临时发一个链接，可在项目目录启动本地服务器：

```bash
cd /d D:\deepseek\工作区\mygo-tactics
python -m http.server 8080
```

再开一个终端，用 Cloudflare Tunnel 暴露到公网：

```bash
cloudflared tunnel --url http://localhost:8080
```

命令会输出一个临时的 `https://....trycloudflare.com` 链接，关掉进程即失效。  
适合测试，不适合长期分享。

---

## 方案 E：同一 Wi-Fi 局域网

如果对方和你在同一个局域网：

```bash
cd /d D:\deepseek\工作区\mygo-tactics
python -m http.server 8080
ipconfig
```

找到本机 IPv4 地址（例如 `192.168.1.23`），让对方访问：

```text
http://192.168.1.23:8080
```

这不是公网链接，只适合同一网络下的设备。Windows 首次启动时可能弹出防火墙提示，需要允许 Python 访问专用网络。

---

## 发布前检查

- [ ] 站点根目录有 `index.html`
- [ ] `styles.css`、`entry.css`、`soul-ui.css`、`diary-ui.css`、`src/`、`assets/` 与 `map_assets/` 目录一起上传
- [ ] 用手机流量或无痕窗口打开测试，避免命中本机缓存
- [ ] 页面能进入标题画面，点击角色能看到蓝色移动范围
- [ ] 完成一次移动 → 攻击 → 确认结算
- [ ] 结束回合后敌方 AI 能行动
