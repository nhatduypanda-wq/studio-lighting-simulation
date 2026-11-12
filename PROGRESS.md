# Tiến độ / Progress

Ghi chú để tiếp tục công việc khi phiên làm việc bị gián đoạn.

## Giai đoạn 2 — người mẫu + da (đang làm, nhánh `phase-2`)

Đã xong:
- `tools/build_models.py`: dựng 12 mẫu MakeHuman (nữ/nam × Đông Á/Âu/Phi × trẻ/lớn tuổi) ra `assets/models/*.glb`, ảnh 2048px trong `assets/models/tex/`, số đo trong `src/models-meta.js`.
  Nguồn (không lưu trong repo): repo `makehumancommunity/makehuman` (lưới gốc, target), repo `makehuman-js/makehuman-data` (lưới tóc/áo/mắt dạng JSON), gói `makehuman_system_assets_cc0.zip` từ files.makehumancommunity.org (ảnh gốc).
- `src/models.js`: `buildModel()` tải mẫu, tóc, mắt, lông mày, áo; xoay/cúi/nghiêng đầu bằng thuộc tính `_turn` trong vertex shader.
- `src/engine.js`: shader da `USE_SKIN` (bóng theo từng kênh màu, ánh sáng xuyên qua phần mỏng).
- `src/main.js`, `src/i18n.js`: điều khiển người mẫu, ngoại hình, tuổi, tóc, màu tóc, màu mắt, màu áo.

Còn lại:
- Tinh chỉnh cường độ tán xạ da; kiểm tra tai phát sáng khi chiếu ngược.
- Kiểm tra từng kiểu tóc, mẫu nam, mẫu lớn tuổi; cổ áo không hở da.
- Kiểm tra bố cục điện thoại, đổi ngôn ngữ, lưu/khôi phục trạng thái, chạy offline.
- Cập nhật README, tăng `CACHE` trong `sw.js`, gộp `phase-2` vào `main` (Pages chạy từ `main`).

## Sau đó
- Path tracing (nút chụp chất lượng cao), bộ chất liệu đầy đủ.
