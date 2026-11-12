# Tiến độ / Progress

Ghi chú để tiếp tục công việc khi phiên làm việc bị gián đoạn.

## Giai đoạn 2 — người mẫu + da: XONG, đã gộp vào `main`

Dựng lại mẫu: `python3 tools/build_models.py --mh <makehuman> --data <makehuman-data> --pack <asset pack>` (xem chú thích đầu file).

## Giai đoạn 3 — chất liệu + chụp chất lượng cao: XONG, đã gộp vào `main`

Lưu ý khi thử: path tracing rất nặng trên máy giả lập không có GPU; chỉ thử với cửa sổ nhỏ (khoảng 420×560) và dưới 60 mẫu, nếu không máy có thể bị treo.

## Giai đoạn 4 — thiết bị còn thiếu + công cụ học: XONG, đã gộp vào `main`

## Giai đoạn 5 — các việc còn lại (đang làm, nhánh `phase-5`)

- [ ] Scrim: bề mặt 'scrim' cho tấm hắt sáng; đèn chiếu xuyên qua thì nguồn sáng hiệu dụng là vệt sáng trên scrim (data.js `scrimFor`, engine `_poseRig`, pathtrace)
- [ ] Gobo trong chế độ chất lượng cao: đặt một tấm chắn có lỗ thật trước optical spot (pathtrace.js)
- [ ] Thử thách: app dựng ảnh mẫu từ một bố cục ẩn, người dùng dựng lại, chấm điểm bằng so sánh ảnh thu nhỏ (tab Học)
- [ ] Tư thế ngồi + nụ cười: build_models.py ghi thêm thuộc tính `_SEATPOS/_SEATNRM` (thân, quần áo) và `_SMILE` (thân); app đổi thuộc tính và thêm ghế
- [ ] Kiểm tra, README, tăng CACHE, gộp vào main

Nguồn dữ liệu dựng mẫu nằm ở /tmp/claude-0/-home-user-ielts-payroll/2a9d2870-e6d0-512a-b6d9-531b737bbb3b/scratchpad/mh (repo, makehuman-data, pack); nếu mất thì tải lại theo chú thích đầu tools/build_models.py.

