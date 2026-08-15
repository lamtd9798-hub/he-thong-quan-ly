## V2.19.1 — Báo giá cập nhật theo từng đợt

- BOQ được upload trước.
- Báo giá NCC có lúc nào thì tải thêm lúc đó.
- Kho giá cộng dồn, không bắt buộc tải cùng lúc.
- Tự động chỉ điền dòng BOQ chưa có giá, không ghi đè giá cũ.
- Sửa lỗi đọc `qty` ở các dòng BOQ không có item map.

## V2.19 — Lập giá trực tiếp trên BOQ gốc

- Tab BOQ không còn dựng bảng dữ liệu riêng.
- Giữ nguyên Sheet BOQ gốc A→K, merge, hàng/cột và bố cục.
- Khối lượng và Vật tư chính được nhập ngay trên đúng ô BOQ.
- Giá tự ráp từ NCC đổ vào đúng cột Vật tư chính.
- Parser Diễn giải/Khối lượng/Giá vật tư được nâng độ chính xác.

# HỆ THỐNG QUẢN LÝ CÔNG TY — V2.18

Đây là bản xây lại từ đầu, dùng cho GitHub Pages + Firebase.


















## V2.18 — Lập giá đấu thầu: BOQ + tự ráp giá vật tư

V2.18 xây lại mục `BOQ & Lập giá` thành `Lập giá đấu thầu` theo quy trình thực tế:

`Upload BOQ → Upload báo giá vật tư → tự nhận diện → ráp giá vào BOQ → kiểm tra nguồn giá`

### 1. BOQ

- Hỗ trợ `.xlsx`, `.xls`, `.csv`.
- Excel nhiều Sheet: tự đề xuất Sheet giống BOQ nhất.
- Tự dò tiêu đề 1–3 hàng và ô gộp.
- Nhận các cột Mục, Diễn giải, Model/Thông số, ĐVT, Khối lượng, Nhãn hiệu, Xuất xứ, Giá vật tư, Nhân công.
- Giữ các dòng Section/Hạng mục để BOQ dễ đọc.
- Khối lượng và Giá vật tư có thể nhập trực tiếp trên bảng.
- Khi nhập giá vật tư bằng tay, hệ thống đánh dấu `Nhập tay` và bỏ liên kết nguồn giá tự động cũ.

### 2. Báo giá vật tư

- Chọn nhiều file Excel/CSV trong một lần.
- Tự tìm Sheet có dữ liệu giá phù hợp.
- Tự tìm dòng tiêu đề 1–3 hàng.
- Tự nhận các cột Mã hàng, Tên vật tư/Mô tả, Quy cách/Model, ĐVT, Hãng, Xuất xứ, NCC, Đơn giá.
- Nếu file không có cột NCC, tên file được dùng làm tên NCC.
- Tất cả dòng giá được lưu thành kho giá của riêng dự án.

### 3. Ráp giá tự động

Hệ thống chấm điểm dựa trên:

1. Mã hàng / mã BOQ.
2. Mô tả vật tư.
3. Quy cách / Model / Thông số.
4. ĐVT.
5. Nhãn hiệu.
6. Các token kỹ thuật như DN, kích thước, kW, HP, bar...

Quy tắc:

- `>=95%`: được phép tự ráp vào cột Giá vật tư.
- `78–94%`: chỉ đề xuất, người dùng bấm `Dùng giá` để xác nhận.
- `<78%`: coi là chưa tìm được giá đáng tin cậy.

### 4. Truy vết nguồn giá

Mỗi giá ráp tự động lưu kèm:

- NCC.
- File nguồn.
- Sheet.
- Dòng trong file nguồn.
- Đơn giá nguồn.
- % khớp.
- Lý do khớp.

Click vào nguồn giá trên BOQ để xem lại thông tin này.

### 5. Giá nhân công

Tab `Giá nhân công` đã được đặt chỗ nhưng chưa bật ở V2.18.
Bước tiếp theo sẽ dùng một BOQ/file giá nhân công mẫu để tự ráp vào cột Nhân công theo cùng cơ chế kiểm soát độ khớp.

### Firebase mới

V2.18 thêm hai vùng dữ liệu:

- `boqImportMeta`
- `materialPriceImports`

Vì vậy cần cập nhật Firebase Rules bằng file `FIREBASE_RULES_V2.18_COPY.txt`.

## V2.17 — BOQ Professional Auto Layout

- Chỉ giữ cột A → K.
- Tự nhận và làm đẹp header BOQ.
- Header chính nền xanh đậm/chữ trắng/in hoa/căn giữa.
- Header phụ nền xanh nhạt.
- Tự tô màu đầu mục lớn theo cấp.
- Làm đẹp GHI CHÚ CHUNG và các dòng note.
- Tự canh độ rộng cột theo loại dữ liệu.
- Tự căn ĐVT/KL/Đơn giá.
- Vẫn giữ resize cột, AutoFit, Ribbon, Freeze, Group và Insert của V2.16.
## V2.16 — Ribbon Excel cho BOQ gốc

- Ribbon: Trang chủ / Chèn / Hiển thị / Dữ liệu.
- Font + cỡ chữ.
- Đậm / nghiêng / căn lề / wrap.
- Chọn vùng bằng Shift.
- Chèn hàng/cột.
- Freeze Panes.
- Group/Ungroup hàng và cột.
- Lưu format/cấu trúc BOQ vào Firebase.
## V2.15 — Giao diện BOQ kiểu Excel + resize cột

- Kéo mép tiêu đề A/B/C... để thay đổi độ rộng.
- Nhấp đúp mép cột để AutoFit.
- Nhớ kích thước cột trên trình duyệt.
- Zoom 50%–150%.
- Vừa màn hình.
- Khôi phục độ rộng cột từ file gốc.
- Click ô để highlight ô, hàng và cột.
- Không thay đổi dữ liệu BOQ gốc.
## V2.14 — Xây lại chức năng Kiểm soát khối lượng từ BOQ gốc

