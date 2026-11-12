# Studio Light

Giả lập ánh sáng studio 3D để học cách đánh đèn chân dung và sản phẩm. Chạy trên iPhone, iPad và Mac bằng trình duyệt, cài được như một ứng dụng (PWA) và dùng được offline. Giao diện tiếng Việt và tiếng Anh.

A 3D studio lighting simulator for learning portrait and product lighting. Runs in the browser on iPhone, iPad and Mac, installs as a PWA and works offline. Vietnamese and English UI.

![Desktop](docs/screenshot-desktop.png)

## Chạy thử / Run

Bản chạy sẵn: https://nhatduypanda-wq.github.io/studio-lighting-simulation/

Không cần build. Phục vụ thư mục này bằng bất kỳ web server tĩnh nào:

```sh
cd studio-lighting-simulation
python3 -m http.server 8080
# mở http://localhost:8080
```

Để dùng trên iPhone/iPad: đưa thư mục lên một host HTTPS (ví dụ GitHub Pages), mở bằng Safari, chọn **Chia sẻ → Thêm vào Màn hình chính**.

## Tính năng / Features

- **Người mẫu** (giai đoạn 2): nữ và nam, ba nhóm ngoại hình (Đông Á, châu Âu, châu Phi), trẻ hoặc lớn tuổi; 4 kiểu tóc nữ, 3 kiểu tóc nam, 7 màu tóc, 3 màu mắt, 6 màu áo; xoay, cúi/ngẩng và nghiêng đầu; tư thế đứng hoặc ngồi ghế đẩu; nụ cười chỉnh được. Vẫn giữ mẫu đầu quét 3D.
- **Da** (giai đoạn 2): tán xạ dưới da xấp xỉ — mép bóng ngả đỏ ấm, ánh sáng xuyên qua phần mỏng như tai khi chiếu ngược.
- **Mẫu chất liệu** (giai đoạn 3): 16 chất liệu (cotton, lụa, nhung, da thuộc, gỗ, giấy, nhựa bóng/mờ, cao su, inox xước, chrome, vàng, đồng, thủy tinh trong/mờ, sứ) trên 5 hình dạng, gồm cả tấm vải treo có nếp.
- **Chụp chất lượng cao** (giai đoạn 3): nút "Chất lượng cao" dựng lại ảnh bằng path tracing — ánh sáng dội thật giữa mọi bề mặt, phản chiếu thật trên kim loại, khúc xạ qua thủy tinh. Đổi bất cứ gì sẽ hủy và quay về xem trực tiếp.
- **Tự tránh khung hình**: chân đèn lọt vào khung hình thì đèn tự chuyển sang treo trần; đèn hoặc tấm hắt sáng che mất chủ thể thì tự được nâng lên cho tới khi máy ảnh nhìn thấy chủ thể. Tắt được trong tab Máy ảnh.
- **Chủ thể khác**: bộ cầu tham chiếu (xám 18 %, chrome, trắng, sơn bóng), chai thủy tinh, bình gốm, bình lắc inox.
- **Đèn**: flash studio 400 Ws, speedlight, LED COB 300 W, LED panel 100 W, ring light, đèn ống LED (tối đa 5 đèn).
- **Phụ kiện**: chóa tiêu chuẩn, softbox 60×90, octabox 120, stripbox 30×120, dù xuyên, dù phản bạc, beauty dish, snoot, parabolic sâu, Fresnel, barn doors, optical spot kèm gobo (cửa sổ, rèm lá, tán lá), lưới tổ ong.
- **Gel màu**: CTO/CTB toàn phần và 1/2 (dịch nhiệt độ màu theo mired), 8 gel hiệu ứng.
- **Xoay đèn tự do** ±180° để feather hoặc chĩa đèn vào phông.
- **Hắt sáng / cờ / scrim**: tròn 80 và 110 cm, V-flat 1×2 m; trắng, bạc, vàng, đen, hoặc scrim (tấm tản: đèn chiếu xuyên qua thành nguồn sáng lớn và mềm, mất khoảng 2–3 stop).
- **Phông**: giấy seamless 9 màu (có xanh chroma) và màu tùy chọn, hoặc cyclorama kín hai tường; khoảng cách chủ thể–phông; tường trắng/xám/đen.
- **Máy ảnh**: tiêu cự, khẩu độ (có độ sâu trường ảnh), tốc độ, ISO, cân bằng trắng, vị trí máy, khung hình, lưu ảnh JPEG.
- **Công cụ đo**: đo sáng từng đèn tại chủ thể (f-stop, độ lệch EV), tỉ lệ đèn chính:đèn phụ, histogram, false color theo vùng phơi sáng, cảnh báo cháy sáng, cảnh báo tốc độ đồng bộ flash.
- **So sánh và ghi chép**: lưu ảnh A rồi bật/tắt để so với bố cục hiện tại; xuất sơ đồ ánh sáng PNG kèm danh sách thiết bị và thông số.
- **Học**: tab Học có 9 bài ngắn (nghịch đảo bình phương, gắt/mềm, bốn kiểu sáng chân dung, tỉ lệ sáng, feathering, tách nền, nhiệt độ màu và gel, kim loại bóng, negative fill), mỗi bài dựng sẵn bố cục và gợi ý một thứ để thử; ngoài ra có 8 bố cục mẫu.
- **Bổ sung giai đoạn 6**: bố cục broad, short, high-key, low-key, bright-field, dark-field, tent lighting; kính mắt; chủ thể đồng hồ, nhẫn, mỹ phẩm, trái cây, bảng màu; đèn phòng (kéo tốc để cân bằng flash với nền), đèn cửa sổ, đèn modeling; lưu nhiều bố cục có tên và chia sẻ qua link; ba cỡ phòng, bốn loại sàn, phông muslin/vinyl/không phông; chân đèn thường, tay boom hoặc treo trần; lều chụp sản phẩm; cucoloris; phóng to mắt xem catchlight; hiển thị family of angles trên sơ đồ; tư thế tay (buông, chống hông, đan tay trước).
- **Thử thách**: app chiếu sáng một chân dung bằng bố cục ẩn, bạn dựng lại ánh sáng từ ảnh mẫu rồi bấm chấm điểm (so ảnh thu nhỏ, thang 100); có thể xem và áp đáp án.

