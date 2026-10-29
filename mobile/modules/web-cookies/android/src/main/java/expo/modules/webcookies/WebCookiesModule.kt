// The sign-in pages' cookies, which page scripts can't read (SIX keeps its session in an
// HttpOnly cookie): read once a sign-in is done, set for SIX's own page ("Tandai Hadir"), and
// cleared with everything else a page kept when the Student signs out.
package expo.modules.webcookies

import android.webkit.CookieManager
import android.webkit.WebStorage
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WebCookiesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WebCookies")

    // "name=value; name2=value2" for the address, HttpOnly cookies included; "" when there are none.
    Function("get") { url: String ->
      CookieManager.getInstance().getCookie(url) ?: ""
    }

    AsyncFunction("set") { url: String, cookie: String, promise: Promise ->
      val manager = CookieManager.getInstance()
      manager.setCookie(url, cookie) { ok ->
        manager.flush()
        promise.resolve(ok)
      }
    }

    // Every cookie and every page's storage the app's web views kept (Microsoft's, Edunex's, SIX's).
    AsyncFunction("clear") { promise: Promise ->
      val manager = CookieManager.getInstance()
      WebStorage.getInstance().deleteAllData()
      manager.removeAllCookies { removed ->
        manager.flush()
        promise.resolve(removed)
      }
    }
  }
}
