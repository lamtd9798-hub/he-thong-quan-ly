# HOTFIX V2.18.2 — XỬ LÝ DỨT ĐIỂM PERMISSION_DENIED

## Nguyên nhân V2.18.1 vẫn lỗi

V2.18.1 vẫn đặt metadata BOQ và kho file giá dưới `pricingSettings/{projectId}`.
Nếu Firebase Rules đang publish không cấp quyền vùng này, thao tác vẫn trả `PERMISSION_DENIED`.

## Cách V2.18.2 sửa

Không dùng `pricingSettings` cho module Lập giá nữa.

Toàn bộ dữ liệu mới được lưu dưới vùng BOQ vốn đang hoạt động:

`/v2/boq/{projectId}/__PRICING_DATA__/boqImportMeta`

`/v2/boq/{projectId}/__PRICING_DATA__/materialPriceImports/{importId}`

Nhánh `__PRICING_DATA__` bị ẩn khỏi danh sách vật tư nên không tạo dòng BOQ giả.

Khi thay BOQ, hệ thống chỉ xóa các dòng vật tư thật và giữ nguyên `__PRICING_DATA__`.

Không cần sửa Firebase Rules để dùng V2.18.2 nếu BOQ hiện tại đã đọc/ghi được.