Theo yêu cầu, V2.14 tạm bỏ toàn bộ giao diện quản lý cũ trong mục Kiểm soát khối lượng:

- Tổng hợp BOQ.
- Tender R0.
- Baseline R1/R2.
- Δ HĐ.
- Đã duyệt/đặt.
- Chờ duyệt.
- Còn lại.
- Vượt CT.
- % sử dụng.
- Giá trị chênh.
- Các tab Revision/Phiếu đặt hàng/Ngoài BOQ/Lịch sử trên màn hình này.

Mục tiêu hiện tại chỉ còn:

`Tải file Excel/CSV → chọn Sheet → tạo bảng BOQ giống Sheet upload`

### Bảng BOQ gốc

Bảng hiển thị:

- nguyên vùng dữ liệu Sheet;
- nguyên số hàng;
- nguyên số cột;
- nguyên vị trí nội dung;
- merged cells;
- độ rộng cột;
- chiều cao dòng;
- giá trị hiển thị của ô;
- chữ cột A/B/C...;
- số hàng 1/2/3...;
- cuộn ngang/dọc.

Không có cột quản lý nào được chèn vào bảng BOQ.

### Nạp lại file

Nếu dự án đã có BOQ:
`Thay / Nạp lại BOQ`

Chọn file và Sheet mới.

Nếu Revision hiện tại đã tồn tại, chức năng chỉ cập nhật `sourceGrid`, không thay Baseline/đơn giá/phiếu đặt hàng cũ.

### Hướng phát triển sau

Sau khi phần BOQ gốc hiển thị chuẩn, chức năng kiểm soát khối lượng sẽ được xây tiếp dựa trên các cột có sẵn của chính BOQ, thay vì dựng một bảng khác làm mất cấu trúc gốc.
## Nâng cấp V2.13 — BOQ gốc phải giống Sheet upload trước

V2.13 đổi ưu tiên xử lý BOQ:

`Upload Excel → lưu nguyên Sheet → hiển thị nguyên hàng/cột → sau đó mới mapping/kiểm soát`

### BOQ gốc

Tab:
`Triển khai → Kiểm soát khối lượng → BOQ gốc`

hiển thị snapshot trực tiếp của Sheet Excel đã chọn.

Hệ thống giữ:

- Toàn bộ vùng dữ liệu đang dùng của Sheet.
- Tất cả hàng, kể cả hàng trống nằm bên trong vùng dữ liệu.
- Tất cả cột.
- Thứ tự hàng/cột.
- Ô merge theo đúng rowspan/colspan.
- Giá trị hiển thị của ô.
- Độ rộng cột.
- Chiều cao dòng.
- Một số định dạng cơ bản nếu workbook cung cấp qua SheetJS.
- Dòng tiêu đề dự án, ghi chú, hệ thống, khu vực và các đầu mục đều nằm đúng vị trí nguồn.

Bảng có thanh cuộn ngang/dọc và hiển thị chữ cột A/B/C... cùng số hàng để dễ đối chiếu với Excel.

### Không biến BOQ gốc thành bảng quản lý

BOQ gốc và bảng kiểm soát là hai lớp riêng:

1. `BOQ gốc`: bản sao Sheet dùng để đối chiếu.
2. `Tổng hợp BOQ`: dữ liệu đã mapping dùng để so Baseline/đặt hàng/vượt khối lượng.

Mapping không được làm thay đổi hình dạng của tab BOQ gốc.

### Revision cũ

Nếu R0/R1 được upload trước V2.13, tab BOQ gốc có nút:

`Nạp lại BOQ gốc`

Chọn đúng file Excel và Sheet.

Chức năng này chỉ bổ sung `sourceGrid` vào Revision:
- Không đổi Baseline.
- Không đổi đơn giá.
- Không đổi khối lượng kiểm soát.
- Không đổi phiếu đặt hàng.

### Firebase

Không thêm node Firebase mới.
Snapshot Sheet nằm trong:
`/v2/quantityBoqRevisions/{projectId}/{revisionId}/sourceGrid`
## Nâng cấp V2.12 — Giữ nguyên cấu trúc BOQ khi upload

V2.12 sửa việc import Excel chỉ lấy các dòng có khối lượng khiến BOQ sau upload không còn giống file gốc.

### Dữ liệu được giữ

Khi import BOQ Excel/CSV, hệ thống lưu:

- Dòng `GHI CHÚ CHUNG`.
- Các dòng note/thuyết minh.
- Hệ thống, ví dụ `1.0 HỆ THỐNG CHỮA CHÁY...`.
- Khu vực/nhóm, ví dụ `1.1 Khu vực hầm`.
- Các đầu mục `1.101`, `1.102`...
- Đúng thứ tự dòng nguồn.
- Toàn bộ cột nguồn có dữ liệu, kể cả cột riêng của file như `KL Tuấn Nguyễn`, `CODE`, `Ghi chú`...

Chỉ dòng `ITEM` có khối lượng mới tham gia:
- Baseline.
- Tổng đã đặt.
- Còn lại.
- Vượt BOQ.
- Giá trị chênh.

Dòng nhóm/note chỉ dùng để giữ cấu trúc và ngữ cảnh.

### Tab BOQ chi tiết

`Triển khai → Kiểm soát khối lượng → BOQ chi tiết`

hiển thị lại bảng theo thứ tự Excel, dùng chính các cột nguồn đã upload.

### Tổng hợp BOQ

Bảng kiểm soát cũng chèn lại:
- Hệ thống.
- Khu vực.
- Ghi chú.

giữa các đầu mục vật tư để người dùng không mất ngữ cảnh.

### Fallback nhiều cột khối lượng

Nếu một dòng có:
- `Khối lượng` trống,
- nhưng `KL Tuấn Nguyễn` có số,

hệ thống vẫn nhận đó là đầu mục vật tư và dùng cột KL có số của dòng đó.

Ví dụ:
`1.101 Tủ điều khiển bơm`
- Khối lượng: trống
- KL Tuấn Nguyễn: 2

