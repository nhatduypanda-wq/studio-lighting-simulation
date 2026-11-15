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

## Giai đoạn 9 — dẫn dắt người mới: XONG toàn bộ 9a–9i, bản 8.8; lịch tự chạy đã tắt (người dùng duyệt 15/11/2026, tự chạy theo lịch)

Thứ tự: việc khó, cần suy luận nhiều làm trước. Mỗi mục xong: thử bằng Playwright (máy tính + điện thoại, vi + en), đánh dấu [x], tăng APP_VERSION và CACHE, commit, push `main`.

- [x] 9a. (xong, bản 8.0; `src/critique.js`, hộp `#critBox` ở tab Đèn + nút 💡 trên ảnh) Nhận xét ảnh tự động: phát hiện lỗi thường gặp (hốc mắt tối, không có đốm sáng trong mắt, bóng mũi chạm môi, mặt cháy/thiếu sáng, ánh sáng bẹt, tỉ lệ sáng quá gắt, phông dính bóng, đèn sai màu…) từ hình học + số đo, kèm cách sửa và nút "sửa giúp tôi".
- [x] 9b. (xong, bản 8.1; `src/coach.js` chứa điều kiện từng bước, khung `#coach` dưới thanh tab, tiến độ lưu ở `sl.lessons.v1`) Bài học từng bước: mỗi bài chia bước, app tự kiểm tra điều kiện từng bước, lưu tiến độ (localStorage).
- [x] 9c. (xong, bản 8.2; 16 thử thách: 7 chân dung, 4 phông nền, 2 nhóm, 3 sản phẩm; `renderConverged()` làm mới probe 3 lượt trước khi chụp/chấm vì ánh sáng dội hội tụ dần; `assets.pending` trong models.js) Thử thách cho chụp nhóm, sản phẩm và phông nền.
- [x] 9d. (xong, bản 8.3; `src/gear.js`: `missing()` lọc bố cục theo thiết bị, `adapt()` đổi loại đèn và giữ độ sáng; thẻ "Thiết bị của tôi" đầu tab Học, lưu ở `sl.gear.v1`; phòng `home` + bố cục homeWindow, homeSpeedlight; bài học/thử thách tự rời phòng `home`) "Tôi có thiết bị gì": chọn đồ đang có, lọc bố cục làm được; bố cục phòng ở nhà (phòng nhỏ, cửa sổ + hắt sáng).
- [x] 9e. (xong, bản 8.4; hàng nâng cao bọc bằng `adv()` → class `.adv`, ẩn bằng `body.simple`; lưu ở `sl.mode.v1`; người mới mặc định ở chế độ đơn giản) Chế độ đơn giản (ẩn tùy chọn nâng cao), chuyển qua lại với chế độ đầy đủ.
- [x] 9f. (xong, bản 8.5; `TOUR` + `tourShow()` trong main.js, lớp phủ `#tour`; tự chạy lần đầu, cờ `sl.tour.v1`; nút xem lại ở cuối tab Phông) Hướng dẫn lần đầu mở app (5–6 bước).
- [x] 9g. (xong, bản 8.6; 21 thuật ngữ `g.<id>.t/.b` trong i18n; dấu ? cạnh nhãn qua `lab()` + `TERM_OF`; thẻ Thuật ngữ ở tab Học; hộp thoại `#gloss`) Giải thích thuật ngữ tại chỗ (stop, f-stop, key, fill, feather, lưới, gel…).
- [x] 9h. (xong, bản 8.7; `exportSheet()` trong main.js: trang A4 PNG gồm ảnh, sơ đồ, thông số máy, vị trí từng đèn, danh sách đồ, trình tự dựng) Phiếu mang đi chụp: sơ đồ + danh sách thiết bị + thông số máy + công suất từng đèn.
- [x] 9i. (xong, bản 8.8; `FRAMINGS` + `applyFraming()` trong main.js, `camera.aimDy` → `engine.look`; `camera.top` cho sản phẩm, `cameraPose` trả vị trí phía trên, up = −z) Khung toàn thân / nửa người / cận mặt chọn sẵn; góc máy từ trên xuống cho sản phẩm.

Không làm: ảnh thật để đối chiếu (không có nguồn ảnh được phép dùng).

## Việc tiếp theo (chờ người dùng duyệt)
- Chưa chạy thử từng bước 17/18 bài học và 4 thử thách mới; chưa thử chế độ chất lượng cao với cỡ cảnh toàn thân / góc máy từ trên xuống.
- Cần người dùng xác nhận trên thiết bị thật: tốc độ trên iPhone/iPad (nhất là nhóm 4–5 người), chế độ chất lượng cao, tự cập nhật.
- Ý tưởng thêm: chỉnh riêng từng người trong nhóm, nhóm trên 5 người, thử thách cho nhóm và sản phẩm.
