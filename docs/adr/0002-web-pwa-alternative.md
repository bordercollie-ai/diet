---
title: "将 Web/PWA 作为原生方案的替代路线"
type: adr
status: accepted
version: "1.1"
date: 2026-08-12
updated: 2026-08-13
---

# ADR 0002: 使用 Web/PWA 作为唯一实现路线

## 决策

Web/PWA 是唯一当前实现路线。应用使用浏览器、IndexedDB、Service Worker 和标准文件下载/选择能力，核心流程完全本地化。

## 原因

原生安装需要 Developer Mode，免费签名也有周期限制。PWA 不需要 Apple Developer 账号、证书或降低设备安全性，同时覆盖 iPhone/iPad、Mac 和桌面浏览器。

## 后果与约束

- 不提供 HealthKit、原生控件体验、App Store 分发或原生通知保证；体重和运动由用户手动输入。
- 安装、通知、后台与文件体验取决于浏览器；必须提供明确的备份与恢复，提醒用户浏览器数据清除和隐私模式的风险。
- 不以账号、服务器、云同步或第三方依赖补偿浏览器限制。
- 领域计算和备份规则独立于 Svelte 与浏览器适配层；实现顺序以 `docs/implementation-plan-web.md` 为准。
