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
            '设置后的万能秘钥可免卡密取件': 'A configured master key can fetch mail without a card key',
            '请输入邮箱地址 (例: user@example.com)': 'Enter email address (e.g. user@example.com)',
            '收取封数': 'Mail count',
            '获取邮件': 'Fetch Mail',
            '获取中...': 'Fetching...',
            '邮箱文件夹': 'Mail Folders',
            '收件箱': 'Inbox',
            '垃圾箱': 'Trash',
            '正在获取邮件，请稍候...': 'Fetching mail, please wait...',
            '标题': 'Subject',
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
            '设置后的万能秘钥可免卡密取件': 'Khóa tổng đã đặt có thể lấy thư không cần mã',
            '请输入邮箱地址 (例: user@example.com)': 'Nhập địa chỉ email (ví dụ: user@example.com)',
            '收取封数': 'Số thư nhận',
            '获取邮件': 'Lấy thư',
            '获取中...': 'Đang lấy...',
            '邮箱文件夹': 'Thư mục hộp thư',
            '收件箱': 'Hộp thư đến',
            '垃圾箱': 'Thùng rác',
            '正在获取邮件，请稍候...': 'Đang lấy thư, vui lòng chờ...',
            '标题': 'Tiêu đề',
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

        match = text.match(/^(\d+)\s*条$/);
        if (match) {
            return lang === 'vi' ? `${match[1]} mục` : `${match[1]} items`;
        }

        match = text.match(/^成功获取\s*(\d+)\s*封邮件$/);
        if (match) {
            return lang === 'vi'
                ? `Đã lấy thành công ${match[1]} thư`
                : `Successfully fetched ${match[1]} mails`;
        }

        match = text.match(/^邮件获取成功！剩余使用次数:\s*(.+)$/);
        if (match) {
            return lang === 'vi'
                ? `Lấy thư thành công! Số lần còn lại: ${match[1]}`
                : `Mail fetched successfully! Remaining uses: ${match[1]}`;
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
        const attrs = ['placeholder', 'title', 'aria-label', 'alt'];
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
