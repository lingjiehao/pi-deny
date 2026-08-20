/**
 * pi-deny
 *
 * 可切换的权限策略管理器。
 * - 快捷键 Ctrl+Alt+P 弹出策略选择框
 * - 策略选项：
 *   - 🚫 禁止 git push（含 git push --force 等所有 push 变体）
 *   - 🚫 禁止 edit（edit / write / edit-diff / patch）
 *   - ✏️ 自定义指令（手动输入要禁止的命令正则）
 *   - ✅ 不禁止任何指令（默认）
 * - 状态栏显示当前策略（🔒RO / 🚫NO-PUSH / ⚙️自定义 / 默认不显示）
 * - 通过 before_agent_start 注入系统提示，让模型感知当前权限策略
 */
export default function (pi: ExtensionAPI) {
  // 策略状态
  let denyGitPush = false;
  let denyEdit = false;
  let customPattern: RegExp | null = null;
  let customLabel = "";

  const STATUS_KEY = "pi-deny";

  // ── 构建当前策略描述（用于系统提示注入） ──────────────────────
  function buildPolicyText(): string {
    const parts: string[] = [];
    if (denyEdit) parts.push("- 禁止 edit / write / edit-diff / patch（所有文件修改工具）");
    if (denyGitPush) parts.push("- 禁止 git push（含 --force 变体）");
    if (customPattern) parts.push(`- 禁止匹配 ${customLabel} 的命令`);
    if (parts.length === 0) return "无（允许所有操作）";
    return parts.join("\n");
  }

  // ── 更新状态栏 ────────────────────────────────────────────────
  function updateStatus(ctx: { ui: { setStatus: (k: string, v: string | undefined) => void } }) {
    if (denyEdit) ctx.ui.setStatus(STATUS_KEY, "🔒RO");
    else if (denyGitPush) ctx.ui.setStatus(STATUS_KEY, "🚫NO-PUSH");
    else if (customPattern) ctx.ui.setStatus(STATUS_KEY, `⚙️${customLabel.slice(0, 8)}`);
    else ctx.ui.setStatus(STATUS_KEY, undefined);
  }

  // ── 系统提示注入：模型感知当前策略 ─────────────────────────────
  pi.on("before_agent_start", (event) => {
    const policy = buildPolicyText();
    const notice = `\n\n<active_policy>
当前生效的权限策略：
${policy}
如果用户要求执行被禁止的操作，必须拒绝并提示用户。要修改策略，请用户按 Ctrl+Alt+P。
</active_policy>`;
    return { systemPrompt: event.systemPrompt + notice };
  });

  // ── 快捷键：弹出策略选择框 ─────────────────────────────────────
  pi.registerShortcut("ctrl+alt+p", {
    description: "Select permission policy (pi-deny)",
    async handler(ctx) {
      const choice = await ctx.ui.select("权限策略", [
        "🚫 禁止 git push",
        "🚫 禁止 edit",
        "✏️ 自定义指令",
        "✅ 不禁止任何指令",
      ]);
      if (choice === undefined) return; // 用户取消

      switch (choice) {
        case "🚫 禁止 git push":
          denyGitPush = true;
          denyEdit = false;
          customPattern = null;
          customLabel = "";
          ctx.ui.notify("🚫 已禁止 git push", "info");
          break;
        case "🚫 禁止 edit":
          denyEdit = true;
          denyGitPush = false;
          customPattern = null;
          customLabel = "";
          ctx.ui.notify("🔒 已禁止 edit / write", "info");
          break;
        case "✏️ 自定义指令": {
          const pattern = await ctx.ui.input("自定义禁止规则", "输入正则，如 ^git push 或 ^rm ");
          if (pattern) {
            try {
              customPattern = new RegExp(pattern);
              customLabel = pattern;
              denyEdit = false;
              denyGitPush = false;
              ctx.ui.notify(`⚙️ 自定义规则已生效: ${pattern}`, "info");
            } catch {
              customPattern = null;
              customLabel = "";
              ctx.ui.notify("正则无效，未设置", "error");
            }
          }
          break;
        }
        case "✅ 不禁止任何指令":
          denyEdit = false;
          denyGitPush = false;
          customPattern = null;
          customLabel = "";
          ctx.ui.notify("✅ 已解除所有禁止，允许全部操作", "info");
          break;
      }
      updateStatus(ctx);
    },
  });

  // ── 工具调用拦截 ─────────────────────────────────────────────
  pi.on("tool_call", (event) => {
    const toolName = event.toolName;

    // 禁止 edit：拦截文件修改工具
    if (denyEdit && (toolName === "edit" || toolName === "write" || toolName === "edit-diff" || toolName === "patch")) {
      return {
        block: true,
        reason: `[pi-deny] 当前策略禁止 ${toolName}。按 Ctrl+Alt+P 更换策略。`,
      };
    }

    // 禁止 git push / 自定义规则：bash 拦截
    if (toolName === "bash") {
      const cmd = String(event.input?.command ?? "");
      if (denyGitPush && /\bgit\s+push\b/.test(cmd)) {
        return {
          block: true,
          reason: `[pi-deny] 当前策略禁止 git push。按 Ctrl+Alt+P 更换策略。`,
        };
      }
      if (customPattern && customPattern.test(cmd)) {
        return {
          block: true,
          reason: `[pi-deny] 命令命中自定义规则「${customLabel}」。按 Ctrl+Alt+P 更换策略。`,
        };
      }
    }

    return undefined;
  });
}