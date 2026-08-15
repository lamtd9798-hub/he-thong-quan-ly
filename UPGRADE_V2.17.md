# NÂNG CẤP V2.16 → V2.17

## Mục tiêu

V2.17 tập trung làm BOQ nhìn chuyên nghiệp ngay khi mở, không cần người dùng tự chỉnh thủ công trước.

## 1. Tự cắt cột A → K

Theo yêu cầu, BOQ trên web chỉ giữ tối đa:

`A → K`

Các cột từ `L` trở đi không còn hiển thị.

Khi upload BOQ mới, dữ liệu từ cột L trở đi cũng không được lưu vào `sourceGrid` mới.

BOQ cũ đã upload trước V2.17 vẫn được tự cắt khi hiển thị.

## 2. Auto Layout cột

Khi mở BOQ, hệ thống tự nhận loại cột và đặt độ rộng phù hợp:

- Mục/Code: hẹp.
- Diễn giải: rộng.
- Đơn vị: hẹp.
- Khối lượng: vừa.
- KL riêng: vừa.
- Model/Thông số: rộng vừa.
- Nhãn hiệu/Xuất xứ: gọn.
- Đơn giá: gọn và đều.

Người dùng vẫn có thể:
- kéo mép cột;
- double-click AutoFit;
- dùng `Khôi phục độ rộng`.

`Khôi phục độ rộng` trong V2.17 trả về Auto Layout mới, không trả về kích thước xấu của bản cũ.

## 3. Tiêu đề BOQ

Hệ thống tự nhận hàng tiêu đề của BOQ.

Hàng tiêu đề chính:
- IN HOA;
- in đậm;
- căn giữa;
- nền xanh đậm;
- chữ trắng.

Hàng tiêu đề phụ:
- in đậm;
- căn giữa;
- nền xanh nhạt.

Các hàng mã/filter phụ như `0.2/1`, `T1/1` không còn bị nhận nhầm thành tiêu đề nếu không chứa từ khóa BOQ.

## 4. Tiêu đề lớn

Dòng:
`BẢNG KHỐI LƯỢNG CÔNG VIỆC`

được tự:
- in hoa;
- in đậm;
- căn giữa;
- tăng cỡ chữ;
- tô nền xanh nhạt.

## 5. Đầu mục lớn

Các dòng như:

`1.0 HỆ THỐNG CHỮA CHÁY...`
`1.1 Khu vực hầm`

được tự nhận và tô nền theo cấp.

Mục cấp cao có màu nổi hơn.
Mục cấp dưới dùng màu nhạt hơn để nhìn rõ phân cấp.

Các dòng vật tư như `1.101`, `1.102` không bị tô nhầm nếu có đơn vị/khối lượng.

## 6. Ghi chú

`GHI CHÚ CHUNG` được tô nền riêng.

Các dòng note phía dưới dùng chữ dịu hơn, nghiêng nhẹ để phân biệt với dòng vật tư.

## 7. Căn lề dữ liệu

- Mô tả: căn trái.
- ĐVT: căn giữa.
- Khối lượng: căn phải.
- Đơn giá: căn phải.
- Nhãn hiệu/Xuất xứ: căn giữa.

## 8. Kích thước cũ

V2.17 dùng khóa lưu layout mới.

Do đó kích thước cột đã lưu ở V2.15/V2.16 sẽ không làm BOQ mới tiếp tục xấu.

Sau khi người dùng chỉnh cột ở V2.17, hệ thống sẽ nhớ layout mới bình thường.

## Firebase

Không cần thay Firebase Rules nếu V2.16 đang chạy bình thường.
