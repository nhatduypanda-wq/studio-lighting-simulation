# Tiến độ / Progress

Ghi chú để tiếp tục công việc khi phiên làm việc bị gián đoạn.

## Giai đoạn 2 — người mẫu + da: XONG, đã gộp vào `main`

Dựng lại mẫu: `python3 tools/build_models.py --mh <makehuman> --data <makehuman-data> --pack <asset pack>` (xem chú thích đầu file).

## Giai đoạn 3 — chất liệu + chụp chất lượng cao: XONG, đã gộp vào `main`

Lưu ý khi thử: path tracing rất nặng trên máy giả lập không có GPU; chỉ thử với cửa sổ nhỏ (khoảng 420×560) và dưới 60 mẫu, nếu không máy có thể bị treo.

## Giai đoạn 4 — thiết bị còn thiếu + công cụ học: XONG, đã gộp vào `main`

## Giai đoạn 5 — scrim, gobo chất lượng cao, thử thách, tư thế ngồi + nụ cười: XONG, đã gộp vào `main`

Chưa kiểm tra bằng mắt: gobo trong chế độ chất lượng cao (tấm chắn có lỗ trước optical spot).

## Giai đoạn 6 (đang làm, nhánh `phase-6`; người dùng yêu cầu chạy liên tục đến hết 13/11/2026 giờ VN)

Thứ tự người dùng duyệt: 1 → 2 → 3 (chân dung trước) → 4 (làm hết, bỏ qua cảm biến) → 5. Mỗi việc xong: thử, [x], commit, gộp main.

1. Bố cục + chủ thể
- [x] 1a. Bố cục chân dung: broad, short, high-key, low-key (data.js PRESETS + i18n)
- [x] 1b. Kính mắt cho người mẫu (models.js buildModel: gọng + tròng kính phản chiếu, theo đầu bằng _turn=1)
- [x] 1c. Bố cục sản phẩm: bright-field, dark-field (thủy tinh), tent lighting (kim loại)
- [x] 1d. Chủ thể mới: đồng hồ, nhẫn, hộp mỹ phẩm bóng, đồ ăn (đơn giản), bảng màu
2. Ánh sáng môi trường
- [x] 2a. Ánh sáng phòng (mức + nhiệt độ màu) — là ánh sáng liên tục nên phụ thuộc tốc độ màn trập; bài học "cân bằng flash với nền"
- [x] 2b. Đèn cửa sổ (nguồn sáng lớn liên tục 5600–6500 K đặt ở tường) 
- [x] 2c. Đèn modeling của flash (bật/tắt, liên tục, yếu)
3. Lưu / chia sẻ
- [x] 3a. Lưu nhiều bố cục có tên (localStorage), tải lại, xóa
- [x] 3b. Chia sẻ bố cục qua link (state nén trong #hash)
4. Không gian + tiện ích
- [ ] 4a. Sàn: bê tông / gỗ / bóng; phông vải muslin, vinyl
- [ ] 4b. Kích thước phòng chỉnh được
- [ ] 4c. Boom/C-stand (kiểu chân: thường / boom / treo trần / tự động)
- [ ] 4d. Lều chụp sản phẩm; cucoloris
- [ ] 4e. Phóng to xem catchlight; minh họa family of angles
5. Người mẫu
- [ ] 5a. Tư thế tay (build_models.py: thêm vài tư thế tay dạng thuộc tính như _SEATPOS)

