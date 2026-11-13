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

## Giai đoạn 7 — chụp nhóm 2–5 người: XONG, đã gộp vào `main`, phiên bản 7.0

- `groupMembers()` trong data.js là nguồn duy nhất cho vị trí, tư thế và độ cao mặt của từng người; engine, sơ đồ, đo sáng và tránh che đều dùng nó.
- Người A là người chỉnh ở tab Chủ thể; B–E là mẫu cố định (COMPANIONS). Khóa mẫu không trùng nhau vì tư thế được ghi vào geometry dùng chung.
- Đo sáng từng người không tính bóng đổ của người này lên người kia (chỉ tính khoảng cách và góc đèn).

## Giai đoạn 8 — ánh sáng trên phông nền: XONG, phiên bản 7.1

- `meterBackdrop()` (data.js): đo sáng trực tiếp tại ba điểm trên phông (giữa, hai mép khung), so với mặt, dự đoán sắc độ. Không tính bóng chủ thể và ánh sáng dội.
- Đèn có `aim: 'bg'` (chĩa vào phông; `BG.z` cập nhật qua `setBackdrop`). Nút "Thêm đèn phông". Bố cục high-key dùng `aim: 'bg'`.
- `meterLight` nay lấy hướng đèn theo chủ thể thật (trước đây coi như đèn chĩa vào điểm đo).
- Năm bài học: bgTone, bgWhite, bgSpot, bgGel, bgShadow.

## Việc tiếp theo (chờ người dùng duyệt)
- Cần người dùng xác nhận trên thiết bị thật: tốc độ trên iPhone/iPad (nhất là nhóm 4–5 người), chế độ chất lượng cao, tự cập nhật.
- Ý tưởng thêm: chỉnh riêng từng người trong nhóm, nhóm trên 5 người, thử thách cho nhóm và sản phẩm.