V2.12 nhận:
`KL = 2`

### Revision cũ V2.11

Revision tạo trước V2.12 chưa có dữ liệu cấu trúc.

Trong tab `BOQ chi tiết` sẽ có nút:

`Tải lại cấu trúc từ Excel / CSV`

Chức năng này:
- KHÔNG thay đổi Baseline.
- KHÔNG thay đổi khối lượng.
- KHÔNG thay đổi đơn giá.
- KHÔNG thay đổi phiếu đặt hàng.

Nó chỉ lấy lại:
- cấu trúc,
- note,
- khu vực,
- thứ tự,
- các cột nguồn,

và map vào đầu mục hiện có.

### Firebase

V2.12 không thêm node mới và không đổi Rules.
Dữ liệu `displayRows` và `sourceHeaders` nằm bên trong từng BOQ Revision.
## Nâng cấp V2.11 — Tự chọn đúng cột dữ liệu BOQ

V2.11 sửa trường hợp Excel nhận đúng tên tiêu đề nhưng khi Lưu báo:
`Không có dòng BOQ hợp lệ trong Sheet đã chọn`.

Nguyên nhân thường gặp:
- Có 2 cột cùng/na ná tên `Diễn giải`.
- Có nhiều cột khối lượng, ví dụ `Khối lượng` và `KL Tuấn Nguyễn`.
- Bộ nhận diện cũ chọn đúng tên cột nhưng chọn nhầm cột không có dữ liệu thực tế.
- Tự nhận số hàng tiêu đề 3 hàng trong khi dữ liệu thực tế phù hợp 2 hàng hơn.

### Logic mới

Hệ thống không chỉ nhìn tên tiêu đề.

Đối với `Khối lượng`:
- Tìm các cột có tên giống Khối lượng / KL / Số lượng.
- Kiểm tra tối đa 500 dòng bên dưới.
- Ưu tiên cột có nhiều dữ liệu số thực tế nhất.

Đối với `Diễn giải`:
- Nếu có nhiều cột trùng tên, ưu tiên cột có nhiều text.
- Ưu tiên mạnh cột có text cùng hàng với cột Khối lượng thực tế.

Các cột ĐVT, giá, model... cũng được chấm điểm dựa trên dữ liệu bên dưới.

### Tự sửa cấu trúc tiêu đề khi Lưu

Nếu người dùng đang chọn:
`Dòng 7 + 3 hàng tiêu đề`

nhưng cấu trúc đó đọc ra 0 dòng BOQ:

1. Hệ thống tự quét lại 40 dòng đầu.
2. Thử 1/2/3 hàng tiêu đề.
3. Chọn cấu trúc đọc được nhiều dòng BOQ hợp lệ nhất.
4. Tiếp tục import mà không bắt người dùng sửa tay.

### Preview mới

Preview không chỉ báo `Đã nhận BOQ`, mà hiển thị:

`Đã nhận XXX dòng BOQ`

Nếu chỉ nhận được tên cột nhưng chưa có dòng dữ liệu hợp lệ, hệ thống cảnh báo trước khi bấm Lưu.

### Firebase

V2.11 không thay đổi Rules hoặc cấu trúc Firebase.
## Nâng cấp V2.10 — Tự nhận BOQ có tiêu đề 1–3 hàng và ô gộp

V2.10 nâng bộ đọc Excel cho các BOQ thực tế có cấu trúc phức tạp.

### Nhận tiêu đề nhiều tầng

Hệ thống tự thử:

- 1 hàng tiêu đề.
- 2 hàng tiêu đề.
- 3 hàng tiêu đề.

Ví dụ:

Hàng 7:
`Diễn giải | Đơn vị | Khối lượng | Model... | Đơn giá (VND)`

Hàng 8:
`... | ... | ... | ... | Vật tư chính | Nhân công và vật tư phụ | Tổng cộng`

Hệ thống ghép thành:

- `Đơn giá (VND) / Vật tư chính`
- `Đơn giá (VND) / Nhân công và vật tư phụ`
- `Đơn giá (VND) / Tổng cộng`

### Nhận ô Merge

V2.10 đọc vùng merged-cell từ workbook Excel.

Các cột có tiêu đề merge dọc 2 hàng như:

- Diễn giải.
- Đơn vị.
- Khối lượng.
- Model/Thông số kỹ thuật.
- Nhãn hiệu.
- Xuất xứ.

vẫn được nhận đúng.

### Cột được nhận thêm

- Diễn giải.
- Model/Thông số kỹ thuật.
- Nhãn hiệu.
- Xuất xứ.
- Đơn vị.
- Khối lượng.
- Vật tư chính.
- Nhân công và vật tư phụ.
- Tổng cộng.

### Tự chọn đúng block tiêu đề

Hệ thống:

1. Quét 40 dòng đầu.
2. Thử từng vị trí với 1/2/3 hàng tiêu đề.
3. Chấm điểm số cột BOQ nhận được.
4. Kiểm tra dữ liệu phía dưới có Mô tả + Khối lượng dạng số hay không.
5. Chọn block phù hợp nhất.

Do đó các dòng:
- tên dự án,
- tên gói thầu,
- ghi chú chung,
- dòng trắng,

không bị coi nhầm là tiêu đề BOQ.

### Cho phép chỉnh tay khi cần

Sau khi chọn Excel sẽ có:

- `Dòng tiêu đề bắt đầu`
- `Số hàng tiêu đề: 1 / 2 / 3`

Hệ thống tự điền trước. Người dùng chỉ cần sửa nếu file đặc biệt.

### Preview mapping

Trước khi nhập, giao diện hiển thị cột hệ thống đã nhận:

- Mô tả.
- ĐVT.
- Khối lượng.
- Model/Thông số.
- Nhãn hiệu.
- Xuất xứ.
- Giá vật tư.
- Nhân công + vật tư phụ.
- Tổng đơn giá.

### Mẫu Excel

