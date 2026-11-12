// The picture a shared link shows (WhatsApp, LINE, X, Discord): 1200 by 630, one per language. It is a
// page of its own, photographed once and kept in public/assets (site/README.md says how).
import { iphone } from "./home.mjs";
import { esc } from "./layout.mjs";

export const card = ({ words, assets }) => `<!doctype html>
<html lang="${words.code}">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <title>Edunex Plus</title>
  <link rel="stylesheet" href="${assets.css}">
  <style>
    body { width: 1200px; height: 630px; overflow: hidden; background: var(--blue); }
    .share { display: grid; grid-template-columns: 1fr 500px; height: 630px; padding: 64px 0 0 72px; color: #fff; }
    .share-brand { display: flex; align-items: center; gap: 14px; font: 800 30px var(--display); letter-spacing: -0.02em; }
    .share-brand img { border-radius: 12px; }
    .share h1 { margin-top: 80px; color: #fff; font-size: 72px; }
    .share h1 span { display: block; }
    .share p { margin-top: 28px; font-size: 28px; }
    .share-art { position: relative; }
    .share-art .iphone { position: absolute; width: 262px; }
    .share-art .iphone:first-child { left: -14px; top: 150px; }
    .share-art .iphone:last-child { left: 222px; top: 62px; }
  </style>
</head>
<body>
  <div class="share">
    <div>
      <div class="share-brand"><img src="/assets/icon-128.png" alt="" width="52" height="52">Edunex Plus</div>
      <h1>${words.home.hero.title.map((line) => `<span>${esc(line)}</span>`).join("")}</h1>
      <p>${esc(words.home.card)}</p>
    </div>
    <div class="share-art">
      ${iphone("phone-schedule", "", { eager: true })}
      ${iphone("phone-home", "", { eager: true })}
    </div>
  </div>
</body>
</html>
`;
