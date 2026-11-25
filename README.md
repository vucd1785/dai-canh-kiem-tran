# Phi Kiếm Trận

144 thanh phi kiếm ngọc bích (cảm hứng Thanh Trúc Phong Vân Kiếm / Đại Canh Kiếm Trận) xếp thành kiếm luân sau lưng một nhân vật đang bay, có trận đồ phù văn vàng, sét, vệt sáng đuôi kiếm, tia lửa và bụi sáng. Điều khiển bằng cử chỉ tay qua webcam (MediaPipe) hoặc bằng bàn phím/chuột.

Toàn bộ mô hình và phù văn được dựng bằng code, không dùng hình ảnh hay model từ phim. Nền mặc định là hoàng hôn vàng; đổi `scene.palette` trong `js/config.js` thành `'night'` để dùng nền đêm.

## Chạy

Camera chỉ hoạt động trên `localhost` hoặc HTTPS, nên cần chạy một server tĩnh:

```powershell
python serve.py
```

Mở `http://localhost:5173` bằng Chrome hoặc Edge, bấm **📷 Bật camera** và cho phép dùng camera.
Cần có mạng vì Three.js, MediaPipe và model nhận cử chỉ được tải từ CDN.

## Điều khiển

| Cử chỉ | Phím | Lệnh |
|---|---|---|
| Thả lỏng tay | 1 | Kiếm luân sau lưng: 3 vòng tròn đồng tâm, chuôi hướng vào nhân vật, mũi hướng ra. Chụm/mở ngón cái–trỏ để chỉnh bán kính vòng |
| ✋ Xòe tay | 2 | Tung kiếm (kiếm luân nở rộng gấp đôi) |
| ✊ Nắm tay | 3 | Kiếm thuẫn hộ thân (quả cầu) |
| ☝️ Giơ ngón trỏ | 4 | Phóng kiếm theo đầu ngón tay (dùng phím thì kiếm theo chuột) |
| ✌️ Chữ V | 5 | Kiếm trận xoắn ốc + bùng sét |
| — | 6 | Thu kiếm |
| 👍 / 👎 giữ | + / − | Tăng / giảm tốc độ |
| 🤟 I love you | Space | Về mặc định |
| Di bàn tay | Kéo chuột | Xoay trận kiếm / xoay camera |
| Hai tay xa–gần | Cuộn chuột | Zoom |
| — | L / T / G / H / C | Bùng sét / bật-tắt vệt / bảng thông số / bảng hướng dẫn / bật camera |

Thả tay (không làm cử chỉ nào) khoảng 0,7 giây thì kiếm về quỹ đạo. Nếu đang phóng kiếm thì kiếm thu về.

## Cấu trúc

```
index.html, css/style.css
js/config.js       mọi thông số (số vòng, số kiếm, màu, lò xo, sét, bloom, cử chỉ…)
js/main.js         khởi tạo, vòng lặp chính, HUD, bảng thông số (lil-gui)
js/scene.js        trời, sao, trăng, núi parallax, biển mây, vệt gió, ánh sáng
js/hero.js         nhân vật + kiếm dưới chân + áo choàng bay
js/sword.js        hình phi kiếm (lưỡi có đốt trúc) + vật liệu phát sáng
js/swarm.js        đàn kiếm: quỹ đạo, lò xo, 6 trạng thái
js/effects/        ribbon (dải băng quay về camera), trail, lightning, sparks, rune (trận đồ phù văn)
js/gesture.js      webcam → MediaPipe GestureRecognizer → cử chỉ ổn định + toạ độ đã làm mượt
js/input.js        cử chỉ / phím / chuột → lệnh
```

## Nâng cấp đồ hoạ sau này

- **Thay hình thanh kiếm:** chỉ cần đổi `createSwordGeometry()` trong `sword.js`, hoặc nạp một file `.glb` rồi lấy geometry của nó đưa vào `InstancedMesh`.
- **Thay nhân vật:** thay nội dung `createHero()`. Chỉ cần giữ lại `root`, `center` và `update`.
- **Thêm/bớt kiếm:** sửa mảng `rings` trong `config.js`. Số kiếm bằng tổng `count` của các vòng. `pulse` / `lobes` chỉnh sóng đâm ra–thu vào, `halo.thrustRate` / `thrustAmp` chỉnh các nhát đâm ngẫu nhiên.

## Đưa lên mạng (Vercel)

Trang tĩnh, không cần build: trên vercel.com → **Add New… → Project** → chọn repo này → Framework Preset **Other**, để trống Build Command → **Deploy**. Mỗi lần đẩy code mới lên GitHub, Vercel tự cập nhật. Link `https` nên camera / cử chỉ tay dùng được.
