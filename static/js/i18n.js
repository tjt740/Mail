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
    const LANG_MARKS = {
        zh: '中',
        en: 'EN',
        vi: 'VI'
    };
    const LOCALES = { zh: 'zh-CN', en: 'en-US', vi: 'vi-VN' };
    const reactManaged = document.documentElement.dataset.i18nManaged === 'react';
    const SKIP_SELECTOR = '[translate="no"], [data-i18n-ignore], [data-i18n-managed="react"], script, style, svg, code, pre';

    const dictionary = {
        en: {
            '语言': 'Language',
            '颜色主题': 'Color Theme',
            '暖陶橙': 'Warm Clay',
            '海洋蓝': 'Ocean Blue',
            '翡翠绿': 'Emerald Green',
            '紫罗兰': 'Violet',
            '玫瑰红': 'Rose Red',
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
            '邮箱范围权限': 'Mailbox Access',
            '管理员邮箱可见范围': 'Admin Mailbox Access',
            '受限管理员': 'Restricted Admin',
            '目标管理员': 'Target Admin',
            '搜索邮箱': 'Search Mailboxes',
            '搜索邮箱地址、操作人或备注...': 'Search email, operator, or notes...',
            '正在加载邮箱范围...': 'Loading mailbox access...',
            '保存可见范围': 'Save Access',
            '没有匹配的邮箱': 'No matching mailboxes',
            '本人添加 · 始终可见': 'Added by this admin · Always visible',
            '历史数据': 'Legacy data',
            '受限管理员默认只能看到自己添加的邮箱。这里勾选的邮箱会作为额外授权；未勾选的其他管理员邮箱及其分组不会出现在邮箱管理、搜索、卡密绑定和收件日志中。': 'Restricted admins see only mailboxes they added by default. Checked mailboxes are additional grants; unchecked mailboxes from other admins and their groups are hidden from mailbox management, search, card binding, and mail logs.',
            '可为任意管理员单独启用邮箱范围限制。启用后，该管理员只能看到自己添加的邮箱，以及这里授权的邮箱分组和单个邮箱；分组中新加入的邮箱会自动继承权限。': 'Mailbox restrictions can be enabled separately for any admin. Once enabled, that admin sees only their own mailboxes plus granted groups and individual mailboxes. New mailboxes added to a granted group inherit access automatically.',
            '限制该管理员的邮箱范围': 'Restrict this admin’s mailbox access',
            '关闭时可查看全部邮箱；开启后按下方授权范围显示。': 'When off, all mailboxes are visible. When on, visibility follows the grants below.',
            '已启用限制': 'Restriction enabled',
            '未启用限制': 'Not restricted',
            '按邮箱分组授权': 'Grant by Mailbox Group',
            '授权整个分组，后续加入的邮箱自动可见': 'Grant the whole group; future mailboxes become visible automatically',
            '按单个邮箱授权': 'Grant Individual Mailboxes',
            '可与分组权限叠加': 'Can be combined with group access',
            '正在加载邮箱分组...': 'Loading mailbox groups...',
            '暂无可授权分组': 'No mailbox groups available',
            '当前未限制，可查看全部邮箱': 'Not restricted; all mailboxes are visible',
            '请选择受限管理员': 'Select a restricted admin',
            '获取邮箱范围失败': 'Failed to load mailbox access',
            '保存邮箱范围失败': 'Failed to save mailbox access',
            '邮箱可见范围已保存': 'Mailbox access saved',
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
            '输入后台邮箱地址，即刻查看最新邮件': 'Enter a configured mailbox to view the latest messages',
            '卡密 / 管理员万能秘钥': 'Card Key / Admin Master Key',
            '请输入卡密或管理员万能秘钥': 'Enter a card key or admin master key',
            '设置后的万能秘钥可免卡密取件': 'A configured master key can fetch mail without a card key',
            '邮箱查询': 'Mailbox Query',
            '查询邮箱': 'Queried Mailboxes',
            '请输入邮箱地址 (例: user@example.com)': 'Enter email address (e.g. user@example.com)',
            '请输入邮局后台已添加的邮箱地址，支持多个自动识别：user@example.com\ntest@example.com, demo@example.com': 'Enter mailbox addresses already added by the administrator. Multiple addresses are auto-detected:\nuser@example.com\ntest@example.com, demo@example.com',
            '请输入邮箱地址，支持多个邮箱自动识别：user@example.com\ntest@example.com, demo@example.com': 'Enter email addresses. Multiple addresses are auto-detected:\nuser@example.com\ntest@example.com, demo@example.com',
            '每个邮箱收取': 'Per mailbox',
            '支持换行、逗号、空格、竖线等格式，会自动识别邮箱地址；默认每个邮箱查询 10 封。': 'Supports line breaks, commas, spaces, pipes, and more. Email addresses are detected automatically. Default is 10 mails per mailbox.',
            '无需卡密或密钥，输入邮局后台已添加的邮箱即可查询；支持换行、逗号、空格、竖线分隔，默认每个邮箱查询 10 封。': 'No key is required. Enter a mailbox already added by the administrator. Line breaks, commas, spaces, and pipes are supported; the default is 10 messages per mailbox.',
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
            '（无正文）': '(No body)',

            '批量复制': 'Batch Copy',
            '批量分组': 'Batch Group',
            '管理员：': 'Admin:',
            '当前分组：': 'Current Group:',
            '邮箱：': 'Mailboxes:',
            '已选：': 'Selected:',
            '已选': 'Selected',
            '个邮箱': 'mailboxes',
            '取消选择': 'Clear Selection',
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
            '颜色主题': 'Chủ đề màu sắc',
            '暖陶橙': 'Cam đất ấm',
            '海洋蓝': 'Xanh đại dương',
            '翡翠绿': 'Xanh ngọc lục bảo',
            '紫罗兰': 'Tím violet',
            '玫瑰红': 'Đỏ hoa hồng',
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
            '邮箱范围权限': 'Quyền truy cập hộp thư',
            '管理员邮箱可见范围': 'Phạm vi hộp thư của quản trị viên',
            '受限管理员': 'Quản trị viên bị giới hạn',
            '目标管理员': 'Quản trị viên mục tiêu',
            '搜索邮箱': 'Tìm hộp thư',
            '搜索邮箱地址、操作人或备注...': 'Tìm email, người thao tác hoặc ghi chú...',
            '正在加载邮箱范围...': 'Đang tải phạm vi hộp thư...',
            '保存可见范围': 'Lưu phạm vi hiển thị',
            '没有匹配的邮箱': 'Không có hộp thư phù hợp',
            '本人添加 · 始终可见': 'Do quản trị viên này thêm · Luôn hiển thị',
            '历史数据': 'Dữ liệu cũ',
            '受限管理员默认只能看到自己添加的邮箱。这里勾选的邮箱会作为额外授权；未勾选的其他管理员邮箱及其分组不会出现在邮箱管理、搜索、卡密绑定和收件日志中。': 'Quản trị viên bị giới hạn mặc định chỉ thấy hộp thư do mình thêm. Các hộp thư được chọn là quyền bổ sung; hộp thư của quản trị viên khác và nhóm của chúng sẽ bị ẩn khỏi quản lý hộp thư, tìm kiếm, liên kết mã và nhật ký thư.',
            '可为任意管理员单独启用邮箱范围限制。启用后，该管理员只能看到自己添加的邮箱，以及这里授权的邮箱分组和单个邮箱；分组中新加入的邮箱会自动继承权限。': 'Có thể bật giới hạn hộp thư riêng cho từng quản trị viên. Khi bật, họ chỉ thấy hộp thư của mình cùng các nhóm và hộp thư riêng lẻ được cấp quyền. Hộp thư mới thêm vào nhóm được cấp quyền sẽ tự động hiển thị.',
            '限制该管理员的邮箱范围': 'Giới hạn phạm vi hộp thư của quản trị viên này',
            '关闭时可查看全部邮箱；开启后按下方授权范围显示。': 'Khi tắt sẽ thấy tất cả hộp thư; khi bật sẽ hiển thị theo quyền bên dưới.',
            '已启用限制': 'Đã bật giới hạn',
            '未启用限制': 'Chưa giới hạn',
            '按邮箱分组授权': 'Cấp quyền theo nhóm hộp thư',
            '授权整个分组，后续加入的邮箱自动可见': 'Cấp quyền cả nhóm; hộp thư thêm sau sẽ tự động hiển thị',
            '按单个邮箱授权': 'Cấp quyền từng hộp thư',
            '可与分组权限叠加': 'Có thể kết hợp với quyền theo nhóm',
            '正在加载邮箱分组...': 'Đang tải nhóm hộp thư...',
            '暂无可授权分组': 'Không có nhóm hộp thư để cấp quyền',
            '当前未限制，可查看全部邮箱': 'Chưa giới hạn; có thể xem tất cả hộp thư',
            '请选择受限管理员': 'Chọn quản trị viên bị giới hạn',
            '获取邮箱范围失败': 'Không thể tải phạm vi hộp thư',
            '保存邮箱范围失败': 'Không thể lưu phạm vi hộp thư',
            '邮箱可见范围已保存': 'Đã lưu phạm vi hộp thư',
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
            '输入后台邮箱地址，即刻查看最新邮件': 'Nhập hộp thư đã cấu hình để xem thư mới nhất',
            '卡密 / 管理员万能秘钥': 'Mã / Khóa tổng quản trị',
            '请输入卡密或管理员万能秘钥': 'Nhập mã hoặc khóa tổng quản trị',
            '设置后的万能秘钥可免卡密取件': 'Khóa tổng đã đặt có thể lấy thư không cần mã',
            '邮箱查询': 'Truy vấn hộp thư',
            '查询邮箱': 'Hộp thư đã tra cứu',
            '请输入邮箱地址 (例: user@example.com)': 'Nhập địa chỉ email (ví dụ: user@example.com)',
            '请输入邮局后台已添加的邮箱地址，支持多个自动识别：user@example.com\ntest@example.com, demo@example.com': 'Nhập địa chỉ hộp thư đã được quản trị viên thêm. Tự nhận diện nhiều địa chỉ:\nuser@example.com\ntest@example.com, demo@example.com',
            '请输入邮箱地址，支持多个邮箱自动识别：user@example.com\ntest@example.com, demo@example.com': 'Nhập địa chỉ email. Có thể tự nhận diện nhiều email:\nuser@example.com\ntest@example.com, demo@example.com',
            '每个邮箱收取': 'Mỗi hộp thư',
            '支持换行、逗号、空格、竖线等格式，会自动识别邮箱地址；默认每个邮箱查询 10 封。': 'Hỗ trợ xuống dòng, dấu phẩy, khoảng trắng, dấu gạch đứng và nhiều định dạng khác. Mặc định truy vấn 10 thư cho mỗi hộp thư.',
            '无需卡密或密钥，输入邮局后台已添加的邮箱即可查询；支持换行、逗号、空格、竖线分隔，默认每个邮箱查询 10 封。': 'Không cần mã hay khóa. Chỉ cần nhập hộp thư đã được quản trị viên thêm; hỗ trợ xuống dòng, dấu phẩy, khoảng trắng và dấu gạch dọc. Mặc định 10 thư mỗi hộp thư.',
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
            '（无正文）': '(Không có nội dung)',

            '批量复制': 'Sao chép hàng loạt',
            '批量分组': 'Phân nhóm hàng loạt',
            '管理员：': 'Quản trị:',
            '当前分组：': 'Nhóm hiện tại:',
            '邮箱：': 'Hộp thư:',
            '已选：': 'Đã chọn:',
            '已选': 'Đã chọn',
            '个邮箱': 'hộp thư',
            '取消选择': 'Bỏ chọn',
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

    // Shared by the React shell and legacy screens; add both translations together.
    const sharedMessages = {
        "管理员级别": ["Administrator level", "Cấp quản trị viên"],
        "管理员层级树": ["Administrator hierarchy", "Cây phân cấp quản trị viên"],
        "个可见账号": ["visible accounts", "tài khoản hiển thị"],
        "适应画布": ["Fit to view", "Vừa khung hình"],
        "放大": ["Zoom in", "Phóng to"],
        "缩小": ["Zoom out", "Thu nhỏ"],
        "展开下级": ["Expand children", "Mở rộng cấp dưới"],
        "收起下级": ["Collapse children", "Thu gọn cấp dưới"],
        "拖动画布 · 双指或 Ctrl + 滚轮缩放 · 点击节点查看详情": ["Drag to pan · Pinch or Ctrl + scroll to zoom · Select a node for details", "Kéo để di chuyển · Chụm hai ngón hoặc Ctrl + cuộn để thu phóng · Chọn nút để xem chi tiết"],
        "仅展示上级关系": ["Parent relationship only", "Chỉ hiển thị quan hệ cấp trên"],
        "子级管理员": ["Child administrator", "Quản trị viên cấp dưới"],
        "暂无管理员": ["No administrators", "Chưa có quản trị viên"],
        "已更新层级树": ["Hierarchy updated", "Đã cập nhật cây phân cấp"],
        "查看层级与授权规则": ["View hierarchy and permission rules", "Xem quy tắc phân cấp và phân quyền"],
        "一级管理员": ["Level 1 administrator", "Quản trị viên cấp 1"],
        "二级管理员": ["Level 2 administrator", "Quản trị viên cấp 2"],
        "三级管理员": ["Level 3 administrator", "Quản trị viên cấp 3"],
        "内置管理员": ["Built-in administrator", "Quản trị viên có sẵn"],
        "一级管理员可创建二级或三级；二级管理员可创建直属三级；三级管理员不能再创建下级。新账号默认不授予功能权限。": ["Level 1 can create level 2 or 3 accounts. Level 2 can create direct level 3 accounts. Level 3 cannot create further accounts. New accounts have no feature permissions by default.", "Cấp 1 có thể tạo tài khoản cấp 2 hoặc 3. Cấp 2 có thể tạo cấp 3 trực thuộc. Cấp 3 không thể tạo thêm cấp dưới. Tài khoản mới mặc định chưa có quyền chức năng."],
        "tjt740 为一级；lhm、pink 为内置二级，保留原有功能权限和邮箱范围，不参与普通子账号的功能授权。": ["tjt740 is level 1. lhm and pink are built-in level 2 administrators with their existing feature permissions and mailbox scopes; they are excluded from ordinary child-account permission settings.", "tjt740 là cấp 1. lhm và pink là quản trị viên cấp 2 có sẵn, giữ nguyên quyền chức năng và phạm vi hộp thư; không áp dụng cài đặt quyền của tài khoản con thông thường."],
        "三级管理员不能创建或管理下级": ["Level 3 administrators cannot create or manage child accounts.", "Quản trị viên cấp 3 không thể tạo hoặc quản lý tài khoản cấp dưới."],
        "管理员级别必须为二级或三级": ["Choose administrator level 2 or 3.", "Chọn quản trị viên cấp 2 hoặc 3."],
        "只有一级管理员可以创建二级管理员": ["Only level 1 administrators can create level 2 administrators.", "Chỉ quản trị viên cấp 1 mới có thể tạo quản trị viên cấp 2."],
        "归属上级的级别必须高于新管理员": ["The parent must have a higher administrator level than the new account.", "Quản trị viên cấp trên phải có cấp cao hơn tài khoản mới."],
        "内置管理员用户名已保留": ["Built-in administrator usernames are reserved.", "Tên đăng nhập quản trị viên có sẵn được dành riêng."],
        "归属上级（可选）": ["Parent administrator (optional)", "Quản trị viên cấp trên (không bắt buộc)"],
        "普通管理员仅能管理直属下级；最高管理员可查看全部账号。新账号默认不授予功能权限。": ["Administrators can only manage their direct reports; super administrators can view all accounts. New accounts have no feature permissions by default.", "Quản trị viên chỉ có thể quản lý cấp dưới trực tiếp; quản trị viên cao nhất có thể xem tất cả tài khoản. Tài khoản mới mặc định chưa được cấp quyền chức năng."],
        "不指定（默认归属当前管理员）": ["Default to the current administrator", "Mặc định là quản trị viên hiện tại"],
        "不选择时，新账号归属当前管理员。": ["If left blank, the new account belongs to the current administrator.", "Nếu không chọn, tài khoản mới sẽ thuộc quản trị viên hiện tại."],
        "归属上级格式错误，请重新选择": ["Invalid parent administrator. Please select again.", "Quản trị viên cấp trên không hợp lệ. Vui lòng chọn lại."],
        "只能将新管理员归属到自己名下": ["You can only create administrators under your own account.", "Bạn chỉ có thể tạo quản trị viên trực thuộc tài khoản của mình."],
        "归属上级不存在，请刷新后重新选择": ["The parent administrator no longer exists. Refresh and select again.", "Quản trị viên cấp trên không còn tồn tại. Hãy tải lại và chọn lại."],
        "请先为目标管理员的上级授予所需权限": ["Grant the required permissions to the parent administrator first.", "Trước tiên, hãy cấp các quyền cần thiết cho quản trị viên cấp trên."],
        "归属上级": ["Parent administrator", "Quản trị viên cấp trên"],
        "最高管理员": ["Super administrator", "Quản trị viên cao nhất"],
        "功能授权": ["Feature permissions", "Cấp quyền chức năng"],
        "保存功能授权": ["Save permissions", "Lưu quyền"],
        "不可管理": ["Cannot manage", "Không thể quản lý"],
        "首页统计": ["Dashboard statistics", "Thống kê trang chủ"],
        "查看全部邮箱（跨账号）": ["View all mailboxes (all accounts)", "Xem mọi hộp thư (mọi tài khoản)"],
        "代理池管理（全站）": ["Proxy management (site-wide)", "Quản lý proxy (toàn hệ thống)"],
        "卡密管理（全站）": ["Card management (site-wide)", "Quản lý mã thẻ (toàn hệ thống)"],
        "卡密日志（全站）": ["Card logs (site-wide)", "Nhật ký mã thẻ (toàn hệ thống)"],
        "系统设置（标题、服务器、轮询）": ["System settings (titles, servers, polling)", "Cài đặt hệ thống (tiêu đề, máy chủ, thăm dò)"],
        "管理直属下级及功能授权": ["Manage direct reports and their permissions", "Quản lý cấp dưới trực tiếp và quyền"],
        "授权直属下级邮箱范围": ["Grant mailbox access to direct reports", "Cấp quyền hộp thư cho cấp dưới trực tiếp"],
        "设置和使用本人万能密钥": ["Set and use own master key", "Đặt và sử dụng khóa tổng cá nhân"],
        "展示系统整体状态：邮箱账号、卡密、代理数量与自动轮询运行情况。点击功能导航卡片进入各模块。": ["Shows mailbox, key and proxy totals, plus automatic polling status. Select a navigation card to open a module.", "Hiển thị tổng số hộp thư, mã, proxy và trạng thái lấy thư tự động. Chọn thẻ điều hướng để mở chức năng."],
        "邮箱账号总数：已配置的收件邮箱数量。": ["Total mailboxes: the number of configured receiving accounts.", "Tổng số hộp thư: số tài khoản nhận thư đã cấu hình."],
        "卡密总数：已生成的卡密数量。": ["Total card keys: the number of generated keys.", "Tổng số mã: số mã đã tạo."],
        "可用代理数量：代理池中可用的代理数。": ["Available proxies: the number of usable proxies in the pool.", "Proxy khả dụng: số proxy có thể sử dụng trong nhóm."],
        "自动轮询：后台定时收件的当前状态（运行中 / 空闲 / 已暂停 / 已禁用）。": ["Automatic polling: the current scheduled mail retrieval status (running / idle / paused / disabled).", "Lấy thư tự động: trạng thái lấy thư theo lịch (đang chạy / rảnh / tạm dừng / đã tắt)."],
        "配置用于收件的邮箱账号，支持单个 / 批量添加、分组、测试连通性、手动收件与发件。": ["Configure receiving accounts individually or in bulk, organize groups, test connections, and receive or send mail manually.", "Cấu hình tài khoản nhận thư riêng lẻ hoặc hàng loạt, sắp xếp nhóm, kiểm tra kết nối, nhận và gửi thư thủ công."],
        "「添加邮箱」下拉：单个添加、批量添加、添加服务器地址。": ["The Add Mailbox menu supports individual accounts, bulk imports and server addresses.", "Menu Thêm hộp thư hỗ trợ thêm riêng lẻ, nhập hàng loạt và địa chỉ máy chủ."],
        "需填写邮箱、密码/授权码、IMAP/SMTP 服务器与端口；可选 SSL。": ["Enter the email, password or app password, and IMAP/SMTP server and port. SSL is optional.", "Nhập email, mật khẩu hoặc mã ứng dụng, máy chủ và cổng IMAP/SMTP. SSL là tùy chọn."],
        "OAuth 邮箱（如 Outlook）在备注标记「OAuth登录」，通过刷新令牌收件。": ["OAuth accounts (such as Outlook) are marked “OAuth登录” in Notes and use refresh tokens to retrieve mail.", "Tài khoản OAuth (như Outlook) được đánh dấu “OAuth登录” trong ghi chú và dùng refresh token để lấy thư."],
        "勾选多行后，底部会滑出批量操作条：批量复制、批量分组、批量删除。": ["Selecting multiple rows opens the bottom action bar for copying, grouping and deleting selected accounts.", "Chọn nhiều dòng để mở thanh thao tác bên dưới: sao chép, phân nhóm và xóa các tài khoản đã chọn."],
        "「视图」按钮可切换分组显示与自定义显示列。": ["Use the view controls to toggle groups and customize visible columns.", "Dùng điều khiển chế độ xem để bật/tắt nhóm và tùy chỉnh các cột hiển thị."],
        "编辑 / 收件 / 测试 / 删除 / 更多（备注、发件等）。": ["Edit / Receive / Test / Delete / More (notes, sending mail, etc.).", "Sửa / Nhận thư / Kiểm tra / Xóa / Thêm (ghi chú, gửi thư, v.v.)."],
        "测试：验证邮箱能否正常登录收件；状态列显示「邮箱正常 / 异常 / 未检测」。": ["Test verifies mailbox login and mail retrieval. The status column shows whether the account is healthy, has an error, or has not been tested.", "Kiểm tra xác minh đăng nhập và nhận thư. Cột trạng thái cho biết tài khoản bình thường, có lỗi hoặc chưa kiểm tra."],
        "管理 HTTP / SOCKS5 代理，用于通过代理连接邮箱服务器，降低直连被限制的风险。": ["Manage HTTP/SOCKS5 proxies for connecting to mail servers and reducing direct connection restrictions.", "Quản lý proxy HTTP/SOCKS5 để kết nối máy chủ thư và giảm hạn chế kết nối trực tiếp."],
        "支持添加 HTTP 与 SOCKS5 两类代理。": ["Both HTTP and SOCKS5 proxies are supported.", "Hỗ trợ cả proxy HTTP và SOCKS5."],
        "「开启代理」会自动选择延迟最低的代理；也可手动切换到指定代理。": ["Enable proxy automatically selects the server with the lowest latency. You can also select one manually.", "Bật proxy tự chọn máy chủ có độ trễ thấp nhất. Bạn cũng có thể chọn thủ công."],
        "密码列默认打码，点击眼睛图标显示、点击复制图标复制。": ["Passwords are masked by default. Use the eye icon to reveal them or the copy icon to copy them.", "Mật khẩu mặc định được che. Nhấn biểu tượng mắt để hiển thị hoặc biểu tượng sao chép để sao chép."],
        "当前所有邮箱共用同一个启用中的代理，是潜在的单点瓶颈（见帮助中心的轮询说明）。": ["All mailboxes currently share the active proxy, which can become a bottleneck. See the polling guide in the Help Center.", "Mọi hộp thư hiện dùng chung proxy đang bật, có thể tạo nút thắt. Xem hướng dẫn lấy thư trong Trung tâm trợ giúp."],
        "生成并管理访问卡密。卡密是前台用户查看邮件的凭证，可限制使用次数、有效期与绑定邮箱。": ["Generate and manage access keys for viewing mail, with usage limits, expiry dates and mailbox bindings.", "Tạo và quản lý mã truy cập để xem thư, với giới hạn sử dụng, thời hạn và liên kết hộp thư."],
        "单个生成或批量生成；可设置使用次数上限、有效期、收取范围（天数）与关键词过滤。": ["Generate one key or a batch. Set usage limits, expiry, mail age in days and keyword filters.", "Tạo một mã hoặc hàng loạt. Đặt giới hạn sử dụng, thời hạn, số ngày lấy thư và bộ lọc từ khóa."],
        "可将卡密绑定到一个或多个邮箱，绑定后该卡密只能查询这些邮箱。": ["Bind a key to one or more mailboxes to restrict it to those accounts.", "Liên kết mã với một hoặc nhiều hộp thư để giới hạn mã chỉ truy vấn các tài khoản đó."],
        "使用情况：已用次数 / 上限，下方为最近使用时间。": ["Usage: uses consumed / limit, with the most recent use shown below.", "Sử dụng: số lần đã dùng / giới hạn, bên dưới là lần dùng gần nhất."],
        "有效期：到期时间，留空为永久有效。": ["Validity: the expiry date; blank means no expiry.", "Thời hạn: ngày hết hạn; để trống nghĩa là không hết hạn."],
        "备注 / 过滤：备注文字与收取范围、关键词过滤。": ["Notes / Filters: notes, mail age limits and keyword filters.", "Ghi chú / Bộ lọc: ghi chú, giới hạn tuổi thư và từ khóa."],
        "删除或过期的卡密进入回收站，可恢复或彻底清理。": ["Deleted or expired keys go to the recycle bin, where they can be restored or permanently removed.", "Mã đã xóa hoặc hết hạn vào thùng rác, có thể khôi phục hoặc xóa vĩnh viễn."],
        "记录每次卡密的使用与查询：谁在什么时间用哪个卡密查询了哪个邮箱。": ["Records key use and queries: who accessed which mailbox, with which key, and when.", "Ghi lại việc dùng mã và truy vấn: ai truy cập hộp thư nào, bằng mã nào và khi nào."],
        "卡密 / 绑定邮箱 / 邮件标题 / 使用者IP / 使用时间（北京时间）。": ["Key / Bound mailbox / Mail subject / User IP / Usage time (Beijing time).", "Mã / Hộp thư liên kết / Tiêu đề thư / IP người dùng / Thời gian dùng (giờ Bắc Kinh)."],
        "action=use 表示成功取件；action=check 表示查询了卡密信息（不消耗次数）。": ["action=use means mail was retrieved successfully; action=check is a key information query and does not consume a use.", "action=use nghĩa là lấy thư thành công; action=check là truy vấn thông tin mã và không tiêu hao lượt dùng."],
        "「保留天数」设为 0 表示不清理；设为 N 表示自动删除 N 天前的卡密日志。": ["Set retention to 0 to keep all logs, or to N to automatically delete key logs older than N days.", "Đặt số ngày lưu là 0 để giữ mọi nhật ký, hoặc N để tự xóa nhật ký mã cũ hơn N ngày."],
        "查看后台自动收件的结果，并控制自动轮询的开关、间隔、日志保留与失败退避。": ["View automatic mail retrieval results and control polling, intervals, log retention and failure backoff.", "Xem kết quả lấy thư tự động và điều khiển lấy thư, khoảng cách, lưu nhật ký và tạm ngưng khi lỗi."],
        "自动轮询：后台按间隔定时收取所有启用邮箱的最新邮件。": ["Automatic polling retrieves the latest mail from all enabled mailboxes at the configured interval.", "Lấy thư tự động lấy thư mới nhất từ mọi hộp thư đang bật theo khoảng cách đã cấu hình."],
        "立即查询：手动触发一次轮询（会忽略失败退避，相当于立即重试）。": ["Query now manually starts one polling round, ignoring backoff so failed accounts are retried immediately.", "Truy vấn ngay khởi động một lượt lấy thư thủ công, bỏ qua tạm ngưng để thử lại tài khoản lỗi ngay."],
        "状态值：received 成功 / failed 失败 / processed 已处理。": ["Statuses: received / failed / processed.", "Trạng thái: received (đã nhận) / failed (thất bại) / processed (đã xử lý)."],
        "自动轮询开关：关闭后暂停定时收件，约 30 秒内生效，无需重启。": ["Turning automatic polling off pauses scheduled retrieval within about 30 seconds, without restarting.", "Tắt lấy thư tự động để tạm dừng trong khoảng 30 giây, không cần khởi động lại."],
        "间隔(秒)：两次轮询之间的等待时间，最低 30 秒。": ["Interval (seconds): the wait between polling rounds, with a minimum of 30 seconds.", "Khoảng cách (giây): thời gian chờ giữa các lượt lấy thư, tối thiểu 30 giây."],
        "日志保留(天)：0 为不清理；设为 N 自动删除 N 天前的收件日志，防止数据库膨胀。": ["Retention (days): 0 keeps all logs; N automatically deletes mail logs older than N days to limit database growth.", "Lưu nhật ký (ngày): 0 giữ tất cả; N tự xóa nhật ký nhận thư cũ hơn N ngày để hạn chế kích thước cơ sở dữ liệu."],
        "退避中 N 个：连续失败的邮箱会被暂时跳过，可展开查看并重置。": ["Accounts in backoff: repeatedly failing mailboxes are temporarily skipped. Expand the list to inspect or reset them.", "Tài khoản đang tạm ngưng: hộp thư lỗi liên tiếp bị bỏ qua tạm thời. Mở danh sách để xem hoặc đặt lại."],
        "每个邮箱每轮抓取最新 5 封、仅看最近 7 天、仅 INBOX。": ["Each round fetches the latest 5 messages per mailbox, from the last 7 days, in INBOX only.", "Mỗi lượt lấy 5 thư mới nhất mỗi hộp thư, trong 7 ngày gần nhất, chỉ từ INBOX."],
        "按「邮箱 + Message-ID」去重，避免重复记录。": ["Messages are deduplicated by mailbox and Message-ID to avoid duplicate logs.", "Loại thư trùng theo hộp thư và Message-ID để tránh nhật ký trùng."],
        "连续失败达阈值（默认 3 次）后进入指数退避（跳过 2→4→8→16 轮），成功后自动恢复。": ["After consecutive failures reach the threshold (3 by default), exponential backoff skips 2→4→8→16 rounds. Successful retrieval resets backoff.", "Khi lỗi liên tiếp đạt ngưỡng (mặc định 3), tạm ngưng theo cấp số nhân bỏ qua 2→4→8→16 lượt. Lấy thư thành công sẽ đặt lại."],
        "管理管理员账号、万能秘钥、系统与页面标题等。左侧锚点可快速跳转到各设置区块。": ["Manage admin accounts, the master key and system/page titles. Use the left navigation to jump to a settings section.", "Quản lý tài khoản quản trị, khóa chính và tiêu đề hệ thống/trang. Dùng điều hướng bên trái để đến mục cài đặt."],
        "管理员账号：修改当前管理员用户名与密码。": ["Admin account: change your username and password.", "Tài khoản quản trị: đổi tên đăng nhập và mật khẩu của bạn."],
        "后台管理员管理：新增/重置/删除其它管理员账号。": ["Manage admins: add, reset or delete other administrator accounts.", "Quản lý quản trị viên: thêm, đặt lại hoặc xóa tài khoản quản trị khác."],
        "万能秘钥：一个无需卡密即可查询任意邮箱的超级凭证，请妥善保管。": ["Master key: a credential that can query any mailbox without a card key. Keep it secure.", "Khóa chính: thông tin xác thực để truy vấn mọi hộp thư không cần mã. Hãy bảo quản an toàn."],
        "系统标题 / 页面标题：自定义站点显示名称。": ["System / Page titles: customize the names displayed on the site.", "Tiêu đề hệ thống / trang: tùy chỉnh tên hiển thị trên trang web."],
        "为什么收不到邮件？": ["Why am I not receiving mail?", "Tại sao tôi không nhận được thư?"],
        "① 邮箱配置或授权码错误——用「测试」按钮验证；② 该邮箱触发了失败退避，被暂时跳过——在收件日志页展开退避列表并重置；③ 使用了 OAuth 的邮箱刷新令牌失效；④ 代理不可用导致连接失败。": ["Possible causes: incorrect mailbox settings or app password (use Test); the mailbox is in backoff (expand and reset it in Mail Logs); an expired OAuth refresh token; or an unavailable proxy.", "Nguyên nhân có thể: sai cấu hình hoặc mã ứng dụng (dùng Kiểm tra); hộp thư đang tạm ngưng (mở và đặt lại trong Nhật ký thư); refresh token OAuth hết hạn; hoặc proxy không khả dụng."],
        "自动轮询多久收一次？": ["How often does automatic polling run?", "Lấy thư tự động chạy bao lâu một lần?"],
        "由「轮询间隔」决定，默认 300 秒（5 分钟），最低 30 秒。可在收件日志页的轮询控制面板调整，改动在当前周期结束后生效。": ["The polling interval defaults to 300 seconds (5 minutes), with a 30-second minimum. Change it in Mail Logs; it takes effect after the current round.", "Khoảng cách mặc định là 300 giây (5 phút), tối thiểu 30 giây. Đổi trong Nhật ký thư; có hiệu lực sau lượt hiện tại."],
        "卡密的使用次数怎么算？": ["How are key uses counted?", "Lượt sử dụng mã được tính thế nào?"],
        "每成功取件一次消耗一次；查询卡密信息（check）不消耗次数。次数用完后卡密变为「次数用完」状态，无法再查询。": ["Each successful retrieval consumes one use. A key information query (check) does not. Once the limit is reached, the key is exhausted and cannot query mail.", "Mỗi lần lấy thư thành công tiêu hao một lượt. Truy vấn thông tin mã (check) không tiêu hao. Khi hết lượt, mã không thể truy vấn thư."],
        "代理怎么用？": ["How do I use a proxy?", "Làm thế nào để dùng proxy?"],
        "在代理池添加 HTTP/SOCKS5 代理后点击「开启代理」，系统会自动选延迟最低的代理连接邮箱；也可手动切换。": ["Add an HTTP/SOCKS5 proxy in Proxy Pool, then enable it. The lowest latency proxy is selected automatically; you can also switch manually.", "Thêm proxy HTTP/SOCKS5 trong Nhóm proxy rồi bật. Proxy có độ trễ thấp nhất được chọn tự động; bạn cũng có thể đổi thủ công."],
        "失败退避是什么？": ["What is failure backoff?", "Tạm ngưng thử lại khi lỗi là gì?"],
        "连续失败达到阈值（默认 3 次）的邮箱会被暂时跳过 2→4→8→16 轮，避免反复空耗子进程与触发服务商限流；该邮箱一旦成功收件就自动恢复正常频率。": ["After repeated failures reach the threshold (3 by default), a mailbox skips 2→4→8→16 rounds to avoid wasted work and provider rate limits. Successful retrieval restores its normal frequency.", "Khi lỗi liên tiếp đạt ngưỡng (mặc định 3), hộp thư bỏ qua 2→4→8→16 lượt để tránh lãng phí và giới hạn nhà cung cấp. Lấy thư thành công sẽ khôi phục tần suất bình thường."],
        "收件日志越来越多怎么办？": ["How do I limit growing mail logs?", "Làm sao hạn chế nhật ký thư tăng lên?"],
        "在收件日志页把「日志保留天数」设为一个正数（如 30），系统会自动清理更早的日志。默认 0 为不清理，长期运行建议开启。": ["Set log retention in Mail Logs to a positive number, such as 30, to delete older logs automatically. The default of 0 keeps everything; enable cleanup for long-running systems.", "Đặt số ngày lưu nhật ký trong Nhật ký thư thành số dương, như 30, để tự xóa nhật ký cũ. Mặc định 0 giữ tất cả; nên bật dọn dẹp khi chạy lâu dài."],
        "页面操作": ["Page actions", "Thao tác trang"],
        "邮箱账号总数": ["Total mailboxes", "Tổng số hộp thư"],
        "卡密总数": ["Total card keys", "Tổng số mã"],
        "可用代理数量": ["Available proxies", "Proxy khả dụng"],
        "空闲": ["Idle", "Đang rảnh"],
        "功能导航": ["Navigation", "Điều hướng"],
        "使用说明": ["User guide", "Hướng dẫn sử dụng"],
        "欢迎使用邮件查看系统管理控制台，点击下方卡片进入对应模块。": ["Welcome to the mail admin console. Select a card below to open a module.", "Chào mừng đến bảng quản trị thư. Chọn thẻ bên dưới để mở chức năng."],
        "添加、编辑和删除邮箱账号配置": ["Add, edit and delete mailbox accounts", "Thêm, sửa và xóa tài khoản hộp thư"],
        "管理代理服务器配置": ["Manage proxy servers", "Quản lý máy chủ proxy"],
        "生成和管理访问卡密": ["Generate and manage access keys", "Tạo và quản lý mã truy cập"],
        "查看卡密使用记录": ["View card usage history", "Xem lịch sử sử dụng mã"],
        "查看邮件接收记录与轮询控制": ["View mail logs and polling controls", "Xem nhật ký nhận thư và điều khiển lấy thư"],
        "配置系统参数和安全选项": ["Configure system and security settings", "Cấu hình hệ thống và bảo mật"],
        "首页 · 概览": ["Home · Overview", "Trang chủ · Tổng quan"],
        "常见问题": ["Frequently asked questions", "Câu hỏi thường gặp"],
        "统计卡片": ["Statistics cards", "Thẻ thống kê"],
        "前往帮助中心查看全部说明 →": ["View all guides in the Help Center →", "Xem mọi hướng dẫn tại Trung tâm trợ giúp →"],
        "单个添加": ["Add one", "Thêm một"],
        "发送": ["Send", "Gửi"],
        "（可选，粘贴后自动填充）": ["(Optional; paste to autofill)", "(Tùy chọn; dán để tự điền)"],
        "支持 ---- / 冒号 / 竖线 / 逗号 / 分号 / Tab / 空格 / key=value / JSON / CSV 表头": ["Supports ----, colons, pipes, commas, semicolons, tabs, spaces, key=value, JSON and CSV headers", "Hỗ trợ ----, dấu hai chấm, gạch dọc, dấu phẩy, chấm phẩy, tab, khoảng trắng, key=value, JSON và tiêu đề CSV"],
        "测试邮箱": ["Test mailbox", "Kiểm tra hộp thư"],
        "批量操作": ["Batch actions", "Thao tác hàng loạt"],
        "行内操作": ["Row actions", "Thao tác trên dòng"],
        "展开分组": ["Expand groups", "Mở rộng nhóm"],
        "展开左侧分组": ["Expand the groups sidebar", "Mở thanh nhóm bên trái"],
        "清除搜索": ["Clear search", "Xóa tìm kiếm"],
        "按账号状态筛选": ["Filter by account status", "Lọc theo trạng thái tài khoản"],
        "倒序": ["Descending", "Giảm dần"],
        "新分组名，回车添加": ["New group name; press Enter to add", "Tên nhóm mới; nhấn Enter để thêm"],
        "添加HTTP代理": ["Add HTTP proxy", "Thêm proxy HTTP"],
        "添加SOCKS5代理": ["Add SOCKS5 proxy", "Thêm proxy SOCKS5"],
        "开启代理": ["Enable proxy", "Bật proxy"],
        "关闭代理": ["Disable proxy", "Tắt proxy"],
        "代理状态：": ["Proxy status:", "Trạng thái proxy:"],
        "未启用": ["Not enabled", "Chưa bật"],
        "点击\"开启代理\"按钮智能选择延迟最低的代理，或手动切换到指定代理": ["Enable the proxy to select the lowest latency server automatically, or select one manually", "Bật proxy để tự chọn máy chủ có độ trễ thấp nhất hoặc chọn thủ công"],
        "类型": ["Type", "Loại"],
        "代理名称": ["Proxy name", "Tên proxy"],
        "地址:端口": ["Address:port", "Địa chỉ:cổng"],
        "延迟": ["Latency", "Độ trễ"],
        "最后检测": ["Last tested", "Kiểm tra lần cuối"],
        "暂无代理配置": ["No proxies configured", "Chưa cấu hình proxy"],
        "代理地址 *": ["Proxy address *", "Địa chỉ proxy *"],
        "端口 *": ["Port *", "Cổng *"],
        "测试代理": ["Test proxy", "Kiểm tra proxy"],
        "代理管理": ["Proxy management", "Quản lý proxy"],
        "注意": ["Note", "Lưu ý"],
        "搜索代理名称、地址或备注...": ["Search proxy name, address or notes...", "Tìm tên, địa chỉ hoặc ghi chú proxy..."],
        "留空将默认为空字符串": ["Leave blank for an empty value", "Để trống nếu không có giá trị"],
        "可选：代理用户名": ["Optional: proxy username", "Tùy chọn: tên đăng nhập proxy"],
        "可选：代理密码": ["Optional: proxy password", "Tùy chọn: mật khẩu proxy"],
        "可选：代理备注": ["Optional: proxy notes", "Tùy chọn: ghi chú proxy"],
        "总卡密数": ["Total keys", "Tổng số mã"],
        "可用卡密": ["Available keys", "Mã khả dụng"],
        "已使用": ["Used", "Đã sử dụng"],
        "已过期": ["Expired", "Đã hết hạn"],
        "批量生成卡密": ["Generate keys in bulk", "Tạo mã hàng loạt"],
        "使用情况": ["Usage", "Tình hình sử dụng"],
        "有效期": ["Validity", "Thời hạn"],
        "备注 / 过滤": ["Notes / Filters", "Ghi chú / Bộ lọc"],
        "暂无卡密数据": ["No card keys", "Chưa có mã"],
        "使用次数限制": ["Usage limit", "Giới hạn sử dụng"],
        "收取X天内的邮件": ["Fetch mail from the last X days", "Lấy thư trong X ngày gần nhất"],
        "关键词邮件": ["Subject keywords", "Từ khóa tiêu đề"],
        "留空则不限制关键词": ["Leave blank to allow all subjects", "Để trống để không lọc tiêu đề"],
        "支持格式：数字天数（如：1、100）、天数+天字（如：1天、7天）或具体日期时间，留空则永不过期，使用北京时间": ["Enter a number of days (e.g. 1 or 100), days with 天 (e.g. 1天), or a date and time in Beijing time. Leave blank for no expiry.", "Nhập số ngày (ví dụ 1, 100), số ngày kèm 天 (ví dụ 1天) hoặc ngày giờ Bắc Kinh. Để trống để không hết hạn."],
        "生成数量": ["Number of keys", "Số lượng mã"],
        "最多一次生成100个": ["Up to 100 keys at a time", "Tối đa 100 mã mỗi lần"],
        "选择邮箱": ["Select mailboxes", "Chọn hộp thư"],
        "请选择邮箱账号": ["Select a mailbox account", "Chọn tài khoản hộp thư"],
        "绑定": ["Bind", "Liên kết"],
        "编辑卡密": ["Edit key", "Sửa mã"],
        "生成API": ["Generate API link", "Tạo liên kết API"],
        "邮箱分组": ["Mailbox groups", "Nhóm hộp thư"],
        "确定选择": ["Confirm selection", "Xác nhận lựa chọn"],
        "卡密回收站": ["Key recycle bin", "Thùng rác mã"],
        "已删除的卡密": ["Deleted keys", "Mã đã xóa"],
        "已过期的卡密": ["Expired keys", "Mã đã hết hạn"],
        "已删除的卡密 (": ["Deleted keys (", "Mã đã xóa ("],
        "已过期的卡密 (": ["Expired keys (", "Mã đã hết hạn ("],
        "批量恢复": ["Restore selected", "Khôi phục mục đã chọn"],
        "批量永久删除": ["Delete selected permanently", "Xóa vĩnh viễn mục đã chọn"],
        "删除封禁": ["Delete blocked", "Xóa tài khoản bị khóa"],
        "删除正常": ["Delete healthy", "Xóa tài khoản bình thường"],
        "删除时间": ["Deleted at", "Thời gian xóa"],
        "删除原因": ["Deletion reason", "Lý do xóa"],
        "过期原因": ["Expiry reason", "Lý do hết hạn"],
        "清空回收站": ["Empty recycle bin", "Dọn thùng rác"],
        "列表字段": ["List fields", "Các trường trong danh sách"],
        "搜索卡密...": ["Search keys...", "Tìm mã..."],
        "设置关键词后只收取标题包含关键词的邮件，多个关键词用逗号分隔": ["Fetch only messages whose subjects contain these keywords. Separate keywords with commas.", "Chỉ lấy thư có tiêu đề chứa từ khóa. Phân tách các từ khóa bằng dấu phẩy."],
        "支持格式：1、7、30、100 或 1天、7天、30天 或具体日期时间": ["Enter days: 1, 7, 30, 100; 1天, 7天, 30天; or a date and time", "Nhập số ngày: 1, 7, 30, 100; 1天, 7天, 30天; hoặc ngày giờ"],
        "卡密用途说明": ["Describe this key’s purpose", "Mô tả mục đích sử dụng mã"],
        "批量卡密用途说明": ["Describe the purpose of these keys", "Mô tả mục đích của các mã"],
        "点击选择按钮选择一个或多个邮箱": ["Use Select to choose one or more mailboxes", "Nhấn Chọn để chọn một hoặc nhiều hộp thư"],
        "搜索邮箱地址...": ["Search email addresses...", "Tìm địa chỉ email..."],
        "卡密被使用后，记录会显示在这里": ["Usage records will appear here when a key is used", "Lịch sử sẽ xuất hiện khi mã được sử dụng"],
        "字段说明": ["Field descriptions", "Mô tả trường"],
        "定期清理": ["Scheduled cleanup", "Dọn dẹp định kỳ"],
        "日志保留天数": ["Log retention days", "Số ngày lưu nhật ký"],
        "成功": ["Success", "Thành công"],
        "失败": ["Failed", "Thất bại"],
        "间隔(秒)": ["Interval (seconds)", "Khoảng cách (giây)"],
        "日志保留(天)": ["Retention (days)", "Lưu nhật ký (ngày)"],
        "退避中": ["In backoff", "Đang tạm ngưng thử lại"],
        "个 ▾": ["accounts ▾", "tài khoản ▾"],
        "未启动": ["Not started", "Chưa khởi động"],
        "下次轮询": ["Next poll", "Lần lấy thư tiếp theo"],
        "邮件自动轮询尚未启动": ["Automatic mail polling has not started", "Chưa khởi động lấy thư tự động"],
        "收件日志 · 轮询控制": ["Mail logs · Polling controls", "Nhật ký thư · Điều khiển lấy thư"],
        "日志来源": ["Log sources", "Nguồn nhật ký"],
        "轮询控制面板": ["Polling controls", "Điều khiển lấy thư"],
        "轮询机制": ["How polling works", "Cách lấy thư định kỳ hoạt động"],
        "按收件状态筛选：成功/失败/已处理": ["Filter mail status: received / failed / processed", "Lọc trạng thái: đã nhận / thất bại / đã xử lý"],
        "关闭后自动轮询暂停，约30秒内生效，无需重启": ["Turning this off pauses polling within about 30 seconds, without restarting", "Tắt để dừng lấy thư trong khoảng 30 giây, không cần khởi động lại"],
        "账号设置": ["Account settings", "Cài đặt tài khoản"],
        "管理员管理": ["Manage administrators", "Quản lý quản trị viên"],
        "系统标题": ["System title", "Tiêu đề hệ thống"],
        "页面标题": ["Page titles", "Tiêu đề trang"],
        "管理员账号设置": ["Admin account settings", "Cài đặt tài khoản quản trị"],
        "管理员用户名": ["Admin username", "Tên đăng nhập quản trị"],
        "管理员密码": ["Admin password", "Mật khẩu quản trị"],
        "确认密码": ["Confirm password", "Xác nhận mật khẩu"],
        "更新管理员账号": ["Update admin account", "Cập nhật tài khoản quản trị"],
        "后台管理员管理": ["Manage admin accounts", "Quản lý tài khoản quản trị"],
        "创建时间": ["Created at", "Thời gian tạo"],
        "当前登录": ["Signed in", "Đang đăng nhập"],
        "当前账号": ["Current account", "Tài khoản hiện tại"],
        "重置账号": ["Reset account", "Đặt lại tài khoản"],
        "新密码": ["New password", "Mật khẩu mới"],
        "确认新密码": ["Confirm new password", "Xác nhận mật khẩu mới"],
        "保存新密码": ["Save new password", "Lưu mật khẩu mới"],
        "新管理员用户名": ["New admin username", "Tên đăng nhập quản trị mới"],
        "新管理员密码": ["New admin password", "Mật khẩu quản trị mới"],
        "确认新管理员密码": ["Confirm new admin password", "Xác nhận mật khẩu quản trị mới"],
        "保存后只存储安全哈希，不会回显明文；请以右侧状态为准。": ["Only a secure hash is stored after saving. The plain text will not be shown; check the status on the right.", "Sau khi lưu chỉ giữ mã băm an toàn, không hiển thị văn bản gốc. Xem trạng thái bên phải."],
        "当前状态": ["Current status", "Trạng thái hiện tại"],
        "设置万能秘钥": ["Set master key", "Đặt khóa chính"],
        "系统名称/标题": ["System name / title", "Tên / tiêu đề hệ thống"],
        "显示在后端管理页面标题中的系统名称，修改后即时生效": ["System name shown in admin page titles; changes apply immediately", "Tên hệ thống trong tiêu đề trang quản trị; thay đổi có hiệu lực ngay"],
        "更新系统标题": ["Update system title", "Cập nhật tiêu đề hệ thống"],
        "API取件页面标题": ["API mail page title", "Tiêu đề trang lấy thư API"],
        "显示在API取件页面的标题": ["Title shown on the API mail page", "Tiêu đề hiển thị trên trang lấy thư API"],
        "前端取件页面标题": ["Public mail page title", "Tiêu đề trang lấy thư công khai"],
        "显示在前端取件页面的标题": ["Title shown on the public mail page", "Tiêu đề hiển thị trên trang lấy thư công khai"],
        "管理员登录页面标题": ["Admin login page title", "Tiêu đề trang đăng nhập quản trị"],
        "显示在管理员登录页面的标题": ["Title shown on the admin login page", "Tiêu đề hiển thị trên trang đăng nhập quản trị"],
        "更新页面标题": ["Update page titles", "Cập nhật tiêu đề trang"],
        "系统名称": ["System name", "Tên hệ thống"],
        "系统版本": ["System version", "Phiên bản hệ thống"],
        "数据库类型": ["Database type", "Loại cơ sở dữ liệu"],
        "设置项": ["Settings", "Cài đặt"],
        "系统设置栏目": ["System settings sections", "Các mục cài đặt hệ thống"],
        "输入新的管理员用户名": ["Enter the new admin username", "Nhập tên đăng nhập quản trị mới"],
        "输入新的管理员密码": ["Enter the new admin password", "Nhập mật khẩu quản trị mới"],
        "再次输入密码确认": ["Enter the password again", "Nhập lại mật khẩu"],
        "至少4位": ["At least 4 characters", "Ít nhất 4 ký tự"],
        "输入新管理员用户名": ["Enter a new admin username", "Nhập tên đăng nhập quản trị mới"],
        "至少6位，设置后可免卡密取件": ["At least 6 characters; fetch mail without a card key after setup", "Ít nhất 6 ký tự; sau khi đặt có thể lấy thư không cần mã"],
        "显示或隐藏万能秘钥": ["Show or hide master key", "Hiện hoặc ẩn khóa chính"],
        "📖 帮助中心": ["📖 Help Center", "📖 Trung tâm trợ giúp"],
        "这里汇总了各功能模块的使用说明、字段释义与常见问题。每个后台页面右上角也有「使用说明」按钮可随时查看。": ["Find module guides, field descriptions and frequently asked questions here. The User guide button on each admin page also opens contextual help.", "Xem hướng dẫn chức năng, mô tả trường và câu hỏi thường gặp tại đây. Nút Hướng dẫn sử dụng trên mỗi trang quản trị cũng mở trợ giúp tương ứng."],
        "定时触发": ["Scheduled trigger", "Kích hoạt theo lịch"],
        "遍历启用邮箱": ["Visit enabled mailboxes", "Duyệt hộp thư đang bật"],
        "跳过退避中的邮箱": ["Skip mailboxes in backoff", "Bỏ qua hộp thư đang tạm ngưng"],
        "IMAP 收取最新邮件": ["Fetch latest mail via IMAP", "Lấy thư mới nhất qua IMAP"],
        "去重写入日志": ["Deduplicate and save logs", "Loại trùng và lưu nhật ký"],
        "失败则退避/成功则恢复": ["Back off on failure; resume on success", "Tạm ngưng khi lỗi; tiếp tục khi thành công"],
        '帮助中心': ['Help Center', 'Trung tâm trợ giúp'],
        '后台管理': ['Admin Console', 'Bảng quản trị'],
        '后台页面': ['Admin Page', 'Trang quản trị'],
        '退出': ['Log Out', 'Đăng xuất'],
        '用户名或密码错误': ['Incorrect username or password', 'Tên đăng nhập hoặc mật khẩu không đúng'],
        '页面加载中': ['Loading page', 'Đang tải trang'],
        '页面加载时间较长，请重试': ['This page is taking longer to load. Please retry.', 'Trang tải lâu hơn dự kiến. Vui lòng thử lại.'],
        '重试': ['Retry', 'Thử lại'],
        '关闭菜单': ['Close menu', 'Đóng menu'],
        '邮件文件夹': ['Mail folders', 'Thư mục thư'],
        '邮箱切换': ['Switch mailbox', 'Chuyển hộp thư'],
        '正在获取邮件，请稍候': ['Fetching mail, please wait', 'Đang lấy thư, vui lòng chờ'],
        '全部状态': ['All statuses', 'Tất cả trạng thái'],
        '账号状态': ['Account status', 'Trạng thái tài khoản'],
        '未检测': ['Not tested', 'Chưa kiểm tra'],
        '尚未检测': ['Not tested yet', 'Chưa được kiểm tra'],
        '正常': ['Healthy', 'Bình thường'],
        '封禁': ['Blocked', 'Bị khóa'],
        '凭据失效': ['Invalid credentials', 'Thông tin xác thực không hợp lệ'],
        '网络异常': ['Network error', 'Lỗi mạng'],
        '检测异常': ['Test error', 'Lỗi kiểm tra'],
        '当前为保存前的测试结果。': ['This test was run before saving.', 'Đây là kết quả kiểm tra trước khi lưu.'],
        '测试请求未返回账号状态': ['The test did not return an account status', 'Kiểm tra không trả về trạng thái tài khoản'],
        '未获得有效检测结果，已保存的账号状态未更改。': ['No valid test result was received. The saved account status is unchanged.', 'Không nhận được kết quả hợp lệ. Trạng thái tài khoản đã lưu không thay đổi.'],
        '最后修改时间': ['Last modified', 'Sửa đổi lần cuối'],
        '操作人': ['Operator', 'Người thao tác'],
        '（无主题）': ['(No subject)', '(Không có tiêu đề)'],
        '时间:': ['Time:', 'Thời gian:'],
        '发件人:': ['From:', 'Người gửi:'],
        '收件人:': ['To:', 'Người nhận:']
    };
    Object.entries(sharedMessages).forEach(([key, values]) => {
        dictionary.en[key] = values[0];
        dictionary.vi[key] = values[1];
    });

    const originalText = new WeakMap();
    const originalAttrs = new WeakMap();
    let currentLang = getInitialLanguage();
    let observer = null;
    let isApplying = false;
    let languageRevision = 0;

    function getParentI18n() {
        try {
            return window.parent !== window ? window.parent.AppI18n : null;
        } catch { return null; }
    }

    function getSavedLanguage() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return null;
        }
    }

    function getInitialLanguage() {
        const saved = getSavedLanguage();
        if (SUPPORTED_LANGS.includes(saved)) return saved;
        const parent = getParentI18n();
        if (parent) return parent.language;
        const browserLanguages = navigator.languages || [navigator.language || ''];
        for (const locale of browserLanguages) {
            const language = locale.toLowerCase().split('-')[0];
            if (SUPPORTED_LANGS.includes(language)) return language;
        }
        return 'en';
    }

    async function detectLanguageFromIp() {
        // A manual language choice always wins. Without one, ask the server for
        // an IP-country recommendation on every page load so travel/VPN changes
        // are reflected automatically.
        if (getParentI18n() || SUPPORTED_LANGS.includes(getSavedLanguage())) return;
        const revision = languageRevision;
        try {
            const response = await fetch('/api/language', {
                method: 'GET',
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) return;
            const data = await response.json();
            if (!data.success || !SUPPORTED_LANGS.includes(data.language)) return;
            if (revision !== languageRevision || SUPPORTED_LANGS.includes(getSavedLanguage())) return;
            setLanguage(data.language, { persist: false });
        } catch (error) {
            // Keep the browser language when IP detection is unavailable.
        }
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
        // Preserve status symbols, but localize the status itself.
        let match = text.match(/^([○✅❌⚠️]+\s*)(.+)$/u);
        if (match) return match[1] + translateWithRules(match[2], lang);
        match = text.match(/^(删除封禁|删除正常|批量恢复|批量永久删除)\s*\((\d+)\)$/);
        if (match) return `${translateExact(match[1], lang)} (${match[2]})`;
        match = text.match(/^已选择\s*(\d+)\s*个邮箱(.*)$/);
        if (match) return lang === 'vi' ? `Đã chọn ${match[1]} hộp thư${match[2]}` : `Selected ${match[1]} mailboxes${match[2]}`;
        match = text.match(/^(.+) · 使用说明$/);
        if (match) return `${translateExact(match[1], lang)} · ${translateExact('使用说明', lang)}`;
        match = text.match(/^例:\s*(.+)$/);
        if (match) return `${lang === 'vi' ? 'Ví dụ' : 'e.g.'}: ${match[1].replace('QQ邮箱', 'QQ Mail')}`;
        if (text.startsWith('例如：user@outlook.com----password----client_id----refresh_token')) {
            return lang === 'vi' ? 'Ví dụ: user@outlook.com----password----client_id----refresh_token; cũng hỗ trợ key=value, JSON hoặc các trường trên nhiều dòng'
                : 'e.g. user@outlook.com----password----client_id----refresh_token; key=value, JSON and multiline fields are also supported';
        }
        if (text.startsWith('每行一个邮箱，也支持 JSON 数组、CSV/TSV 表头和分行字段：')) {
            const examples = text.split('\n').slice(1, -1).join('\n');
            return lang === 'vi'
                ? `Mỗi dòng một hộp thư; cũng hỗ trợ mảng JSON, tiêu đề CSV/TSV và các trường trên nhiều dòng:\n${examples}\nHỗ trợ dấu phẩy, chấm phẩy, gạch dọc, dấu hai chấm, tab, khoảng trắng, JSON và key=value`
                : `One mailbox per line; JSON arrays, CSV/TSV headers and multiline fields are also supported:\n${examples}\nSupports commas, semicolons, pipes, colons, tabs, spaces, JSON and key=value`;
        }
        match = text.match(/^(\d+)\s*封$/);
        if (match) return lang === 'vi' ? `${match[1]} thư` : `${match[1]} ${match[1] === '1' ? 'message' : 'messages'}`;
        match = text.match(/^邮件正文：(.+)$/);
        if (match) return `${translateExact('邮件正文', lang)}: ${match[1]}`;
        match = text.match(/^颜色主题\s*[:：]\s*(.+)$/);
        if (match) {
            return `${translateExact('颜色主题', lang)}: ${translateExact(match[1], lang)}`;
        }
        match = text.match(/^欢迎，\s*(.+)$/);
        if (match) {
            return lang === 'vi' ? `Xin chào, ${match[1]}` : `Welcome, ${match[1]}`;
        }

        match = text.match(/^操作人：\s*(.+)$/);
        if (match) {
            const operator = match[1] === '历史数据'
                ? (lang === 'vi' ? 'Dữ liệu cũ' : 'Legacy data')
                : match[1];
            return lang === 'vi' ? `Người thao tác: ${operator}` : `Operator: ${operator}`;
        }

        match = text.match(/^(\d+)\s*个邮箱\s*·\s*操作人：\s*(.+)$/);
        if (match) {
            const operator = match[2] === '历史数据'
                ? (lang === 'vi' ? 'Dữ liệu cũ' : 'Legacy data')
                : match[2];
            return lang === 'vi'
                ? `${match[1]} hộp thư · Người thao tác: ${operator}`
                : `${match[1]} mailboxes · Operator: ${operator}`;
        }

        match = text.match(/^(.+)\s*·\s*(已限制|未限制)$/);
        if (match) {
            const state = match[2] === '已限制'
                ? (lang === 'vi' ? 'Đã giới hạn' : 'Restricted')
                : (lang === 'vi' ? 'Chưa giới hạn' : 'Unrestricted');
            return `${match[1]} · ${state}`;
        }

        match = text.match(/^本人邮箱\s*(\d+)\s*个，授权分组\s*(\d+)\s*个，单邮箱授权\s*(\d+)\s*个$/);
        if (match) {
            return lang === 'vi'
                ? `Hộp thư riêng ${match[1]}, nhóm được cấp ${match[2]}, hộp thư được cấp riêng ${match[3]}`
                : `Own mailboxes ${match[1]}, granted groups ${match[2]}, individual grants ${match[3]}`;
        }

        match = text.match(/^本人邮箱\s*(\d+)\s*个，额外授权\s*(\d+)\s*个$/);
        if (match) {
            return lang === 'vi'
                ? `Hộp thư riêng ${match[1]}, cấp thêm ${match[2]}`
                : `Own mailboxes ${match[1]}, additional grants ${match[2]}`;
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

        if (text.includes('\n')) return text.split('\n').map((line) => translateWithRules(line, lang)).join('\n');
        return t[text] || text;
    }

    function shouldSkipNode(node) {
        const parent = node.parentElement;
        if (!parent) return true;
        return !!parent.closest(SKIP_SELECTOR + ', textarea, [data-i18n-date], [data-i18n-number]');
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
        const next = `${leading}${translated}${trailing}`;
        if (value !== next) node.nodeValue = next;
    }

    function getOriginalAttrStore(element) {
        if (!originalAttrs.has(element)) {
            originalAttrs.set(element, {});
        }
        return originalAttrs.get(element);
    }

    function shouldTranslateValue(element) {
        if (element.tagName !== 'INPUT') return false;
        const type = (element.getAttribute('type') || 'text').toLowerCase();
        return ['button', 'submit', 'reset'].includes(type);
    }

    function translateAttributes(element) {
        if (element.closest(SKIP_SELECTOR)) return;
        if (element.hasAttribute('data-i18n-date')) {
            const next = formatDate(element.dataset.i18nDate);
            if (element.textContent !== next) element.textContent = next;
        }
        if (element.hasAttribute('data-i18n-number')) {
            const next = formatNumber(element.dataset.i18nNumber);
            if (element.textContent !== next) element.textContent = next;
        }
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
            const next = translateWithRules(store[attr].trim(), currentLang);
            if (value !== next) element.setAttribute(attr, next);
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
            if (root.closest(SKIP_SELECTOR)) return;
            translateAttributes(root);
        }

        const treeWalker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches(SKIP_SELECTOR)) {
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
            document.documentElement.lang = LOCALES[currentLang];
            if (!reactManaged) {
                translateTitle();
                walk(document.body);
                syncSwitcher();
            }
        } finally {
            if (observer) {
                startObserver();
            }
            isApplying = false;
        }
    }

    function syncSwitcher() {
        const wrapper = document.getElementById('i18nLanguageSwitcher');
        const trigger = document.getElementById('i18nLanguageButton');
        if (wrapper) wrapper.dataset.language = currentLang;
        if (trigger) {
            trigger.setAttribute(
                'aria-label',
                `${translateWithRules('语言', currentLang)}: ${LANG_LABELS[currentLang]}`
            );
        }
        document.querySelectorAll('.i18n-language-option').forEach((option) => {
            const active = option.dataset.language === currentLang;
            option.classList.toggle('is-active', active);
            option.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function setLanguageMenuOpen(open, focusOption = false) {
        const wrapper = document.getElementById('i18nLanguageSwitcher');
        const trigger = document.getElementById('i18nLanguageButton');
        const menu = document.getElementById('i18nLanguageMenu');
        if (!wrapper || !trigger || !menu) return;

        wrapper.classList.toggle('is-open', open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;

        if (open && focusOption) {
            const activeOption = menu.querySelector('.i18n-language-option.is-active');
            const firstOption = menu.querySelector('.i18n-language-option');
            (activeOption || firstOption)?.focus();
        }
    }

    function createSwitcher() {
        if (document.getElementById('i18nLanguageSwitcher')) return;

        const headerUserInfo = document.querySelector('.header-actions .user-info');
        const headerActions = headerUserInfo ? headerUserInfo.parentElement : null;
        const wrapper = document.createElement('div');
        wrapper.className = headerActions
            ? 'i18n-switcher i18n-switcher--header i18n-switcher--icon i18n-switcher--custom'
            : 'i18n-switcher i18n-switcher--icon i18n-switcher--custom';
        wrapper.id = 'i18nLanguageSwitcher';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'i18n-language-trigger';
        trigger.id = 'i18nLanguageButton';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', 'i18nLanguageMenu');
        trigger.setAttribute('title', '语言');
        trigger.innerHTML = '<span class="i18n-switcher-icon" aria-hidden="true"><svg viewBox="0 0 1024 1024"><use href="#ai-global"></use></svg></span>';

        const menu = document.createElement('div');
        menu.className = 'i18n-language-menu';
        menu.id = 'i18nLanguageMenu';
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', '语言');
        menu.hidden = true;

        SUPPORTED_LANGS.forEach((lang) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'i18n-language-option';
            option.dataset.language = lang;
            option.setAttribute('role', 'option');

            const mark = document.createElement('span');
            mark.className = 'i18n-language-mark';
            mark.setAttribute('aria-hidden', 'true');
            mark.textContent = LANG_MARKS[lang];

            const name = document.createElement('span');
            name.className = 'i18n-language-name';
            name.textContent = LANG_LABELS[lang];

            const check = document.createElement('span');
            check.className = 'i18n-language-check';
            check.setAttribute('aria-hidden', 'true');
            check.innerHTML = '<svg viewBox="0 0 1024 1024"><use href="#ai-check"></use></svg>';

            option.append(mark, name, check);
            option.addEventListener('click', () => {
                setLanguageMenuOpen(false);
                setLanguage(lang);
                trigger.focus();
            });
            menu.appendChild(option);
        });

        trigger.addEventListener('click', () => {
            setLanguageMenuOpen(menu.hidden, false);
        });
        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setLanguageMenuOpen(true, true);
            }
        });
        menu.addEventListener('keydown', (event) => {
            const options = Array.from(menu.querySelectorAll('.i18n-language-option'));
            const currentIndex = options.indexOf(document.activeElement);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
            if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = options.length - 1;
            if (event.key === 'Escape') {
                event.preventDefault();
                setLanguageMenuOpen(false);
                trigger.focus();
                return;
            }
            if (nextIndex !== currentIndex && nextIndex >= 0) {
                event.preventDefault();
                options[nextIndex].focus();
            }
        });

        wrapper.append(trigger, menu);
        if (headerActions) {
            headerActions.insertBefore(wrapper, headerUserInfo);
        } else {
            document.body.appendChild(wrapper);
        }

        document.addEventListener('click', (event) => {
            if (!wrapper.contains(event.target)) {
                setLanguageMenuOpen(false);
            }
        });
    }

    function startObserver() {
        if (!observer) return;
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['placeholder', 'title', 'aria-label', 'alt', 'value', 'data-label', 'data-i18n-date', 'data-i18n-number']
        });
    }

    function observeChanges() {
        if (observer) observer.disconnect();
        let queued = false;
        const roots = new Set();
        observer = new MutationObserver((mutations) => {
            if (isApplying) return;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => roots.add(node));
                }
                if (mutation.type === 'characterData') {
                    const node = mutation.target;
                    originalText.set(node, node.nodeValue);
                    roots.add(node);
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
                    roots.add(element);
                }
            });
            if (roots.size && !queued) {
                queued = true;
                // Batch dynamic rows/toasts once, without walking the entire page.
                queueMicrotask(() => {
                    queued = false;
                    observer.disconnect();
                    try {
                        roots.forEach((node) => { if (node.isConnected) walk(node); });
                        roots.clear();
                    } finally { startObserver(); }
                });
            }
        });
        startObserver();
    }

    function setLanguage(lang, { persist = true, sync = true } = {}) {
        if (!SUPPORTED_LANGS.includes(lang)) return;
        languageRevision++;
        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* In-memory sync still works. */ }
        }
        const changed = currentLang !== lang;
        currentLang = lang;
        if (changed) {
            applyLanguage();
            window.dispatchEvent(new CustomEvent('app-language-change', { detail: { language: lang } }));
        }
        if (sync) {
            const parent = getParentI18n();
            if (parent) parent.setLanguage(lang, { persist: false });
            document.querySelectorAll('iframe.legacy-frame').forEach((frame) => {
                try { frame.contentWindow.AppI18n?.setLanguage(lang, { persist: false, sync: false }); } catch { /* Cross-origin frame. */ }
            });
        }
    }

    function formatNumber(value, options = {}) {
        const number = Number(value);
        return Number.isFinite(number) ? new Intl.NumberFormat(LOCALES[currentLang], options).format(number) : String(value);
    }

    function formatDate(value, options = {}) {
        if (!value) return '-';
        // Database timestamps without offsets are stored in Beijing time.
        let normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
        if (typeof normalized === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) normalized += '+08:00';
        const date = new Date(normalized);
        if (!Number.isFinite(date.getTime())) return String(value);
        return new Intl.DateTimeFormat(LOCALES[currentLang], {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
            timeZone: 'Asia/Shanghai', ...options
        }).format(date);
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

    function observeExternalLanguageChanges() {
        window.addEventListener('storage', (event) => {
            if (event.key !== STORAGE_KEY || !SUPPORTED_LANGS.includes(event.newValue)) return;
            if (event.newValue === currentLang) return;
            setLanguage(event.newValue, { persist: false });
        });
    }

    window.AppI18n = {
        get language() {
            return currentLang;
        },
        setLanguage,
        t(text, lang = currentLang) {
            return translateWithRules(String(text), SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG);
        },
        get locale() { return LOCALES[currentLang]; },
        languages: SUPPORTED_LANGS.map((key) => ({ key, name: LANG_LABELS[key], mark: LANG_MARKS[key] })),
        formatNumber,
        formatDate
    };

    function init() {
        patchDialogs();
        applyLanguage();
        if (!reactManaged) {
            createSwitcher();
            applyLanguage();
            observeChanges();
        }
        observeExternalLanguageChanges();
        detectLanguageFromIp();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