## Mô hình ánh sáng / Lighting model

- Mỗi đèn là một nguồn sáng có bóng đổ, được lấy mẫu ngẫu nhiên trên đúng diện tích mặt phát sáng của phụ kiện và cộng dồn qua nhiều khung hình. Vì vậy độ mềm của bóng phụ thuộc vào kích thước và khoảng cách nguồn sáng như thật.
- Cường độ theo luật nghịch đảo bình phương; công suất tính bằng lumen-giây (flash) hoặc lumen (đèn liên tục) và quy đổi theo khẩu độ, ISO, tốc độ. Thẻ xám 18 % được đo đúng sáng sẽ ra giá trị 0,18.
- Hai đầu dò ánh sáng đặt tại chủ thể: một cái nhìn thấy mặt đèn (cho phản chiếu trên da, kim loại, thủy tinh), một cái không (cho ánh sáng dội từ tường, sàn, phông và tấm hắt sáng).
- Độ sâu trường ảnh và khử răng cưa cũng được cộng dồn bằng cách xê dịch máy ảnh trên khẩu độ thật (tiêu cự / 2N).

Giới hạn hiện tại: ánh sáng dội là xấp xỉ theo một điểm tại chủ thể; tán xạ dưới da là xấp xỉ dựa trên bản đồ bóng, chưa phải mô phỏng đầy đủ; tóc là các mảng phẳng có vân, chưa phải từng sợi; Chế độ chất lượng cao không có tán xạ dưới da và bỏ qua vân nổi (bump) của chất liệu; trên điện thoại nó chạy chậm và ở độ phân giải thấp hơn.

## Cấu trúc / Layout

| File | Vai trò |
|---|---|
| `index.html`, `styles.css` | Khung giao diện |
| `src/main.js` | Trạng thái, bảng điều khiển, lưu vào localStorage |
| `src/engine.js` | Dựng hình three.js, cộng dồn mẫu, đầu dò ánh sáng |
| `src/models.js` | Hình học phòng, phông, đèn, phụ kiện, chủ thể |
| `src/diagram.js` | Sơ đồ ánh sáng nhìn từ trên |
| `src/data.js` | Danh mục thiết bị, bố cục mẫu, công thức trắc quang |
| `src/materials.js` | Thư viện chất liệu, vân bề mặt sinh bằng canvas |
| `src/pathtrace.js` | Chụp chất lượng cao bằng three-gpu-pathtracer |
| `tools/build_models.py` | Dựng người mẫu từ dữ liệu MakeHuman ra `assets/models/` |
| `src/i18n.js` | Chuỗi tiếng Việt và tiếng Anh |
| `sw.js`, `manifest.webmanifest` | PWA, chạy offline |

Khi sửa file, tăng `CACHE` trong `sw.js` để máy đã cài nhận bản mới.

## Ghi công / Credits

- Người mẫu, tóc, mắt, quần áo và ảnh da: bộ tài nguyên hệ thống của [MakeHuman](http://www.makehumancommunity.org), CC0.
- Mẫu đầu người quét 3D: “Infinite, 3D Head Scan” của Lee Perry-Smith, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), xem `assets/LeePerrySmith_License.txt`.
- [three.js](https://threejs.org) (MIT), xem `vendor/THREE-LICENSE`.
- [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) và [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) của Garrett Johnson (MIT), xem `vendor/PATHTRACER-LICENSE`.
