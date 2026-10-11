// First run (and after signing out): connect EduNex. The sign-in itself
// happens in a window the app owns, on Microsoft's own page.
import { useT } from "../i18n";
import { useBridge, useSettings, useStore } from "../store";
import { Button, Segmented } from "../ui/controls";
import { Card } from "../ui/display";
import { Icons } from "../ui/icons";
import { useSignIn } from "./source-status";

export function Welcome() {
  const t = useT();
  const store = useStore();
  const bridge = useBridge();
  const settings = useSettings();
  const { signIn, busy } = useSignIn();

  return (
    <div className="relative h-screen overflow-y-auto bg-welcome text-fg">
      {store.platform === "darwin" && <div className="drag absolute inset-x-0 top-0 h-[52px]" />}
      <div className="grid min-h-full place-items-center px-6 py-16">
        <div className="w-full max-w-[460px]">
          <div className="mx-auto grid size-14 place-items-center rounded-[16px] bg-gradient-to-b from-[#4c8bf7] to-[#2563eb] text-white shadow-[0_8px_24px_-8px_rgb(37_99_235/0.55)]">
            <Icons.GraduationCap className="size-7" strokeWidth={1.9} />
          </div>
          <h1 className="mt-5 text-center text-[24px] leading-8 font-semibold tracking-[-0.02em]">{t("welcome.title")}</h1>
          <p className="mx-auto mt-2 max-w-[400px] text-center text-lead text-muted">{t("welcome.lead")}</p>

          <Card className="mt-7 overflow-hidden">
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--source-edunex-bg) text-[13px] font-bold text-(--source-edunex-fg)">
                E
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lead font-semibold">{t("source.edunex")}</span>
                <span className="block truncate text-small text-muted">{busy ? t("welcome.waiting") : t("welcome.edunexDetail")}</span>
              </span>
              <Button variant="primary" busy={busy} onClick={() => void signIn("edunex")}>
                {t("welcome.connect")}
              </Button>
            </div>
          </Card>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-small text-muted">
            <Icons.ShieldCheck className="size-3.5" />
            {t("welcome.passwordNote")}
          </p>
          <p className="mt-1 text-center text-caption text-faint">{t("welcome.readOnly")}</p>
          {store.vault === "memory" && <p className="mt-4 rounded-lg bg-warning-bg px-3.5 py-2.5 text-center text-small text-warning-fg">{t("settings.sessionNotSaved")}</p>}

          <div className="mt-10 flex justify-center">
            <Segmented
              label={t("settings.language")}
              value={settings.lang}
              onChange={(lang) => void bridge.invoke("settings.update", { lang }).catch(() => undefined)}
              options={[
                { value: "id", label: "Indonesia" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
