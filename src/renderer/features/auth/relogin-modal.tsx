import { Button } from "@/components/ui/button";

/**
 * The modal "please sign in again" moment (#18, user story 4): a 401 or a
 * missing token paused the app — this modal makes that pause visible and
 * reopens the login webview. Completing the SSO recovers the session without
 * an app restart; there is deliberately no silent re-login or refresh logic
 * (spec: auth & session). "Sign in again" flips the auth machine to
 * authenticating, which swaps this modal for the embedded webview.
 */
export function ReloginModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="w-[min(560px,90vw)] rounded-2xl bg-background-primary-default p-6 shadow-2xl">
        <h2 className="text-[15px] font-semibold tracking-tight">Please sign in again</h2>
        <p className="mt-2 text-[13px] leading-5 text-text-secondary">
          Your session is no longer valid, so the app paused instead of showing stale
          data. Nothing was lost — signing in again with your INA account picks up
          where you left off.
        </p>
        <div className="mt-5">
          <Button variant="primary" onClick={() => void window.edunex.startLogin()}>
            Sign in again
          </Button>
        </div>
      </div>
    </div>
  );
}
