# Stellara

Stellara 是一个面向英语口试场景的 AI 音色复刻 MVP。用户登录后可以上传自己的声音样本，克隆个人音色，再输入文本生成对应的语音音频。

当前技术栈：

- Next.js 15 App Router
- Supabase Auth + Postgres
- MiniMax Voice Clone / TTS API
- Tailwind CSS

## Current Scope

当前仓库已经实现：

- 邮箱密码登录
- 音色列表页 `/voices`
- 新建音色页 `/voices/new`
- 文本生成音频页 `/generate`
- 生成历史页 `/history`
- 主样本上传、拖拽上传、麦克风录音
- 录音实时频谱图
- 自定义音频播放器
- 服务端 API
  - `POST /api/voices`
  - `POST /api/generate`

当前还没有实现：

- SSE 实时状态流
- 音频持久化到 Supabase Storage
- 管理后台
- 自动刷新 7 天即将过期音色的 cron job

## Local Development

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.local.example .env.local
```

3. 填写 `.env.local`

需要至少配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
MINIMAX_API_KEY=your-minimax-api-key
MINIMAX_API_BASE=https://api.minimax.io/v1
MINIMAX_TIMEOUT_MS=120000
MINIMAX_MAX_RETRIES=2
```

4. 初始化 Supabase 数据库

在 Supabase SQL Editor 中执行 [`supabase/schema.sql`](/Users/jesse/Documents/MCP/Stellara/supabase/schema.sql)。

5. 启动开发环境

```bash
npm run dev
```

默认访问：

- `http://localhost:3000/login`

## Supabase Setup

### 1. Create Project

在 Supabase 新建一个项目，然后拿到：

- Project URL
- `anon` key
- `service_role` key

### 2. Enable Email Auth

在 Supabase 控制台中启用 Email/Password 登录。

建议：

- 开发阶段先关闭 email confirm，减少测试摩擦
- 上线前再决定是否开启邮箱确认

### 3. Run Schema

执行 [`supabase/schema.sql`](/Users/jesse/Documents/MCP/Stellara/supabase/schema.sql) 后会创建：

- `voices`
- `generation_tasks`

以及：

- 索引
- `updated_at` trigger
- RLS policy

### 4. RLS Assumptions

当前前端和 API 都基于“用户只能访问自己的数据”这一约束工作：

- `voices.user_id = auth.uid()`
- `generation_tasks.user_id = auth.uid()`

因此不要删除现有 RLS policy，除非同步修改应用逻辑。

## MiniMax Setup

### Required

- 配置 `MINIMAX_API_KEY`

### Current API Usage

项目当前使用：

- 文件上传接口：`/v1/files/upload`
- 音色克隆接口：`/v1/voice_clone`
- TTS 接口：`/v1/t2a_v2`

默认使用海外版域名：

- `https://api.minimax.io/v1`

如需切换环境，可通过 `MINIMAX_API_BASE` 覆盖。

### Current Constraints

代码里已经按 MVP 约束做了基础校验：

- 音频格式：`mp3 / m4a / wav`
- 音频大小：最大 20MB
- 文本长度：最大 1000 字符
- 主样本真实时长检测：至少 10 秒

注意：

- 当前克隆流程只需要“主样本音频”，不再要求示例音频或示例文本
- 页面会在浏览器端读取真实音频时长，小于 10 秒会直接拦截
- 真实合法性仍由 MiniMax 最终判定，过短或质量过差的样本仍可能被上游拒绝

## Database Model

### `voices`

用于存储用户的克隆音色。

关键字段：

- `id`
- `user_id`
- `name`
- `minimax_voice_id`
- `status`
- `preview_url`
- `last_used_at`

### `generation_tasks`

用于记录每次音频生成请求。

关键字段：

- `id`
- `user_id`
- `voice_id`
- `text`
- `status`
- `temp_audio_url`
- `storage_audio_url`
- `error_code`
- `error_message`

## Voice Expiry Logic

MiniMax 侧有 7 天未使用自动删除音色的限制。

当前仓库里的展示逻辑是：

- 0-4 天：`active`
- 5-6 天：`expiring`
- 7 天及以上：`expired`

这个状态在页面层会根据 `last_used_at` 动态推导，不完全依赖数据库静态值。相关代码在 [`src/lib/voice-status.ts`](/Users/jesse/Documents/MCP/Stellara/src/lib/voice-status.ts)。

这意味着：

- 即使还没做 cron，页面状态也能基本正确
- 真正刷新 MiniMax 活跃时间，后续仍需要服务端任务或 cron

## Deploy to Vercel

### 1. Push Code to Git Provider

先把当前仓库推到 GitHub、GitLab 或 Bitbucket。

Vercel 的 Import Project 页面只能从 Git 仓库导入，不能直接从本地目录部署这个 Next.js 项目。

### 2. Import Project in Vercel

在 Vercel 控制台：

1. 点击 `Add New...`
2. 进入 `Project`
3. 在你截图那个页面里，选择 `Import Project`
4. 选择刚刚推送的 `Stellara` 仓库
5. Framework Preset 保持 `Next.js`

### 3. Configure Environment Variables

在 Vercel Project Settings 中配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MINIMAX_API_KEY`
- `MINIMAX_API_BASE`
- `MINIMAX_TIMEOUT_MS`
- `MINIMAX_MAX_RETRIES`

推荐直接填成：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-secret-key
MINIMAX_API_KEY=your-minimax-api-key
MINIMAX_API_BASE=https://api.minimax.io/v1
MINIMAX_TIMEOUT_MS=180000
MINIMAX_MAX_RETRIES=3
```

说明：

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 在 Supabase 新版控制台里对应 `Publishable key`
- `SUPABASE_SERVICE_ROLE_KEY` 对应 `Secret key`
- `MINIMAX_API_BASE` 如果你用海外版，就保持 `https://api.minimax.io/v1`

### 4. Build Command

默认即可：

```bash
npm run build
```

### 5. Output

Next.js 默认输出，无需额外配置。

### 6. Redeploy

环境变量填完后点击 `Deploy`。

如果你是先导入项目、后补环境变量，需要在 Vercel 项目里手动触发一次 `Redeploy`。

### 7. Initialize Supabase Before First Real Test

如果你还没在线上对应的 Supabase 项目里执行过 schema，先去 Supabase SQL Editor 跑一次 [`supabase/schema.sql`](/Users/jesse/Documents/MCP/Stellara/supabase/schema.sql)。

否则上线后会遇到：

- `Could not find the table 'public.voices' in the schema cache`
- 或 `generation_tasks` 不存在

### 8. Post-deploy Checks

上线后至少验证这几条：

1. `/login` 可以正常注册和登录
2. `/voices/new` 可以上传文件、拖拽文件、麦克风录音
3. 上传至少 10 秒样本后，音色可以成功创建
4. `/generate` 可以生成音频并自动播放
5. `/history` 能看到生成记录并播放
6. MiniMax 错误会被用户看到友好提示

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
```

## Known Gaps

- 生成页还不是 SSE 流式状态，而是单请求完成后返回结果
- 生成结果还没异步搬运到 Supabase Storage，历史页当前复用临时 URL
- 没有管理端余额监控和告警
- 没有 `voices` 自动续期任务
- 没有移动端专门优化过的录音交互

## Suggested Next Steps

建议优先级：

1. 把 `/generate` 改成 SSE 状态流
2. 接 Supabase Storage 做音频持久化
3. 增加 cron endpoint，刷新快过期音色
4. 增加更严格的音频时长校验
