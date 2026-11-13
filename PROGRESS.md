# Tiến độ / Progress

Ghi chú để tiếp tục công việc khi phiên làm việc bị gián đoạn.

## Giai đoạn 2 — người mẫu + da: XONG, đã gộp vào `main`

Dựng lại mẫu: `python3 tools/build_models.py --mh <makehuman> --data <makehuman-data> --pack <asset pack>` (xem chú thích đầu file).

## Giai đoạn 3 — chất liệu + chụp chất lượng cao: XONG, đã gộp vào `main`

Lưu ý khi thử: path tracing rất nặng trên máy giả lập không có GPU; chỉ thử với cửa sổ nhỏ (khoảng 420×560) và dưới 60 mẫu, nếu không máy có thể bị treo.

## Giai đoạn 4 — thiết bị còn thiếu + công cụ học: XONG, đã gộp vào `main`

## Giai đoạn 5 — scrim, gobo chất lượng cao, thử thách, tư thế ngồi + nụ cười: XONG, đã gộp vào `main`

Chưa kiểm tra bằng mắt: gobo trong chế độ chất lượng cao (tấm chắn có lỗ trước optical spot).

## Giai đoạn 6 — XONG toàn bộ (1a–1d, 2a–2c, 3a–3b, 4a–4e, 5a), đã gộp vào `main`, phiên bản 6.4

Ghi chú kỹ thuật:
- Pháp tuyến phông giấy từng bị ngược khiến đèn đặt gần phông bị tính là trong bóng; đã sửa ở 6.1.
- Tư thế: thân và quần áo có `_seatpos/_seatnrm` (float) và `_arm_<pose>_p/_n` (offset nén int16/int8); app cộng offset trên CPU (models.js, `apply`).
- Đèn phòng chưa có trong chế độ chất lượng cao (path tracer không có ambient light).

## Giai đoạn 7 — chụp nhóm 2–5 người (đang làm, nhánh `phase-7`)

- [ ] 7a. data.js `groupMembers(subject)`: thành viên, vị trí (hàng ngang / vòng cung / hai hàng), độ cao mặt; `subjectTarget` lấy tâm nhóm
- [ ] 7b. models.js `buildGroup`: nhiều `buildModel`, mỗi người một mẫu khác nhau (khóa mẫu không trùng để tư thế không đè nhau)
- [ ] 7c. Đo sáng từng người + độ chênh sáng trong nhóm (main.js updateReadouts); sơ đồ vẽ từng người; tránh che áp cho mọi khuôn mặt
- [ ] 7d. Giao diện: số người, đội hình, khoảng cách; máy ảnh tự lùi cho vừa khung
- [ ] 7e. Bố cục mẫu và bài học chụp nhóm (phủ sáng đều, bóng đổ chéo, độ sâu trường ảnh hai hàng)
- [ ] 7f. Kiểm tra, README, gộp vào main

