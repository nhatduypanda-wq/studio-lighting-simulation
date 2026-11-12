# Tiến độ / Progress

Ghi chú để tiếp tục công việc khi phiên làm việc bị gián đoạn.

## Giai đoạn 2 — người mẫu + da: XONG, đã gộp vào `main`

Dựng lại mẫu: `python3 tools/build_models.py --mh <makehuman> --data <makehuman-data> --pack <asset pack>` (xem chú thích đầu file).

## Giai đoạn 3 — chất liệu + chụp chất lượng cao: XONG, đã gộp vào `main`

Lưu ý khi thử: path tracing rất nặng trên máy giả lập không có GPU; chỉ thử với cửa sổ nhỏ (khoảng 420×560) và dưới 60 mẫu, nếu không máy có thể bị treo.

## Giai đoạn 4 — thiết bị còn thiếu + công cụ học (đang làm, nhánh `phase-4`)

Đánh dấu [x] khi xong và đã commit:
- [ ] Gel màu (CTO/CTB theo mired, gel màu RGB) cho mọi đèn
- [ ] Đèn mới: ring light, đèn ống; phụ kiện mới: parabolic, Fresnel, barn doors, optical spot + gobo
- [ ] Xoay đèn tự do ±180° (để đánh phông); phông xanh, cyclorama
- [ ] Tỉ lệ đèn chính:phụ, histogram, false color
- [ ] Xuất sơ đồ ánh sáng PNG, so sánh A/B
- [ ] Tab "Học": 9 bài học ngắn kèm bố cục dựng sẵn (src/lessons.js), hai ngôn ngữ
- [ ] Kiểm tra điện thoại + 2 ngôn ngữ, README, tăng CACHE trong sw.js, gộp vào main

Không làm trong đợt này: tư thế ngồi, scrim, chế độ thử thách chấm điểm.

