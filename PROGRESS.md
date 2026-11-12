# Tiến độ / Progress

Ghi chú để tiếp tục công việc khi phiên làm việc bị gián đoạn.

## Giai đoạn 2 — người mẫu + da: XONG, đã gộp vào `main`

Dựng lại mẫu: `python3 tools/build_models.py --mh <makehuman> --data <makehuman-data> --pack <asset pack>` (xem chú thích đầu file).

## Giai đoạn 3 — chất liệu + chụp chất lượng cao (đang làm, nhánh `phase-3`)

Kế hoạch:
1. Chủ thể "Mẫu chất liệu": một vật (cầu / khối / trụ / nút xoắn) với ~14 chất liệu chọn được (vải cotton, lụa, nhung, da thuộc, gỗ, giấy, nhựa bóng/mờ, cao su, inox xước, vàng, đồng, thủy tinh, sứ men). Vân bề mặt sinh bằng canvas trong `src/materials.js`.
2. Nút "Chụp chất lượng cao": path tracing bằng thư viện three-gpu-pathtracer (vendor vào `vendor/`, thêm import map). Dựng một scene riêng cho path tracer: bản sao lưới (đầu đã xoay sẵn trên CPU), đèn mềm thành RectAreaLight, đèn gom thành spot có bán kính. Hủy khi người dùng đổi bất cứ gì. Phải bắt lỗi và báo nếu thiết bị không chạy được.

Còn lại: xem `git log` nhánh phase-3 để biết bước nào đã commit; sau đó kiểm tra điện thoại + 2 ngôn ngữ, cập nhật README, tăng `CACHE` trong `sw.js`, gộp vào `main`.