`MAU_BOQ_REVISION.xlsx` có 2 Sheet:

- `BOQ_1_HANG`
- `BOQ_2_HANG_MERGE`

để test cả hai dạng tiêu đề.

### Firebase

V2.10 không thay đổi cấu trúc Firebase so với V2.9.
## Nâng cấp V2.9 — Import BOQ Excel / CSV

V2.9 nâng phần `Triển khai → Kiểm soát khối lượng → BOQ Revision`.

### Định dạng hỗ trợ

- `.xlsx`
- `.xls`
- `.csv`

### Excel nhiều Sheet

Sau khi chọn file Excel:

1. Hệ thống đọc danh sách Sheet.
2. Tự đề xuất Sheet có cấu trúc BOQ phù hợp nhất.
3. Người dùng có thể chọn lại Sheet cần nhập.
4. File chỉ được lưu thành Revision sau khi bấm `Tải & So sánh`.

### Tự nhận dòng tiêu đề

Hệ thống dò trong 40 dòng đầu để tìm hàng tiêu đề.

Nếu file có dạng:

- Dòng 1: Tên dự án.
- Dòng 2: Chủ đầu tư.
- Dòng 3: Gói thầu.
- Dòng 6: STT | Mô tả | ĐVT | Khối lượng...

thì hệ thống có thể tự chọn dòng 6.

Người dùng vẫn có ô `Dòng tiêu đề` để sửa thủ công khi cần.

### Không bắt buộc thứ tự cột

Các cột được nhận theo tên, không theo vị trí.

Hỗ trợ nhiều tên thường gặp:

- STT / Mã / Code.
- Hệ / Hệ thống.
- Nhóm / Hạng mục.
- Mô tả / Nội dung / Tên vật tư.
- Thông số / Quy cách / Model / Spec.
- ĐVT / Đơn vị / UOM.
- Khối lượng / Số lượng / Qty.
- Giá chào / Đơn giá HĐ / Unit Price.
- Giá vật tư.
- Nhân công.
- Thầu phụ.
- Khác.
- Hao hụt %.
- Markup / Lợi nhuận %.

Tối thiểu phải nhận được:
- Mô tả/Nội dung.
- Khối lượng/Số lượng.

### Preview trước khi nhập

Sau khi chọn file, giao diện hiển thị:

- Tên file.
- Sheet.
- Dòng tiêu đề đang dùng.
- Số dòng dữ liệu ước tính.
- Các tiêu đề cột đã đọc.
- Cảnh báo nếu chưa nhận được Mô tả + Khối lượng.

### Mẫu file

Có hai nút:

- `Tải mẫu Excel`
- `Tải mẫu CSV`

### Xử lý Excel

Website sử dụng SheetJS Community Edition standalone để đọc workbook ngay trên trình duyệt.

Dữ liệu Revision vẫn chạy qua quy trình V2.8:

`File Excel/CSV → Chọn Sheet → Đọc BOQ → Mapping → So sánh → Xác nhận → Áp dụng Baseline`

### Firebase

V2.9 không thêm node Firebase mới và không thay đổi cấu trúc dữ liệu so với V2.8.

## Nâng cấp V2.8 — BOQ Revision & Baseline hợp đồng

V2.8 giải quyết trường hợp BOQ thay đổi sau khi trúng thầu/ký hợp đồng.

Luồng mới:

`R0 Tender → R1 Hợp đồng → R2 Phụ lục → R3... → chọn Revision đang áp dụng → Phiếu đặt hàng`

### 1. R0 luôn được giữ

R0 là BOQ đấu thầu/trúng thầu ban đầu.

- Không bị ghi đè khi có BOQ hợp đồng mới.
- Dùng làm mốc lịch sử để biết khối lượng/giá trị đã thay đổi bao nhiêu sau đấu thầu.
- Dự án mới: R0 được tạo tự động khi bấm Bàn giao.
- Dự án cũ V2.7: hệ thống tự chuyển Baseline cũ thành R0 khi tài khoản quản lý mở trang.
- Có thể tải R0 trực tiếp từ CSV nếu dự án chưa có BOQ trong hệ thống.

### 2. Tải R1/R2/R3 từ CSV

Trong:

`Triển khai → Kiểm soát khối lượng`

có nút:

`＋ Tải BOQ Revision`

Mỗi file được lưu thành một phiên bản riêng:

- Mã Revision.
- Loại: Hợp đồng / Phụ lục / Revision khác.
- Tên.
- Ngày hiệu lực.
- File nguồn.
- Người tạo.
- Số dòng.
- Tổng giá trị.

Revision mới ở trạng thái **Chờ áp dụng** và chưa làm thay đổi khối lượng kiểm soát.

### 3. Mapping đầu mục

Hệ thống tự ghép đầu mục theo:

1. Mã/STT nếu duy nhất.
2. Mô tả + Spec + ĐVT.
3. Nếu không chắc chắn → đánh dấu `CHƯA MAP`.

Có nút **Map lại** để người dùng chọn thủ công đầu mục lịch sử tương ứng.

Mục tiêu là giữ một `stable item id` xuyên suốt các Revision, để phiếu đặt hàng cũ không bị mất liên kết khi BOQ đổi mã hoặc mô tả.

### 4. So sánh Revision

Mỗi Revision có nút **So sánh**.

Hiển thị:

- Thêm mới.
- Tăng khối lượng.
- Giảm khối lượng.
- Loại bỏ.
- Thay đổi đơn giá.
- Δ giá trị.
- Mapping tự động/thủ công.

Ngoài so với Revision trước, hệ thống luôn tính chênh so với Tender R0.

### 5. Chỉ một Revision là Baseline đang áp dụng

Khi quản lý bấm:

`Áp dụng Baseline`

hệ thống mới chuyển Revision đó thành Baseline dùng để kiểm soát phiếu đặt hàng.

Phiếu đặt hàng cũ không bị xóa.

Toàn bộ khối lượng đã duyệt/đặt được tính lại theo Baseline mới.

