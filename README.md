# Hải Sản Cảng Phan Thiết · Cổng điều hành nội bộ

Website nội bộ quản lý đơn hàng, khách hàng, doanh số và công việc của công ty kinh doanh hải sản.

## Chức năng chính

- Đăng nhập riêng cho từng nhân sự.
- Giám đốc xem và chỉnh sửa toàn bộ đơn hàng; nhân viên chỉ chỉnh sửa đơn hàng do mình phụ trách hoặc tạo.
- Theo dõi đơn hàng/cơ hội bán theo 4 giai đoạn: Khách mới, Đang báo giá, Sắp chốt, Đã chốt đơn.
- Một đơn hàng có thể gồm nhiều loại hải sản; mỗi dòng nhập số lượng theo đơn vị của sản phẩm.
- Đơn giá tự lấy từ giá bán hiện tại trong Kho hàng, tự tính thành tiền từng dòng và cộng tổng giá trị đơn hàng.
- Giá bán và ngày chốt giá được lưu theo từng dòng, vì vậy việc đổi giá trong Kho hàng sau này không làm thay đổi đơn hàng cũ.
- Tách riêng tên khách hàng, số điện thoại, loại khách hàng và kênh bán hàng trên mỗi báo giá/đơn hàng.
- Lưu khu vực giao hàng/địa chỉ gồm phường, xã, thành phố hoặc tỉnh trên đơn hàng và Data khách hàng.
- Tự động tạo Data khách hàng khi lưu báo giá hoặc đơn hàng mới.
- Xuất toàn bộ Data khách hàng thành tệp Excel ngay trong menu Data khách hàng.
- Ghi chính xác ngày và giờ khách hàng được tự động lưu vào Data khách hàng.
- Nhận diện khách cũ khi trùng cả tên và số điện thoại; hiển thị số lần khách quay lại ngay trên biểu mẫu.
- Thư mục Hợp đồng liên kết với đơn hàng, khách hàng và Sales phụ trách.
- Khi đơn hàng chuyển sang `Hoàn thành`, hệ thống tự tạo hợp đồng `Chờ duyệt`; các đơn đã hoàn thành trước đó cũng được tự bổ sung nếu chưa có hợp đồng.
- Hợp đồng ghi rõ người bán được tính là Sales hay Giám đốc theo người được phân công trên đơn hàng.
- Doanh số chỉ được ghi nhận khi Giám đốc duyệt hợp đồng sang trạng thái `Đã ký`; hệ thống tự cộng cho người bán được phân công trên đơn hàng.
- Bảng tổng hợp doanh số theo từng Sales và lịch sử hợp đồng của từng khách hàng.
- Menu Kênh bán hàng riêng, có thể chọn từng tháng để xem số khách, số đơn/báo giá, giá trị dự kiến, hợp đồng đã ký và doanh số thực tế của từng kênh.
- Xếp hạng kênh hiệu quả nhất theo doanh số hợp đồng đã ký trong tháng: Trực tiếp, Facebook, Zalo, TikTok, khách giới thiệu, khách cũ quay lại, điện thoại và các kênh khác.
- Danh mục hải sản gợi ý: cá nục, cá bạc má, cá ngừ, cá thu, mực ống, mực trứng, bạch tuộc, ghẹ, tôm và combo hải sản.
- Hệ thống tự bổ sung sẵn 10 mặt hàng chính nếu Kho đang thiếu: cá nục, cá bạc má, cá bã trầu, cá ngừ, cá thu, bạch tuộc, mực ống, mực trứng, mực khô và mực 1 nắng.
- Mặt hàng được bổ sung có giá ban đầu bằng 0 và được đánh dấu “Cần cập nhật giá bán”; cần nhập giá trong Kho hàng trước khi đưa vào đơn.
- Quản lý xuất kho, nhập kho, điều chỉnh tăng/giảm và tự động tính tồn kho.
- Theo dõi giá nhập, giá bán, lãi dự kiến và giá trị hàng tồn.
- Phân loại hàng bán chạy, bán chậm theo lượng xuất trong 30 ngày.
- Tự đề xuất số lượng nên nhập dựa trên sức bán, tồn hiện tại và mức tồn tối thiểu.
- Hàng hết được tô đỏ, hàng sắp hết được tô vàng.
- Thiết lập tháng béo ngon nhất và ghi chú mùa vụ cho từng loại hải sản.
- Báo cáo công việc, kế hoạch tuần, công văn đi/đến, lịch họp, lịch hẹn và công tác.
- Thông báo việc sắp đến hạn hoặc đã quá hạn.
- Quản lý vai trò: Giám đốc, Admin, Sales, Kế toán, Hành chính.
- Bắt buộc đổi mật khẩu tạm trong lần đăng nhập đầu tiên; mật khẩu tối thiểu 10 ký tự và phải có chữ lẫn số.
- Giám đốc/Admin có thể đặt lại mật khẩu, khóa hoặc mở khóa tài khoản; thao tác khóa sẽ đăng xuất tài khoản đó khỏi mọi thiết bị.
- Nhật ký hệ thống ghi người thực hiện, thời gian và nội dung thêm, sửa, xóa, duyệt hợp đồng, quản lý tài khoản và sao lưu.
- Dữ liệu nghiệp vụ được tự động sao lưu mỗi ngày, lưu 30 ngày; Giám đốc/Admin có thể tạo bản thủ công và tải tệp JSON về máy.

