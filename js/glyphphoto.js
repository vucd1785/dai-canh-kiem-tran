// ẢNH CHỮ PHÙ VĂN của người dùng (vd. cắt từ phim): chọn từ máy → tự xoá nền tối, giữ nét sáng,
// nhuộm vàng; dùng chung cho kiếm nhỏ phù văn và cự kiếm. Ảnh được nhớ trong trình duyệt (IndexedDB).
// Nếu có file assets/glyph.png trong thư mục dự án thì tự dùng khi chưa chọn ảnh nào.
import { CONFIG } from './config.js';
import { setGlyphImage, resetGlyph } from './effects/rune.js';

const DB = 'phiKiem', STORE = 'files', KEY = 'glyphImage';

function idb(mode, fn) {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => {
      const tx = rq.result.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      tx.oncomplete = () => res(r?.result);
      tx.onerror = () => rej(tx.error);
    };
  });
}

function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}

export class GlyphPhoto {
  constructor() {
    this.img = null;
    this.status = 'Đang dùng chữ trong ô (天宇)';
    this.onStatus = null;
  }

  _set(s) { this.status = s; this.onStatus?.(s); }

  async init() {
    try {
      const blob = await idb('readonly', (s) => s.get(KEY));
      if (blob) return this._useBlob(blob, 'ảnh đã lưu');
    } catch { /* trình duyệt chặn lưu trữ */ }
    try { this._use(await loadImage('assets/glyph.png'), 'assets/glyph.png'); } catch { /* chưa có file */ }
  }

  async useFile(file) {
    await this._useBlob(file, file.name);
    try { await idb('readwrite', (s) => s.put(file, KEY)); } catch { /* không lưu được */ }
  }

  async _useBlob(blob, label) {
    const url = URL.createObjectURL(blob);
    try { this._use(await loadImage(url), label); } finally { URL.revokeObjectURL(url); }
  }

  _use(img, label) {
    this.img = img;
    this.reprocess();
    this._set(`Đang dùng: ${label}`);
  }

  // Xử lý lại khi đổi ngưỡng tách nền
  reprocess() { if (this.img) setGlyphImage(this.img, CONFIG.rune.glyph.threshold); }

  async clear() {
    try { await idb('readwrite', (s) => s.delete(KEY)); } catch { /* bỏ qua */ }
    this.img = null;
    resetGlyph();
    this._set('Đang dùng chữ trong ô');
  }
}
