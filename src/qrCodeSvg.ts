// Pure TypeScript ISO/IEC 18004 QR Code SVG Generator (Version 2, Error Correction Level M)
// Supports byte-mode strings up to 26 UTF-8 bytes (ideal for IDs like "BCA-2026-0003")

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function getGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomon(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = getGeneratorPoly(ecCount);
  const msg = new Uint8Array(data.length + ecCount);
  msg.set(data, 0);

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }

  return msg.slice(data.length);
}

export function generateStudentIdQrSvg(payload: string): string {
  const size = 25; // QR Version 2 (25x25)
  const totalDataCodewords = 28; // Version 2-M
  const ecCodewordsCount = 16; // Version 2-M

  const utf8Bytes = Buffer.from(payload, 'utf8');
  const bits: number[] = [];

  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Byte mode indicator (0100) + 8-bit byte length
  pushBits(0b0100, 4);
  pushBits(utf8Bytes.length, 8);
  for (const b of utf8Bytes) {
    pushBits(b, 8);
  }

  // Terminator (up to 4 zero bits)
  const maxDataBits = totalDataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < maxDataBits; i++) {
    bits.push(0);
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataBytes = new Uint8Array(totalDataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i * 8 + b];
    }
    dataBytes[i] = byteVal;
  }

  let padToggle = true;
  for (let i = bits.length / 8; i < totalDataCodewords; i++) {
    dataBytes[i] = padToggle ? 0xec : 0x11;
    padToggle = !padToggle;
  }

  const ecBytes = computeReedSolomon(dataBytes, ecCodewordsCount);
  const allCodewords = new Uint8Array(totalDataCodewords + ecCodewordsCount);
  allCodewords.set(dataBytes, 0);
  allCodewords.set(ecBytes, totalDataCodewords);

  const matrix: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = dark ? 1 : 0;
      reserved[r][c] = true;
    }
  };

  // Finder patterns + separators
  const placeFinder = (topR: number, leftC: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = topR + r;
        const cc = leftC + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setFunctionModule(rr, cc, inOuter && (onBorder || inInner));
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment pattern for Version 2 at (18, 18)
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const dist = Math.max(Math.abs(r), Math.abs(c));
      setFunctionModule(18 + r, 18 + c, dist === 2 || dist === 0);
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setFunctionModule(6, i, i % 2 === 0);
    if (!reserved[i][6]) setFunctionModule(i, 6, i % 2 === 0);
  }

  // Dark module and reserved format information areas
  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) setFunctionModule(8, i, false);
    if (!reserved[i][8]) setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
    if (!reserved[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
  }

  // Data bit sequence
  const fullBits: number[] = [];
  for (const cw of allCodewords) {
    for (let b = 7; b >= 0; b--) {
      fullBits.push((cw >> b) & 1);
    }
  }
  for (let i = 0; i < 7; i++) {
    fullBits.push(0); // Version 2 remainder bits
  }

  // Zig-zag module placement
  let bitIdx = 0;
  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5; // Skip vertical timing column
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let d = 0; d < 2; d++) {
        const c = rightCol - d;
        if (!reserved[r][c]) {
          const bit = bitIdx < fullBits.length ? fullBits[bitIdx++] : 0;
          // Apply Mask 0: (r + c) % 2 === 0
          const masked = (r + c) % 2 === 0 ? bit ^ 1 : bit;
          matrix[r][c] = masked;
        }
      }
    }
    upward = !upward;
  }

  // Write Format Information for Level M (00) + Mask 0 (000) -> 0x5412
  const formatBits = 0x5412;
  const getFormatBit = (posFromMsb: number) => ((formatBits >> (14 - posFromMsb)) & 1) === 1;

  // Top-left format info
  const tlCoords: [number, number][] = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8]
  ];
  tlCoords.forEach(([r, c], idx) => {
    matrix[r][c] = getFormatBit(idx) ? 1 : 0;
  });

  // Bottom-left & top-right format info
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = getFormatBit(i) ? 1 : 0;
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][size - 8 + i] = getFormatBit(7 + i) ? 1 : 0;
  }

  // Render crisp SVG with 2-module quiet zone
  const margin = 2;
  const viewSize = size + margin * 2;
  let pathData = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        pathData += `M${c + margin},${r + margin}h1v1h-1z`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges" width="100%" height="100%" role="img" aria-label="QR Code for ${payload}"><rect width="${viewSize}" height="${viewSize}" fill="#ffffff"/><path d="${pathData}" fill="#0a1931"/></svg>`;
}
