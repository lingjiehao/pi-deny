/**
 * pi-deny
 *
 * 权限策略管理器
 * - 快捷键 Ctrl+Alt+P 弹出策略选择框
 * - 策略：禁止 git push / 禁止 edit（只读）/ 严格（两者）+ 自定义指令（自然语言）
 * - 自定义指令直接注入模型上下文，由模型语义理解并遵守（不做命令级匹配）
 * - 其他策略用事件级拦截兜底（防模型漏判）
 * - "不禁止任何指令"时不显示状态栏；其余显示徽标；自定义显示 ⚙️
 */
export default function (pi: ExtensionAPI) {
  type Policy = {
    id: string;
    label: string;
    badge: string | undefined;   // undefined = 状态栏不显示
    denyEdit: boolean;
    denyGitPush: boolean;
    custom?: string;             // 自定义指令（自然语言，注入上下文）
  };

  const STATUS_KEY = "pi-deny";

  // 当前策略（默认：不禁止任何指令）
  let current: Policy = {
    id: "none",
    label: "全部放行",
    badge: undefined,
    denyEdit: false,
    denyGitPush: false,
  };

  // ── 预设策略 ──────────────────────────────────────────────────
  const selectOptions = [
    "🚫 禁止 git push",
    "🔒 禁止 edit / write（只读）",
    "⛔ 严格：禁止 git push + edit",
    "✏️ 自定义指令（自然语言）",
    "✅ 不禁止任何指令",
  ];

  // ── 策略描述（注入系统提示） ──────────────────────────────────
  function policyText(p: Policy): string {
    const prohibitions: string[] = [];
    if (p.denyEdit) prohibitions.push("禁止 edit / write / edit-diff / patch（所有文件修改）");
    if (p.denyGitPush) prohibitions.push("禁止 git push（含 --force）");
    const base = prohibitions.length ? prohibitions.join("；") : "（无内置禁止项）";
    if (p.custom) return `${base}。自定义约束（必须严格遵守）：${p.custom}`;
    return base;
  }

  // ── 状态栏 ────────────────────────────────────────────────────
  function updateStatus(ctx: { ui: { setStatus: (k: string, v: string | undefined) => void } }) {
    ctx.ui.setStatus(STATUS_KEY, current.badge ?? undefined);
  }

  // ── 系统提示注入：每次 agent 启动注入当前策略 ──────────────────
  pi.on("before_agent_start", (event) => {
    const notice = `\n\n<active_policy>
当前生效的权限策略：
${policyText(current)}
你必须在每次行动前判断是否违反此策略。如果用户要求执行被禁止的操作，一律拒绝并提示。要修改策略，请用户按 Ctrl+Alt+P。
</active_policy>`;
    return { systemPrompt: event.systemPrompt + notice };
  });

  // ── 快捷键：弹出策略选择框 ─────────────────────────────────────
  pi.registerShortcut("ctrl+alt+p", {
    description: "Select permission policy (pi-deny)",
    async handler(ctx) {
      const choice = await ctx.ui.select("权限策略", selectOptions);
      if (choice === undefined) return;

      switch (choice) {
        case "🚫 禁止 git push":
          current = { id: "push", label: choice, badge: "🚫NO-PUSH", denyEdit: false, denyGitPush: true };
          break;
        case "🔒 禁止 edit / write（只读）":
          current = { id: "edit", label: choice, badge: "🔒RO", denyEdit: true, denyGitPush: false };
          break;
        case "⛔ 严格：禁止 git push + edit":
          current = { id: "strict", label: choice, badge: "⛔STRICT", denyEdit: true, denyGitPush: true };
          break;
        case "✏️ 自定义指令（自然语言）": {
          const custom = await ctx.ui.input("自定义约束（自然语言）", "例如：不要修改 docs/ 下的文件；或禁止 sudo 操作");
          if (custom) {
            current = { id: "custom", label: `自定义: ${custom}`, badge: "⚙️", denyEdit: false, denyGitPush: false, custom };
            ctx.ui.notify(`⚙️ 自定义约束已注入上下文：${custom}`, "info");
            updateStatus(ctx);
            return;
          }
          return;
        }
        case "✅ 不禁止任何指令":
          current = { id: "none", label: choice, badge: undefined, denyEdit: false, denyGitPush: false };
          break;
      }
      updateStatus(ctx);
      ctx.ui.notify(`策略已切换：${current.label}`, "info");
    },
  });

  // ── 工具拦截（兜底：防模型漏判） ──────────────────────────────
  pi.on("tool_call", (event) => {
    const t = event.toolName;
    if (current.denyEdit && (t === "edit" || t === "write" || t === "edit-diff" || t === "patch")) {
      return { block: true, reason: `[pi-deny] ${current.label}：禁止 ${t}。按 Ctrl+Alt+P 修改。` };
    }
    if (t === "bash" && current.denyGitPush && /\bgit\s+push\b/.test(String(event.input?.command ?? ""))) {
      return { block: true, reason: `[pi-deny] ${current.label}：禁止 git push。按 Ctrl+Alt+P 修改。` };
    }
    return undefined;
  });
}