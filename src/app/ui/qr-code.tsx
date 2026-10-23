// A QR code a phone's camera reads: Settings' phone link, the maintainer's LINE in "Laporkan masalah".
import { useMemo } from "react";
import { encode } from "uqr";

/**
 * A QR code drawn from its modules, one SVG path, never markup from a string.
 * Black on white in either theme, with the quiet border cameras need.
 */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { d, size } = useMemo(() => {
    const { data } = encode(text, { ecc: "M", border: 0 });
    let path = "";
    for (const [y, row] of data.entries()) for (const [x, dark] of row.entries()) if (dark) path += `M${x} ${y}h1v1h-1z`;
    return { d: path, size: data.length };
  }, [text]);
  const quiet = 3;
  const box = size + quiet * 2;
  return (
    <svg role="img" aria-label={label} viewBox={`${-quiet} ${-quiet} ${box} ${box}`} shapeRendering="crispEdges" className="size-36 shrink-0 rounded-lg">
      <rect x={-quiet} y={-quiet} width={box} height={box} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