Giám đốc, Admin và Kế toán được cập nhật kho. Sales và Hành chính được xem dữ liệu kho nhưng không được tạo phiếu.

## Phân quyền và an toàn tài khoản

- **Giám đốc:** toàn quyền; sửa hoặc xóa mọi báo giá hết hiệu lực và đơn hàng chưa có hợp đồng ký, duyệt hợp đồng, phân quyền, đặt lại mật khẩu, khóa tài khoản, xem nhật ký và sao lưu.
- **Admin:** quản trị vận hành, kho, tài khoản thường, nhật ký và sao lưu; không được tạo, khóa hoặc thay đổi tài khoản Giám đốc.
- **Sales:** tạo, sửa và xóa đơn/báo giá do mình tạo hoặc được phân công khi nhập nhầm; không được xóa dữ liệu của người khác hoặc đơn đã có hợp đồng ký.
- **Kế toán:** xem đơn hàng, tạo hợp đồng chờ duyệt và cập nhật kho; không được sửa đơn hàng của người khác.
- **Hành chính:** báo cáo, kế hoạch, công văn và lịch; không được sửa đơn hàng của người khác.

Hệ thống không xóa tài khoản nhân viên nghỉ việc. Giám đốc/Admin dùng chức năng **Khóa tài khoản** để giữ nguyên lịch sử nhưng chặn đăng nhập.

## Sao lưu

- Bản sao lưu ứng dụng được tạo tự động khi có lượt sử dụng đầu tiên trong ngày.
- Chỉ lưu dữ liệu nghiệp vụ và thông tin tài khoản không nhạy cảm; không xuất mật khẩu hoặc phiên đăng nhập.
- Bản lưu cũ hơn 30 ngày được tự xóa.
- Trước khi nhập dữ liệu lớn hoặc thay đổi quan trọng, vào **Sao lưu dữ liệu → Sao lưu ngay**, sau đó tải tệp về máy công ty.
- Bản sao lưu này bảo vệ trước thao tác nhầm. Khi nâng cấp Railway, cần bật thêm sao lưu PostgreSQL của Railway để phục hồi khi toàn bộ dịch vụ hoặc ổ đĩa gặp sự cố.

## Quy định tên miền

- Tên miền phải đăng ký bằng tên công ty hoặc Giám đốc.
- Email quản lý tên miền phải là email do công ty kiểm soát; bật xác thực hai bước và tự động gia hạn.
- Không giao quyền sở hữu tên miền cho nhân viên hoặc đơn vị thiết kế website.

## Quy tắc khách hàng và hợp đồng

- Một khách hàng được nhận diện bằng cặp `Tên khách hàng + Số điện thoại` sau khi hệ thống chuẩn hóa cách viết.
- Trước khi tạo đơn hàng, cần khai báo sản phẩm và giá bán trong Kho hàng. Tổng tiền đơn hàng không nhập thủ công mà do hệ thống tự tính.
- Lần đầu lưu là khách mới. Mỗi báo giá/đơn hàng mới có cùng tên và số điện thoại sẽ được ghi nhận là quay lại lần 1, lần 2, lần 3...
- Sales chỉ được tạo hợp đồng từ đơn hàng của mình. Admin và Kế toán có thể nhập hợp đồng; chỉ Giám đốc được duyệt, sửa trạng thái hoặc hủy.
- Hợp đồng `Chờ duyệt` chưa được tính doanh số. Hợp đồng `Đã ký` mới được cộng vào doanh số của Sales phụ trách.

## Triển khai trên Railway

1. Kết nối repository GitHub với Railway.
2. Thêm dịch vụ PostgreSQL trong cùng project Railway.
3. Trong dịch vụ website, tạo biến `DATABASE_URL` và chọn tham chiếu `DATABASE_URL` của PostgreSQL.
4. Build command: `npm run build`
5. Start command: `npm run start`
6. Deploy lại dịch vụ.

Lần đầu mở website, hệ thống sẽ yêu cầu tạo tài khoản Giám đốc. Tài khoản này có toàn quyền quản trị.
