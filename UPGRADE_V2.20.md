# V2.20 — BOQ PRICING WORKSPACE

## Mục tiêu

V2.20 đổi module “Lập giá đấu thầu” từ nhiều bảng/tab sang một màn hình BOQ duy nhất.

Quy trình:

1. Tải BOQ gốc `.xlsx`.
2. Hệ thống tự tìm Sheet `CTG` hoặc `CTC`.
3. Match `BOQ Code` với `CTG/CTC cột B` và tự lấy nhân công ở `cột T`.
4. Khi nhận báo giá vật tư, bấm `+ Thêm báo giá` và chọn file. File được tự đọc, lưu vào Kho giá và tự ráp các dòng khớp >=95% mà không có bước xác nhận thêm.
5. Các dòng khớp 78–94% chỉ nằm trong `Cần kiểm tra`; dòng chưa có ứng viên được đánh dấu riêng.
6. Làm việc trực tiếp trên spreadsheet BOQ.
7. `Xuất Excel` lấy lại chính file `.xlsx` gốc và chỉ ghi các ô đã thay đổi vào Sheet BOQ, nhằm giữ nguyên các sheet khác, hình thức, merge, ảnh/logo, thiết lập in... của file ban đầu.

## Nhân công CTG/CTC

- Code nguồn: cột B.
- Nhân công nguồn: cột T.
- Với template hiện tại, hệ thống đọc B1/D1/D2/D3 để biết Sheet BOQ và các cột Diễn giải/ĐVT/Khối lượng.
- Chỉ tự điền nhân công cho đầu mục có khối lượng làm giá > 0.
- Nếu BOQ mẫu hiện tại thể hiện hệ số nhân công (ví dụ 1.30 ở phụ kiện thép), V2.20 suy luận hệ số từ giá mẫu và giữ lại hệ số đó.

## Báo giá vật tư

- Có thể tải từng file bất kỳ lúc nào.
- Chọn file xong là tự xử lý, không cần bấm thêm nút “Ráp giá”.
- >=95%: tự dùng nếu ô vật tư đang trống.
- 78–94%: đưa vào Cần kiểm tra.
- <78%: Chưa có giá.
- Kho giá tạo index theo Code/ĐVT để đối chiếu nhanh hơn.

## Xuất Excel giữ file gốc

File `.xlsx` gốc được lưu riêng dưới `boqVersions/{projectId}/__SOURCE_XLSX__`, là vùng Firebase đã có Rules trong hệ thống.

V2.20 dùng file gốc làm “template nguồn” và patch giá trị vào XML của chính workbook đó. Vì vậy không dựng lại workbook từ bảng HTML.

Lưu ý: để bảo toàn file gốc, chế độ xuất nguyên mẫu không cho phép xuất nếu đã thêm/xóa số hàng hoặc số cột so với BOQ ban đầu. Sửa nội dung/giá trên các ô hiện hữu vẫn xuất bình thường.

## Sau khi cập nhật

Với dự án đã nhập BOQ từ V2.19.x, bấm `Thay BOQ` và chọn lại file `.xlsx` gốc một lần để V2.20 lưu bản nguồn phục vụ xuất Excel nguyên mẫu và đọc CTG/CTC.

## Firebase Rules

Không cần thay Firebase Rules.
