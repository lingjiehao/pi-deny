# pi-deny 测试方法

可切换权限策略管理器。测试覆盖：策略选择、模型感知、工具拦截、状态栏显示。

## 环境

```bash
# 加载扩展（二选一）
pi install git:git@github.com:lingjiehao/pi-deny.git   # 正式安装
# 或开发模式
pi -e /path/to/pi-deny/extensions/index.ts
```

## 测试 1：策略选择框

在交互式 TUI 中按 Ctrl+Alt+P，应弹出选择框：

```
权限策略
☐ 🚫 禁止 git push
☐ 🚫 禁止 edit
☐ ✏️ 自定义指令
☐ ✅ 不禁止任何指令
```

- 方向键选择 + Enter 确认，Esc 取消（不改变策略）

## 测试 2：各策略的拦截效果

### 2.1 禁止 git push
1. Ctrl+Alt+P → 选 "🚫 禁止 git push"
2. 让模型执行 `git push`
   - 预期：被拦截，提示 `[pi-deny] 当前策略禁止 git push`
3. `git status` / `git diff` / `git log` 应正常放行

### 2.2 禁止 edit
1. Ctrl+Alt+P → 选 "🚫 禁止 edit"
2. 让模型写/改文件
   - 预期：write/edit 被拦截，提示 `[pi-deny] 当前策略禁止 write`
3. 状态栏应显示 `🔒RO`

### 2.3 自定义指令
1. Ctrl+Alt+P → 选 "✏️ 自定义指令"
2. 输入 `^rm `（禁止卸载类命令）
3. 让模型执行 `rm file` 或 `rm -rf dir`
   - 预期：被拦截，提示 `[pi-deny] 命令命中自定义规则`
4. 状态栏应显示 `⚙️^rm`

### 2.4 不禁止任何指令
1. Ctrl+Alt+P → 选 "✅ 不禁止任何指令"
2. 让模型执行任意操作（写文件、git push）
   - 预期：全部放行，状态栏无显示

## 测试 3：模型感知

- 选择策略后，发送一条与策略相关的请求（如选"禁止 git push"后问模型"我可以 git push 吗"）
  - 预期：模型应回答"当前策略禁止"或主动拒绝（系统提示中已有策略说明）
- 可以从 `/session` 或调试输出中确认系统提示包含 `<active_policy>` 和策略描述

## 测试 4：取消选择

- Ctrl+Alt+P → Esc 取消
  - 预期：策略不变，无通知

## 回归（自动化，可选）

```bash
# 默认策略（无禁止）下允许所有操作
pi --mode json -p "用write工具写入/tmp/pideny-test.txt 内容 x"
ls /tmp/pideny-test.txt   # 应存在
```

> 注意：策略选择框需要交互式 UI（TUI 模式），headless 模式无法弹出；拦截验证需在交互模式进行。

## 清理

```bash
rm -f /tmp/pideny-test.txt /tmp/rotest.txt
```