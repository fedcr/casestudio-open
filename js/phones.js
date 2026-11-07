// Database telefoni.
// Dimensioni W x H x T (mm): verificate su Wikipedia/schede ufficiali (iPhone 16/17, Galaxy S24/S25/S26, Pixel 10).
// Fotocamere: lista di forme viste da DIETRO, x/y = CENTRO misurato dall'angolo in alto a sinistra.
//   t:'r' rettangolo arrotondato (w,h,r)   t:'c' cerchio (w = diametro)
// Tasti: lato visto da DAVANTI ('right' | 'left'), y = distanza dal bordo superiore al centro, len = lunghezza.
// Le posizioni di fotocamere e tasti sono APPROSSIMATE: correggile con l'editor visuale (scheda Telefono).

const R = (x, y, w, h, r) => ({ t: 'r', x, y, w, h, r });
const C = (x, y, d) => ({ t: 'c', x, y, w: d, h: d, r: d / 2 });
const B = (side, y, len) => ({ side, y, len });

const ipBtns = (h, big) => {
  const k = h / 147.6;
  return [B('right', 58 * k, 18), B('left', 27 * k, 8), B('left', 44 * k, 11.5), B('left', 60 * k, 11.5)];
};
const ipCtl = (y) => B('right', y, 10);

// disposizioni camera
const camIp15 = [R(19.5, 19.5, 31, 31, 9)];
const camIp16 = [R(15.5, 21.5, 21.5, 33, 10.5)];
const camPro = [R(22, 22, 37, 37.5, 10)];
const camSam3 = [C(15.3, 14, 13.2), C(15.3, 31.3, 13.2), C(15.3, 48.6, 13.2), C(30, 15, 5)];
const camUltra = [C(16.5, 15.5, 14.2), C(16.5, 33.7, 14.2), C(16.5, 51.9, 14.2), C(16.5, 70.1, 14.2), C(31.5, 17, 5), C(31.5, 28, 5)];
const camPixel = (W) => [R(W / 2, 27, W - 1, 24, 12)];

