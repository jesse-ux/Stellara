# Stellara TODOS

## Active

### [P2] 音色库平台化
- **What:** 将音色库设计为内部平台服务，供其他语音功能（AI对话、语音消息等）复用
- **Why:** 为Phase 2的多功能语音平台打基础
- **Pros:** 未来扩展更容易，其他功能不用重新实现音色管理
- **Cons:** 增加当前MVP的抽象层复杂度
- **Context:** 当前音色管理直接绑定TTS生成流程。平台化需要抽象出独立的voice service layer。
- **Effort:** M (human ~3天 / CC ~1h)
- **Depends on:** MVP上线，有真实用户数据

### [P2] 移动端适配优化
- **What:** 优化手机端体验，主要是生成结果查看和音色管理
- **Why:** 学生可能在校外用手机查看结果
- **Pros:** 提升移动端使用体验
- **Cons:** 增加开发和测试工作量
- **Context:** 桌面端优先开发，但基础响应式需要保证。重点是生成历史页和音色列表页。
- **Effort:** M (human ~3天 / CC ~1h)
- **Depends on:** MVP桌面端完成

### [P3] Freemium付费模式
- **What:** 设计和实现付费订阅模式（免费额度+付费升级）
- **Why:** 长期可持续运营
- **Pros:** 收入来源，筛选高质量用户
- **Cons:** 需要支付系统接入，增加复杂度
- **Context:** 当前用户群体小，先不考虑付费。等验证需求后再设计定价。
- **Effort:** L (human ~1周 / CC ~2h)
- **Depends on:** 有稳定用户量和使用数据

## Completed

(none)
