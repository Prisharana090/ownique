// Draws Ownique's free product templates (original artwork, made here from SVG) → public/templates/*.jpg
// Run: node scripts/make-templates.mjs   (masks/print areas live in src/lib/templates.ts)
import sharp from "sharp";
const W = 1000, H = 1000;
const bg = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f0ea"/><stop offset="1" stop-color="#e6e0d6"/></linearGradient>
  <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="cyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfcac3"/><stop offset="0.18" stop-color="#f2efea"/><stop offset="0.42" stop-color="#ffffff"/><stop offset="0.75" stop-color="#ebe7e1"/><stop offset="1" stop-color="#bdb7af"/></linearGradient>
</defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`;
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${body}</svg>`);

const T = {
  tshirt: `<ellipse cx="500" cy="905" rx="300" ry="34" fill="url(#shadow)"/>
    <defs><linearGradient id="tee" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9e6e1"/><stop offset="0.5" stop-color="#fbfaf8"/><stop offset="1" stop-color="#e4e0da"/></linearGradient></defs>
    <path d="M360 150 Q500 225 640 150 L835 255 L770 420 L690 385 L690 870 Q500 890 310 870 L310 385 L230 420 L165 255 Z" fill="url(#tee)" stroke="#d6d1ca" stroke-width="3"/>
    <path d="M360 150 Q500 225 640 150 Q600 190 500 200 Q400 190 360 150 Z" fill="#dcd7d0"/>
    <g fill="none" stroke="#000" stroke-opacity="0.05" stroke-width="22" stroke-linecap="round">
      <path d="M340 470 Q470 500 660 455"/><path d="M330 640 Q500 610 670 650"/><path d="M360 790 Q480 770 640 800"/></g>
    <g fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="10" stroke-linecap="round"><path d="M350 520 Q480 548 650 505"/></g>`,
  pot: `<ellipse cx="500" cy="900" rx="250" ry="30" fill="url(#shadow)"/>
    <g fill="#5f8a5a"><path d="M500 330 C470 200 380 160 330 170 C400 210 450 260 480 335 Z"/><path d="M505 330 C520 190 610 120 680 130 C610 180 560 250 525 335 Z"/><path d="M495 335 C430 250 330 260 280 290 C370 290 430 310 480 345 Z" fill="#4e7a4b"/><path d="M510 335 C580 260 690 270 730 300 C640 300 580 320 525 345 Z" fill="#6c9a65"/></g>
    <path d="M285 330 L715 330 L715 390 L285 390 Z" fill="url(#cyl)" stroke="#cfc9c1" stroke-width="2"/>
    <path d="M305 390 L695 390 L640 870 Q500 895 360 870 Z" fill="url(#cyl)" stroke="#cfc9c1" stroke-width="2"/>
    <path d="M305 390 L695 390 L690 410 L310 410 Z" fill="#000" fill-opacity="0.07"/>`,
  mug: `<ellipse cx="480" cy="860" rx="290" ry="32" fill="url(#shadow)"/>
    <path d="M690 400 C820 400 830 640 690 660" fill="none" stroke="#e6e2dc" stroke-width="46"/>
    <path d="M690 400 C820 400 830 640 690 660" fill="none" stroke="#c9c3bb" stroke-width="4"/>
    <path d="M250 300 L710 300 L710 800 Q480 850 250 800 Z" fill="url(#cyl)" stroke="#cfc9c1" stroke-width="2"/>
    <ellipse cx="480" cy="300" rx="230" ry="42" fill="#f7f5f1" stroke="#d3cdc5" stroke-width="3"/>
    <ellipse cx="480" cy="306" rx="205" ry="30" fill="#e3ded7"/>`,
  wall: `<defs><radialGradient id="light" cx="0.45" cy="0.3" r="0.8"><stop offset="0" stop-color="#fbf9f5"/><stop offset="1" stop-color="#e2dcd2"/></radialGradient></defs>
    <rect width="1000" height="820" fill="url(#light)"/>
    <rect y="820" width="1000" height="180" fill="#cdbfae"/><rect y="812" width="1000" height="16" fill="#efe9e1"/>
    <rect x="0" y="828" width="1000" height="10" fill="#000" fill-opacity="0.06"/>
    <ellipse cx="830" cy="815" rx="90" ry="10" fill="url(#shadow)"/>
    <path d="M800 815 L860 815 L850 700 L810 700 Z" fill="#efe9e1" stroke="#d6cfc5" stroke-width="2"/>
    <g fill="#6c9a65"><path d="M830 700 C800 620 760 600 740 600 C780 630 810 660 825 705 Z"/><path d="M832 700 C850 610 890 590 910 595 C870 630 850 660 838 705 Z"/></g>`,
  glass: `<ellipse cx="500" cy="880" rx="210" ry="26" fill="url(#shadow)"/>
    <defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dfe7ea" stop-opacity="0.95"/><stop offset="0.2" stop-color="#f4f8f9" stop-opacity="0.6"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="0.8" stop-color="#eef3f5" stop-opacity="0.6"/><stop offset="1" stop-color="#cfd9dd" stop-opacity="0.95"/></linearGradient></defs>
    <path d="M320 230 L680 230 L640 860 Q500 880 360 860 Z" fill="url(#gl)" stroke="#bfcbd0" stroke-width="3"/>
    <ellipse cx="500" cy="230" rx="180" ry="26" fill="none" stroke="#bfcbd0" stroke-width="3"/>
    <path d="M362 800 Q500 815 638 800 L640 860 Q500 880 360 860 Z" fill="#cfd9dd" fill-opacity="0.55"/>
    <path d="M360 280 L345 760" stroke="#fff" stroke-width="14" stroke-opacity="0.8" stroke-linecap="round"/>`,
  can: `<ellipse cx="500" cy="885" rx="210" ry="26" fill="url(#shadow)"/>
    <defs><linearGradient id="al" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9ea3a8"/><stop offset="0.15" stop-color="#e3e6e8"/><stop offset="0.35" stop-color="#ffffff"/><stop offset="0.55" stop-color="#d4d8db"/><stop offset="0.85" stop-color="#eef0f1"/><stop offset="1" stop-color="#8f949a"/></linearGradient></defs>
    <path d="M330 210 L670 210 L690 260 L690 800 L670 850 Q500 875 330 850 L310 800 L310 260 Z" fill="url(#al)" stroke="#a7acb1" stroke-width="3"/>
    <ellipse cx="500" cy="210" rx="170" ry="26" fill="#d9dcdf" stroke="#a7acb1" stroke-width="3"/>
    <ellipse cx="500" cy="214" rx="120" ry="16" fill="#c5c9cd"/><rect x="470" y="196" width="60" height="18" rx="9" fill="#b3b8bd"/>
    <path d="M310 270 L690 270" stroke="#000" stroke-opacity="0.08" stroke-width="6"/><path d="M310 790 L690 790" stroke="#000" stroke-opacity="0.08" stroke-width="6"/>`,
  notebook: `<ellipse cx="520" cy="880" rx="300" ry="30" fill="url(#shadow)"/>
    <defs><linearGradient id="nb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f1ea"/><stop offset="1" stop-color="#e3dbcf"/></linearGradient></defs>
    <rect x="270" y="150" width="480" height="700" rx="18" fill="#efe9df" transform="translate(14 10)"/>
    <rect x="270" y="150" width="480" height="700" rx="18" fill="url(#nb)" stroke="#d2c8ba" stroke-width="3"/>
    <rect x="270" y="150" width="46" height="700" rx="14" fill="#d9cfc1"/>
    <rect x="690" y="150" width="18" height="700" fill="#b7a998" fill-opacity="0.85"/>
    <path d="M745 170 L755 175 L755 845 L745 840 Z" fill="#fff" fill-opacity="0.8"/>`,
};
for (const [name, body] of Object.entries(T)) {
  await sharp(svg(body)).jpeg({ quality: 90 }).toFile(`public/templates/${name}.jpg`);
  console.log("wrote", name);
}
