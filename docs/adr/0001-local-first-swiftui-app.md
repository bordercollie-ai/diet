---
title: "采用本地优先的 SwiftUI 饮食记录应用"
type: adr
status: superseded
version: "1.0"
date: 2026-08-12
---


# ADR 0001: 采用本地优先的 SwiftUI 饮食记录应用（历史）

> Superseded on 2026-08-13 by ADR 0002. SwiftUI is no longer an active implementation route.

## 背景

应用供个人使用，目标平台是 iPhone/iPad，并希望尽量支持 macOS。用户不购买Apple Developer Program，也不使用服务器或 iCloud，因此必须接受免费签名带来的约 7 天重新安装/签名限制。

核心需求是记录饮食卡路里、规划饮食目标、内置精选日本食品数据、保存用户自定义食品，并通过 Files 手动导出/导入数据。通知和 HealthKit 联动有价值，但不应阻塞本地饮食记录的核心流程。

## 决策

1. 使用原生 SwiftUI，优先支持 iPhone/iPad，并通过 SwiftUI/Mac Catalyst 最大化macOS 代码复用。
2. 采用本地优先存储，不实现账号、后端、云同步或 iCloud 依赖。
3. 使用版本化 JSON 作为 Files 备份格式；导入默认合并记录，冲突时按相同 ID覆盖，并在界面明确提示。
4. 首版内置精选日本食品数据，包括代表性的便利店和麦当劳项目；开发期允许使用官方公开页面导入脚本生成可审阅的快照，但不抓取或声称覆盖完整品牌菜单。每个数据集记录来源、授权信息和版本。
5. 支持用户手动创建和保存食品，自动计算每日总热量/宏量营养，并允许覆盖自动估算的目标。
6. 使用本地通知实现提醒。HealthKit 仅在用户授权后，尝试读取体重并写入每日热量/营养数据；权限不可用时核心功能仍可运行。
7. 首版支持中文、英文界面及中文、英文、日文食品名称；AI 识别、条码扫描、完整过敏/饮食筛选、云同步和远程营养 API 暂缓。

## 原因

- 原生 SwiftUI 能覆盖目标 Apple 平台，避免引入跨平台框架和额外依赖。
- 本地数据符合个人使用和无费用要求，也避免服务器、账号和隐私运维。
- JSON 备份可通过 Files 手动同步，且格式透明、可测试、可迁移。
- 精选数据集能先验证记录流程，避免未经确认的第三方数据授权和维护成本。
- HealthKit 和通知属于增强能力，不能成为无证书环境下 MVP 的单点故障。

## 取舍与后果

### 正面

- 无需服务器、付费开发者账号或 iCloud。
- 离线可用，数据由用户掌控。
- 一套 SwiftUI 代码可覆盖 iOS/iPadOS，并尽量复用到 macOS。
- 可通过版本化导出文件完成备份和设备间手动迁移。

### 负面

- 免费签名可能要求约每 7 天重新安装或签名。
- Files 同步是手动的，不是实时同步；合并冲突规则必须保持稳定。
- 内置食品库不是完整品牌数据库，需要维护数据来源和授权。
- HealthKit 能力、entitlement 和 Mac Catalyst 支持必须在真实设备和目标系统上 先验证。
- JSON 备份包含敏感健康数据，导出文件由用户自行负责保管。

## 不采用的方案

- **云端账号和数据库**：超出本地自用和零运营成本目标。
- **iCloud 同步**：与当前无 iCloud 约束冲突。
- **跨平台框架**：首版增加构建、平台能力和依赖复杂度；原生 SwiftUI 已覆盖目标平台。
- **完整自动抓取食品库**：授权、准确性和持续更新成本过高。
- **首版 AI 识别**：不是饮食记录闭环的必要条件，延后到 MVP 验证后。

## 官方食品导入脚本（2026-08-13）

- 仅访问品牌公开页面；单线程、低频请求，使用明确的 User-Agent，不绕过验证码、登录、robots 或访问控制。
- 脚本是开发期工具，输出本地 JSON；App 不在运行时联网，也不自动更新食品库。
- 每条记录保存来源 URL 和抓取日期；官方页面缺少的语言名称不得猜测，使用外部人工映射并单独标记。
- 当前麦当劳日本公开站点提供日文和英文菜单名称，但没有官方中文菜单名称；中文字段必须由人工审核的映射文件提供，否则脚本明确报错。

## 开发与分发限制

- iOS Simulator 和 Mac Catalyst 开发不需要付费 Apple Developer 证书。
- 从 Xcode 或免费个人签名直接安装到 iPhone/iPad，需要用户在设备上开启 Developer Mode；免费签名通常约 7 天后过期并需要重新安装。
- TestFlight/App Store 安装不需要 Developer Mode，但需要 Apple 签名、分发和相应流程。用户不愿开启 Developer Mode 时，开发与验证范围限定为模拟器和 Mac Catalyst；HealthKit 等真实设备能力标记为不可用。

## 实施前验证

- 确认当前 macOS/Xcode 与目标 iOS/macOS 版本。
- 在个人设备上验证免费签名周期和重装流程。
- 验证 HealthKit entitlement、授权流程及 Mac Catalyst 行为。
- 为 JSON 备份建立版本号、校验和备份恢复测试。

## Phase 0 capability spike (2026-08-12)

- Xcode 26.3 (17C529) is installed at `/Applications/Xcode.app`; the active developer directory remains `/Library/Developer/CommandLineTools`, so checks used `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.
- Selected spike deployment targets were iOS 18.0 (iPhone/iPad) and iOS 18.0
  for Mac Catalyst. The installed SDKs are iOS/iOS Simulator/macOS 26.2.
- The disposable SwiftUI app built successfully for Mac Catalyst with
  `CODE_SIGNING_ALLOWED=NO`.
- After installing the simulator runtime, the iOS simulator build succeeded and the app installed and launched on iPhone 16e (iOS 26.3).
- The simulator notification check succeeded: the app logged
  `notification scheduled` and `notification cancelled`.
- `security find-identity -v -p codesigning` reports `0 valid identities found`. A trusted iPhone is visible to Xcode, but Developer Mode is intentionally not enabled, so free signing/install behavior cannot be tested.
- `HealthKit.framework` and `UserNotifications.framework` are present in the SDKs. HealthKit authorization and read/write remain untested because they require a real device with Developer Mode and signing; the user declined enabling Developer Mode.
- **Result:** HealthKit is `unavailable` for this environment by deliberate device-security choice. Keep HealthKit optional and do not let it block local recording.