Đầu mục bị loại khỏi BOQ mới:
- Baseline hiện hành = 0.
- Nếu trước đó công trường đã đặt → toàn bộ phần đã đặt sẽ trở thành vượt Baseline và cảnh báo.

### 6. Tách hai loại chênh lệch

Bảng kiểm soát V2.8 tách rõ:

**Chênh Hợp đồng so với Tender**
`= Baseline Revision hiện hành − Tender R0`

và:

**Vượt do công trường**
`= Tổng phiếu đã duyệt/đặt − Baseline Revision hiện hành`

Ví dụ:

- R0 Tender = 1.000 m.
- R1 Hợp đồng = 1.200 m.
- Công trường đã đặt = 1.260 m.

Hệ thống báo:

- Δ HĐ so Tender = +200 m.
- Vượt công trường = +60 m.

Không báo sai thành +260 m.

### 7. Giá trị tiền

Hệ thống tính riêng:

- Giá trị thay đổi hợp đồng so Tender.
- Giá trị vượt công trường theo đơn giá HĐ/Baseline.
- Chi phí vượt dự kiến theo giá mua.
- Variation/VO chỉ tạo từ phần vượt công trường khi người dùng yêu cầu.

### 8. Export CSV

File xuất kiểm soát có:

- Tender R0.
- Baseline Revision hiện hành.
- Δ HĐ.
- Đã đặt.
- Vượt công trường.
- Giá trị Δ HĐ.
- Giá trị vượt.
- Chi phí vượt.
- Danh sách Revision.
- Danh sách phiếu đặt hàng.

### Firebase mới

- `/v2/quantityBoqRevisions/{projectId}/{revisionId}`

Các node V2.7 vẫn được giữ:
- `/v2/quantityBaseline`
- `/v2/quantityBaselineMeta`
- `/v2/orderRequests`
- `/v2/quantityAudit`

## Nâng cấp V2.7 — Kiểm soát khối lượng đặt hàng công trường

V2.7 bổ sung tab **Kiểm soát khối lượng** bên trong menu **Triển khai**.

Luồng:

`BOQ trúng thầu → Baseline BOQ → Phiếu đặt hàng lần 1/2/3... → Cộng dồn → Cảnh báo vượt → Giá trị chênh → Variation/VO`

### 1. Baseline BOQ được khóa tại thời điểm trúng thầu

Khi bấm **Bàn giao** từ Đấu thầu sang Triển khai:

- Hệ thống tự snapshot BOQ hiện tại.
- Lưu khối lượng BOQ.
- ĐVT.
- Giá vật tư.
- NET/ĐVT.
- Giá chào/ĐVT.
- NCC/Hãng đã chọn.
- Người khóa và thời điểm khóa.

Sau khi đã khóa, Baseline không tự thay đổi nếu BOQ đấu thầu bị sửa về sau.

Các dự án đã bàn giao từ phiên bản cũ có nút:
**Khởi tạo Baseline từ BOQ hiện tại**.

### 2. Phiếu đặt hàng công trường

Mỗi lần công trường yêu cầu vật tư được lưu thành một phiếu riêng:

- Mã phiếu: DDH-YYYY-XXX.
- Ngày đề nghị.
- Người đề nghị.
- Khu vực / Tầng / Zone.
- Ghi chú.
- Nhiều dòng vật tư.

Trạng thái:

`Nháp → Chờ duyệt → Đã duyệt → Đã đặt hàng`

Ngoài ra có trạng thái `Đã hủy`.

Chỉ phiếu **Đã duyệt** và **Đã đặt hàng** mới cộng vào tổng kiểm soát.

### 3. Quy đổi đơn vị đặt hàng

Mỗi dòng có:

- ĐVT BOQ.
- ĐVT đặt hàng.
- Hệ số quy đổi.
- Số lượng đặt.
- Khối lượng quy đổi.

Ví dụ:

`BOQ = m`
`Đặt = cây`
`1 cây = 6 m`
`20 cây = 120 m BOQ`

Có thể áp dụng tương tự:

- Cuộn → m.
- Hộp → cái.
- Bộ → cái.
- Kiện → cái.

### 4. Bảng kiểm soát BOQ

Tự hiển thị:

- KL BOQ.
- Tổng đã duyệt/đặt.
- Khối lượng chờ duyệt.
- Khối lượng còn lại.
- Tăng/Giảm so với BOQ.
- % sử dụng.
- Giá chào/ĐVT.
- Giá trị chênh.
- Chi phí vượt dự kiến.

Màu:

- Xám: chưa đặt.
- Xanh: trong BOQ.
- Vàng: đạt từ 90% hoặc phiếu chờ duyệt sắp/vượt BOQ.
- Đỏ: đã vượt BOQ.

### 5. Giá trị vượt

Hệ thống tính hai loại:

**Giá trị thương mại vượt**
`= KL vượt × Giá chào BOQ`

Dùng làm cơ sở xem xét phát sinh với khách hàng.

**Chi phí vượt dự kiến**
`= phần KL thực sự vượt × Giá mua dự kiến tại từng lần đặt`

Chi phí vượt được tính theo đúng thứ tự các phiếu được duyệt, nên khi một phiếu chỉ có một phần vượt Baseline thì chỉ phần vượt mới tính vào chi phí tăng.

### 6. Đầu mục ngoài BOQ

Khi công trường yêu cầu vật tư không tồn tại trong Baseline:

- Chọn `+ ĐẦU MỤC NGOÀI BOQ`.
- Nhập mô tả/spec/ĐVT.
- Giá chào dự kiến.
- Giá mua dự kiến.
- Lý do.

Toàn bộ khối lượng này được cảnh báo là phát sinh ngoài BOQ.

### 7. Lý do vượt

Các lý do chuẩn:

- Thay đổi thiết kế.
- BOQ thiếu.
- Khách hàng yêu cầu bổ sung.
- Điều kiện thực tế công trường.
- Hao hụt thi công.
- Thi công sai / làm lại.
- Khác.

