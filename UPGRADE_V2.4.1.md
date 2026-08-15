# HOTFIX V2.4.1

Sửa lỗi `permission_denied at /v2/users`.

Nguyên nhân:
V2.4 vô tình để `.read` ở bên trong `$uid`, trong khi các module:
- Giao việc & Tiến độ
- Triển khai
- Người dùng & phân quyền

đều cần đọc toàn bộ danh sách `/v2/users`.

## Cách cập nhật

1. Copy đè toàn bộ source V2.4.1 lên GitHub.
2. Firebase Console → Realtime Database → Quy tắc / Rules.
3. Ctrl+A xóa Rules cũ.
4. Dán toàn bộ `FIREBASE_RULES_V2.4.1_COPY.txt`.
5. Bấm Xuất bản / Publish.
6. Quay lại web → Ctrl+F5.

Khi đúng bản mới, góc trái sẽ hiện:
`Company Hub · V2.4.1`