export const PHONES = [
  // ---------- Apple ----------
  { id: 'ip15', brand: 'Apple', name: 'iPhone 15', W: 71.6, H: 147.6, T: 7.8, R: 10.5, cams: camIp15, buttons: ipBtns(147.6), bottom: { x: 0, len: 38 } },
  { id: 'ip15p', brand: 'Apple', name: 'iPhone 15 Plus', W: 77.8, H: 160.9, T: 7.8, R: 11, cams: [R(21, 19.5, 31, 31, 9)], buttons: ipBtns(160.9), bottom: { x: 0, len: 38 } },
  { id: 'ip15pro', brand: 'Apple', name: 'iPhone 15 Pro', W: 70.6, H: 146.6, T: 8.25, R: 10, cams: camPro, buttons: ipBtns(146.6), bottom: { x: 0, len: 38 } },
  { id: 'ip15pm', brand: 'Apple', name: 'iPhone 15 Pro Max', W: 76.7, H: 159.9, T: 8.25, R: 10.5, cams: [R(22, 22, 37, 37.5, 10)], buttons: ipBtns(159.9), bottom: { x: 0, len: 38 } },
  { id: 'ip16', brand: 'Apple', name: 'iPhone 16', W: 71.6, H: 147.6, T: 7.8, R: 10.5, cams: camIp16, buttons: [...ipBtns(147.6), ipCtl(96)], bottom: { x: 0, len: 38 } },
  { id: 'ip16p', brand: 'Apple', name: 'iPhone 16 Plus', W: 77.8, H: 160.9, T: 7.8, R: 11, cams: camIp16, buttons: [...ipBtns(160.9), ipCtl(104)], bottom: { x: 0, len: 38 } },
  { id: 'ip16pro', brand: 'Apple', name: 'iPhone 16 Pro', W: 71.5, H: 149.6, T: 8.25, R: 10.5, cams: camPro, buttons: [...ipBtns(149.6), ipCtl(98)], bottom: { x: 0, len: 38 } },
  { id: 'ip16pm', brand: 'Apple', name: 'iPhone 16 Pro Max', W: 77.6, H: 163.0, T: 8.25, R: 11, cams: [R(22, 22, 37, 37.5, 10)], buttons: [...ipBtns(163), ipCtl(106)], bottom: { x: 0, len: 38 } },
  { id: 'ip17', brand: 'Apple', name: 'iPhone 17', W: 71.5, H: 149.6, T: 7.95, R: 10.5, cams: camIp16, buttons: [...ipBtns(149.6), ipCtl(98)], bottom: { x: 0, len: 38 } },
  { id: 'ipair', brand: 'Apple', name: 'iPhone Air', W: 74.7, H: 156.2, T: 5.64, R: 10.5, approx: true, cams: [R(37.35, 16, 70, 23, 9)], buttons: [B('right', 60, 18), ipCtl(100), B('left', 30, 8), B('left', 46, 11.5), B('left', 62, 11.5)], bottom: { x: 0, len: 36 } },
  { id: 'ip17pro', brand: 'Apple', name: 'iPhone 17 Pro', W: 71.9, H: 150.0, T: 8.75, R: 10.5, approx: true, cams: [R(35.95, 21, 71, 40, 9)], buttons: [...ipBtns(150), ipCtl(98)], bottom: { x: 0, len: 38 } },
  { id: 'ip17pm', brand: 'Apple', name: 'iPhone 17 Pro Max', W: 78.0, H: 163.4, T: 8.75, R: 11, approx: true, cams: [R(39, 21, 77, 40, 9)], buttons: [...ipBtns(163.4), ipCtl(106)], bottom: { x: 0, len: 38 } },

  // ---------- Samsung ----------
  { id: 's24', brand: 'Samsung', name: 'Galaxy S24', W: 70.6, H: 147.0, T: 7.6, R: 9.5, cams: camSam3, buttons: [B('right', 42, 22), B('right', 65, 12)], bottom: { x: 0, len: 40 } },
  { id: 's24p', brand: 'Samsung', name: 'Galaxy S24+', W: 75.9, H: 158.5, T: 7.7, R: 10, cams: camSam3, buttons: [B('right', 46, 22), B('right', 70, 12)], bottom: { x: 0, len: 40 } },
  { id: 's24u', brand: 'Samsung', name: 'Galaxy S24 Ultra', W: 79.0, H: 162.3, T: 8.6, R: 4.5, cams: camUltra, buttons: [B('right', 52, 24), B('right', 78, 13)], bottom: { x: 0, len: 62 } },
  { id: 's25', brand: 'Samsung', name: 'Galaxy S25', W: 70.5, H: 146.9, T: 7.2, R: 9.5, cams: camSam3, buttons: [B('right', 42, 22), B('right', 65, 12)], bottom: { x: 0, len: 40 } },
  { id: 's25p', brand: 'Samsung', name: 'Galaxy S25+', W: 75.8, H: 158.4, T: 7.3, R: 10, cams: camSam3, buttons: [B('right', 46, 22), B('right', 70, 12)], bottom: { x: 0, len: 40 } },
  { id: 's25u', brand: 'Samsung', name: 'Galaxy S25 Ultra', W: 77.6, H: 162.8, T: 8.2, R: 4.5, cams: camUltra, buttons: [B('right', 52, 24), B('right', 78, 13)], bottom: { x: 0, len: 62 } },
  { id: 's25e', brand: 'Samsung', name: 'Galaxy S25 Edge', W: 75.6, H: 158.2, T: 5.8, R: 10, cams: [C(15.3, 14, 13.2), C(15.3, 31.3, 13.2), C(30, 15, 5)], buttons: [B('right', 46, 22), B('right', 70, 12)], bottom: { x: 0, len: 40 } },
  { id: 's26', brand: 'Samsung', name: 'Galaxy S26', W: 71.7, H: 149.6, T: 7.2, R: 10, cams: camSam3, buttons: [B('right', 42, 22), B('right', 65, 12)], bottom: { x: 0, len: 40 } },
  { id: 's26p', brand: 'Samsung', name: 'Galaxy S26+', W: 75.8, H: 158.4, T: 7.3, R: 10, cams: camSam3, buttons: [B('right', 46, 22), B('right', 70, 12)], bottom: { x: 0, len: 40 } },
  { id: 's26u', brand: 'Samsung', name: 'Galaxy S26 Ultra', W: 78.1, H: 163.6, T: 7.9, R: 5, cams: camUltra, buttons: [B('right', 52, 24), B('right', 78, 13)], bottom: { x: 0, len: 62 } },

  // ---------- Google ----------
  { id: 'px9', brand: 'Google', name: 'Pixel 9', W: 72.0, H: 152.8, T: 8.5, R: 10, cams: camPixel(72), buttons: [B('right', 40, 22), B('right', 64, 10)], bottom: { x: 0, len: 40 } },
  { id: 'px9p', brand: 'Google', name: 'Pixel 9 Pro', W: 72.0, H: 152.8, T: 8.5, R: 10, cams: camPixel(72), buttons: [B('right', 40, 22), B('right', 64, 10)], bottom: { x: 0, len: 40 } },
  { id: 'px9xl', brand: 'Google', name: 'Pixel 9 Pro XL', W: 76.6, H: 162.8, T: 8.5, R: 10.5, cams: camPixel(76.6), buttons: [B('right', 44, 22), B('right', 68, 10)], bottom: { x: 0, len: 40 } },
  { id: 'px10', brand: 'Google', name: 'Pixel 10', W: 72.0, H: 152.8, T: 8.6, R: 10, cams: camPixel(72), buttons: [B('right', 40, 22), B('right', 64, 10)], bottom: { x: 0, len: 40 } },
  { id: 'px10p', brand: 'Google', name: 'Pixel 10 Pro', W: 72.0, H: 152.8, T: 8.6, R: 10, cams: camPixel(72), buttons: [B('right', 40, 22), B('right', 64, 10)], bottom: { x: 0, len: 40 } },
  { id: 'px10xl', brand: 'Google', name: 'Pixel 10 Pro XL', W: 76.6, H: 162.8, T: 8.5, R: 10.5, approx: true, cams: camPixel(76.6), buttons: [B('right', 44, 22), B('right', 68, 10)], bottom: { x: 0, len: 40 } },

  // ---------- Libero ----------
  { id: 'custom', brand: 'Personalizzato', name: 'Misure tue', W: 72, H: 150, T: 8, R: 10, cams: [R(20, 20, 30, 30, 8)], buttons: [B('right', 50, 16)], bottom: { x: 0, len: 38 } },
];

export function phoneById(id) {
  return PHONES.find(p => p.id === id) || PHONES[0];
}

export function clonePhone(p) {
  return JSON.parse(JSON.stringify(p));
}
