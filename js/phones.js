// Database telefoni. Valori da schede tecniche, arrotondati: verificali con un calibro.
// Convenzione: W x H x T in mm (larghezza, altezza, spessore senza isola camera).
// cam: bounding box dell'isola camera vista da DIETRO, misurata dall'angolo in alto a sinistra.
// buttons: lato visto da DAVANTI ('right' | 'left'), y = distanza dal bordo superiore al centro, len = lunghezza.
// approx: true = dati stimati, da controllare prima di stampare.

const std = (side, y, len) => ({ side, y, len });

export const PHONES = [
  // ---------- Apple ----------
  { id: 'ip15', brand: 'Apple', name: 'iPhone 15', W: 71.6, H: 147.6, T: 7.8, R: 10.5,
    cam: { cx: 4, cy: 4, w: 30, h: 31, r: 8 },
    buttons: [std('right', 58, 17), std('left', 28, 8), std('left', 44, 11), std('left', 60, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ip15p', brand: 'Apple', name: 'iPhone 15 Plus', W: 77.8, H: 160.9, T: 7.8, R: 11,
    cam: { cx: 4, cy: 4, w: 30, h: 31, r: 8 },
    buttons: [std('right', 62, 17), std('left', 30, 8), std('left', 47, 11), std('left', 64, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ip15pro', brand: 'Apple', name: 'iPhone 15 Pro', W: 70.6, H: 146.6, T: 8.25, R: 10,
    cam: { cx: 3.5, cy: 3.5, w: 37, h: 38, r: 9 },
    buttons: [std('right', 58, 17), std('left', 28, 8), std('left', 44, 11), std('left', 60, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ip15pm', brand: 'Apple', name: 'iPhone 15 Pro Max', W: 76.7, H: 159.9, T: 8.25, R: 10.5,
    cam: { cx: 3.5, cy: 3.5, w: 37, h: 38, r: 9 },
    buttons: [std('right', 62, 17), std('left', 30, 8), std('left', 47, 11), std('left', 64, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ip16', brand: 'Apple', name: 'iPhone 16', W: 71.6, H: 147.6, T: 7.8, R: 10.5,
    cam: { cx: 4.5, cy: 4.5, w: 20, h: 33, r: 9 },
    buttons: [std('right', 58, 17), std('right', 96, 10), std('left', 28, 8), std('left', 44, 11), std('left', 60, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ip16p', brand: 'Apple', name: 'iPhone 16 Plus', W: 77.8, H: 160.9, T: 7.8, R: 11,
    cam: { cx: 4.5, cy: 4.5, w: 20, h: 33, r: 9 },
    buttons: [std('right', 62, 17), std('right', 103, 10), std('left', 30, 8), std('left', 47, 11), std('left', 64, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ip16pro', brand: 'Apple', name: 'iPhone 16 Pro', W: 71.5, H: 149.6, T: 8.25, R: 10.5,
    cam: { cx: 3.5, cy: 3.5, w: 37, h: 38, r: 9 },
    buttons: [std('right', 58, 17), std('right', 98, 10), std('left', 29, 8), std('left', 45, 11), std('left', 61, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ip16pm', brand: 'Apple', name: 'iPhone 16 Pro Max', W: 77.6, H: 163.0, T: 8.25, R: 11,
    cam: { cx: 3.5, cy: 3.5, w: 37, h: 38, r: 9 },
    buttons: [std('right', 63, 17), std('right', 105, 10), std('left', 31, 8), std('left', 48, 11), std('left', 65, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ip17', brand: 'Apple', name: 'iPhone 17', W: 71.5, H: 149.6, T: 7.95, R: 10.5, approx: true,
    cam: { cx: 4.5, cy: 4.5, w: 33, h: 22, r: 8 },
    buttons: [std('right', 58, 17), std('right', 98, 10), std('left', 29, 8), std('left', 45, 11), std('left', 61, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ipair', brand: 'Apple', name: 'iPhone Air', W: 74.7, H: 156.2, T: 5.64, R: 10.5, approx: true,
    cam: { cx: 3, cy: 3, w: 68.7, h: 24, r: 8 },
    buttons: [std('right', 60, 17), std('right', 100, 10), std('left', 30, 8), std('left', 46, 11), std('left', 62, 11)],
    bottom: { x: 0, len: 36 } },
  { id: 'ip17pro', brand: 'Apple', name: 'iPhone 17 Pro', W: 71.9, H: 150.0, T: 8.75, R: 10.5, approx: true,
    cam: { cx: 0, cy: 3, w: 71.9, h: 40, r: 8 },
    buttons: [std('right', 58, 17), std('right', 98, 10), std('left', 29, 8), std('left', 45, 11), std('left', 61, 11)],
    bottom: { x: 0, len: 38 } },
  { id: 'ip17pm', brand: 'Apple', name: 'iPhone 17 Pro Max', W: 78.0, H: 163.4, T: 8.75, R: 11, approx: true,
    cam: { cx: 0, cy: 3, w: 78, h: 40, r: 8 },
    buttons: [std('right', 63, 17), std('right', 105, 10), std('left', 31, 8), std('left', 48, 11), std('left', 65, 11)],
    bottom: { x: 0, len: 38 } },

  // ---------- Samsung ----------
  { id: 's24', brand: 'Samsung', name: 'Galaxy S24', W: 70.6, H: 147.0, T: 7.6, R: 9.5,
    cam: { cx: 6, cy: 6, w: 17, h: 52, r: 8 },
    buttons: [std('right', 42, 22), std('right', 65, 12)],
    bottom: { x: 0, len: 40 } },
  { id: 's24p', brand: 'Samsung', name: 'Galaxy S24+', W: 75.9, H: 158.5, T: 7.7, R: 10,
    cam: { cx: 6, cy: 6, w: 17, h: 52, r: 8 },
    buttons: [std('right', 46, 22), std('right', 70, 12)],
    bottom: { x: 0, len: 40 } },
  { id: 's24u', brand: 'Samsung', name: 'Galaxy S24 Ultra', W: 79.0, H: 162.3, T: 8.6, R: 4,
    cam: { cx: 7, cy: 7, w: 17, h: 70, r: 8 },
    buttons: [std('right', 52, 22), std('right', 76, 12)],
    bottom: { x: 0, len: 62 } },
  { id: 's25', brand: 'Samsung', name: 'Galaxy S25', W: 70.5, H: 146.9, T: 7.2, R: 9.5,
    cam: { cx: 6, cy: 6, w: 17, h: 52, r: 8 },
    buttons: [std('right', 42, 22), std('right', 65, 12)],
    bottom: { x: 0, len: 40 } },
  { id: 's25p', brand: 'Samsung', name: 'Galaxy S25+', W: 75.8, H: 158.4, T: 7.3, R: 10,
    cam: { cx: 6, cy: 6, w: 17, h: 52, r: 8 },
    buttons: [std('right', 46, 22), std('right', 70, 12)],
    bottom: { x: 0, len: 40 } },
  { id: 's25u', brand: 'Samsung', name: 'Galaxy S25 Ultra', W: 77.6, H: 162.8, T: 8.2, R: 4,
    cam: { cx: 6.5, cy: 7, w: 17, h: 70, r: 8 },
    buttons: [std('right', 52, 22), std('right', 76, 12)],
    bottom: { x: 0, len: 62 } },
  { id: 's26', brand: 'Samsung', name: 'Galaxy S26', W: 71.7, H: 149.6, T: 7.2, R: 10, approx: true,
    cam: { cx: 6, cy: 6, w: 17, h: 52, r: 8 },
    buttons: [std('right', 42, 22), std('right', 65, 12)],
    bottom: { x: 0, len: 40 } },
  { id: 's26p', brand: 'Samsung', name: 'Galaxy S26+', W: 75.8, H: 158.4, T: 7.3, R: 10, approx: true,
    cam: { cx: 6, cy: 6, w: 17, h: 52, r: 8 },
    buttons: [std('right', 46, 22), std('right', 70, 12)],
    bottom: { x: 0, len: 40 } },
  { id: 's26u', brand: 'Samsung', name: 'Galaxy S26 Ultra', W: 78.1, H: 163.6, T: 7.9, R: 5, approx: true,
    cam: { cx: 6.5, cy: 7, w: 17, h: 70, r: 8 },
    buttons: [std('right', 52, 22), std('right', 76, 12)],
    bottom: { x: 0, len: 62 } },

  // ---------- Google ----------
  { id: 'px9', brand: 'Google', name: 'Pixel 9', W: 72.0, H: 152.8, T: 8.5, R: 10,
    cam: { cx: 3, cy: 11, w: 66, h: 24, r: 11 },
    buttons: [std('right', 40, 22), std('right', 64, 10)],
    bottom: { x: 0, len: 40 } },
  { id: 'px9p', brand: 'Google', name: 'Pixel 9 Pro', W: 72.0, H: 152.8, T: 8.5, R: 10,
    cam: { cx: 3, cy: 11, w: 66, h: 24, r: 11 },
    buttons: [std('right', 40, 22), std('right', 64, 10)],
    bottom: { x: 0, len: 40 } },
  { id: 'px9xl', brand: 'Google', name: 'Pixel 9 Pro XL', W: 76.6, H: 162.8, T: 8.5, R: 10.5,
    cam: { cx: 3, cy: 12, w: 70.5, h: 25, r: 11 },
    buttons: [std('right', 44, 22), std('right', 68, 10)],
    bottom: { x: 0, len: 40 } },

  // ---------- Libero ----------
  { id: 'custom', brand: 'Personalizzato', name: 'Misure tue', W: 72, H: 150, T: 8, R: 10,
    cam: { cx: 4, cy: 4, w: 30, h: 30, r: 8 },
    buttons: [std('right', 50, 16)],
    bottom: { x: 0, len: 38 } },
];

export function phoneById(id) {
  return PHONES.find(p => p.id === id) || PHONES[0];
}

export function clonePhone(p) {
  return JSON.parse(JSON.stringify(p));
}
