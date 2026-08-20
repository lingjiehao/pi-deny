# pi-deny

可切换的权限策略管理器 for pi。按 `Ctrl+Alt+P` 弹出策略选择框，选择当前权限策略，模型能感知策略并拒绝被禁止的操作。

## 功能

- **快捷键 `Ctrl+Alt+P`** 弹出策略选择框：
  - 🚫 禁止 git push
  - 🚫 禁止 edit（edit / write / edit-diff / patch）
  - ✏️ 自定义指令（输入正则，如 `^rm ` 或 `git push`）
  - ✅ 不禁止任何指令（默认）
- **模型感知**：每次 agent 启动时通过 `before_agent_start` 把当前策略注入系统提示（`<active_policy>`），模型知道自己该拒绝什么
- **事件级拦截**：`tool_call` 钩子拦截匹配的调用，返回 `block + reason`
- **状态栏显示**：🔒RO（禁 edit） / 🚫NO-PUSH（禁 git push） / ⚙️自定义 / 默认不显示

## 安装

```bash
# 从 GitHub 安装
pi install git:git@github.com:lingjiehao/pi-deny.git

# 或本地开发
pi -e /path/to/pi-deny/extensions/index.ts
```

## 用法

```text
Ctrl+Alt+P    ← 弹出权限策略选择框
  → 选择策略后立即生效（状态栏 + 模型感知 + 拦截）
```

## 测试

见 [TESTING.md](TESTING.md)

## 原理

- `registerShortcut("ctrl+alt+p")` → `ctx.ui.select()` 弹选择框，`ctx.ui.input()` 输入自定义规则
- `before_agent_start` 返回追加的 `systemPrompt`，注入当前策略
- `tool_call` 事件返回 `{ block: true, reason }` 阻止被禁止的操作
- `ctx.ui.setStatus` 在状态栏显示当前策略

## 对比 pi-readonly-toggle

| | pi-readonly-toggle | pi-deny |
|---|-------------------|---------|
| 策略数量 | 单一开关（RO/RW） | 多策略（git push / edit / 自定义 / 全放行） |
| 选择方式 | 快捷键直接切换 | 快捷键弹选择框 |
| 模型感知 | 无（只有拦截提示） | ✅ 系统提示注入 |
| 自定义规则 | 无 | ✅ 正则 |

## License

MIT