### 8. Tạo Variation / VO

Dòng vượt BOQ hoặc ngoài BOQ có nút **Tạo VO**.

Hệ thống tự tạo Variation nháp trong:

`Tài chính dự án → Phát sinh`

với giá trị dựa trên phần tăng theo giá chào BOQ.

### 9. Dashboard Giám đốc

Dashboard tự cộng:

- Số đầu mục vượt BOQ.
- Giá trị vượt BOQ.

Nếu dự án có khối lượng vượt, cảnh báo này được đưa vào sức khỏe dự án và có thể làm dự án chuyển sang **ĐỎ** để quản lý xử lý.

### Firebase mới

- `/v2/quantityBaseline/{projectId}/{boqItemId}`
- `/v2/quantityBaselineMeta/{projectId}`
- `/v2/orderRequests/{projectId}/{requestId}`
- `/v2/quantityAudit/{projectId}/{auditId}`

## Nâng cấp V2.6 — Chuẩn hóa tài chính + Dashboard Giám đốc

V2.6 tập trung sửa logic quản trị thay vì mở thêm nhiều menu.

### 1. Sửa Forecast Cost và lợi nhuận ảo

Logic mới:

`Forecast hiệu lực = MAX(Forecast kế hoạch, Actual Cost + PO còn cam kết)`

- Nếu Forecast của một Budget để 0, hệ thống mặc định lấy Budget.
- Actual Cost liên kết với PO sẽ tự giảm phần PO còn cam kết.
- Forecast không thể thấp hơn phần chi phí đã thực tế phát sinh + phần PO chưa thành Actual.
- Chấm dứt tình trạng Budget > 0 nhưng Forecast = 0 và lợi nhuận dự kiến = 100%.

### 2. PO → Actual Cost

Khi ghi nhận chi phí thực tế có thể chọn PO liên quan.

Hệ thống tự lấy:
- NCC.
- Nội dung.
- Giá trị tham khảo.
- Số PO.

Liên kết này giúp không cộng trùng:
`PO cam kết + hóa đơn thực tế của cùng PO`.

### 3. Dashboard Giám đốc

Dashboard có **Bảng điều hành Giám đốc**:

- Tổng giá trị hợp đồng.
- Forecast Cost.
- Lợi nhuận dự kiến.
- Phải thu.
- Số dự án Đỏ.
- Số dự án Vàng.

Mỗi dự án tự đánh giá:

- **XANH**: trong ngưỡng kiểm soát.
- **VÀNG**: cần theo dõi.
- **ĐỎ**: cần can thiệp.

Cảnh báo dựa trên:
- Forecast lỗ.
- Forecast vượt Budget.
- Công nợ khách hàng quá hạn.
- Tiến độ dự án trễ.
- Công việc quá hạn.
- Hồ sơ kỹ thuật trễ.
- Vật tư trễ.

### 4. Cash Flow 6 tháng

Tự dự báo theo tháng từ:
- Công nợ khách hàng đến hạn.
- Công nợ NCC đến hạn.
- PO còn cam kết chưa thành Actual.
- Điều chỉnh thu/chi thủ công.

Hiển thị:
- Thu dự kiến.
- Chi dự kiến.
- Net Cash Flow tháng.
- Số dư dự kiến.
- Cảnh báo số dư âm.

### 5. Nghiệm thu → Hóa đơn → Thu tiền

Billing V2.6 tách rõ:

`Giá trị nghiệm thu`
`- Giữ lại bảo hành`
`- Thu hồi tạm ứng`
`= Giá trị đủ điều kiện xuất trước VAT`
`+ VAT`
`= Tổng hóa đơn`

Theo dõi riêng:
- Giá trị đã nghiệm thu.
- Giữ lại bảo hành.
- Thu hồi tạm ứng.
- Giá trị đã xuất hóa đơn.
- Đã thu.
- Còn phải thu.

### 6. Audit Log tài chính

Tự lưu lịch sử:
- Sửa hợp đồng.
- Sửa Budget / Forecast.
- Tạo/sửa chi phí.
- Thanh toán NCC.
- Tạo/sửa/duyệt Variation.
- Tạo/sửa hóa đơn.
- Thu tiền khách hàng.
- Điều chỉnh Cash Flow.

Mỗi log lưu:
- Người thao tác.
- Thời điểm.
- Loại dữ liệu.
- Dữ liệu trước.
- Dữ liệu sau.

### 7. Sửa cache giao diện

CSS và JavaScript đều dùng version `2.6.0`.
Khi nâng cấp sẽ hạn chế trường hợp GitHub đã có code mới nhưng trình duyệt vẫn hiển thị CSS/JS cũ.

### Firebase mới
- `/v2/cashFlowPlans/{projectId}/{YYYY-MM}`
- `/v2/financeAudit/{projectId}/{auditId}`

## Nâng cấp V2.5 — Tài chính dự án

Thêm menu **Tài chính dự án** theo vòng đời:

`Giá trị hợp đồng → Budget → PO/Chi phí → Phát sinh → Xuất hóa đơn → Thu tiền → Lợi nhuận`

### 1. Hợp đồng & Budget
- Giá trị hợp đồng gốc trước VAT.
- VAT, ngày ký, hạn hợp đồng, tạm ứng, giữ lại bảo hành.
- Giá trị hợp đồng tự lấy mặc định từ giá đã duyệt/trúng thầu.
- Phát sinh đã duyệt tự cộng/trừ để ra **HĐ điều chỉnh**.
- Nút **Tạo Budget từ BOQ**:
  - Vật tư.
  - Nhân công.
  - Thầu phụ.
  - Chi phí khác.
  - Chi phí chung.
  - Dự phòng.
- Mỗi Budget có **Budget Amount** và **Forecast Cost**.

### 2. PO / Cam kết chi phí
- Hệ thống đọc trực tiếp dữ liệu PO từ module **Triển khai → Vật tư & Mua hàng**.
- Tự tổng hợp giá trị PO đang cam kết.

