# NÂNG CẤP V2.18.2 → V2.19

## Mục tiêu

V2.19 sửa lại hoàn toàn cách hiển thị BOQ trong `Lập giá đấu thầu`.

Bản cũ biến BOQ thành bảng dữ liệu mới gồm Mục / Diễn giải / Model / ĐVT / Khối lượng / Giá vật tư / Nguồn giá / Trạng thái. Cách này không giữ nguyên hình dạng BOQ.

V2.19 đổi thành:

`Upload BOQ → giữ nguyên Sheet BOQ gốc → lập giá ngay trên đúng bảng đó`.

## BOQ gốc

Tab `1. BOQ` hiển thị lại:
- đúng thứ tự dòng;
- đúng cột A → K;
- ô merge;
- nội dung tiêu đề dự án;
- GHI CHÚ CHUNG;
- hệ thống / khu vực / đầu mục;
- độ rộng cột;
- chiều cao dòng;
- một phần style Excel.

Không dựng thêm bảng 8 cột quản lý.

## Ô được nhập trực tiếp

Hệ thống tự nhận cột:
- `Khối lượng`;
- `Đơn giá (VND) / Vật tư chính`.

Tại các dòng vật tư, đúng hai ô này trở thành input ngay trong BOQ gốc.

Khi người dùng nhập giá bằng tay, giá được lưu vào BOQ item như cũ.

Khi hệ thống ráp giá từ file NCC, giá cũng đổ vào đúng ô `Vật tư chính` của BOQ gốc.

Nếu giá có nguồn NCC, bên cạnh ô giá có chấm xanh để mở chi tiết nguồn giá.

## Nhận diện BOQ

V2.19 tăng độ ổn định của parser:
- chọn cột Diễn giải dựa trên dữ liệu text thật phía dưới;
- chọn Khối lượng dựa trên dữ liệu số;
- ưu tiên đúng `Vật tư chính` và `Nhân công` trong tiêu đề 2 tầng;
- tránh trường hợp có Mục nhưng Diễn giải bị trống như V2.18.2.

## BOQ đã nhập bằng bản cũ

BOQ đã nhập trước V2.19 chưa có snapshot Sheet gốc.

Sau khi cập nhật, tab BOQ sẽ yêu cầu:
`Thay BOQ`

Chọn lại đúng file Excel và Sheet. Sau lần này hệ thống lưu `sourceGrid` để hiển thị nguyên BOQ.

## Firebase

Không cần thay Firebase Rules.
Dữ liệu Sheet gốc được lưu bên trong:
`/v2/boq/{projectId}/__PRICING_DATA__/boqImportMeta/sourceGrid`
