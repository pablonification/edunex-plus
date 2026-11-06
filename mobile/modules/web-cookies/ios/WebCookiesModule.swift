// The sign-in pages' cookies on iOS, as android/…/WebCookiesModule.kt keeps them on Android: the web
// views (react-native-webview) keep theirs in WebKit's default store, which page scripts can't read
// (SIX keeps its session in an HttpOnly cookie). WebKit only answers on the main thread and later,
// so "get" is a promise here where Android's is immediate; index.ts awaits both.
import ExpoModulesCore
import WebKit

public class WebCookiesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WebCookies")

    // "name=value; name2=value2" for the address, HttpOnly cookies included; "" when there are none.
    AsyncFunction("get") { (url: String, promise: Promise) in
      guard let address = URL(string: url) else { return promise.resolve("") }
      store().getAllCookies { cookies in
        promise.resolve(
          cookies.filter { sentTo($0, address) }.map { "\($0.name)=\($0.value)" }.joined(separator: "; "))
      }
    }.runOnQueue(.main)

    // One "Set-Cookie" line for the address. An expired one ("Max-Age=0") deletes that cookie, as on Android.
    AsyncFunction("set") { (url: String, cookie: String, promise: Promise) in
      guard let address = URL(string: url) else { return promise.resolve(false) }
      let cookies = store()
      if expires(cookie) {
        let name = String(cookie.split(separator: ";", maxSplits: 1).first?.split(separator: "=", maxSplits: 1).first ?? "")
          .trimmingCharacters(in: .whitespaces)
        cookies.getAllCookies { all in
          let gone = all.filter { $0.name == name && sentTo($0, address) }
          let group = DispatchGroup()
          for each in gone {
            group.enter()
            cookies.delete(each) { group.leave() }
          }
          group.notify(queue: .main) { promise.resolve(true) }
        }
        return
      }
      guard let made = HTTPCookie.cookies(withResponseHeaderFields: ["Set-Cookie": cookie], for: address).first else {
        return promise.resolve(false)
      }
      cookies.setCookie(made) { promise.resolve(true) }
    }.runOnQueue(.main)

    // One site's page storage (Edunex keeps its sign-in there): signing out of that system alone. WebKit
    // groups what it keeps by the registrable domain (itb.ac.id), so this clears the page storage of
    // ITB's other sites too; their cookies (SIX's session) stay.
    Function("clearOrigin") { (origin: String) in
      guard let host = URL(string: origin)?.host?.lowercased() else { return }
      DispatchQueue.main.async {
        let data = WKWebsiteDataStore.default()
        let kinds: Set<String> = [
          WKWebsiteDataTypeLocalStorage, WKWebsiteDataTypeSessionStorage, WKWebsiteDataTypeIndexedDBDatabases,
        ]
        data.fetchDataRecords(ofTypes: kinds) { records in
          let site = records.filter { host == $0.displayName || host.hasSuffix("." + $0.displayName) }
          data.removeData(ofTypes: kinds, for: site) {}
        }
      }
    }

    // Every cookie and every page's storage the app's web views kept (Microsoft's, Edunex's, SIX's).
    AsyncFunction("clear") { (promise: Promise) in
      WKWebsiteDataStore.default().removeData(
        ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast
      ) { promise.resolve(true) }
    }.runOnQueue(.main)
  }
}

private func store() -> WKHTTPCookieStore {
  WKWebsiteDataStore.default().httpCookieStore
}

/** Whether a page at `address` gets `cookie`: its domain, path, Secure and expiry, as a browser decides. */
private func sentTo(_ cookie: HTTPCookie, _ address: URL) -> Bool {
  guard let host = address.host?.lowercased() else { return false }
  if let end = cookie.expiresDate, end <= Date() { return false }
  if cookie.isSecure && address.scheme?.lowercased() != "https" { return false }
  var domain = cookie.domain.lowercased()
  let wide = domain.hasPrefix(".")
  if wide { domain.removeFirst() }
  guard host == domain || (wide && host.hasSuffix("." + domain)) else { return false }
  let path = address.path.isEmpty ? "/" : address.path
  let under = cookie.path.hasSuffix("/") ? cookie.path : cookie.path + "/"
  return path == cookie.path || path.hasPrefix(under)
}

/** A "Set-Cookie" line that ends the cookie ("Max-Age=0" or less), as the app writes one to sign out of SIX. */
private func expires(_ line: String) -> Bool {
  line.split(separator: ";").dropFirst().contains { part in
    let pair = part.split(separator: "=", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
    return pair.count == 2 && pair[0].lowercased() == "max-age" && (Int(pair[1]) ?? 1) <= 0
  }
}