### 3. Chi phí thực tế & Công nợ NCC
- Ngày ghi nhận.
- Nhóm chi phí.
- Hệ thống.
- NCC / Thầu phụ.
- Nội dung.
- Số hóa đơn / chứng từ.
- Giá trị trước VAT.
- VAT.
- Hạn thanh toán.
- Ghi nhận nhiều lần thanh toán cho cùng một chứng từ.
- Tự tính:
  - Tổng phải trả.
  - Đã trả.
  - Còn nợ.
  - Khoản quá hạn.

### 4. Phát sinh / Variation
- Phát sinh tăng hoặc giảm.
- Trạng thái Nháp / Đã trình / Đã duyệt / Từ chối.
- Chỉ phát sinh **Đã duyệt** mới làm thay đổi giá trị hợp đồng.
- Có ngày duyệt và tham chiếu CĐT.

### 5. Xuất hóa đơn & Thu tiền
- Số hóa đơn / đợt.
- Ngày xuất.
- Hạn thanh toán.
- Giá trị trước VAT.
- VAT.
- Ghi nhận nhiều lần thu tiền.
- Tự tính:
  - Đã xuất hóa đơn.
  - Đã thu.
  - Còn phải thu.
  - Hóa đơn quá hạn.

### 6. Hiệu quả dự án
Tự tính:
- HĐ điều chỉnh.
- Budget.
- PO cam kết.
- Actual Cost.
- Forecast Cost.
- Forecast Profit.
- Forecast Margin %.
- Phải thu khách hàng.
- Phải trả NCC.
- Dòng tiền ròng đã thu - đã trả.

Dashboard cũng có thêm **Tài chính danh mục dự án** cho Giám đốc/Quản lý.

### Dữ liệu Firebase mới
- `/v2/financeSettings/{projectId}`
- `/v2/budgets/{projectId}/{id}`
- `/v2/actualCosts/{projectId}/{id}`
- `/v2/supplierPayments/{projectId}/{id}`
- `/v2/variations/{projectId}/{id}`
- `/v2/billings/{projectId}/{id}`
- `/v2/receipts/{projectId}/{id}`

## Nâng cấp V2.4 — Quản lý triển khai sau khi trúng thầu

Module **Triển khai** được xây lại theo luồng:

`Trúng thầu → Bàn giao Tender → Kỹ thuật → Hồ sơ kỹ thuật → Vật tư/Mua hàng → Thi công → Nghiệm thu → Hoàn thành`

### 1. Bàn giao Tender → Kỹ thuật

Checklist 8 nội dung:
- Phạm vi hợp đồng.
- BOQ / Giá trúng thầu.
- Clarification / Exclusion.
- Báo giá NCC / Thầu phụ.
- Cơ sở thiết kế / Spec / Tiêu chuẩn.
- Liên hệ CĐT / TVGS / Tổng thầu.
- Yêu cầu tiến độ hợp đồng.
- Điều kiện thương mại cần lưu ý.

Có người bàn giao, người nhận, ngày bàn giao, link thư mục hồ sơ và ghi chú.

### 2. Hồ sơ kỹ thuật

Theo dõi:
- Shopdrawing.
- Material Submission.
- RFI.
- Biện pháp thi công.
- Hồ sơ khác.

Mỗi hồ sơ có mã, hệ, revision, người phụ trách, deadline, ngày trình, trạng thái và comment.

Trạng thái:
- Đang chuẩn bị.
- Đã trình.
- Yêu cầu sửa.
- Đã duyệt.

### 3. Vật tư & Mua hàng

Theo dõi:
- Hạng mục.
- Hệ thống.
- NCC.
- Số PO.
- Giá trị.
- Ngày cần tại công trường.
- Ngày PO.
- Ngày dự kiến giao.
- Trạng thái giao hàng.

Cảnh báo tự động nếu quá ngày cần mà vật tư chưa về.

### 4. Thi công & Nghiệm thu

Theo dõi:
- Mốc/công việc.
- Nhóm.
- Người phụ trách.
- Ngày bắt đầu.
- Deadline.
- % tiến độ.
- Trạng thái.
- Vướng mắc.
- Kết quả nghiệm thu / Biên bản.

Có nút **Tạo bộ mốc triển khai** tự sinh 8 mốc chuẩn từ Kickoff đến ngày mục tiêu.

### Dữ liệu mới

- `/v2/handover/{projectId}`
- `/v2/executionDocs/{projectId}/{id}`
- `/v2/procurement/{projectId}/{id}`
- `/v2/milestones/{projectId}/{id}`

## Nâng cấp V2.3 — Giao việc & Tiến độ

Đã bổ sung module **Giao việc & Tiến độ**:

- Giao việc theo dự án hoặc công việc chung.
- Chọn người phụ trách từ danh sách người dùng V2.
- Nhóm công việc: kiểm tra hồ sơ, BOQ, RFQ, lập giá, trình duyệt, nộp thầu, kỹ thuật, vật tư, thi công...
- Ngày bắt đầu và deadline.
- Ưu tiên: Thấp / Bình thường / Cao / Khẩn cấp.
- Trạng thái: Chưa thực hiện / Đang thực hiện / Đang vướng / Hoàn thành.
- % hoàn thành.
- Ghi rõ vướng mắc và hành động tiếp theo.
- Kanban 4 cột và chế độ danh sách.
- Cảnh báo công việc quá hạn.
- Lọc theo dự án, nhân viên, trạng thái, ưu tiên.
- Nút **Tạo bộ việc đấu thầu** tự sinh 6 mốc:
  1. Kiểm tra hồ sơ.
  2. Bóc / rà BOQ.
  3. RFQ / hỏi giá.
  4. Tổng hợp & lập giá.
  5. Trình duyệt.
  6. Nộp thầu.
