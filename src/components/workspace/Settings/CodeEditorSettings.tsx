"use client";
/** Settings → Code Editor (Module 03 §1.9): font, size, ligatures, key binding, tab size, wrap, relative numbers, theme, AI completion, minimap. */
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FONT_OPTIONS, useSettings, type KeyBinding, type ThemePref } from "@/store/settings";
import { isPro, useMe } from "@/store/me";
import { SettingRow, Segmented } from "@/components/workspace/Settings/SettingRow";

export function CodeEditorSettings() {
  const editor = useSettings((s) => s.editor);
  const setEditor = useSettings((s) => s.setEditor);
  const { setTheme } = useTheme();
  const pro = isPro(useMe((s) => s.me));

  const changeTheme = (t: ThemePref) => { setEditor({ theme: t }); setTheme(t); };

  return (
    <div className="divide-y divide-line/60">
      <SettingRow label="Font" description="Applies to the editor and results.">
        <Select value={editor.font} onValueChange={(v) => setEditor({ font: v })}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{FONT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label="Font size">
        <Select value={String(editor.fontSize)} onValueChange={(v) => setEditor({ fontSize: Number(v) })}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => <SelectItem key={n} value={String(n)}>{n} px</SelectItem>)}</SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label="Font ligatures" description="Renders =>, != and similar as single glyphs.">
        <Switch checked={editor.ligatures} onCheckedChange={(v) => setEditor({ ligatures: v })} aria-label="Font ligatures" />
      </SettingRow>
      <SettingRow label="Key binding">
        <Segmented<KeyBinding> ariaLabel="Key binding" value={editor.keyBinding} onChange={(v) => setEditor({ keyBinding: v })} options={[{ value: "standard", label: "Standard" }, { value: "vim", label: "Vim" }, { value: "emacs", label: "Emacs" }]} />
      </SettingRow>
      <SettingRow label="Tab size">
        <Segmented<"2" | "4"> ariaLabel="Tab size" value={String(editor.tabSize) as "2" | "4"} onChange={(v) => setEditor({ tabSize: Number(v) })} options={[{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }]} />
      </SettingRow>
      <SettingRow label="Word wrap">
        <Switch checked={editor.wordWrap} onCheckedChange={(v) => setEditor({ wordWrap: v })} aria-label="Word wrap" />
      </SettingRow>
      <SettingRow label="Relative line numbers">
        <Switch checked={editor.relativeLineNumbers} onCheckedChange={(v) => setEditor({ relativeLineNumbers: v })} aria-label="Relative line numbers" />
      </SettingRow>
      <SettingRow label="Theme" description="Workspace and editor colors.">
        <Segmented<ThemePref> ariaLabel="Theme" value={editor.theme} onChange={changeTheme} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} />
      </SettingRow>
      <SettingRow label="AI inline completion" description={pro ? "Ghost-text suggestions after a 600 ms pause. Tab accepts." : "Part of the Pro plan."}>
        <Switch checked={editor.aiCompletion} disabled={!pro} onCheckedChange={(v) => setEditor({ aiCompletion: v })} aria-label="AI inline completion" />
      </SettingRow>
      <SettingRow label="Minimap">
        <Switch checked={editor.minimap} onCheckedChange={(v) => setEditor({ minimap: v })} aria-label="Minimap" />
      </SettingRow>
    </div>
  );
}
