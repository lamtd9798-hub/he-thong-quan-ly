# NÂNG CẤP TỪ V2.3 LÊN V2.4

## 1. Copy code lên GitHub

Giải nén `he-thong-quan-ly-v2.4-full.zip`.

Copy đè TOÀN BỘ nội dung bên trong lên root repo GitHub.

Khi đúng bản mới, góc trái hiện:

`Company Hub · V2.4`

## 2. Firebase Rules — BẮT BUỘC

Vào:

Firebase Console → Realtime Database → Quy tắc / Rules

Ctrl+A xóa rules cũ → dán toàn bộ:

`FIREBASE_RULES_V2.4_COPY.txt`

→ Xuất bản / Publish.

## 3. Test nhanh

1. Vào một dự án đấu thầu.
2. Chuyển trạng thái sang `Trúng thầu`.
3. Bấm `Bàn giao`.
4. Mở menu `Triển khai`.
5. Chọn dự án.
6. Cập nhật PM, Kickoff, ngày mục tiêu.
7. Mở tab `Bàn giao Tender → Kỹ thuật` và tick checklist.
8. Thêm 1 Shopdrawing.
9. Thêm 1 vật tư/PO.
10. Bấm `Tạo bộ mốc triển khai`.
11. Kiểm tra cảnh báo deadline.

## 4. Nhánh Firebase mới

- `/v2/handover`
- `/v2/executionDocs`
- `/v2/procurement`
- `/v2/milestones`

Dữ liệu các phiên bản trước vẫn giữ nguyên.
