// The phone's side of Android's in-app update (./apk-update.ts): the release's APK downloaded into the app's cache
// (only the newest kept), and Android's installer opened on it through the file library's content URI.
import { Directory, File, Paths } from "expo-file-system";
import type { ApkFiles } from "./apk-update";

const APK_TYPE = "application/vnd.android.package-archive";

/** The APK in the app's cache folder "update" (only the newest kept), opened in Android's installer by its content URI. */
export function phoneApkFiles(): ApkFiles {
  const folder = new Directory(Paths.cache, "update");
  const fileOf = (version: string) => new File(folder, `edunex-plus-${version}.apk`);
  // A version is "there" only once its download finished: a part-file never gets the final name.
  const done = new Set<string>();
  return {
    async download(url, version, progress) {
      done.delete(version);
      if (folder.exists) folder.delete();
      folder.create({ intermediates: true });
      await File.downloadFileAsync(url, fileOf(version), {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) progress(bytesWritten / totalBytes);
        },
      });
      done.add(version);
    },
    has: (version) => done.has(version) && fileOf(version).exists,
    async open(version) {
      await fileOf(version).preview({ mimeType: APK_TYPE, title: `Edunex Plus ${version}` });
    },
  };
}
