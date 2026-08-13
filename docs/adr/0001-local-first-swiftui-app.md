---
title: "采用本地优先的 SwiftUI 饮食记录应用"
type: adr
status: superseded
version: "1.1"
date: 2026-08-12
updated: 2026-08-13
---

# ADR 0001: 本地优先 SwiftUI 路线（历史）

已于 2026-08-13 被 ADR 0002 取代；不得继续作为实现依据。

原方案选择 SwiftUI、本地存储和版本化 JSON 备份，通知与 HealthKit 为可选增强能力。能力验证确认模拟器和 Mac Catalyst 构建可用，但没有有效签名身份，且真实设备未启用 Developer Mode。因此，真实设备安装与 HealthKit 读写未验证，HealthKit 在当前环境不可用。

选择 Web/PWA 后，所有活跃范围、约束和实施计划分别以 `docs/prd-web.md`、ADR 0002 和 `docs/implementation-plan-web.md` 为准。
