# Tiến độ / Progress

Ghi chú để tiếp tục công việc khi phiên làm việc bị gián đoạn.

## Giai đoạn 2 — người mẫu + da: XONG, đã gộp vào `main`

Dựng lại mẫu: `python3 tools/build_models.py --mh <makehuman> --data <makehuman-data> --pack <asset pack>` (xem chú thích đầu file).

## Giai đoạn 3 — chất liệu + chụp chất lượng cao: XONG, đã gộp vào `main`

Lưu ý khi thử: path tracing rất nặng trên máy giả lập không có GPU; chỉ thử với cửa sổ nhỏ (khoảng 420×560) và dưới 60 mẫu, nếu không máy có thể bị treo.

## Việc tiếp theo (chờ người dùng duyệt)
- Thiết bị còn thiếu so với kế hoạch ban đầu: gel màu, gobo/optical spot, barn doors, scrim, parabolic, Fresnel, đèn ống, ring light, cyclorama, phông xanh.
- Công cụ học: tỉ lệ key:fill, histogram, false color, xuất sơ đồ ánh sáng PNG, so sánh A/B, bài học/thử thách.
- Người mẫu: thêm tư thế ngồi, biểu cảm, mẫu chất lượng cao hơn nếu người dùng cung cấp.
