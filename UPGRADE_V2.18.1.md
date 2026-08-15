# HOTFIX V2.18.1 — SỬA PERMISSION_DENIED

## Nguyên nhân đã kiểm tra

V2.18 tạo 2 node Firebase mới: `boqImportMeta` và `materialPriceImports`.
Một số máy vẫn bị `PERMISSION_DENIED` dù đã dán Rules, và import BOQ có thể ghi được dòng BOQ trước rồi lỗi ở bước lưu metadata.

V2.18.1 không còn phụ thuộc vào 2 node mới này.

Metadata BOQ và kho file giá được lưu dưới node đã có Rules ổn định từ các bản trước:

`/v2/pricingSettings/{projectId}/boqImportMeta`

`/v2/pricingSettings/{projectId}/materialPriceImports`

Vì vậy nếu V2.17/V2.18 hiện tại đã đăng nhập và dùng Lập giá được thì **không cần sửa Firebase Rules thêm**.

## Cập nhật

1. Copy đè toàn bộ V2.18.1 lên GitHub.
2. Chờ GitHub Pages cập nhật.
3. Ctrl + F5.
4. Góc trái phải hiện `Company Hub · V2.18.1`.
5. Tải BOQ lại và thử upload file báo giá.

V2.18.1 cũng đổi thông báo lỗi để nếu Firebase còn chặn thì biết rõ lỗi xảy ra ở metadata BOQ hay file giá.

---

# NÂNG CẤP V2.17 → V2.18

## 1. GitHub

Giải nén:
`he-thong-quan-ly-v2.18-full.zip`

Copy đè toàn bộ nội dung lên repository.

Sau khi GitHub Pages cập nhật, góc trái phải hiện:
`Company Hub · V2.18.1`

Nhấn:
`Ctrl + F5`

Menu cũ `BOQ & Lập giá` đổi thành:
`Lập giá đấu thầu`

## 2. Firebase Rules — CẦN CẬP NHẬT

V2.18 thêm:
- `/v2/boqImportMeta`
- `/v2/materialPriceImports`

Vào Firebase Console:
`Realtime Database → Quy tắc`

Copy toàn bộ nội dung file:
`FIREBASE_RULES_V2.18_COPY.txt`

Dán đè Rules hiện tại và bấm Publish/Xuất bản.

## 3. Test BOQ

Vào:
`Lập giá đấu thầu → 1. BOQ`

Bấm:
`Tải BOQ Excel / CSV`

Chọn BOQ gốc.

Hệ thống phải preview:
- Sheet được chọn.
- Dòng tiêu đề.
- Số dòng vật tư nhận được.

Sau khi nhập, có thể sửa trực tiếp:
- Khối lượng.
- Giá vật tư.

## 4. Test báo giá vật tư

Qua tab:
`2. Báo giá vật tư`

Bấm:
`Tải file giá vật tư`

Có thể chọn nhiều file cùng lúc.

Hệ thống phải hiển thị mỗi file với:
- Sheet tự chọn.
- Dòng tiêu đề.
- Số dòng giá đọc được.

## 5. Test ráp giá

Sau khi import giá, hệ thống tự áp dụng các dòng có độ khớp >=95%.

Qua tab:
`3. Ráp giá`

Kiểm tra:
- xanh: >=95%;
- cam: 78–94%;
- đỏ: chưa đủ tin cậy.

Các dòng cam phải có nút:
`Dùng giá`

## 6. Kiểm tra nguồn giá

Quay lại tab BOQ.

Dòng đã ráp giá phải hiện:
- NCC;
- tên file;
- Sheet;
- dòng nguồn.

Click vào nguồn giá để xem % khớp và lý do.

## 7. Giá nhân công

Chưa triển khai ở V2.18.
Sau khi phần giá vật tư chạy ổn, bước tiếp theo là upload BOQ mẫu giá nhân công và ráp vào cột Nhân công.