- Deadline 6 mốc được chia tự động từ ngày hiện tại đến hạn nộp thầu.
- Dashboard hiển thị việc quá hạn, việc đang vướng và việc của người đang đăng nhập.
- Báo cáo tuần/tháng có nút **Tự tổng hợp từ Giao việc**:
  - Việc đã hoàn thành.
  - Việc đang thực hiện.
  - Kế hoạch tiếp theo.
  - Vướng mắc.
  - Việc quá hạn.
- Nhân viên có thể cập nhật công việc được giao cho chính mình.
- Role VIEWER chỉ được xem.

Dữ liệu mới:

- `/v2/tasks/{taskId}`

## Nâng cấp V2.2

Đã bổ sung module **BOQ & Lập giá**:

- Chọn dự án và quản lý BOQ theo từng dòng.
- Các trường: hệ thống, nhóm, mô tả, spec, ĐVT, khối lượng.
- Chi phí: vật tư, nhân công, thầu phụ, chi phí khác.
- Hao hụt %.
- Markup %.
- Tự tính NET/ĐVT, giá chào/ĐVT, thành tiền NET, thành tiền chào.
- Tổng giá NET, tổng giá chào, lợi nhuận gộp và tỷ lệ lợi nhuận.
- So sánh nhiều báo giá nhà cung cấp cho từng dòng BOQ.
- Lưu hãng, lead time, điều khoản thanh toán, hiệu lực báo giá.
- Chọn một báo giá → tự cập nhật giá vật tư vào dòng BOQ.
- Xuất BOQ CSV.
- Tải mẫu CSV và nhập BOQ hàng loạt từ CSV.
- Khi trình duyệt giá, hệ thống tự lấy tổng từ BOQ.
- Hồ sơ trình giá lưu snapshot BOQ tại thời điểm trình để về sau đối chiếu.
- Siết Database Rules: Đấu thầu/Trưởng phòng không thể tự đổi trạng thái hồ sơ sang APPROVED/REJECTED; quyền quyết định thuộc Giám đốc/Admin.

Dữ liệu mới:

- `/v2/boq/{projectId}/{itemId}`
- `/v2/supplierQuotes/{projectId}/{itemId}/{quoteId}`


### Nâng cấp mới V2.2

- Sửa cache/route: bấm **BOQ & Lập giá** sẽ mở đúng module, kể cả sau khi GitHub Pages vừa cập nhật.
- Chi phí chung dự án %.
- Dự phòng / Contingency %.
- Chiết khấu giá chào %.
- VAT %.
- Tách rõ NET trực tiếp, tổng chi phí dự án, giá chào trước VAT và tổng sau VAT.
- Ma trận so sánh NCC: vật tư theo hàng, nhà cung cấp theo cột, đánh dấu giá thấp nhất và giá đang chọn.
- Lưu nhiều phiên bản BOQ dạng snapshot bất biến.
- Xem chi tiết từng phiên bản và khôi phục phiên bản cũ.
- Khi trình Giám đốc, hệ thống tự tạo một snapshot BOQ và gắn vào hồ sơ phê duyệt.
- Hồ sơ duyệt lưu thêm VAT và tổng giá sau VAT.

Dữ liệu mới:
- `/v2/pricingSettings/{projectId}`
- `/v2/boqVersions/{projectId}/{versionId}`

## Chức năng đã có

- Đăng nhập Firebase Authentication.
- Dashboard quản trị.
- Danh mục dự án.
- Pipeline đấu thầu.
- BOQ & Lập giá chi tiết.
- So sánh báo giá nhiều nhà cung cấp.
- RFQ / Hỏi giá nhà cung cấp.
- Trình giá nhiều phiên bản.
- Giám đốc duyệt / từ chối giá.
- Trúng thầu → bàn giao kỹ thuật.
- Theo dõi triển khai và % tiến độ.
- Báo cáo tuần / tháng.
- Người dùng & phân quyền.
- Nhật ký hoạt động.
- Responsive cho laptop/màn hình nhỏ.

## Dữ liệu V2

Dữ liệu mới lưu riêng dưới:

- `/v2/users`
- `/v2/projects`
- `/v2/rfqs`
- `/v2/boq`
- `/v2/supplierQuotes`
- `/v2/pricingSettings`
- `/v2/boqVersions`
- `/v2/approvals`
- `/v2/execution`
- `/v2/reports`
- `/v2/activities`
- `/v2/tasks`

Dữ liệu cũ không bị ghi đè.

## Cách thay web cũ trên GitHub

1. Backup repo cũ nếu cần.
2. Xóa nội dung cũ trên branch `main`.
3. Copy TOÀN BỘ file/thư mục của bộ V2 này lên root repo.
4. Commit + Push.
5. Nếu GitHub Pages đang chạy `main / root` thì trang V2 sẽ được publish.

## Firebase

Bản này dùng lại Firebase project hiện tại và tài khoản Authentication cũ.

Admin bootstrap:
`lamtd9798@gmail.com`

Tài khoản khác đăng nhập lần đầu sẽ tự tạo profile V2 với role `EMPLOYEE`.
Admin vào **Người dùng & phân quyền** để đổi role.

Role:
- ADMIN
- DIRECTOR
- MANAGER
- TENDER
- PROCUREMENT
- TECHNICAL
- EMPLOYEE
- VIEWER

## QUAN TRỌNG: Database Rules

Upload `database.rules.json` lên GitHub KHÔNG làm rules Firebase thay đổi.

Cần vào:
Firebase Console → Realtime Database → Rules

Sau đó copy nội dung `database.rules.json` và Publish.

Nếu hệ thống V1 vẫn cần chạy tạm, hãy backup rules cũ trước khi thay.

## Chạy local

Không mở `index.html` bằng `file://` vì JavaScript dùng ES Modules.
Dùng VS Code Live Server hoặc GitHub Pages.

## Hướng phát triển tiếp theo

- File upload báo giá/hồ sơ.
- Material/Shopdrawing register.
- Task & Gantt.
- PO/Mua hàng.
- Nghiệm thu/khối lượng/thanh toán.
- Export Excel/PDF.
