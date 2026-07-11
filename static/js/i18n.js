(function () {
    'use strict';

    const STORAGE_KEY = 'mailSystemLanguage';
    const DEFAULT_LANG = 'zh';
    const SUPPORTED_LANGS = ['zh', 'en', 'vi'];
    const LANG_LABELS = {
        zh: '中文',
        en: 'English',
        vi: 'Tiếng Việt'
    };

    const dictionary = {
        en: {
            '语言': 'Language',
            '邮件查看系统': 'Mail Viewer System',
            '邮件管理系统': 'Mail Management System',
            '邮件查看系统后台管理': 'Mail viewer admin console',
            '管理员登录': 'Admin Login',
            '用户名': 'Username',
            '密码': 'Password',
            '登录': 'Log In',
            '退出登录': 'Log Out',
            '欢迎': 'Welcome',
            '首页': 'Home',
            '邮箱管理': 'Mailboxes',
            '代理池': 'Proxy Pool',
            '卡密管理': 'Card Keys',
            '卡密日志': 'Card Logs',
            '收件日志': 'Mail Logs',
            '系统设置': 'System Settings',
            '展开侧边栏': 'Expand sidebar',
            '收起菜单': 'Collapse menu',
            '展开菜单': 'Expand menu',
            '展开': 'Expand',
            '收起': 'Collapse',
            '切换主题': 'Switch theme',
            '切换到明亮模式': 'Switch to light mode',
            '切换到暗黑模式': 'Switch to dark mode',
            '显示密码': 'Show password',
            '隐藏密码': 'Hide password',
            '显示/隐藏密码': 'Show/hide password',

            '添加邮箱': 'Add Mailbox',
            '批量添加邮箱': 'Batch Add Mailboxes',
            '添加服务器地址': 'Add Server Address',
            '隐藏分组': 'Hide Groups',
            '显示分组': 'Show Groups',
            '分组管理': 'Group Management',
            '所有分组': 'All Groups',
            '未分组': 'Ungrouped',
            '暂无自定义分组': 'No custom groups',
            '显示列': 'Columns',
            '复制已选': 'Copy Selected',
            '搜索': 'Search',
            '清除': 'Clear',
            '搜索邮箱地址或服务器...': 'Search mailbox or server...',
            '序号ID': 'ID',
            '序号': 'No.',
            '分组': 'Group',
            '邮箱地址': 'Email Address',
            '服务器（收/发）': 'Server (IMAP/SMTP)',
            '添加时间': 'Created At',
            '备注': 'Notes',
            '操作': 'Actions',
            '编辑': 'Edit',
            '收件': 'Receive',
            '发件': 'Send',
            '测试': 'Test',
            '删除': 'Delete',
            '保存': 'Save',
            '取消': 'Cancel',
            '确定': 'OK',
            '确认': 'Confirm',
            '关闭': 'Close',
            '新增': 'Add',
            '批量删除': 'Batch Delete',
            '全选': 'Select All',
            '导入': 'Import',
            '导出': 'Export',
            '刷新': 'Refresh',
            '加载中...': 'Loading...',
            '正在加载...': 'Loading...',
            '暂无数据': 'No data',
            '暂无记录': 'No records',
            '暂无邮箱': 'No mailboxes',
            '暂无卡密日志': 'No card logs',
            '网络错误，请稍后重试': 'Network error, please try again later',
            '复制成功': 'Copied',
            '复制失败，请手动复制': 'Copy failed, please copy manually',
            '邮箱地址已复制': 'Email address copied',
            '已复制邮箱地址': 'Email address copied',
            '复制邮箱': 'Copy Mailbox',
            '请选择要复制的邮箱': 'Please select mailboxes to copy',

            '系统概览': 'System Overview',
            '快速操作': 'Quick Actions',
            '系统信息': 'System Info',
            '页面标题设置': 'Page Title Settings',
            '系统标题设置': 'System Title Settings',
            '管理员账号': 'Admin Account',
            '管理员列表': 'Admin List',
            '新增管理员': 'Add Admin',
            '重置密码': 'Reset Password',
            '当前管理员': 'Current Admin',
            '管理员万能秘钥': 'Admin Master Key',
            '万能秘钥': 'Master Key',
            '保存设置': 'Save Settings',

            '代理池管理': 'Proxy Pool',
            'HTTP代理': 'HTTP Proxy',
            'SOCKS5代理': 'SOCKS5 Proxy',
            '添加代理': 'Add Proxy',
            '批量添加代理': 'Batch Add Proxies',
            '代理地址': 'Proxy Address',
            '端口': 'Port',
            '状态': 'Status',
            '启用': 'Enable',
            '禁用': 'Disable',

            '卡密': 'Card Key',
            '生成卡密': 'Generate Key',
            '批量生成': 'Batch Generate',
            '使用次数': 'Uses',
            '剩余次数': 'Remaining',
            '过期时间': 'Expires At',
            '绑定邮箱': 'Bound Email',
            '回收站': 'Recycle Bin',
            '清空日志': 'Clear Logs',
            '保存定期清理': 'Save Cleanup',
            '保留天数(0关闭)': 'Retention days (0 off)',
            '卡密使用日志': 'Card Usage Logs',
            '邮件标题': 'Mail Subject',
            '使用者IP': 'User IP',
            '使用时间（北京时间）': 'Used At (Beijing Time)',
            '卡密绑定邮箱': 'Bound Email',

            '邮件查看': 'Mail Viewer',
            '卡密 / 管理员万能秘钥': 'Card Key / Admin Master Key',
            '请输入卡密或管理员万能秘钥': 'Enter a card key or admin master key',
            '设置后的万能秘钥可免卡密取件': 'A configured master key can fetch mail without a card key',
            '邮箱查询': 'Mailbox Query',
            '请输入邮箱地址 (例: user@example.com)': 'Enter email address (e.g. user@example.com)',
            '请输入邮箱地址，支持多个邮箱自动识别：user@example.com\ntest@example.com, demo@example.com': 'Enter email addresses. Multiple addresses are auto-detected:\nuser@example.com\ntest@example.com, demo@example.com',
            '每个邮箱收取': 'Per mailbox',
            '支持换行、逗号、空格、竖线等格式，会自动识别邮箱地址；默认每个邮箱查询 10 封。': 'Supports line breaks, commas, spaces, pipes, and more. Email addresses are detected automatically. Default is 10 mails per mailbox.',
            '收取封数': 'Mail count',
            '获取邮件': 'Fetch Mail',
            '获取中...': 'Fetching...',
            '邮箱文件夹': 'Mail Folders',
            '展开邮箱文件夹': 'Expand Mail Folders',
            '折叠邮箱文件夹': 'Collapse Mail Folders',
            '收件箱': 'Inbox',
            '垃圾箱': 'Trash',
            '正在获取邮件，请稍候...': 'Fetching mail, please wait...',
            '邮箱': 'Mailbox',
            '标题': 'Subject',
            '验证码': 'Code',
            '发件人': 'From',
            '收件人': 'To',
            '时间': 'Time',
            '暂无邮件': 'No mail',
            '返回邮件列表': 'Back to Mail List',
            '发件人:': 'From:',
            '收件人:': 'To:',
            '时间:': 'Time:',
            '图片内容': 'Images',
            '附件': 'Attachments',
            '下载': 'Download',
            '请输入邮箱地址': 'Please enter an email address',
            '单次最多支持 50 个邮箱，请分批查询': 'Up to 50 mailboxes are supported per query. Please split into batches.',
            '已检测到管理员登录状态，免卡密访问': 'Admin login detected. Card key is not required.',
            '您尚未登录管理员账户，请使用卡密或万能秘钥访问': 'You are not logged in as admin. Use a card key or master key to access mail.',
            '未获取到邮件': 'No mail was fetched',
            '请求失败': 'Request failed',
            '请输入有效的邮箱地址': 'Please enter a valid email address',
            '邮箱中暂无邮件': 'No mail in this mailbox',
            '获取邮件失败': 'Failed to fetch mail',
            '网络请求失败，请检查网络连接': 'Network request failed, please check your connection',
            '邮件获取成功': 'Mail fetched successfully',
            '附件下载已开始': 'Attachment download started',
            '附件下载失败': 'Attachment download failed',
            '未知': 'Unknown',
            '无主题': 'No subject',
            '（无主题）': '(No subject)',
            '(无主题)': '(No subject)',
            '(邮件内容为空)': '(Mail body is empty)',

            '批量复制': 'Batch Copy',
            '批量分组': 'Batch Group',
            '管理员：': 'Admin:',
            '当前分组：': 'Current Group:',
            '邮箱：': 'Mailboxes:',
            '已选：': 'Selected:',
            '选择': 'Select',
            '上级分组': 'Parent Group',
            '分组名称': 'Group Name',
            '输入分组名称': 'Enter group name',
            '添加分组': 'Add Group',
            '添加下级分组': 'Add Child Group',
            '编辑分组': 'Edit Group',
            '已选择邮箱': 'Selected Mailboxes',
            '目标分组': 'Target Group',
            '应用分组': 'Apply Group',
            '发送邮件': 'Send Mail',
            '昵称': 'Nickname',
            '收件人看到的发件人昵称（可选）': 'Sender nickname shown to recipients (optional)',
            '主题': 'Subject',
            '正文': 'Body',
            '邮件主题': 'Mail subject',
            '邮件正文': 'Mail body',
            '当前邮箱': 'Current Mailbox',
            '收取': 'Fetch',
            '封': 'messages',
            '收取邮件': 'Fetch Mail',
            '收件失败': 'Fetch Failed',
            '返回列表': 'Back to List',
            '图片': 'Images',
            '邮箱账号': 'Mailbox Account',
            '邮箱密码': 'Mailbox Password',
            '邮箱密码或授权码': 'Mailbox password or app password',
            '选择服务器': 'Select Server',
            '选择已有服务器或手动输入': 'Select an existing server or enter manually',
            '收件服务器地址': 'Incoming Server',
            '发件服务器地址': 'Outgoing Server',
            '收件协议': 'Incoming Protocol',
            '发件协议': 'Outgoing Protocol',
            '收件端口': 'Incoming Port',
            '发件端口': 'Outgoing Port',
            '收件启用SSL': 'Incoming SSL',
            '发件启用SSL': 'Outgoing SSL',
            '输入备注信息': 'Enter notes',
            '输入操作人': 'Enter operator',
            '自动识别邮箱内容': 'Auto-detect Mailbox Content',
            '输入新分组名，回车添加': 'Enter a new group name, press Enter to add',
            '可直接新增分组，添加后会自动选中。': 'You can add a group here; it will be selected automatically.',
            '批量添加': 'Batch Add',
            '编辑备注': 'Edit Notes',
            '备注内容': 'Note Content',
            '服务器地址管理': 'Server Address Management',
            '服务器名称': 'Server Name',
            '添加服务器': 'Add Server',
            '更新服务器': 'Update Server',
            '已添加的服务器': 'Saved Servers',
            '批量删除选中': 'Delete Selected',
            '暂无服务器配置': 'No server configurations',
            '收/发信息': 'Incoming/Outgoing',
            '检测状态': 'Check Status',
            '添加人': 'Added By',
            '操作人': 'Operator',
            '最后修改时间': 'Last Updated',
            '未检测': 'Not Checked',
            '邮箱正常': 'Mailbox OK',
            '邮箱异常': 'Mailbox Error',
            '历史数据': 'Legacy Data',
            '未指定': 'Unassigned',
            '全部添加人': 'All Added By',
            '全部操作人': 'All Operators',
            '按检测状态筛选': 'Filter by check status',
            '按添加人筛选': 'Filter by added by',
            '按操作人筛选': 'Filter by operator',
            '尚未检测': 'Not checked yet',
            '收：': 'In:',
            '发：': 'Out:',
            '更多': 'More',
            '点击复制邮箱': 'Click to copy mailbox',
            '暂无邮箱账号': 'No mailbox accounts',
            '每页': 'Per page',
            '上一页': 'Previous',
            '下一页': 'Next',
            '加载邮箱列表失败': 'Failed to load mailbox list',
            '请填写分组名称': 'Please enter a group name',
            '分组添加成功': 'Group added',
            '分组添加失败': 'Failed to add group',
            '分组更新成功': 'Group updated',
            '分组更新失败': 'Failed to update group',
            '分组删除成功': 'Group deleted',
            '分组删除失败': 'Failed to delete group',
            '分组分配失败': 'Failed to assign group',
            '确定要删除该分组及其子分组吗？': 'Delete this group and its child groups?',
            '登录状态已失效，请刷新页面后重新登录': 'Login expired. Refresh and sign in again.',
            '测试中...': 'Testing...',
            '测试失败：Microsoft OAuth 拒绝该账号，账号处于 service abuse mode': 'Test failed: Microsoft OAuth rejected this account because it is in service abuse mode',
            '测试失败：OAuth 令牌获取失败': 'Test failed: OAuth token request failed',
            '测试失败：邮箱认证失败，请检查密码、授权码或 OAuth 数据': 'Test failed: mailbox authentication failed. Check password, app password, or OAuth data',
            'Microsoft OAuth 拒绝该账号登录，账号处于 service abuse mode': 'Microsoft OAuth rejected this account because it is in service abuse mode',
            'OAuth 令牌获取失败': 'OAuth token request failed',
            '邮箱认证失败': 'Mailbox authentication failed',
            'SSL 连接失败': 'SSL connection failed',
            '未找到邮箱信息': 'Mailbox not found',
            '所有邮件已存在，未发现新邮件': 'All mail already exists. No new mail found.',
            '邮箱中暂无新邮件': 'No new mail in this mailbox',
            '收件失败，详情已显示在弹窗内': 'Fetch failed. Details are shown in the modal.',
            '网络错误，详情已显示在弹窗内': 'Network error. Details are shown in the modal.',
            '请填写完整的邮箱信息后再测试': 'Complete mailbox information before testing',
            '邮箱连接测试成功': 'Mailbox connection test passed',
            '测试请求失败，请检查服务是否正常运行': 'Test request failed. Check whether the service is running.',
            '请填写收件人地址': 'Please enter recipient address',
            '发送成功': 'Sent successfully',
            '发送失败': 'Send failed',
            '确定要删除这个邮箱账号吗？': 'Delete this mailbox account?',
            '邮箱删除成功': 'Mailbox deleted',
            '删除失败': 'Delete failed',
            '请填写完整的收/发件服务器信息': 'Complete incoming and outgoing server information',
            '保存成功': 'Saved',
            '保存失败': 'Save failed',
            '请填写所有必需字段': 'Please fill in all required fields',
            '批量添加成功': 'Batch add succeeded',
            '批量添加失败': 'Batch add failed',
            '邮箱地址为空': 'Mailbox address is empty',
            '选中的邮箱不存在': 'Selected mailboxes do not exist',
            '请选择要分组的邮箱': 'Select mailboxes to group',
            '请选择要删除的邮箱': 'Select mailboxes to delete',
            '批量删除成功': 'Batch delete succeeded',
            '批量删除失败': 'Batch delete failed',
            '请填写完整的服务器信息': 'Complete server information',
            '服务器保存成功': 'Server saved',
            '服务器保存失败': 'Failed to save server',
            '确定要删除这个服务器配置吗？': 'Delete this server configuration?',
            '服务器删除成功': 'Server deleted',
            '请选择要删除的服务器': 'Select servers to delete',
            '获取邮箱信息失败': 'Failed to get mailbox information',
            '邮箱ID缺失': 'Mailbox ID is missing',
            '备注保存成功': 'Notes saved',

            '邮件收件日志': 'Mail Receiving Logs',
            '日志总数': 'Total Logs',
            '成功收取': 'Successful Fetches',
            '失败记录': 'Failed Records',
            '轮询间隔': 'Polling Interval',
            '关键词：邮箱、主题、发件人、正文': 'Keywords: mailbox, subject, sender, body',
            '全部状态': 'All Statuses',
            '已处理': 'Processed',
            '全部管理员': 'All Admins',
            '查询': 'Search',
            '清空': 'Clear',
            '立即查询': 'Query Now',
            '批量筛选': 'Batch Filter',
            '批量邮箱筛选：每行或逗号分隔多个邮箱': 'Batch mailbox filter: one per line or comma-separated',
            '批量主题筛选：每行或逗号分隔多个关键词': 'Batch subject filter: one per line or comma-separated',
            '批量发件人筛选：每行或逗号分隔多个发件人': 'Batch sender filter: one per line or comma-separated',
            '最近开始': 'Last Started',
            '最近结束': 'Last Finished',
            '结果': 'Result',
            '收件日志详情': 'Mail Log Details',
            '自动轮询': 'Auto Poll',
            '手动轮询': 'Manual Poll',
            '后台取件': 'Admin Fetch',
            '卡密接口': 'Card API',
            '卡密预览': 'Card Preview',
            '手动': 'Manual',
            '验证码': 'Code',
            '管理员': 'Admin',
            '主题 / 摘要': 'Subject / Summary',
            '收件时间': 'Received At',
            '详情': 'Details',
            '最后查询': 'Last Query',
            '暂无收件日志': 'No mail logs',
            '日志ID': 'Log ID',
            '收件邮箱': 'Mailbox',
            '来源': 'Source',
            '记录': 'Recorded',
            '邮件正文': 'Mail Body',
            '处理建议': 'Advice',
            '错误详情': 'Error Details',
            '检查邮箱密码/授权码是否正确，确认邮箱已开启 IMAP，并确认账号没有触发安全拦截。': 'Check the mailbox password/app password, confirm IMAP is enabled, and make sure the account is not blocked by a security check.',
            '检查收件服务器端口和 SSL 开关是否匹配；常见 IMAP SSL 使用 993，STARTTLS 或非 SSL 配置不要使用隐式 SSL。': 'Check that the incoming server port matches the SSL setting. IMAP SSL commonly uses 993; STARTTLS or non-SSL should not use implicit SSL.',
            '检查服务器地址、端口、网络连通性和代理配置。': 'Check server address, port, network connectivity, and proxy settings.',
            '检查服务器域名是否填写正确，或当前网络是否能解析该域名。': 'Check whether the server domain is correct and resolvable from the current network.',
            '根据完整错误检查邮箱账号、授权码、服务器地址、端口、SSL 和代理配置。': 'Check mailbox account, app password, server address, port, SSL, and proxy settings based on the full error.',
            '这条是收取失败记录，没有实际邮件正文。请查看下方错误详情。': 'This is a failed fetch record and has no actual mail body. See the error details below.',
            '这条记录没有保存正文。重新收取或轮询成功后，这里会显示实际邮件内容。': 'This record has no saved body. After a successful fetch or poll, the actual mail content will appear here.',
            '登录状态已失效，请重新登录': 'Login expired. Please sign in again.',
            '获取收件日志失败': 'Failed to load mail logs',
            '启动中...': 'Starting...',
            '已开始轮询': 'Polling started',
            '轮询启动失败': 'Failed to start polling',

            'API取件页面': 'API Mail Fetch Page',
            '此卡密不存在': 'This card key does not exist',
            '请检查卡密是否正确，或联系管理员获取有效卡密': 'Please check the card key or contact the administrator',
            '复制': 'Copy'
        },
        vi: {
            '语言': 'Ngôn ngữ',
            '邮件查看系统': 'Hệ thống xem thư',
            '邮件管理系统': 'Hệ thống quản lý thư',
            '邮件查看系统后台管理': 'Trang quản trị hệ thống xem thư',
            '管理员登录': 'Đăng nhập quản trị',
            '用户名': 'Tên đăng nhập',
            '密码': 'Mật khẩu',
            '登录': 'Đăng nhập',
            '退出登录': 'Đăng xuất',
            '欢迎': 'Xin chào',
            '首页': 'Trang chủ',
            '邮箱管理': 'Quản lý hộp thư',
            '代理池': 'Nhóm proxy',
            '卡密管理': 'Quản lý mã',
            '卡密日志': 'Nhật ký mã',
            '收件日志': 'Nhật ký nhận thư',
            '系统设置': 'Cài đặt hệ thống',
            '展开侧边栏': 'Mở thanh bên',
            '收起菜单': 'Thu gọn menu',
            '展开菜单': 'Mở menu',
            '展开': 'Mở rộng',
            '收起': 'Thu gọn',
            '切换主题': 'Đổi giao diện',
            '切换到明亮模式': 'Chuyển sang giao diện sáng',
            '切换到暗黑模式': 'Chuyển sang giao diện tối',
            '显示密码': 'Hiện mật khẩu',
            '隐藏密码': 'Ẩn mật khẩu',
            '显示/隐藏密码': 'Hiện/ẩn mật khẩu',

            '添加邮箱': 'Thêm hộp thư',
            '批量添加邮箱': 'Thêm hộp thư hàng loạt',
            '添加服务器地址': 'Thêm địa chỉ máy chủ',
            '隐藏分组': 'Ẩn nhóm',
            '显示分组': 'Hiện nhóm',
            '分组管理': 'Quản lý nhóm',
            '所有分组': 'Tất cả nhóm',
            '未分组': 'Chưa phân nhóm',
            '暂无自定义分组': 'Chưa có nhóm tùy chỉnh',
            '显示列': 'Cột hiển thị',
            '复制已选': 'Sao chép đã chọn',
            '搜索': 'Tìm kiếm',
            '清除': 'Xóa lọc',
            '搜索邮箱地址或服务器...': 'Tìm hộp thư hoặc máy chủ...',
            '序号ID': 'ID',
            '序号': 'STT',
            '分组': 'Nhóm',
            '邮箱地址': 'Địa chỉ email',
            '服务器（收/发）': 'Máy chủ (nhận/gửi)',
            '添加时间': 'Thời gian thêm',
            '备注': 'Ghi chú',
            '操作': 'Thao tác',
            '编辑': 'Sửa',
            '收件': 'Nhận',
            '发件': 'Gửi',
            '测试': 'Kiểm tra',
            '删除': 'Xóa',
            '保存': 'Lưu',
            '取消': 'Hủy',
            '确定': 'OK',
            '确认': 'Xác nhận',
            '关闭': 'Đóng',
            '新增': 'Thêm',
            '批量删除': 'Xóa hàng loạt',
            '全选': 'Chọn tất cả',
            '导入': 'Nhập',
            '导出': 'Xuất',
            '刷新': 'Làm mới',
            '加载中...': 'Đang tải...',
            '正在加载...': 'Đang tải...',
            '暂无数据': 'Không có dữ liệu',
            '暂无记录': 'Không có bản ghi',
            '暂无邮箱': 'Không có hộp thư',
            '暂无卡密日志': 'Chưa có nhật ký mã',
            '网络错误，请稍后重试': 'Lỗi mạng, vui lòng thử lại sau',
            '复制成功': 'Đã sao chép',
            '复制失败，请手动复制': 'Sao chép thất bại, vui lòng sao chép thủ công',
            '邮箱地址已复制': 'Đã sao chép địa chỉ email',
            '已复制邮箱地址': 'Đã sao chép địa chỉ email',
            '复制邮箱': 'Sao chép hộp thư',
            '请选择要复制的邮箱': 'Vui lòng chọn hộp thư cần sao chép',

            '系统概览': 'Tổng quan hệ thống',
            '快速操作': 'Thao tác nhanh',
            '系统信息': 'Thông tin hệ thống',
            '页面标题设置': 'Cài đặt tiêu đề trang',
            '系统标题设置': 'Cài đặt tiêu đề hệ thống',
            '管理员账号': 'Tài khoản quản trị',
            '管理员列表': 'Danh sách quản trị',
            '新增管理员': 'Thêm quản trị',
            '重置密码': 'Đặt lại mật khẩu',
            '当前管理员': 'Quản trị hiện tại',
            '管理员万能秘钥': 'Khóa tổng quản trị',
            '万能秘钥': 'Khóa tổng',
            '保存设置': 'Lưu cài đặt',

            '代理池管理': 'Quản lý proxy',
            'HTTP代理': 'Proxy HTTP',
            'SOCKS5代理': 'Proxy SOCKS5',
            '添加代理': 'Thêm proxy',
            '批量添加代理': 'Thêm proxy hàng loạt',
            '代理地址': 'Địa chỉ proxy',
            '端口': 'Cổng',
            '状态': 'Trạng thái',
            '启用': 'Bật',
            '禁用': 'Tắt',

            '卡密': 'Mã',
            '生成卡密': 'Tạo mã',
            '批量生成': 'Tạo hàng loạt',
            '使用次数': 'Số lần dùng',
            '剩余次数': 'Còn lại',
            '过期时间': 'Hết hạn',
            '绑定邮箱': 'Email đã liên kết',
            '回收站': 'Thùng rác',
            '清空日志': 'Xóa nhật ký',
            '保存定期清理': 'Lưu dọn dẹp định kỳ',
            '保留天数(0关闭)': 'Số ngày lưu (0 tắt)',
            '卡密使用日志': 'Nhật ký sử dụng mã',
            '邮件标题': 'Tiêu đề thư',
            '使用者IP': 'IP người dùng',
            '使用时间（北京时间）': 'Thời gian dùng (Bắc Kinh)',
            '卡密绑定邮箱': 'Email liên kết mã',

            '邮件查看': 'Xem thư',
            '卡密 / 管理员万能秘钥': 'Mã / Khóa tổng quản trị',
            '请输入卡密或管理员万能秘钥': 'Nhập mã hoặc khóa tổng quản trị',
            '设置后的万能秘钥可免卡密取件': 'Khóa tổng đã đặt có thể lấy thư không cần mã',
            '邮箱查询': 'Truy vấn hộp thư',
            '请输入邮箱地址 (例: user@example.com)': 'Nhập địa chỉ email (ví dụ: user@example.com)',
            '请输入邮箱地址，支持多个邮箱自动识别：user@example.com\ntest@example.com, demo@example.com': 'Nhập địa chỉ email. Có thể tự nhận diện nhiều email:\nuser@example.com\ntest@example.com, demo@example.com',
            '每个邮箱收取': 'Mỗi hộp thư',
            '支持换行、逗号、空格、竖线等格式，会自动识别邮箱地址；默认每个邮箱查询 10 封。': 'Hỗ trợ xuống dòng, dấu phẩy, khoảng trắng, dấu gạch đứng và nhiều định dạng khác. Mặc định truy vấn 10 thư cho mỗi hộp thư.',
            '收取封数': 'Số thư nhận',
            '获取邮件': 'Lấy thư',
            '获取中...': 'Đang lấy...',
            '邮箱文件夹': 'Thư mục hộp thư',
            '展开邮箱文件夹': 'Mở thư mục hộp thư',
            '折叠邮箱文件夹': 'Thu gọn thư mục hộp thư',
            '收件箱': 'Hộp thư đến',
            '垃圾箱': 'Thùng rác',
            '正在获取邮件，请稍候...': 'Đang lấy thư, vui lòng chờ...',
            '邮箱': 'Hộp thư',
            '标题': 'Tiêu đề',
            '验证码': 'Mã xác minh',
            '发件人': 'Người gửi',
            '收件人': 'Người nhận',
            '时间': 'Thời gian',
            '暂无邮件': 'Không có thư',
            '返回邮件列表': 'Quay lại danh sách thư',
            '发件人:': 'Người gửi:',
            '收件人:': 'Người nhận:',
            '时间:': 'Thời gian:',
            '图片内容': 'Hình ảnh',
            '附件': 'Tệp đính kèm',
            '下载': 'Tải xuống',
            '请输入邮箱地址': 'Vui lòng nhập địa chỉ email',
            '单次最多支持 50 个邮箱，请分批查询': 'Mỗi lần hỗ trợ tối đa 50 hộp thư. Vui lòng chia thành nhiều lượt.',
            '已检测到管理员登录状态，免卡密访问': 'Đã phát hiện đăng nhập quản trị. Không cần mã.',
            '您尚未登录管理员账户，请使用卡密或万能秘钥访问': 'Bạn chưa đăng nhập quản trị. Hãy dùng mã hoặc khóa tổng để truy cập thư.',
            '未获取到邮件': 'Không lấy được thư',
            '请求失败': 'Yêu cầu thất bại',
            '请输入有效的邮箱地址': 'Vui lòng nhập địa chỉ email hợp lệ',
            '邮箱中暂无邮件': 'Hộp thư này chưa có thư',
            '获取邮件失败': 'Lấy thư thất bại',
            '网络请求失败，请检查网络连接': 'Yêu cầu mạng thất bại, vui lòng kiểm tra kết nối',
            '邮件获取成功': 'Lấy thư thành công',
            '附件下载已开始': 'Đã bắt đầu tải tệp đính kèm',
            '附件下载失败': 'Tải tệp đính kèm thất bại',
            '未知': 'Không rõ',
            '无主题': 'Không có tiêu đề',
            '（无主题）': '(Không có tiêu đề)',
            '(无主题)': '(Không có tiêu đề)',
            '(邮件内容为空)': '(Nội dung thư trống)',

            '批量复制': 'Sao chép hàng loạt',
            '批量分组': 'Phân nhóm hàng loạt',
            '管理员：': 'Quản trị:',
            '当前分组：': 'Nhóm hiện tại:',
            '邮箱：': 'Hộp thư:',
            '已选：': 'Đã chọn:',
            '选择': 'Chọn',
            '上级分组': 'Nhóm cha',
            '分组名称': 'Tên nhóm',
            '输入分组名称': 'Nhập tên nhóm',
            '添加分组': 'Thêm nhóm',
            '添加下级分组': 'Thêm nhóm con',
            '编辑分组': 'Sửa nhóm',
            '已选择邮箱': 'Hộp thư đã chọn',
            '目标分组': 'Nhóm đích',
            '应用分组': 'Áp dụng nhóm',
            '发送邮件': 'Gửi thư',
            '昵称': 'Biệt danh',
            '收件人看到的发件人昵称（可选）': 'Biệt danh người gửi hiển thị cho người nhận (tùy chọn)',
            '主题': 'Tiêu đề',
            '正文': 'Nội dung',
            '邮件主题': 'Tiêu đề thư',
            '邮件正文': 'Nội dung thư',
            '当前邮箱': 'Hộp thư hiện tại',
            '收取': 'Lấy',
            '封': 'thư',
            '收取邮件': 'Lấy thư',
            '收件失败': 'Lấy thư thất bại',
            '返回列表': 'Quay lại danh sách',
            '图片': 'Hình ảnh',
            '邮箱账号': 'Tài khoản hộp thư',
            '邮箱密码': 'Mật khẩu hộp thư',
            '邮箱密码或授权码': 'Mật khẩu hộp thư hoặc mã ứng dụng',
            '选择服务器': 'Chọn máy chủ',
            '选择已有服务器或手动输入': 'Chọn máy chủ đã có hoặc nhập thủ công',
            '收件服务器地址': 'Máy chủ nhận',
            '发件服务器地址': 'Máy chủ gửi',
            '收件协议': 'Giao thức nhận',
            '发件协议': 'Giao thức gửi',
            '收件端口': 'Cổng nhận',
            '发件端口': 'Cổng gửi',
            '收件启用SSL': 'Bật SSL nhận',
            '发件启用SSL': 'Bật SSL gửi',
            '输入备注信息': 'Nhập ghi chú',
            '输入操作人': 'Nhập người thao tác',
            '自动识别邮箱内容': 'Tự nhận diện nội dung hộp thư',
            '输入新分组名，回车添加': 'Nhập tên nhóm mới, nhấn Enter để thêm',
            '可直接新增分组，添加后会自动选中。': 'Có thể thêm nhóm tại đây; sau khi thêm sẽ tự chọn.',
            '批量添加': 'Thêm hàng loạt',
            '编辑备注': 'Sửa ghi chú',
            '备注内容': 'Nội dung ghi chú',
            '服务器地址管理': 'Quản lý địa chỉ máy chủ',
            '服务器名称': 'Tên máy chủ',
            '添加服务器': 'Thêm máy chủ',
            '更新服务器': 'Cập nhật máy chủ',
            '已添加的服务器': 'Máy chủ đã lưu',
            '批量删除选中': 'Xóa mục đã chọn',
            '暂无服务器配置': 'Chưa có cấu hình máy chủ',
            '收/发信息': 'Thông tin nhận/gửi',
            '检测状态': 'Trạng thái kiểm tra',
            '添加人': 'Người thêm',
            '操作人': 'Người thao tác',
            '最后修改时间': 'Sửa lần cuối',
            '未检测': 'Chưa kiểm tra',
            '邮箱正常': 'Hộp thư bình thường',
            '邮箱异常': 'Hộp thư lỗi',
            '历史数据': 'Dữ liệu cũ',
            '未指定': 'Chưa chỉ định',
            '全部添加人': 'Tất cả người thêm',
            '全部操作人': 'Tất cả người thao tác',
            '按检测状态筛选': 'Lọc theo trạng thái kiểm tra',
            '按添加人筛选': 'Lọc theo người thêm',
            '按操作人筛选': 'Lọc theo người thao tác',
            '尚未检测': 'Chưa kiểm tra',
            '收：': 'Nhận:',
            '发：': 'Gửi:',
            '更多': 'Thêm',
            '点击复制邮箱': 'Bấm để sao chép hộp thư',
            '暂无邮箱账号': 'Chưa có tài khoản hộp thư',
            '每页': 'Mỗi trang',
            '上一页': 'Trang trước',
            '下一页': 'Trang sau',
            '加载邮箱列表失败': 'Tải danh sách hộp thư thất bại',
            '请填写分组名称': 'Vui lòng nhập tên nhóm',
            '分组添加成功': 'Đã thêm nhóm',
            '分组添加失败': 'Thêm nhóm thất bại',
            '分组更新成功': 'Đã cập nhật nhóm',
            '分组更新失败': 'Cập nhật nhóm thất bại',
            '分组删除成功': 'Đã xóa nhóm',
            '分组删除失败': 'Xóa nhóm thất bại',
            '分组分配失败': 'Gán nhóm thất bại',
            '确定要删除该分组及其子分组吗？': 'Xóa nhóm này và các nhóm con?',
            '登录状态已失效，请刷新页面后重新登录': 'Phiên đăng nhập hết hạn. Vui lòng tải lại và đăng nhập lại.',
            '测试中...': 'Đang kiểm tra...',
            '测试失败：Microsoft OAuth 拒绝该账号，账号处于 service abuse mode': 'Kiểm tra thất bại: Microsoft OAuth từ chối tài khoản vì đang ở chế độ service abuse',
            '测试失败：OAuth 令牌获取失败': 'Kiểm tra thất bại: lấy token OAuth thất bại',
            '测试失败：邮箱认证失败，请检查密码、授权码或 OAuth 数据': 'Kiểm tra thất bại: xác thực hộp thư thất bại. Kiểm tra mật khẩu, mã ứng dụng hoặc dữ liệu OAuth',
            'Microsoft OAuth 拒绝该账号登录，账号处于 service abuse mode': 'Microsoft OAuth từ chối đăng nhập vì tài khoản ở chế độ service abuse',
            'OAuth 令牌获取失败': 'Lấy token OAuth thất bại',
            '邮箱认证失败': 'Xác thực hộp thư thất bại',
            'SSL 连接失败': 'Kết nối SSL thất bại',
            '未找到邮箱信息': 'Không tìm thấy hộp thư',
            '所有邮件已存在，未发现新邮件': 'Tất cả thư đã tồn tại. Không có thư mới.',
            '邮箱中暂无新邮件': 'Hộp thư chưa có thư mới',
            '收件失败，详情已显示在弹窗内': 'Lấy thư thất bại. Chi tiết đã hiển thị trong cửa sổ.',
            '网络错误，详情已显示在弹窗内': 'Lỗi mạng. Chi tiết đã hiển thị trong cửa sổ.',
            '请填写完整的邮箱信息后再测试': 'Vui lòng điền đầy đủ thông tin hộp thư trước khi kiểm tra',
            '邮箱连接测试成功': 'Kiểm tra kết nối hộp thư thành công',
            '测试请求失败，请检查服务是否正常运行': 'Yêu cầu kiểm tra thất bại. Vui lòng kiểm tra dịch vụ có đang chạy không.',
            '请填写收件人地址': 'Vui lòng nhập địa chỉ người nhận',
            '发送成功': 'Gửi thành công',
            '发送失败': 'Gửi thất bại',
            '确定要删除这个邮箱账号吗？': 'Xóa tài khoản hộp thư này?',
            '邮箱删除成功': 'Đã xóa hộp thư',
            '删除失败': 'Xóa thất bại',
            '请填写完整的收/发件服务器信息': 'Vui lòng điền đầy đủ thông tin máy chủ nhận/gửi',
            '保存成功': 'Đã lưu',
            '保存失败': 'Lưu thất bại',
            '请填写所有必需字段': 'Vui lòng điền tất cả mục bắt buộc',
            '批量添加成功': 'Thêm hàng loạt thành công',
            '批量添加失败': 'Thêm hàng loạt thất bại',
            '邮箱地址为空': 'Địa chỉ hộp thư trống',
            '选中的邮箱不存在': 'Hộp thư đã chọn không tồn tại',
            '请选择要分组的邮箱': 'Vui lòng chọn hộp thư cần phân nhóm',
            '请选择要删除的邮箱': 'Vui lòng chọn hộp thư cần xóa',
            '批量删除成功': 'Xóa hàng loạt thành công',
            '批量删除失败': 'Xóa hàng loạt thất bại',
            '请填写完整的服务器信息': 'Vui lòng điền đầy đủ thông tin máy chủ',
            '服务器保存成功': 'Đã lưu máy chủ',
            '服务器保存失败': 'Lưu máy chủ thất bại',
            '确定要删除这个服务器配置吗？': 'Xóa cấu hình máy chủ này?',
            '服务器删除成功': 'Đã xóa máy chủ',
            '请选择要删除的服务器': 'Vui lòng chọn máy chủ cần xóa',
            '获取邮箱信息失败': 'Lấy thông tin hộp thư thất bại',
            '邮箱ID缺失': 'Thiếu ID hộp thư',
            '备注保存成功': 'Đã lưu ghi chú',

            '邮件收件日志': 'Nhật ký nhận thư',
            '日志总数': 'Tổng nhật ký',
            '成功收取': 'Lấy thành công',
            '失败记录': 'Bản ghi thất bại',
            '轮询间隔': 'Khoảng poll',
            '关键词：邮箱、主题、发件人、正文': 'Từ khóa: hộp thư, tiêu đề, người gửi, nội dung',
            '全部状态': 'Tất cả trạng thái',
            '已处理': 'Đã xử lý',
            '全部管理员': 'Tất cả quản trị',
            '查询': 'Tìm',
            '清空': 'Xóa',
            '立即查询': 'Truy vấn ngay',
            '批量筛选': 'Lọc hàng loạt',
            '批量邮箱筛选：每行或逗号分隔多个邮箱': 'Lọc hộp thư hàng loạt: mỗi dòng một hộp thư hoặc phân tách bằng dấu phẩy',
            '批量主题筛选：每行或逗号分隔多个关键词': 'Lọc tiêu đề hàng loạt: mỗi dòng một từ khóa hoặc phân tách bằng dấu phẩy',
            '批量发件人筛选：每行或逗号分隔多个发件人': 'Lọc người gửi hàng loạt: mỗi dòng một người gửi hoặc phân tách bằng dấu phẩy',
            '最近开始': 'Bắt đầu gần nhất',
            '最近结束': 'Kết thúc gần nhất',
            '结果': 'Kết quả',
            '收件日志详情': 'Chi tiết nhật ký nhận thư',
            '自动轮询': 'Tự động poll',
            '手动轮询': 'Poll thủ công',
            '后台取件': 'Quản trị lấy thư',
            '卡密接口': 'API mã',
            '卡密预览': 'Xem trước mã',
            '手动': 'Thủ công',
            '验证码': 'Mã xác minh',
            '管理员': 'Quản trị',
            '主题 / 摘要': 'Tiêu đề / Tóm tắt',
            '收件时间': 'Thời gian nhận',
            '详情': 'Chi tiết',
            '最后查询': 'Truy vấn cuối',
            '暂无收件日志': 'Chưa có nhật ký nhận thư',
            '日志ID': 'ID nhật ký',
            '收件邮箱': 'Hộp thư nhận',
            '来源': 'Nguồn',
            '记录': 'Bản ghi',
            '处理建议': 'Gợi ý xử lý',
            '错误详情': 'Chi tiết lỗi',
            '检查邮箱密码/授权码是否正确，确认邮箱已开启 IMAP，并确认账号没有触发安全拦截。': 'Kiểm tra mật khẩu/mã ứng dụng, xác nhận IMAP đã bật và tài khoản không bị chặn bảo mật.',
            '检查收件服务器端口和 SSL 开关是否匹配；常见 IMAP SSL 使用 993，STARTTLS 或非 SSL 配置不要使用隐式 SSL。': 'Kiểm tra cổng máy chủ nhận có khớp với SSL không. IMAP SSL thường dùng 993; STARTTLS hoặc không SSL không nên dùng SSL ẩn.',
            '检查服务器地址、端口、网络连通性和代理配置。': 'Kiểm tra địa chỉ máy chủ, cổng, kết nối mạng và cấu hình proxy.',
            '检查服务器域名是否填写正确，或当前网络是否能解析该域名。': 'Kiểm tra tên miền máy chủ có đúng và mạng hiện tại có phân giải được không.',
            '根据完整错误检查邮箱账号、授权码、服务器地址、端口、SSL 和代理配置。': 'Dựa trên lỗi đầy đủ để kiểm tra tài khoản hộp thư, mã ứng dụng, địa chỉ máy chủ, cổng, SSL và proxy.',
            '这条是收取失败记录，没有实际邮件正文。请查看下方错误详情。': 'Đây là bản ghi lấy thất bại nên không có nội dung thư. Xem chi tiết lỗi bên dưới.',
            '这条记录没有保存正文。重新收取或轮询成功后，这里会显示实际邮件内容。': 'Bản ghi này chưa lưu nội dung. Sau khi lấy hoặc poll thành công, nội dung thư sẽ hiển thị tại đây.',
            '登录状态已失效，请重新登录': 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
            '获取收件日志失败': 'Tải nhật ký nhận thư thất bại',
            '启动中...': 'Đang khởi động...',
            '已开始轮询': 'Đã bắt đầu poll',
            '轮询启动失败': 'Khởi động poll thất bại',

            'API取件页面': 'Trang lấy thư API',
            '此卡密不存在': 'Mã này không tồn tại',
            '请检查卡密是否正确，或联系管理员获取有效卡密': 'Vui lòng kiểm tra mã hoặc liên hệ quản trị viên',
            '复制': 'Sao chép'
        }
    };

    const originalText = new WeakMap();
    const originalAttrs = new WeakMap();
    let currentLang = getInitialLanguage();
    let observer = null;
    let isApplying = false;

    function getInitialLanguage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        return SUPPORTED_LANGS.includes(saved) ? saved : DEFAULT_LANG;
    }

    function translateExact(text, lang) {
        if (!text || lang === DEFAULT_LANG) return text;
        const table = dictionary[lang] || {};
        return table[text] || text;
    }

    function translateWithRules(text, lang) {
        if (!text || lang === DEFAULT_LANG) return text;
        const exact = translateExact(text, lang);
        if (exact !== text) return exact;

        const t = dictionary[lang] || {};
        let match = text.match(/^欢迎，\s*(.+)$/);
        if (match) {
            return lang === 'vi' ? `Xin chào, ${match[1]}` : `Welcome, ${match[1]}`;
        }

        if (text.startsWith('每行一个邮箱，自动识别多种格式：')) {
            return lang === 'vi'
                ? 'Mỗi dòng một hộp thư, tự nhận diện nhiều định dạng:\nuser@example.com----password\nuser@hotmail.com----password----client_id----refresh_token----Graph API\nemail=user@example.com password=password client_id=... refresh_token=... auth_type=graph\nHỗ trợ ---- / dấu hai chấm / gạch dọc / dấu phẩy / JSON / key=value / Graph API'
                : 'One mailbox per line. Multiple formats are auto-detected:\nuser@example.com----password\nuser@hotmail.com----password----client_id----refresh_token----Graph API\nemail=user@example.com password=password client_id=... refresh_token=... auth_type=graph\nSupports ---- / colon / pipe / comma / JSON / key=value / Graph API';
        }

        match = text.match(/^共\s*(\d+)\s*条记录，第\s*(\d+)\s*页，共\s*(\d+)\s*页$/);
        if (match) {
            return lang === 'vi'
                ? `Tổng ${match[1]} bản ghi, trang ${match[2]}, tổng ${match[3]} trang`
                : `Total ${match[1]} records, page ${match[2]} of ${match[3]}`;
        }

        match = text.match(/^共\s*(\d+)\s*封邮件，第\s*(\d+)\s*\/\s*(\d+)\s*页$/);
        if (match) {
            return lang === 'vi'
                ? `Tổng ${match[1]} thư, trang ${match[2]} / ${match[3]}`
                : `Total ${match[1]} mails, page ${match[2]} / ${match[3]}`;
        }

        match = text.match(/^共\s*(\d+)\s*个邮箱，第\s*(\d+)\s*\/\s*(\d+)\s*页$/);
        if (match) {
            return lang === 'vi'
                ? `Tổng ${match[1]} hộp thư, trang ${match[2]} / ${match[3]}`
                : `Total ${match[1]} mailboxes, page ${match[2]} / ${match[3]}`;
        }

        match = text.match(/^共\s*(\d+)\s*条$/);
        if (match) {
            return lang === 'vi' ? `Tổng ${match[1]}` : `Total ${match[1]}`;
        }

        match = text.match(/^成功\s*(\d+)$/);
        if (match) {
            return lang === 'vi' ? `Thành công ${match[1]}` : `Success ${match[1]}`;
        }

        match = text.match(/^失败\s*(\d+)$/);
        if (match) {
            return lang === 'vi' ? `Thất bại ${match[1]}` : `Failed ${match[1]}`;
        }

        match = text.match(/^(\d+)\s*条$/);
        if (match) {
            return lang === 'vi' ? `${match[1]} mục` : `${match[1]} items`;
        }

        match = text.match(/^(\d+)\s*个邮箱$/);
        if (match) {
            return lang === 'vi' ? `${match[1]} hộp thư` : `${match[1]} mailboxes`;
        }

        match = text.match(/^批量复制\s*\((\d+)\)$/);
        if (match) {
            return lang === 'vi' ? `Sao chép hàng loạt (${match[1]})` : `Batch Copy (${match[1]})`;
        }

        match = text.match(/^批量删除\s*\((\d+)\)$/);
        if (match) {
            return lang === 'vi' ? `Xóa hàng loạt (${match[1]})` : `Batch Delete (${match[1]})`;
        }

        match = text.match(/^批量分组\s*\((\d+)\)$/);
        if (match) {
            return lang === 'vi' ? `Phân nhóm hàng loạt (${match[1]})` : `Batch Group (${match[1]})`;
        }

        match = text.match(/^成功获取\s*(\d+)\s*封邮件$/);
        if (match) {
            return lang === 'vi'
                ? `Đã lấy thành công ${match[1]} thư`
                : `Successfully fetched ${match[1]} mails`;
        }

        match = text.match(/^成功获取\s*(\d+)\s*封邮件，(\d+)\s*个邮箱失败$/);
        if (match) {
            return lang === 'vi'
                ? `Đã lấy thành công ${match[1]} thư, ${match[2]} hộp thư thất bại`
                : `Successfully fetched ${match[1]} mails, ${match[2]} mailboxes failed`;
        }

        match = text.match(/^邮件获取成功！剩余使用次数:\s*(.+)$/);
        if (match) {
            return lang === 'vi'
                ? `Lấy thư thành công! Số lần còn lại: ${match[1]}`
                : `Mail fetched successfully! Remaining uses: ${match[1]}`;
        }

        match = text.match(/^成功收取\s*(\d+)\s*封新邮件$/);
        if (match) {
            return lang === 'vi'
                ? `Đã lấy thành công ${match[1]} thư mới`
                : `Successfully fetched ${match[1]} new mails`;
        }

        match = text.match(/^开始检测批量导入的\s*(\d+)\s*个邮箱\.\.\.$/);
        if (match) {
            return lang === 'vi'
                ? `Bắt đầu kiểm tra ${match[1]} hộp thư vừa nhập...`
                : `Checking ${match[1]} imported mailboxes...`;
        }

        match = text.match(/^批量导入检测完成：成功\s*(\d+)\s*个，失败\s*(\d+)\s*个$/);
        if (match) {
            return lang === 'vi'
                ? `Kiểm tra sau nhập hoàn tất: thành công ${match[1]}, thất bại ${match[2]}`
                : `Import check completed: ${match[1]} succeeded, ${match[2]} failed`;
        }

        match = text.match(/^批量分组完成：成功\s*(\d+)\s*个(?:，失败\s*(\d+)\s*个)?$/);
        if (match) {
            const failed = match[2] || '0';
            return lang === 'vi'
                ? `Phân nhóm hàng loạt hoàn tất: thành công ${match[1]}${match[2] ? `, thất bại ${failed}` : ''}`
                : `Batch group completed: ${match[1]} succeeded${match[2] ? `, ${failed} failed` : ''}`;
        }

        match = text.match(/^已复制：(.+)$/);
        if (match) {
            return lang === 'vi' ? `Đã sao chép: ${match[1]}` : `Copied: ${match[1]}`;
        }

        match = text.match(/^已复制\s*(\d+)\s*个邮箱$/);
        if (match) {
            return lang === 'vi' ? `Đã sao chép ${match[1]} hộp thư` : `Copied ${match[1]} mailboxes`;
        }

        match = text.match(/^分组“(.+)”已存在，不能重复添加。?$/);
        if (match) {
            return lang === 'vi'
                ? `Nhóm "${match[1]}" đã tồn tại, không thể thêm trùng.`
                : `Group "${match[1]}" already exists.`;
        }

        match = text.match(/^分组名称可用，点击添加后会自动选中。$/);
        if (match) {
            return lang === 'vi'
                ? 'Tên nhóm khả dụng; sau khi thêm sẽ tự chọn.'
                : 'Group name is available and will be selected after adding.';
        }

        match = text.match(/^已添加并选中分组“(.+)”。$/);
        if (match) {
            return lang === 'vi'
                ? `Đã thêm và chọn nhóm "${match[1]}".`
                : `Added and selected group "${match[1]}".`;
        }

        match = text.match(/^确定要删除选中的\s*(\d+)\s*个邮箱账号吗？$/);
        if (match) {
            return lang === 'vi'
                ? `Xóa ${match[1]} tài khoản hộp thư đã chọn?`
                : `Delete ${match[1]} selected mailbox accounts?`;
        }

        match = text.match(/^确定要删除选中的\s*(\d+)\s*个服务器配置吗？$/);
        if (match) {
            return lang === 'vi'
                ? `Xóa ${match[1]} cấu hình máy chủ đã chọn?`
                : `Delete ${match[1]} selected server configurations?`;
        }

        match = text.match(/^接口返回异常（HTTP\s*(\d+)）$/);
        if (match) {
            return lang === 'vi' ? `Phản hồi API bất thường (HTTP ${match[1]})` : `Unexpected API response (HTTP ${match[1]})`;
        }

        match = text.match(/^管理员\s*(.+)\s*已删除$/);
        if (match) {
            return lang === 'vi'
                ? `Quản trị viên ${match[1]} đã bị xóa`
                : `Admin ${match[1]} has been deleted`;
        }

        match = text.match(/^管理员\s*(.+)\s*的密码已重置$/);
        if (match) {
            return lang === 'vi'
                ? `Mật khẩu của quản trị viên ${match[1]} đã được đặt lại`
                : `Password for admin ${match[1]} has been reset`;
        }

        if (text.includes('（北京时间）')) {
            return text.replace('（北京时间）', lang === 'vi' ? '(Bắc Kinh)' : '(Beijing Time)');
        }

        return t[text] || text;
    }

    function shouldSkipNode(node) {
        const parent = node.parentElement;
        if (!parent) return true;
        const tag = parent.tagName;
        return ['SCRIPT', 'STYLE', 'SVG', 'PATH', 'USE', 'CODE', 'PRE', 'TEXTAREA'].includes(tag);
    }

    function translateTextNode(node) {
        if (shouldSkipNode(node)) return;
        const value = node.nodeValue;
        if (!value || !value.trim()) return;

        if (!originalText.has(node)) {
            originalText.set(node, value);
        }

        const source = originalText.get(node);
        const leading = source.match(/^\s*/)[0];
        const trailing = source.match(/\s*$/)[0];
        const trimmed = source.trim();
        const translated = translateWithRules(trimmed, currentLang);
        node.nodeValue = `${leading}${translated}${trailing}`;
    }

    function getOriginalAttrStore(element) {
        if (!originalAttrs.has(element)) {
            originalAttrs.set(element, {});
        }
        return originalAttrs.get(element);
    }

    function shouldTranslateValue(element) {
        if (element.tagName !== 'INPUT') return true;
        const type = (element.getAttribute('type') || 'text').toLowerCase();
        return ['button', 'submit', 'reset'].includes(type);
    }

    function translateAttributes(element) {
        const attrs = ['placeholder', 'title', 'aria-label', 'alt', 'data-label'];
        if (shouldTranslateValue(element)) {
            attrs.push('value');
        }

        const store = getOriginalAttrStore(element);
        attrs.forEach((attr) => {
            if (!element.hasAttribute(attr)) return;
            const value = element.getAttribute(attr);
            if (!value || !value.trim()) return;
            if (store[attr] === undefined) {
                store[attr] = value;
            }
            element.setAttribute(attr, translateWithRules(store[attr].trim(), currentLang));
        });
    }

    function walk(root) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            translateTextNode(root);
            return;
        }
        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

        if (root.nodeType === Node.ELEMENT_NODE) {
            translateAttributes(root);
        }

        const treeWalker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const tag = node.tagName;
                        if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'USE', 'CODE', 'PRE'].includes(tag)) {
                            return NodeFilter.FILTER_REJECT;
                        }
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node = treeWalker.nextNode();
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                translateTextNode(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                translateAttributes(node);
            }
            node = treeWalker.nextNode();
        }
    }

    function translateTitle() {
        if (!document.__i18nOriginalTitle) {
            document.__i18nOriginalTitle = document.title;
        }
        const source = document.__i18nOriginalTitle;
        if (currentLang === DEFAULT_LANG) {
            document.title = source;
            return;
        }
        document.title = source
            .split(' - ')
            .map((part) => translateWithRules(part, currentLang))
            .join(' - ');
    }

    function applyLanguage() {
        if (isApplying) return;
        isApplying = true;
        if (observer) {
            observer.disconnect();
        }
        try {
            document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : currentLang;
            translateTitle();
            walk(document.body);
            syncSwitcher();
        } finally {
            if (observer) {
                startObserver();
            }
            isApplying = false;
        }
    }

    function syncSwitcher() {
        const select = document.getElementById('i18nLanguageSelect');
        if (select && select.value !== currentLang) {
            select.value = currentLang;
        }
    }

    function createSwitcher() {
        if (document.getElementById('i18nLanguageSwitcher')) return;

        const headerUserInfo = document.querySelector('.header-actions .user-info');
        const headerActions = headerUserInfo ? headerUserInfo.parentElement : null;
        const wrapper = document.createElement('div');
        wrapper.className = headerActions ? 'i18n-switcher i18n-switcher--header' : 'i18n-switcher';
        wrapper.id = 'i18nLanguageSwitcher';

        const label = document.createElement('label');
        label.setAttribute('for', 'i18nLanguageSelect');
        label.textContent = '语言';

        const select = document.createElement('select');
        select.id = 'i18nLanguageSelect';
        select.setAttribute('aria-label', '语言');

        SUPPORTED_LANGS.forEach((lang) => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = LANG_LABELS[lang];
            select.appendChild(option);
        });

        select.value = currentLang;
        select.addEventListener('change', () => {
            setLanguage(select.value);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        if (headerActions) {
            headerActions.insertBefore(wrapper, headerUserInfo);
        } else {
            document.body.appendChild(wrapper);
        }
    }

    function startObserver() {
        if (!observer) return;
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['placeholder', 'title', 'aria-label', 'alt', 'value']
        });
    }

    function observeChanges() {
        if (observer) observer.disconnect();
        observer = new MutationObserver((mutations) => {
            if (isApplying) return;
            let shouldApply = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    shouldApply = true;
                }
                if (mutation.type === 'characterData') {
                    const node = mutation.target;
                    originalText.set(node, node.nodeValue);
                    shouldApply = true;
                }
                if (mutation.type === 'attributes') {
                    const element = mutation.target;
                    const attr = mutation.attributeName;
                    const store = getOriginalAttrStore(element);
                    const currentValue = element.getAttribute(attr);
                    if (currentValue && currentValue.trim()) {
                        store[attr] = currentValue;
                    } else {
                        delete store[attr];
                    }
                    shouldApply = true;
                }
            });
            if (shouldApply) {
                window.requestAnimationFrame(applyLanguage);
            }
        });
        startObserver();
    }

    function setLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) return;
        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        applyLanguage();
        window.dispatchEvent(new CustomEvent('app-language-change', { detail: { language: lang } }));
    }

    function patchDialogs() {
        if (!window.__i18nDialogsPatched) {
            const originalAlert = window.alert;
            const originalConfirm = window.confirm;
            window.alert = function (message) {
                return originalAlert.call(window, translateWithRules(String(message), currentLang));
            };
            window.confirm = function (message) {
                return originalConfirm.call(window, translateWithRules(String(message), currentLang));
            };
            window.__i18nDialogsPatched = true;
        }
    }

    window.AppI18n = {
        get language() {
            return currentLang;
        },
        setLanguage,
        t(text) {
            return translateWithRules(String(text), currentLang);
        }
    };

    function init() {
        patchDialogs();
        createSwitcher();
        applyLanguage();
        observeChanges();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
