---
title: "将 Web/PWA 作为原生方案的替代路线"
type: adr
status: accepted
version: "1.0"
date: 2026-08-12
---

# ADR 0002: 使用 Web/PWA 作为唯一实现路线

## 背景

原生 SwiftUI 方案能覆盖 iPhone/iPad、Mac Catalyst、通知和 HealthKit，但直接从 Xcode 安装到设备需要 Developer Mode；免费个人签名还有约 7 天限制。用户希望保留不降低设备安全性的选择。

## 决策

Web/PWA 是唯一当前实现路线，不再推进原生 SwiftUI MVP。该方案使用浏览器、IndexedDB、Service Worker 和标准文件选择/下载能力，核心记录流程完全本地化。

不需要支持的最低 Safari 和 Chromium 版本，尽量新的浏览器支持即可。

需要 PWA 安装体验。

## 原因

- 不需要 Apple Developer 账号、证书或 Developer Mode。
- 可覆盖 iPhone/iPad、Mac 和桌面浏览器，减少平台安装门槛。
- IndexedDB 和 JSON 文件足以支撑本地记录与手动迁移。

## 取舍

- 浏览器无法访问 HealthKit；体重、运动和营养同步必须删除或改为手动输入。
- 通知权限、后台执行、文件系统和安装体验因浏览器而异。
- PWA 数据清除、浏览器迁移和隐私模式可能导致数据丢失，必须提供显式导出提醒和可靠的备份恢复。
- App Store 分发、原生控件体验和系统健康数据整合不再是 Web 方案承诺。

## 约束

- 不引入账号、服务器、云同步或第三方依赖来弥补浏览器能力差异。
- 先复用纯领域计算和备份规则；UI、存储适配和权限能力与 SwiftUI 隔离。
- Web 方案获选后，先更新 `docs/implementation-plan-web.md`，再开始新的实现阶段。
