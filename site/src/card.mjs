// The picture a shared link shows (WhatsApp, LINE, X, Discord): 1200 by 630, one per language. It is a
// page of its own, photographed once and kept in public/assets (site/README.md says how).
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
    .share { position: relative; display: grid; grid-template-columns: 1fr 470px; height: 630px; padding: 64px 0 0 72px; color: #fff; }
    .share .hero-art { padding-top: 40px; justify-content: flex-end; padding-right: 30px; }
    .share .hero-art i { width: 240px; }
    .share-brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
    .share-brand img { border-radius: 12px; }
    .share h1 { margin-top: 84px; color: #fff; font-size: 76px; }
    .share h1 span { display: block; }
    .share p { margin-top: 28px; font-size: 28px; color: rgb(255 255 255 / 0.92); }
    .share-art { position: relative; }
    .share-art .phone { position: absolute; width: 268px; border-width: 9px; border-radius: 44px; }
    .share-art .phone img { border-radius: 35px; }
    .share-art .phone:first-child { left: 0; top: 96px; transform: rotate(-5deg); }
    .share-art .phone:last-child { left: 226px; top: 30px; transform: rotate(5deg); }
  </style>
</head>
<body>
  <div class="share">
    <div class="hero-art"><i></i><i></i></div>
    <div style="position:relative">
      <div class="share-brand"><img src="/assets/icon-128.png" alt="" width="52" height="52">Edunex Plus</div>
      <h1>${words.home.hero.title.map((line) => `<span>${esc(line)}</span>`).join("")}</h1>
      <p>${esc(words.home.card)}</p>
    </div>
    <div class="share-art">
      <div class="phone"><img src="/assets/phone-schedule.webp" alt=""></div>
      <div class="phone"><img src="/assets/phone-home.webp" alt=""></div>
    </div>
  </div>
</body>
</html>
`;
